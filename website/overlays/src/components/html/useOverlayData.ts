import { useEffect, useState } from 'react';
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
          setCurrentRacer({
            username: info.username,
            timeLeftMs: info.timeLeftInMs ?? INITIAL_TIME_MS,
            fastestLapMs: fastest,
            lastLapMs: last,
          });
          setShowLowerThird(true);
          setShowLeaderboard(false);
        }
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
