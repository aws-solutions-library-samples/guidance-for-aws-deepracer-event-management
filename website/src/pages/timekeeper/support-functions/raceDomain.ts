interface Lap {
  lapId: string | null;
  time: number;
  resets: number;
  isValid: boolean;
  autTimerConnected: boolean;
  carName: string;
}

interface AverageLap {
  startLapId: number;
  endLapId: number;
  avgTime: number;
}

export interface Race {
  eventId: string | null;
  userId: string | null;
  username: string | null;
  countryCode?: string;
  laps: Lap[];
  averageLaps: AverageLap[];
  trackId: number;
  racedByProxy: boolean;
}

interface Car {
  ComputerName: string;
}

export const defaultRace: Race = {
  eventId: null,
  userId: null,
  username: null,
  laps: [],
  averageLaps: [],
  trackId: 1,
  racedByProxy: false,
};

export const defaultLap: Lap = {
  lapId: null,
  time: 0,
  resets: 0,
  isValid: false,
  autTimerConnected: false,
  carName: '',
};

export const defaultCar: Car = {
  ComputerName: 'Default',
};

export function extractUserAttribute(
  attributes: Array<{ Name: string; Value: string }> | undefined,
  name: string
): string | undefined {
  if (!attributes) return undefined;
  return attributes.find((a) => a.Name === name)?.Value;
}

/**
 * Build the timekeeper's race config from the selected event.
 *
 * Always returns a NEW object — never the event's stored `raceConfig`
 * reference — so callers can't accidentally mutate shared store state (the
 * old `raceDetails['eventName'] = …` writes leaked the event name back onto
 * the store event). Tolerates an event with no `raceConfig`, returning just
 * the event name rather than crashing. See issue #267.
 */
export function buildRaceConfigFromEvent(
  selectedEvent: { raceConfig?: Record<string, any> | null; eventName?: string } | null | undefined
): Record<string, any> {
  return { ...(selectedEvent?.raceConfig ?? {}), eventName: selectedEvent?.eventName };
}
