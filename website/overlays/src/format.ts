export interface AverageLap {
  avgTime: number;
  startLapId?: number;
  endLapId?: number;
}

/** Subset of the RacerProfile join exposed on getLeaderboard.entries.profile. */
export interface RacerProfileLite {
  username?: string;
  avatarConfig?: string | null;
  highlightColour?: string | null;
}

export interface LeaderboardEntry {
  username: string;
  fastestLapTime?: number | null;
  fastestAverageLap?: AverageLap | null;
  countryCode?: string | null;
  profile?: RacerProfileLite | null;
}

export function PadZero(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function PadZeroMS(n: number | string): string {
  const num = typeof n === 'string' ? Number(n) : n;
  if (num < 10) return `00${num}`;
  if (num < 100) return `0${num}`;
  return String(num);
}

export function GetFormattedLapTime(timeInMS: number, showMinutes = false): string {
  if (timeInMS === 999999999) return '00.000';

  if (showMinutes) {
    const min = Math.floor(timeInMS / 1000 / 60);
    const sec = Math.floor(timeInMS / 1000) - min * 60;
    const ms = String(timeInMS - (min * 60 * 1000 + sec * 1000));
    return `${PadZero(min)}:${PadZero(sec)}.${PadZeroMS(ms).slice(0, 3)}`;
  }

  const sec = Math.floor(timeInMS / 1000);
  const ms = String(timeInMS - sec * 1000);
  return `${PadZero(sec)}.${PadZeroMS(ms).slice(0, 3)}`;
}

export function GetFormattedTotalTime(timeInMS: number): string {
  if (timeInMS < 0) return '00:00.0';
  const min = Math.floor(timeInMS / 1000 / 60);
  const sec = Math.floor(timeInMS / 1000 - min * 60);
  const ms = timeInMS - (min * 60 * 1000 + sec * 1000);
  return `${PadZero(min)}:${PadZero(sec)}.${String(ms).slice(0, 1)}`;
}

export function GetLeaderboardDataSorted<T extends LeaderboardEntry>(
  entries: T[],
  raceFormat: string
): T[] {
  const sorted = [...entries];
  if (raceFormat === 'average') {
    sorted.sort((a, b) => {
      if (!a.fastestAverageLap && !b.fastestAverageLap) return 0;
      if (!a.fastestAverageLap) return 1;
      if (!b.fastestAverageLap) return -1;
      return a.fastestAverageLap.avgTime - b.fastestAverageLap.avgTime;
    });
  } else {
    sorted.sort((a, b) => {
      const aTime = a.fastestLapTime ?? Infinity;
      const bTime = b.fastestLapTime ?? Infinity;
      return aTime - bTime;
    });
  }
  return sorted;
}
