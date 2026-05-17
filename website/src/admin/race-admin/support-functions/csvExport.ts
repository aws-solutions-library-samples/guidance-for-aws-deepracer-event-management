/**
 * CSV export utility for race data.
 * Produces one row per lap with race-level fields repeated.
 */

interface RaceForExport {
  raceId: string;
  userId: string;
  username?: string;
  trackId: string;
  racedByProxy?: boolean;
  createdAt?: string;
  laps?: Array<{
    lapId: string;
    time: number;
    resets: number;
    isValid: boolean;
  }>;
}

const CSV_HEADERS = [
  'Race ID',
  'Username',
  'User ID',
  'Track',
  'Raced By Proxy',
  'Race Date',
  'Lap #',
  'Lap Time (ms)',
  'Lap Time (s)',
  'Resets',
  'Valid',
];

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function racesToCSV(races: RaceForExport[], eventName?: string): string {
  const rows: string[] = [];

  // Header
  rows.push(CSV_HEADERS.join(','));

  for (const race of races) {
    const laps = race.laps || [];
    if (laps.length === 0) {
      // Race with no laps — still include a row
      rows.push([
        race.raceId,
        escapeCSV(race.username || race.userId),
        race.userId,
        race.trackId,
        String(race.racedByProxy || false),
        race.createdAt || '',
        '',
        '',
        '',
        '',
        '',
      ].join(','));
    } else {
      for (const lap of laps) {
        rows.push([
          race.raceId,
          escapeCSV(race.username || race.userId),
          race.userId,
          race.trackId,
          String(race.racedByProxy || false),
          race.createdAt || '',
          String(Number(lap.lapId) + 1),
          String(lap.time),
          (lap.time / 1000).toFixed(3),
          String(lap.resets),
          String(lap.isValid),
        ].join(','));
      }
    }
  }

  return rows.join('\n');
}

const SUMMARY_HEADERS = [
  'Username',
  'User ID',
  'Track',
  'Races',
  'Total Laps',
  'Valid Laps',
  'Invalid Laps',
  'Fastest Lap (ms)',
  'Fastest Lap (s)',
  'Avg Lap (ms)',
  'Avg Lap (s)',
  'Total Resets',
  'Completion Ratio (%)',
];

export function racesToSummaryCSV(races: RaceForExport[]): string {
  // Group by userId + trackId
  const grouped: Record<string, { races: RaceForExport[]; username: string; trackId: string; userId: string }> = {};
  for (const race of races) {
    const key = `${race.userId}#${race.trackId}`;
    if (!grouped[key]) {
      grouped[key] = {
        races: [],
        username: race.username || race.userId,
        trackId: race.trackId,
        userId: race.userId,
      };
    }
    grouped[key].races.push(race);
  }

  const rows: string[] = [SUMMARY_HEADERS.join(',')];

  for (const group of Object.values(grouped)) {
    const allLaps = group.races.flatMap((r) => r.laps || []);
    const validLaps = allLaps.filter((l) => l.isValid);
    const invalidLaps = allLaps.length - validLaps.length;
    const validTimes = validLaps.map((l) => l.time);
    const totalResets = allLaps.reduce((sum, l) => sum + (l.resets || 0), 0);
    const fastest = validTimes.length > 0 ? Math.min(...validTimes) : '';
    const avg = validTimes.length > 0 ? validTimes.reduce((a, b) => a + b, 0) / validTimes.length : '';
    const completionRatio = allLaps.length > 0 ? ((validLaps.length / allLaps.length) * 100).toFixed(1) : '';

    rows.push([
      escapeCSV(group.username),
      group.userId,
      group.trackId,
      String(group.races.length),
      String(allLaps.length),
      String(validLaps.length),
      String(invalidLaps),
      String(fastest),
      typeof fastest === 'number' ? (fastest / 1000).toFixed(3) : '',
      typeof avg === 'number' ? avg.toFixed(1) : '',
      typeof avg === 'number' ? (avg / 1000).toFixed(3) : '',
      String(totalResets),
      String(completionRatio),
    ].join(','));
  }

  return rows.join('\n');
}

export function downloadCSV(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
