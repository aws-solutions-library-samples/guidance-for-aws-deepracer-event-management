/**
 * F1-broadcast-style status colours for racing visualisations.
 *
 * Reused across:
 *   - The commentator race-statistics chart (per-lap bar colours)
 *   - The streaming overlays (highlight states for current/fastest racer)
 *   - The wide-format venue leaderboard (when it lands; see task #57)
 *
 * Static palette — these are broadcast-graphics conventions and aren't
 * theme-reactive (they're designed for dark backgrounds either way).
 *
 * Naming follows F1 timing-screen conventions:
 *   - "purple" = fastest of the session/event so far
 *   - "green"  = fastest of this race / personal best in the run
 *   - "yellow" = a valid lap that isn't a personal best
 *   - "red"    = invalid / DNF / car-reset etc.
 *   - threshold is the dashed comparison line drawn at the event-wide
 *     fastest time on the race-stats chart.
 */
export const racingStatusColors = {
  invalid: '#FF1801',
  valid: '#FFD600',
  fastestOfRace: '#00C853',
  fastestOfEvent: '#9100E1',
  threshold: '#FF8800',
} as const;

export type RacingStatusColors = typeof racingStatusColors;
