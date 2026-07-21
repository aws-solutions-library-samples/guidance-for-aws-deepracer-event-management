import { useEffect, useRef, useState } from 'react';
import { generateClient } from 'aws-amplify/api';
import * as queries from '../../graphql/queries.js';
import * as subscriptions from '../../graphql/subscriptions.js';
import type { LeaderboardEntry } from '../../format';

export interface UseOverlayDataArgs {
  eventId: string;
  trackId: string;
  raceFormat: string;
}

export interface CurrentRacer {
  username: string;
  timeLeftMs: number;
  fastestLapMs: number | null;
  lastLapMs: number | null;
  avatarConfig: string | null;
  countryCode: string | null;
  highlightColour: string | null;
}

export interface OverlayData {
  leaderboardEntries: LeaderboardEntry[];
  /** Track title from `leaderBoardConfig.leaderBoardTitle` (e.g. "LONDON"). */
  eventName: string;
  /**
   * Operator-configured footer text from `leaderBoardConfig.leaderBoardFooter`
   * — typically the race / event name, used as the bottom-right brand on the
   * leaderboard panel. Empty string if unset.
   */
  raceName: string;
  /**
   * Fastest lap time across all racers in this event (the leader's time).
   * Used by the lower-third to colour the current racer's times: matching
   * or beating this is "fastest of event" (purple). `null` when there are
   * no leaderboard entries yet.
   */
  eventBestLapMs: number | null;
  /**
   * Username of the racer who most recently finished — set from the
   * `onNewLeaderboardEntry` subscription (same trigger the public
   * leaderboard uses for its own highlight) and held for
   * `HIGHLIGHT_HOLD_MS`. The leaderboard panel uses this to highlight the
   * just-finished racer's row and slide a 4-wide window centred on them
   * when they fall outside the top-4.
   */
  highlightedUsername: string | null;
  showLeaderboard: boolean;
  showLowerThird: boolean;
  currentRacer: CurrentRacer | null;
}

const INITIAL_TIME_MS = 180000;
// Local timer cadence — match the leaderboard's RaceOverlayInfo at 30 FPS.
// Higher than the legacy 10 FPS so the tenths-of-a-second digit looks
// smooth, and tied to wall-clock delta rather than fixed -100ms so the
// timer self-corrects if setInterval skews under load.
const TIMER_TICK_MS = 1000 / 30;
// How long to keep the just-finished racer highlighted on the leaderboard
// (also gates the row-swap when they didn't make the visible top-4). The
// visual pulse fades inside the first 12s; the row stays put for the rest
// of this window before reverting to the natural top-4 ordering.
const HIGHLIGHT_HOLD_MS = 30_000;

function pickFastest(laps: Array<{ time: number; isValid: boolean }> | undefined): number | null {
  if (!laps) return null;
  const valid = laps.filter((l) => l.isValid);
  if (valid.length === 0) return null;
  return valid.reduce((min, lap) => (lap.time < min ? lap.time : min), Number.POSITIVE_INFINITY);
}

function pickLast(
  laps: Array<{ lapId: number; time: number; isValid: boolean }> | undefined
): number | null {
  if (!laps) return null;
  const valid = laps.filter((l) => l.isValid);
  if (valid.length === 0) return null;
  return valid.reduce((latest, lap) => (lap.lapId > latest.lapId ? lap : latest), valid[0]).time;
}

function pickFastestAvg(
  avgLaps: Array<{ avgTime: number; startLapId: number; endLapId: number }> | undefined
): number | null {
  if (!avgLaps || avgLaps.length === 0) return null;
  return avgLaps.reduce(
    (min, lap) => (lap.avgTime < min ? lap.avgTime : min),
    Number.POSITIVE_INFINITY
  );
}

export function useOverlayData({ eventId, trackId, raceFormat }: UseOverlayDataArgs): OverlayData {
  const [leaderboardEntries, setLeaderboardEntries] = useState<LeaderboardEntry[]>([]);
  const [eventName, setEventName] = useState<string>('');
  const [raceName, setRaceName] = useState<string>('');
  const [showLeaderboard, setShowLeaderboard] = useState<boolean>(false);
  const [showLowerThird, setShowLowerThird] = useState<boolean>(false);
  const [currentRacer, setCurrentRacer] = useState<CurrentRacer | null>(null);
  const [raceStatus, setRaceStatus] = useState<string | null>(null);
  const [highlightedUsername, setHighlightedUsername] = useState<string | null>(null);

  // Track the last raceStatus + username we saw on an overlay-info message so
  // we can decide whether each new message represents a state TRANSITION
  // (timer needs to resync to the server's authoritative value) versus a
  // mid-race update (timer should keep ticking locally and only the lap data
  // is interesting). Without this, every server message that arrives during
  // a race overwrites our local `timeLeftMs` with a slightly stale value
  // from the message, causing a visible stutter / jump-up between local
  // ticks.
  const prevStatusRef = useRef<string | null>(null);
  const prevUsernameRef = useRef<string | null>(null);
  // Last wall-clock timestamp the local ticker ran. Used to compute actual
  // elapsed time per tick rather than assuming a fixed delta — same pattern
  // as `RaceOverlayInfo` in the public leaderboard.
  const lastTickRef = useRef<number>(0);
  // setTimeout handle for clearing `highlightedUsername` after the hold
  // window expires. Held in a ref so it survives re-renders but can be
  // cancelled cleanly when the next race finishes (replacing the highlight)
  // or when the subscription effect tears down.
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasRacer = currentRacer != null;
  const timeHasRunOut = currentRacer != null && currentRacer.timeLeftMs <= 0;

  useEffect(() => {
    if (raceStatus !== 'RACE_IN_PROGRESS') return;
    if (!hasRacer || timeHasRunOut) return;

    lastTickRef.current = Date.now();
    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = now - lastTickRef.current;
      lastTickRef.current = now;
      setCurrentRacer((prev) => {
        if (!prev || prev.timeLeftMs <= 0) return prev;
        return { ...prev, timeLeftMs: Math.max(0, prev.timeLeftMs - elapsed) };
      });
    }, TIMER_TICK_MS);

    return () => clearInterval(interval);
  }, [raceStatus, hasRacer, timeHasRunOut]);

  useEffect(() => {
    const client = generateClient();

    function fetchLeaderboard(applyConfig: boolean) {
      return (
        client.graphql({
          query: queries.getLeaderboard,
          variables: { eventId, trackId },
        }) as Promise<{
          data: {
            getLeaderboard: {
              config?: { leaderBoardTitle: string; leaderBoardFooter?: string };
              entries: LeaderboardEntry[];
            };
          };
        }>
      ).then((response) => {
        setLeaderboardEntries(response.data.getLeaderboard.entries ?? []);
        if (applyConfig && response.data.getLeaderboard.config) {
          setEventName(response.data.getLeaderboard.config.leaderBoardTitle.toUpperCase());
          setRaceName((response.data.getLeaderboard.config.leaderBoardFooter ?? '').toUpperCase());
        }
      });
    }

    fetchLeaderboard(true).then(() => {
      setShowLeaderboard(true);
    });

    const overlaySub = (
      client.graphql({
        query: subscriptions.onNewOverlayInfo,
        variables: { eventId, trackId },
      }) as {
        subscribe: (handlers: { next: (msg: any) => void; error?: (err: any) => void }) => {
          unsubscribe: () => void;
        };
      }
    ).subscribe({
      next: ({ data }) => {
        const info = data?.onNewOverlayInfo;
        if (!info) return;

        if (info.eventName) {
          setEventName(info.eventName);
        }

        setRaceStatus(info.raceStatus ?? null);

        if (info.raceStatus === 'RACE_SUBMITTED') {
          return;
        }

        const finished = info.raceStatus === 'RACE_FINISHED';
        const noCompetitor = 'competitor' in info && info.competitor === null;

        if (finished || noCompetitor) {
          setShowLowerThird(false);
          setShowLeaderboard(true);
          setCurrentRacer(null);
          prevStatusRef.current = info.raceStatus ?? null;
          prevUsernameRef.current = info.username ?? prevUsernameRef.current;
          return;
        }

        if (info.username) {
          const fastest =
            raceFormat === 'average' ? pickFastestAvg(info.averageLaps) : pickFastest(info.laps);
          const last = pickLast(info.laps);

          // The server's `timeLeftInMs` is what the timer was when this
          // message was emitted — by the time we receive it, it's a few
          // hundred ms stale. Adopting it on every message overwrites the
          // local ticker and produces a visible stutter (jump-up between
          // ticks). Resync only on transitions: a new racer, a status
          // change, or no prior local value.
          const isTransition = prevStatusRef.current !== info.raceStatus;
          const isDifferentRacer = prevUsernameRef.current !== info.username;
          const shouldResyncTimer = isTransition || isDifferentRacer;

          setCurrentRacer((prev) => ({
            username: info.username,
            timeLeftMs:
              shouldResyncTimer || !prev ? (info.timeLeftInMs ?? INITIAL_TIME_MS) : prev.timeLeftMs,
            fastestLapMs: fastest,
            lastLapMs: last,
            avatarConfig: info.profile?.avatarConfig ?? null,
            countryCode: info.countryCode ?? null,
            highlightColour: info.profile?.highlightColour ?? null,
          }));
          setShowLowerThird(true);
          setShowLeaderboard(false);
        }

        prevStatusRef.current = info.raceStatus ?? null;
        prevUsernameRef.current = info.username ?? null;
      },
      error: (err) => console.error('onNewOverlayInfo error', err),
    });

    const newEntrySub = (
      client.graphql({
        query: subscriptions.onNewLeaderboardEntry,
        variables: { eventId, trackId },
      }) as {
        subscribe: (handlers: { next: (msg: any) => void; error?: (err: any) => void }) => {
          unsubscribe: () => void;
        };
      }
    ).subscribe({
      next: ({ data }) => {
        // Same trigger the public leaderboard uses for its own highlight —
        // a new entry arriving is the authoritative "this racer just
        // finished their race" signal, far more reliable than guessing
        // from overlay-info status transitions.
        const newEntry = data?.onNewLeaderboardEntry;
        if (newEntry?.username) {
          setHighlightedUsername(newEntry.username);
          if (highlightTimerRef.current) {
            clearTimeout(highlightTimerRef.current);
          }
          highlightTimerRef.current = setTimeout(() => {
            setHighlightedUsername(null);
            highlightTimerRef.current = null;
          }, HIGHLIGHT_HOLD_MS);
        }
        fetchLeaderboard(false);
      },
      error: (err) => console.error('onNewLeaderboardEntry error', err),
    });

    const deleteEntrySub = (
      client.graphql({
        query: subscriptions.onDeleteLeaderboardEntry,
        variables: { eventId, trackId },
      }) as {
        subscribe: (handlers: { next: () => void; error?: (err: any) => void }) => {
          unsubscribe: () => void;
        };
      }
    ).subscribe({
      next: () => {
        fetchLeaderboard(false);
      },
      error: (err) => console.error('onDeleteLeaderboardEntry error', err),
    });

    return () => {
      overlaySub.unsubscribe();
      newEntrySub.unsubscribe();
      deleteEntrySub.unsubscribe();
      if (highlightTimerRef.current) {
        clearTimeout(highlightTimerRef.current);
        highlightTimerRef.current = null;
      }
    };
  }, [eventId, trackId, raceFormat]);

  // Event-wide best lap time — the minimum `fastestLapTime` across all
  // leaderboard entries. Used by the lower-third to decide whether a
  // racer's lap is the fastest of the event (purple) or just their own
  // best (green).
  const eventBestLapMs = leaderboardEntries.reduce<number | null>((min, e) => {
    const t = e.fastestLapTime;
    if (t == null || t <= 0) return min;
    return min == null || t < min ? t : min;
  }, null);

  return {
    leaderboardEntries,
    eventName,
    raceName,
    eventBestLapMs,
    highlightedUsername,
    showLeaderboard,
    showLowerThird,
    currentRacer,
  };
}
