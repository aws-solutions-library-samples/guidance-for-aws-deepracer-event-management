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
  labels: LeaderboardLabels;
  visible: boolean;
}

interface Row {
  rank: number;
  entry: LeaderboardEntry | null;
  rankLabel: string;
}

function entryTime(entry: LeaderboardEntry, raceFormat: string): number | null {
  if (raceFormat === 'average') {
    return entry.fastestAverageLap ? entry.fastestAverageLap.avgTime : null;
  }
  return entry.fastestLapTime ?? null;
}

function formatTime(entry: LeaderboardEntry | null, raceFormat: string): string {
  if (!entry) return '';
  if (raceFormat === 'average') {
    return entry.fastestAverageLap
      ? GetFormattedLapTime(entry.fastestAverageLap.avgTime)
      : 'DNF';
  }
  return entry.fastestLapTime != null ? GetFormattedLapTime(entry.fastestLapTime) : '';
}

export function Leaderboard({
  entries,
  raceFormat,
  gapToLeader,
  eventName,
  raceName,
  labels,
  visible,
}: LeaderboardProps) {
  const sorted = GetLeaderboardDataSorted(entries, raceFormat);
  const leaderTime = sorted.length > 0 ? entryTime(sorted[0], raceFormat) : null;

  const rows: Row[] = [
    { rank: 1, entry: sorted[0] ?? null, rankLabel: labels.first },
    { rank: 2, entry: sorted[1] ?? null, rankLabel: labels.second },
    { rank: 3, entry: sorted[2] ?? null, rankLabel: labels.third },
    { rank: 4, entry: sorted[3] ?? null, rankLabel: labels.fourth },
  ];

  return (
    <div className={`${styles.leaderboard} ${visible ? styles.visible : ''}`}>
      <div className={styles.eventName}>{eventName}</div>
      <ol className={styles.rows}>
        {rows.map(({ rank, entry, rankLabel }) => {
          const time = entry ? entryTime(entry, raceFormat) : null;
          const gap = rank > 1 && leaderTime != null && time != null ? time - leaderTime : null;
          const avatarConfig = entry ? parseAvatarConfig(entry.profile?.avatarConfig) : null;
          const highlightColour = entry?.profile?.highlightColour ?? null;
          return (
            <li
              key={rank}
              className={`${styles.row} ${styles[`rank${rank}` as keyof typeof styles]}`}
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
                  <Avatar
                    avatarStyle="Transparent"
                    {...(avatarConfig as Record<string, string>)}
                  />
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
                {gapToLeader && gap != null && gap > 0
                  ? `+${GetFormattedLapTime(gap)}`
                  : ''}
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
