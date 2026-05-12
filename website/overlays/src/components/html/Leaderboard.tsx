import { GetFormattedLapTime, GetLeaderboardDataSorted } from '../../format';
import type { LeaderboardEntry } from '../../format';
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
          return (
            <li key={rank} className={`${styles.row} ${styles[`rank${rank}` as keyof typeof styles]}`}>
              <span className={styles.rank}>{rankLabel}</span>
              <span className={styles.name}>{entry ? entry.username : ''}</span>
              <span className={styles.time}>{formatTime(entry, raceFormat)}</span>
              {gapToLeader && gap != null && gap > 0 ? (
                <span className={styles.gap}>+{GetFormattedLapTime(gap)}</span>
              ) : null}
            </li>
          );
        })}
      </ol>
      <div className={styles.footer}>{labels.footer}</div>
    </div>
  );
}
