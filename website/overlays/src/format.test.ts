import { describe, test, expect } from 'vitest';
import { GetFormattedLapTime, GetFormattedTotalTime, GetLeaderboardDataSorted } from './format';

describe('GetFormattedLapTime', () => {
  test('sub-minute time without showMinutes returns SS.mmm', () => {
    expect(GetFormattedLapTime(8324)).toBe('08.324');
  });

  test('sub-minute time with showMinutes returns 00:SS.mmm', () => {
    expect(GetFormattedLapTime(8324, true)).toBe('00:08.324');
  });

  test('multi-minute time with showMinutes returns MM:SS.mmm', () => {
    expect(GetFormattedLapTime(71234, true)).toBe('01:11.234');
  });

  test('sentinel 999999999 returns 00.000', () => {
    expect(GetFormattedLapTime(999999999)).toBe('00.000');
  });
});

describe('GetFormattedTotalTime', () => {
  test('positive remaining time returns MM:SS.t', () => {
    expect(GetFormattedTotalTime(125400)).toBe('02:05.4');
  });

  test('zero remaining time returns 00:00.0', () => {
    expect(GetFormattedTotalTime(0)).toBe('00:00.0');
  });

  test('negative remaining time returns 00:00.0', () => {
    expect(GetFormattedTotalTime(-1)).toBe('00:00.0');
  });
});

describe('GetLeaderboardDataSorted', () => {
  test('fastest format sorts by fastestLapTime ascending', () => {
    const entries = [
      { username: 'b', fastestLapTime: 9000 },
      { username: 'a', fastestLapTime: 8000 },
      { username: 'c', fastestLapTime: 10000 },
    ];
    const sorted = GetLeaderboardDataSorted(entries, 'fastest');
    expect(sorted.map((e) => e.username)).toEqual(['a', 'b', 'c']);
  });

  test('average format sorts by fastestAverageLap.avgTime, missing values go last', () => {
    const entries = [
      { username: 'a', fastestAverageLap: { avgTime: 9000 } },
      { username: 'b', fastestAverageLap: null },
      { username: 'c', fastestAverageLap: { avgTime: 8000 } },
    ];
    const sorted = GetLeaderboardDataSorted(entries, 'average');
    expect(sorted.map((e) => e.username)).toEqual(['c', 'a', 'b']);
  });
});
