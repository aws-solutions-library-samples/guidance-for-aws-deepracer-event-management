/**
 * F1-broadcast-style status colours for racing visualisations.
 *
 * Mirrors `website/src/theme/racing-status-colors.ts` in the main app
 * (added by upstream PR #219) — duplicated here because the overlays app is
 * a separate Vite bundle with its own `src/`. When the two apps land in a
 * shared module layout this should move to a common location.
 *
 * F1 timing-screen conventions:
 *   - "purple" = fastest of the session/event so far
 *   - "green"  = fastest of this race / personal best in the run
 *   - "yellow" = a valid lap that isn't a personal best
 *   - "red"    = invalid / DNF
 */
export const racingStatusColors = {
  invalid: '#FF1801',
  valid: '#FFD600',
  fastestOfRace: '#00C853',
  fastestOfEvent: '#9100E1',
  threshold: '#FF8800',
} as const;

export type RacingStatusColors = typeof racingStatusColors;
