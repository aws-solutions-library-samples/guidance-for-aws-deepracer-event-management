import Avatar from 'avataaars';
import { GetFormattedLapTime, GetLeaderboardDataSorted } from '../../format';
import type { LeaderboardEntry } from '../../format';
import { Flag } from '../Flag';
import { parseAvatarConfig } from '../parseAvatarConfig';
import styles from './Leaderboard.module.css';

export interface LeaderboardLabels {
  first: string;
  second: string;
  third: string;
  fourth: string;
  footer: string;
}

export interface LeaderboardProps {
  entries: LeaderboardEntry[];
  raceFormat: string;
  gapToLeader: boolean;
  eventName: string;
  /**
   * Bottom-right brand text — defaults to the operator-configured
   * `leaderBoardFooter` (typically the race / event name). Falls back to
   * the rank-label footer (`labels.footer`) when empty.
   */
  raceName?: string;
  /**
   * Username of the just-finished racer. When set their row is highlighted
   * (pulse fades over 12s). If they didn't make the visible top-4 the
   * panel slides to a 4-wide window centred on them — they sit in row 3
   * of 4 with the racers above and below for context. `useOverlayData`
   * clears this 30s after race finish so the panel reverts to the
   * natural top-4 ordering.
   */
  highlightedUsername?: string | null;
  labels: LeaderboardLabels;
  visible: boolean;
}

interface Row {
  rank: number;
  entry: LeaderboardEntry | null;
  rankLabel: string;
  highlighted: boolean;
}

const TOP_N = 4;

function entryTime(entry: LeaderboardEntry, raceFormat: string): number | null {
  if (raceFormat === 'average') {
    return entry.fastestAverageLap ? entry.fastestAverageLap.avgTime : null;
  }
  return entry.fastestLapTime ?? null;
}

function formatTime(entry: LeaderboardEntry | null, raceFormat: string): string {
  if (!entry) return '';
  if (raceFormat === 'average') {
    return entry.fastestAverageLap ? GetFormattedLapTime(entry.fastestAverageLap.avgTime) : 'DNF';
  }
  return entry.fastestLapTime != null ? GetFormattedLapTime(entry.fastestLapTime) : '';
}

export function Leaderboard({
  entries,
  raceFormat,
  gapToLeader,
  eventName,
  raceName,
  highlightedUsername,
  labels,
  visible,
}: LeaderboardProps) {
  const sorted = GetLeaderboardDataSorted(entries, raceFormat);
  const leaderTime = sorted.length > 0 ? entryTime(sorted[0], raceFormat) : null;

  // Index of the just-finished racer in the full sorted list. If they're
  // outside the visible top-N we slide the panel to a 4-wide window centred
  // on them — they sit at index 2 (row 3) with the racers immediately above
  // and below for context. When they're already in the top-4 (or no one is
  // highlighted) we keep the natural top-4 ordering.
  const highlightedIdx = highlightedUsername
    ? sorted.findIndex((e) => e.username === highlightedUsername)
    : -1;
  const neighbourhoodView = highlightedIdx >= TOP_N;
  // Place the highlighted racer at index 2 of the 4-row window. If they're
  // close to the bottom of the field, clamp the window end so all four
  // slots stay filled — the racer naturally slides into row 4 rather than
  // leaving an empty trailing slot. Mirrors the public leaderboard, which
  // calls `scrollIntoView({ block: 'center' })` and lets the browser clamp
  // the scroll when the target is near the end of the list.
  const windowStart = neighbourhoodView
    ? Math.min(highlightedIdx - 2, Math.max(0, sorted.length - TOP_N))
    : 0;

  const standardLabels = [labels.first, labels.second, labels.third, labels.fourth];

  const rows: Row[] = [];
  for (let i = 0; i < TOP_N; i += 1) {
    const sortedIdx = windowStart + i;
    const entry = sorted[sortedIdx] ?? null;
    const realRank = sortedIdx + 1;
    rows.push({
      rank: realRank,
      entry,
      rankLabel: neighbourhoodView ? `#${realRank}` : standardLabels[i],
      highlighted: !!highlightedUsername && entry?.username === highlightedUsername,
    });
  }

  return (
    <div className={`${styles.leaderboard} ${visible ? styles.visible : ''}`}>
      <div className={styles.eventName}>{eventName}</div>
      <ol className={styles.rows}>
        {rows.map(({ rank, entry, rankLabel, highlighted }) => {
          const time = entry ? entryTime(entry, raceFormat) : null;
          const gap = rank > 1 && leaderTime != null && time != null ? time - leaderTime : null;
          const avatarConfig = entry ? parseAvatarConfig(entry.profile?.avatarConfig) : null;
          const highlightColour = entry?.profile?.highlightColour ?? null;
          // Podium colours only apply in the natural top-4 view. In the
          // neighbourhood view (a finisher outside the top-4) the panel
          // shows mid-field positions like #5/#6/#7/#8 — none of which
          // should be coloured gold/silver/bronze.
          const podiumClass =
            !neighbourhoodView && rank <= 3 ? styles[`rank${rank}` as keyof typeof styles] : '';
          return (
            <li
              key={`${rank}-${entry?.username ?? 'empty'}`}
              className={`${styles.row} ${podiumClass} ${highlighted ? styles.highlighted : ''}`}
              style={
                highlightColour
                  ? ({
                      // Expose the racer's personal colour as a CSS custom
                      // property — `.row::before` paints the gradient bar
                      // from this var (and stays transparent if unset, so
                      // racers without a profile colour look unchanged).
                      '--racer-highlight': highlightColour,
                    } as React.CSSProperties)
                  : undefined
              }
            >
              <span className={styles.rank}>{rankLabel}</span>
              {avatarConfig ? (
                <span className={styles.avatar}>
                  <Avatar avatarStyle="Transparent" {...(avatarConfig as Record<string, string>)} />
                  {entry?.countryCode ? (
                    <Flag countryCode={entry.countryCode} className={styles.flagOverlay} />
                  ) : null}
                </span>
              ) : entry?.countryCode ? (
                <Flag countryCode={entry.countryCode} className={styles.flagSolo} />
              ) : (
                <span className={styles.avatarPlaceholder} />
              )}
              <span className={styles.name}>{entry ? entry.username : ''}</span>
              {/* Gap-to-leader rendered BEFORE lap time so the time always
                  sits at the right edge of the row. The span is rendered
                  even when there is no gap (P1, gapToLeader off, no time
                  data) so the grid keeps its column alignment. */}
              <span className={styles.gap}>
                {gapToLeader && gap != null && gap > 0 ? `+${GetFormattedLapTime(gap)}` : ''}
              </span>
              <span className={styles.time}>{formatTime(entry, raceFormat)}</span>
            </li>
          );
        })}
      </ol>
      <div className={styles.footer}>{raceName || labels.footer}</div>
    </div>
  );
}
