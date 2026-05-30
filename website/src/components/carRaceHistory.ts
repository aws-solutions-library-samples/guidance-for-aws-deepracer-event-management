import { GetTrackTypeNameFromId } from '../admin/events/support-functions/raceConfig';

export interface CarRaceHistoryLap {
  lapId?: string;
  time?: number | null;
  resets?: number | null;
  isValid?: boolean | null;
}

export interface CarRaceHistoryRace {
  raceId?: string;
  eventId?: string;
  trackId?: string;
  createdAt?: string;
  laps?: CarRaceHistoryLap[];
}

export interface CarRaceHistoryActivation {
  managedInstanceId?: string;
  carName?: string;
  from?: string;
  to?: string | null;
  raceCount?: number;
  lapCount?: number;
  races?: CarRaceHistoryRace[];
}

export interface CarRaceHistorySummary {
  totalRaces?: number;
  totalLaps?: number;
  totalValidLaps?: number;
  bestLapTime?: number | null;
}

export interface CarRaceHistory {
  chassisSerial?: string;
  summary?: CarRaceHistorySummary;
  activations?: CarRaceHistoryActivation[];
}

export interface RaceHistoryRow {
  key: string;
  hostName: string;
  eventName: string;
  trackName: string;
  createdAt: string;
  lapTime: number | null;
  isValid: boolean;
}

type EventsById = Record<string, { eventName?: string } | undefined>;

/**
 * Flatten the getCarRaceHistory response into one row per lap, resolving the
 * event name (from the events store) and track name (from the shared track
 * util), sorted most-recent first. Pure — no network, fully unit-testable.
 */
export function flattenRaceHistory(
  data: CarRaceHistory | null | undefined,
  eventsById: EventsById
): RaceHistoryRow[] {
  const rows: RaceHistoryRow[] = [];
  for (const act of data?.activations ?? []) {
    for (const race of act.races ?? []) {
      const eventName = eventsById[race.eventId ?? '']?.eventName || race.eventId || '-';
      const trackName = GetTrackTypeNameFromId(race.trackId) || race.trackId || '-';
      for (const lap of race.laps ?? []) {
        rows.push({
          key: `${race.raceId ?? '?'}-${lap.lapId ?? '?'}`,
          hostName: act.carName || '-',
          eventName,
          trackName,
          createdAt: race.createdAt || '',
          lapTime: lap.time ?? null,
          isValid: Boolean(lap.isValid),
        });
      }
    }
  }
  rows.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  return rows;
}
