import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const mockSubscribers: Array<{ query: any; next: (msg: any) => void }> = [];

vi.mock('aws-amplify/api', () => ({
  generateClient: () => ({
    graphql: (op: { query: any; variables?: any }) => {
      if (typeof op.query === 'object' && op.query.subscription === true) {
        return {
          subscribe: ({ next }: { next: (msg: any) => void }) => {
            mockSubscribers.push({ query: op.query, next });
            return { unsubscribe: () => {} };
          },
        };
      }
      // Initial getLeaderboard query.
      return Promise.resolve({
        data: {
          getLeaderboard: {
            config: { leaderBoardTitle: 'fake event' },
            entries: [{ username: 'a', fastestLapTime: 1000 }],
          },
        },
      });
    },
  }),
}));

vi.mock('../../graphql/queries.js', () => ({
  getLeaderboard: { name: 'getLeaderboard' },
}));

vi.mock('../../graphql/subscriptions.js', () => ({
  onNewOverlayInfo: { subscription: true, name: 'onNewOverlayInfo' },
  onNewLeaderboardEntry: { subscription: true, name: 'onNewLeaderboardEntry' },
  onDeleteLeaderboardEntry: { subscription: true, name: 'onDeleteLeaderboardEntry' },
}));

beforeEach(() => {
  mockSubscribers.length = 0;
});

// Import after mocks are set up.
import { useOverlayData } from './useOverlayData';

describe('useOverlayData', () => {
  test('loads initial leaderboard entries and event name on mount', async () => {
    const { result } = renderHook(() => useOverlayData({ eventId: 'e1', trackId: '1', raceFormat: 'fastest' }));
    await waitFor(() => {
      expect(result.current.leaderboardEntries).toEqual([{ username: 'a', fastestLapTime: 1000 }]);
      expect(result.current.eventName).toBe('FAKE EVENT');
    });
  });

  test('shows leaderboard initially, hides lower thirds', async () => {
    const { result } = renderHook(() => useOverlayData({ eventId: 'e1', trackId: '1', raceFormat: 'fastest' }));
    await waitFor(() => expect(result.current.showLeaderboard).toBe(true));
    expect(result.current.showLowerThird).toBe(false);
    expect(result.current.currentRacer).toBeNull();
  });

  test('on RACE_IN_PROGRESS message: hides leaderboard, shows lower third with racer info', async () => {
    const { result } = renderHook(() => useOverlayData({ eventId: 'e1', trackId: '1', raceFormat: 'fastest' }));
    await waitFor(() => expect(result.current.leaderboardEntries.length).toBe(1));

    const overlaySub = mockSubscribers.find((s) => s.query.name === 'onNewOverlayInfo')!;
    act(() => {
      overlaySub.next({
        data: {
          onNewOverlayInfo: {
            username: 'racer1',
            timeLeftInMs: 120000,
            raceStatus: 'RACE_IN_PROGRESS',
            laps: [{ lapId: 1, time: 8500, isValid: true }],
          },
        },
      });
    });

    await waitFor(() => {
      expect(result.current.showLeaderboard).toBe(false);
      expect(result.current.showLowerThird).toBe(true);
      expect(result.current.currentRacer?.username).toBe('racer1');
      expect(result.current.currentRacer?.fastestLapMs).toBe(8500);
    });
  });

  test('on RACE_FINSIHED message: hides lower third and shows leaderboard again', async () => {
    const { result } = renderHook(() => useOverlayData({ eventId: 'e1', trackId: '1', raceFormat: 'fastest' }));
    await waitFor(() => expect(result.current.leaderboardEntries.length).toBe(1));

    const overlaySub = mockSubscribers.find((s) => s.query.name === 'onNewOverlayInfo')!;
    act(() => {
      overlaySub.next({
        data: {
          onNewOverlayInfo: { username: 'racer1', timeLeftInMs: 120000, raceStatus: 'RACE_IN_PROGRESS', laps: [] },
        },
      });
    });
    await waitFor(() => expect(result.current.showLowerThird).toBe(true));

    act(() => {
      overlaySub.next({
        data: {
          onNewOverlayInfo: { username: 'racer1', timeLeftInMs: 0, raceStatus: 'RACE_FINSIHED', laps: [] },
        },
      });
    });

    await waitFor(() => {
      expect(result.current.showLowerThird).toBe(false);
      expect(result.current.showLeaderboard).toBe(true);
    });
  });

  test('on competitor=null message: same effect as race finished', async () => {
    const { result } = renderHook(() => useOverlayData({ eventId: 'e1', trackId: '1', raceFormat: 'fastest' }));
    await waitFor(() => expect(result.current.leaderboardEntries.length).toBe(1));

    const overlaySub = mockSubscribers.find((s) => s.query.name === 'onNewOverlayInfo')!;
    act(() => {
      overlaySub.next({
        data: {
          onNewOverlayInfo: { competitor: null, raceStatus: 'NO_RACER_SELECTED' },
        },
      });
    });

    await waitFor(() => {
      expect(result.current.showLowerThird).toBe(false);
      expect(result.current.showLeaderboard).toBe(true);
    });
  });
});
