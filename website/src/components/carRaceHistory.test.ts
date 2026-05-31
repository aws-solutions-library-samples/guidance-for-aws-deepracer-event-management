import { describe, it, expect, vi } from 'vitest';

vi.mock('../admin/events/support-functions/raceConfig', () => ({
  GetTrackTypeNameFromId: (id?: string | null) => (id === '1' ? 'reInvent 2018' : undefined),
}));

import { flattenRaceHistory } from './carRaceHistory';

const data = {
  chassisSerial: 'AMSS-9QCJ',
  summary: { totalRaces: 2, totalLaps: 3, totalValidLaps: 2, bestLapTime: 11.0 },
  activations: [
    {
      carName: 'LGW02',
      managedInstanceId: 'mi-2',
      races: [
        {
          raceId: 'r2',
          eventId: 'e2',
          trackId: '2',
          createdAt: '2026-03-10T00:00:00Z',
          laps: [{ lapId: 'l3', time: 11.0, resets: 0, isValid: true }],
        },
      ],
    },
    {
      carName: 'LGW01',
      managedInstanceId: 'mi-1',
      races: [
        {
          raceId: 'r1',
          eventId: 'e1',
          trackId: '1',
          createdAt: '2026-01-10T00:00:00Z',
          laps: [
            { lapId: 'l1', time: 12.5, resets: 1, isValid: true },
            { lapId: 'l2', time: 99.9, resets: 3, isValid: false },
          ],
        },
      ],
    },
  ],
};

const eventsById = { e1: { eventName: 'London GP' } }; // e2 deliberately absent

describe('flattenRaceHistory', () => {
  it('flattens laps across hostnames, resolves names, sorts newest first', () => {
    const rows = flattenRaceHistory(data as any, eventsById);
    expect(rows).toHaveLength(3);
    // newest race (LGW02, March) first
    expect(rows[0].hostName).toBe('LGW02');
    expect(rows[0].eventName).toBe('e2'); // falls back to eventId when not in store
    expect(rows[0].trackName).toBe('2'); // GetTrackTypeNameFromId undefined -> trackId
    const lgw01 = rows.filter((r) => r.hostName === 'LGW01');
    expect(lgw01[0].eventName).toBe('London GP'); // resolved from store
    expect(lgw01[0].trackName).toBe('reInvent 2018'); // resolved from util
    expect(lgw01.some((r) => r.isValid === false)).toBe(true);
  });

  it('returns [] for null data', () => {
    expect(flattenRaceHistory(null, {})).toEqual([]);
  });

  it('preserves a 0 lap time and falls back to "-" for missing event/host', () => {
    const partial = {
      activations: [
        {
          // no carName -> hostName should fall back to "-"
          managedInstanceId: 'mi-x',
          races: [
            {
              // no eventId, no trackId -> both should fall back to "-"
              raceId: 'r9',
              createdAt: '2026-04-01T00:00:00Z',
              laps: [{ lapId: 'l9', time: 0, resets: 0, isValid: true }],
            },
          ],
        },
      ],
    };
    const rows = flattenRaceHistory(partial as any, {});
    expect(rows).toHaveLength(1);
    expect(rows[0].lapTime).toBe(0); // 0 is a real value, not coerced to null
    expect(rows[0].hostName).toBe('-');
    expect(rows[0].eventName).toBe('-');
    expect(rows[0].trackName).toBe('-');
  });
});
