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
    const { result } = renderHook(() =>
      useOverlayData({ eventId: 'e1', trackId: '1', raceFormat: 'fastest' })
    );
    await waitFor(() => {
      expect(result.current.leaderboardEntries).toEqual([{ username: 'a', fastestLapTime: 1000 }]);
      expect(result.current.eventName).toBe('FAKE EVENT');
    });
  });

  test('shows leaderboard initially, hides lower thirds', async () => {
    const { result } = renderHook(() =>
      useOverlayData({ eventId: 'e1', trackId: '1', raceFormat: 'fastest' })
    );
    await waitFor(() => expect(result.current.showLeaderboard).toBe(true));
    expect(result.current.showLowerThird).toBe(false);
    expect(result.current.currentRacer).toBeNull();
  });

  test('on RACE_IN_PROGRESS message: hides leaderboard, shows lower third with racer info', async () => {
    const { result } = renderHook(() =>
      useOverlayData({ eventId: 'e1', trackId: '1', raceFormat: 'fastest' })
    );
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

  test('on RACE_FINISHED message: hides lower third and shows leaderboard again', async () => {
    const { result } = renderHook(() =>
      useOverlayData({ eventId: 'e1', trackId: '1', raceFormat: 'fastest' })
    );
    await waitFor(() => expect(result.current.leaderboardEntries.length).toBe(1));

    const overlaySub = mockSubscribers.find((s) => s.query.name === 'onNewOverlayInfo')!;
    act(() => {
      overlaySub.next({
        data: {
          onNewOverlayInfo: {
            username: 'racer1',
            timeLeftInMs: 120000,
            raceStatus: 'RACE_IN_PROGRESS',
            laps: [],
          },
        },
      });
    });
    await waitFor(() => expect(result.current.showLowerThird).toBe(true));

    act(() => {
      overlaySub.next({
        data: {
          onNewOverlayInfo: {
            username: 'racer1',
            timeLeftInMs: 0,
            raceStatus: 'RACE_FINISHED',
            laps: [],
          },
        },
      });
    });

    await waitFor(() => {
      expect(result.current.showLowerThird).toBe(false);
      expect(result.current.showLeaderboard).toBe(true);
    });
  });

  test('on competitor=null message: same effect as race finished', async () => {
    const { result } = renderHook(() =>
      useOverlayData({ eventId: 'e1', trackId: '1', raceFormat: 'fastest' })
    );
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

  test('local timer ticks down over time when race is running', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const { result } = renderHook(() =>
        useOverlayData({ eventId: 'e1', trackId: '1', raceFormat: 'fastest' })
      );
      await vi.waitFor(() => expect(result.current.leaderboardEntries.length).toBe(1));

      const overlaySub = mockSubscribers.find((s) => s.query.name === 'onNewOverlayInfo')!;
      act(() => {
        overlaySub.next({
          data: {
            onNewOverlayInfo: {
              username: 'racer1',
              timeLeftInMs: 10000,
              raceStatus: 'RACE_IN_PROGRESS',
              laps: [],
            },
          },
        });
      });
      await vi.waitFor(() => expect(result.current.currentRacer?.timeLeftMs).toBe(10000));

      // Advance 500ms — timer ticks at 30 FPS with wall-clock delta, so the
      // exact value depends on how many ticks fired (~15) and at what offset
      // the last one landed. Allow a small tolerance.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(500);
      });
      const after500 = result.current.currentRacer?.timeLeftMs ?? 0;
      expect(after500).toBeGreaterThanOrEqual(9450);
      expect(after500).toBeLessThanOrEqual(9550);

      // Advance another 1000ms — about 1500ms total elapsed
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
      const after1500 = result.current.currentRacer?.timeLeftMs ?? 0;
      expect(after1500).toBeGreaterThanOrEqual(8450);
      expect(after1500).toBeLessThanOrEqual(8550);
    } finally {
      vi.useRealTimers();
    }
  });

  test('mid-race messages do NOT jump the timer back up (no stutter)', async () => {
    // Regression guard: server messages arriving during a race carry a
    // slightly stale `timeLeftInMs` (it's what the timer was when the message
    // was emitted, plus network delay). Adopting that value on every message
    // produced a visible stutter — the timer would tick down then jump back
    // up. After the fix, mid-race messages should leave the local timer
    // alone and only update lap data.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const { result } = renderHook(() =>
        useOverlayData({ eventId: 'e1', trackId: '1', raceFormat: 'fastest' })
      );
      await vi.waitFor(() => expect(result.current.leaderboardEntries.length).toBe(1));

      const overlaySub = mockSubscribers.find((s) => s.query.name === 'onNewOverlayInfo')!;
      // First message — initial state transition into RACE_IN_PROGRESS.
      act(() => {
        overlaySub.next({
          data: {
            onNewOverlayInfo: {
              username: 'racer1',
              timeLeftInMs: 10000,
              raceStatus: 'RACE_IN_PROGRESS',
              laps: [],
            },
          },
        });
      });
      await vi.waitFor(() => expect(result.current.currentRacer?.timeLeftMs).toBe(10000));

      // Let the timer run for 300ms locally.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(300);
      });
      const before = result.current.currentRacer?.timeLeftMs ?? 0;
      expect(before).toBeLessThan(10000); // confirm it actually ticked

      // A new in-progress message arrives carrying the original (stale)
      // `timeLeftInMs: 10000` along with new lap data. The fix should NOT
      // adopt that timer value — it should keep the local 300-ms-elapsed
      // value and only update lap data.
      act(() => {
        overlaySub.next({
          data: {
            onNewOverlayInfo: {
              username: 'racer1',
              timeLeftInMs: 10000, // stale
              raceStatus: 'RACE_IN_PROGRESS',
              laps: [{ lapId: 1, time: 5500, isValid: true }],
            },
          },
        });
      });
      // Lap data picked up
      await vi.waitFor(() => expect(result.current.currentRacer?.fastestLapMs).toBe(5500));
      // Timer NOT bumped back to 10000 — should be at or below `before`
      // (might tick on slightly between the message and our assert, but
      // must not exceed `before` by more than a small jitter).
      const after = result.current.currentRacer?.timeLeftMs ?? 0;
      expect(after).toBeLessThanOrEqual(before + 50);
    } finally {
      vi.useRealTimers();
    }
  });

  test('status transition (paused → running) DOES resync the timer', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const { result } = renderHook(() =>
        useOverlayData({ eventId: 'e1', trackId: '1', raceFormat: 'fastest' })
      );
      await vi.waitFor(() => expect(result.current.leaderboardEntries.length).toBe(1));

      const overlaySub = mockSubscribers.find((s) => s.query.name === 'onNewOverlayInfo')!;
      // Paused at 10000.
      act(() => {
        overlaySub.next({
          data: {
            onNewOverlayInfo: {
              username: 'racer1',
              timeLeftInMs: 10000,
              raceStatus: 'RACE_PAUSED',
              laps: [],
            },
          },
        });
      });
      await vi.waitFor(() => expect(result.current.currentRacer?.timeLeftMs).toBe(10000));

      // Transition to running with a server timer value that differs from
      // the previously-paused value — this is the case where the server is
      // authoritative and we MUST resync.
      act(() => {
        overlaySub.next({
          data: {
            onNewOverlayInfo: {
              username: 'racer1',
              timeLeftInMs: 8000,
              raceStatus: 'RACE_IN_PROGRESS',
              laps: [],
            },
          },
        });
      });
      await vi.waitFor(() => expect(result.current.currentRacer?.timeLeftMs).toBe(8000));
    } finally {
      vi.useRealTimers();
    }
  });

  test('different racer becoming current DOES resync the timer', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const { result } = renderHook(() =>
        useOverlayData({ eventId: 'e1', trackId: '1', raceFormat: 'fastest' })
      );
      await vi.waitFor(() => expect(result.current.leaderboardEntries.length).toBe(1));

      const overlaySub = mockSubscribers.find((s) => s.query.name === 'onNewOverlayInfo')!;
      act(() => {
        overlaySub.next({
          data: {
            onNewOverlayInfo: {
              username: 'racer1',
              timeLeftInMs: 10000,
              raceStatus: 'RACE_IN_PROGRESS',
              laps: [],
            },
          },
        });
      });
      await vi.waitFor(() => expect(result.current.currentRacer?.timeLeftMs).toBe(10000));

      // Let racer1 race for a bit.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(200);
      });

      // A new racer takes over — must resync the timer to the new racer's
      // remaining time, even though the status didn't change.
      act(() => {
        overlaySub.next({
          data: {
            onNewOverlayInfo: {
              username: 'racer2',
              timeLeftInMs: 5000,
              raceStatus: 'RACE_IN_PROGRESS',
              laps: [],
            },
          },
        });
      });
      await vi.waitFor(() => expect(result.current.currentRacer?.username).toBe('racer2'));
      // The new racer's timer value applied — within tolerance for one tick
      // that may have fired between the message and our assertion.
      const after = result.current.currentRacer?.timeLeftMs ?? 0;
      expect(after).toBeLessThanOrEqual(5000);
      expect(after).toBeGreaterThanOrEqual(4950);
    } finally {
      vi.useRealTimers();
    }
  });

  test('local timer stops when race is not in progress', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const { result } = renderHook(() =>
        useOverlayData({ eventId: 'e1', trackId: '1', raceFormat: 'fastest' })
      );
      await vi.waitFor(() => expect(result.current.leaderboardEntries.length).toBe(1));

      const overlaySub = mockSubscribers.find((s) => s.query.name === 'onNewOverlayInfo')!;
      // Send a paused race
      act(() => {
        overlaySub.next({
          data: {
            onNewOverlayInfo: {
              username: 'racer1',
              timeLeftInMs: 10000,
              raceStatus: 'RACE_PAUSED',
              laps: [],
            },
          },
        });
      });
      await vi.waitFor(() => expect(result.current.currentRacer?.timeLeftMs).toBe(10000));

      // Advance 1000ms — paused, so still 10000ms
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
      expect(result.current.currentRacer?.timeLeftMs).toBe(10000);
    } finally {
      vi.useRealTimers();
    }
  });

  test('captures highlightedUsername from onNewLeaderboardEntry', async () => {
    // The public leaderboard's own highlight uses the same trigger — a new
    // leaderboard entry arriving IS the authoritative "this racer just
    // finished" signal.
    const { result } = renderHook(() =>
      useOverlayData({ eventId: 'e1', trackId: '1', raceFormat: 'fastest' })
    );
    await waitFor(() => expect(result.current.leaderboardEntries.length).toBe(1));
    expect(result.current.highlightedUsername).toBeNull();

    const newEntrySub = mockSubscribers.find((s) => s.query.name === 'onNewLeaderboardEntry')!;
    act(() => {
      newEntrySub.next({
        data: { onNewLeaderboardEntry: { username: 'racer1' } },
      });
    });

    await waitFor(() => {
      expect(result.current.highlightedUsername).toBe('racer1');
    });
  });

  test('clears highlightedUsername after 30s hold window', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const { result } = renderHook(() =>
        useOverlayData({ eventId: 'e1', trackId: '1', raceFormat: 'fastest' })
      );
      await vi.waitFor(() => expect(result.current.leaderboardEntries.length).toBe(1));

      const newEntrySub = mockSubscribers.find((s) => s.query.name === 'onNewLeaderboardEntry')!;
      act(() => {
        newEntrySub.next({
          data: { onNewLeaderboardEntry: { username: 'racer1' } },
        });
      });
      await vi.waitFor(() => expect(result.current.highlightedUsername).toBe('racer1'));

      // Still highlighted at 29.9s — within the 30s hold window.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(29_900);
      });
      expect(result.current.highlightedUsername).toBe('racer1');

      // Cleared just past 30s.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(200);
      });
      await vi.waitFor(() => expect(result.current.highlightedUsername).toBeNull());
    } finally {
      vi.useRealTimers();
    }
  });

  test('a second new entry replaces the highlight (no queue, no extension)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const { result } = renderHook(() =>
        useOverlayData({ eventId: 'e1', trackId: '1', raceFormat: 'fastest' })
      );
      await vi.waitFor(() => expect(result.current.leaderboardEntries.length).toBe(1));

      const newEntrySub = mockSubscribers.find((s) => s.query.name === 'onNewLeaderboardEntry')!;
      act(() => {
        newEntrySub.next({
          data: { onNewLeaderboardEntry: { username: 'racer1' } },
        });
      });
      await vi.waitFor(() => expect(result.current.highlightedUsername).toBe('racer1'));

      // 10s in, racer2 finishes and a new entry arrives.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10_000);
      });
      act(() => {
        newEntrySub.next({
          data: { onNewLeaderboardEntry: { username: 'racer2' } },
        });
      });
      await vi.waitFor(() => expect(result.current.highlightedUsername).toBe('racer2'));

      // The earlier 30s timer (from racer1) must NOT clear racer2 when it
      // would have fired (30s after racer1's finish = 20s after racer2's).
      await act(async () => {
        await vi.advanceTimersByTimeAsync(20_100);
      });
      expect(result.current.highlightedUsername).toBe('racer2');

      // racer2's own 30s window expires.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10_000);
      });
      await vi.waitFor(() => expect(result.current.highlightedUsername).toBeNull());
    } finally {
      vi.useRealTimers();
    }
  });
});
