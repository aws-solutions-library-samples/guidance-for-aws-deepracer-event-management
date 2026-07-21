import Avatar from 'avataaars';
import { GetFormattedLapTime, GetFormattedTotalTime } from '../../format';
import { racingStatusColors } from '../../theme/racing-status-colors';
import { Flag } from '../Flag';
import { parseAvatarConfig } from '../parseAvatarConfig';
import styles from './LowerThird.module.css';

type LapStatus = 'fastestOfEvent' | 'fastestOfRace' | 'valid';

/**
 * Classify a lap time for F1-style colour coding:
 *   - "fastestOfEvent" (purple): equals or beats the event-wide best
 *   - "fastestOfRace"  (green):  the racer's best lap this race
 *   - "valid"          (yellow): a valid lap that isn't a personal best
 *
 * `null` is returned when the lap has no time yet (don't show any colour).
 */
function classifyLap(
  lapMs: number | null,
  racerBestMs: number | null,
  eventBestMs: number | null
): LapStatus | null {
  if (lapMs == null || lapMs <= 0) return null;
  if (eventBestMs != null && lapMs <= eventBestMs) return 'fastestOfEvent';
  if (racerBestMs != null && lapMs <= racerBestMs) return 'fastestOfRace';
  return 'valid';
}

function statusColor(status: LapStatus | null): string | undefined {
  if (!status) return undefined;
  return racingStatusColors[status];
}

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
  /** Fastest lap across the whole event — used to colour the racer's
   *  times purple when they match or beat it. */
  eventBestLapMs?: number | null;
  eventName: string;
  labels: LowerThirdLabels;
  visible: boolean;
  /** AWSJSON-encoded avataaars config from RacerProfile. */
  avatarConfig?: string | null;
  /** ISO-3166 alpha-2 country code from the racer's profile. */
  countryCode?: string | null;
  /** Hex colour the racer set on their profile. */
  highlightColour?: string | null;
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
  eventBestLapMs,
  eventName,
  labels,
  visible,
  avatarConfig,
  countryCode,
  highlightColour,
}: LowerThirdProps) {
  const parsedAvatar = parseAvatarConfig(avatarConfig);
  // Colour-status for the two timing cells. The "Fastest" cell shows the
  // racer's best for the race — purple if they match/beat the event best,
  // else green. The "Previous" cell shows the most recent lap — purple
  // if it set a new event best, green if it equals the racer's best
  // (i.e. the latest lap WAS their personal best), else yellow.
  const fastestStatus = classifyLap(fastestLapMs, fastestLapMs, eventBestLapMs ?? null);
  const previousStatus = classifyLap(lastLapMs, fastestLapMs, eventBestLapMs ?? null);
  return (
    <div
      className={`${styles.lowerThird} ${visible ? styles.visible : ''}`}
      style={
        highlightColour
          ? ({ '--racer-highlight': highlightColour } as React.CSSProperties)
          : undefined
      }
    >
      <div className={styles.identity}>
        {parsedAvatar ? (
          <span className={styles.avatar}>
            <Avatar avatarStyle="Transparent" {...(parsedAvatar as Record<string, string>)} />
            {countryCode ? <Flag countryCode={countryCode} className={styles.flagOverlay} /> : null}
          </span>
        ) : countryCode ? (
          <Flag countryCode={countryCode} className={styles.flagSolo} />
        ) : null}
        <div className={styles.identityText}>
          <div className={styles.racerLabel}>{labels.racer}</div>
          <div className={styles.racerName}>{username}</div>
        </div>
      </div>
      <div className={styles.stats}>
        <div className={styles.stat}>
          <div className={styles.statLabel}>{labels.remaining}</div>
          <div className={styles.statValue}>{GetFormattedTotalTime(timeLeftMs)}</div>
          {/* No colour indicator on the countdown — only on lap times. */}
          <div className={styles.statIndicator} />
        </div>
        <div className={styles.stat}>
          <div className={styles.statLabel}>{labels.fastest}</div>
          <div className={styles.statValue}>{formatLap(fastestLapMs)}</div>
          <div
            className={styles.statIndicator}
            style={{ background: statusColor(fastestStatus) }}
          />
        </div>
        <div className={styles.stat}>
          <div className={styles.statLabel}>{labels.previous}</div>
          <div className={styles.statValue}>{formatLap(lastLapMs)}</div>
          <div
            className={styles.statIndicator}
            style={{ background: statusColor(previousStatus) }}
          />
        </div>
      </div>
      <div className={styles.eventName}>{eventName}</div>
    </div>
  );
}
