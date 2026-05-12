import { GetFormattedLapTime, GetFormattedTotalTime } from '../../format';
import styles from './LowerThird.module.css';

export interface LowerThirdLabels {
  racer: string;
  remaining: string;
  fastest: string;
  previous: string;
}

export interface LowerThirdProps {
  username: string;
  timeLeftMs: number;
  fastestLapMs: number | null;
  lastLapMs: number | null;
  eventName: string;
  labels: LowerThirdLabels;
  visible: boolean;
}

function formatLap(ms: number | null): string {
  if (ms == null) return '00.000';
  return GetFormattedLapTime(ms);
}

export function LowerThird({
  username,
  timeLeftMs,
  fastestLapMs,
  lastLapMs,
  eventName,
  labels,
  visible,
}: LowerThirdProps) {
  return (
    <div className={`${styles.lowerThird} ${visible ? styles.visible : ''}`}>
      <div className={styles.identity}>
        <div className={styles.racerLabel}>{labels.racer}</div>
        <div className={styles.racerName}>{username}</div>
      </div>
      <div className={styles.stat}>
        <div className={styles.statLabel}>{labels.remaining}</div>
        <div className={styles.statValue}>{GetFormattedTotalTime(timeLeftMs)}</div>
      </div>
      <div className={styles.stat}>
        <div className={styles.statLabel}>{labels.fastest}</div>
        <div className={styles.statValue}>{formatLap(fastestLapMs)}</div>
      </div>
      <div className={styles.stat}>
        <div className={styles.statLabel}>{labels.previous}</div>
        <div className={styles.statValue}>{formatLap(lastLapMs)}</div>
      </div>
      <div className={styles.eventName}>{eventName}</div>
    </div>
  );
}
