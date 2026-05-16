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
}

export interface OverlayData {
  leaderboardEntries: LeaderboardEntry[];
  eventName: string;
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

function pickFastest(laps: Array<{ time: number; isValid: boolean }> | undefined): number | null {
  if (!laps) return null;
  const valid = laps.filter((l) => l.isValid);
  if (valid.length === 0) return null;
  return valid.reduce((min, lap) => (lap.time < min ? lap.time : min), Number.POSITIVE_INFINITY);
}

function pickLast(laps: Array<{ lapId: number; time: number; isValid: boolean }> | undefined): number | null {
  if (!laps) return null;
  const valid = laps.filter((l) => l.isValid);
  if (valid.length === 0) return null;
  return valid.reduce((latest, lap) => (lap.lapId > latest.lapId ? lap : latest), valid[0]).time;
}

function pickFastestAvg(
  avgLaps: Array<{ avgTime: number; startLapId: number; endLapId: number }> | undefined,
): number | null {
  if (!avgLaps || avgLaps.length === 0) return null;
  return avgLaps.reduce((min, lap) => (lap.avgTime < min ? lap.avgTime : min), Number.POSITIVE_INFINITY);
}

export function useOverlayData({ eventId, trackId, raceFormat }: UseOverlayDataArgs): OverlayData {
  const [leaderboardEntries, setLeaderboardEntries] = useState<LeaderboardEntry[]>([]);
  const [eventName, setEventName] = useState<string>('');
  const [showLeaderboard, setShowLeaderboard] = useState<boolean>(false);
  const [showLowerThird, setShowLowerThird] = useState<boolean>(false);
  const [currentRacer, setCurrentRacer] = useState<CurrentRacer | null>(null);
  const [raceStatus, setRaceStatus] = useState<string | null>(null);

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
        client.graphql({ query: queries.getLeaderboard, variables: { eventId, trackId } }) as Promise<{
          data: { getLeaderboard: { config?: { leaderBoardTitle: string }; entries: LeaderboardEntry[] } };
        }>
      ).then((response) => {
        setLeaderboardEntries(response.data.getLeaderboard.entries ?? []);
        if (applyConfig && response.data.getLeaderboard.config) {
          setEventName(response.data.getLeaderboard.config.leaderBoardTitle.toUpperCase());
        }
      });
    }

    fetchLeaderboard(true).then(() => {
      setShowLeaderboard(true);
    });

    const overlaySub = (
      client.graphql({ query: subscriptions.onNewOverlayInfo, variables: { eventId, trackId } }) as {
        subscribe: (handlers: { next: (msg: any) => void; error?: (err: any) => void }) => { unsubscribe: () => void };
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

        const finished = info.raceStatus === 'RACE_FINSIHED';
        const noCompetitor = 'competitor' in info && info.competitor === null;

        if (finished || noCompetitor) {
          setShowLowerThird(false);
          setShowLeaderboard(true);
          setCurrentRacer(null);
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
              shouldResyncTimer || !prev
                ? info.timeLeftInMs ?? INITIAL_TIME_MS
                : prev.timeLeftMs,
            fastestLapMs: fastest,
            lastLapMs: last,
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
      client.graphql({ query: subscriptions.onNewLeaderboardEntry, variables: { eventId, trackId } }) as {
        subscribe: (handlers: { next: () => void; error?: (err: any) => void }) => { unsubscribe: () => void };
      }
    ).subscribe({
      next: () => {
        fetchLeaderboard(false);
      },
      error: (err) => console.error('onNewLeaderboardEntry error', err),
    });

    const deleteEntrySub = (
      client.graphql({ query: subscriptions.onDeleteLeaderboardEntry, variables: { eventId, trackId } }) as {
        subscribe: (handlers: { next: () => void; error?: (err: any) => void }) => { unsubscribe: () => void };
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
    };
  }, [eventId, trackId, raceFormat]);

  return { leaderboardEntries, eventName, showLeaderboard, showLowerThird, currentRacer };
}
