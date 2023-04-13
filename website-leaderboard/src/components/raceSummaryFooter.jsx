import React from 'react';
import { useTranslation } from 'react-i18next';
import { useWindowSize } from '../hooks/useWindowSize';
import { convertMsToString } from '../support-functions/time';
import { Flag } from './flag';
import styles from './raceSummaryFooter.module.css';

const RaceSummaryFooter = ({
  username,
  overallRank,
  consistency,
  gapToFastest,
  fastestLapTime,
  avgLapTime,
  lapCompletionRatio,
  avgLapsPerAttempt,
  countryCode,
  visible,
}) => {
  const { t } = useTranslation();

  const windowSize = useWindowSize();
  const aspectRatio = windowSize.width / windowSize.height;

  if (username) {
    if (aspectRatio < 1.2 && username.length > 15) {
      username = username.substr(0, 10) + '...';
    } else if (username.length > 30) {
      username = username.substr(0, 10) + '...';
    }
  }

  return (
    <>
      {visible && (
        <div className={styles.footerRoot}>
          <div>
            <div className={styles.footerBigHeader}>{t('leaderboard.summary-footer.finsiher')}</div>
            <div className={styles.footerNormalText}>
              <span className={styles.racerCountryFlag}>
                <Flag countryCode={countryCode} />
              </span>
              <span>{username.length < 18 ? username : username.substr(0, 18) + '...'}</span>
            </div>
          </div>
          <div>
            <div className={styles.footerSmallHeader}>{t('leaderboard.summary-footer.rank')}</div>
            <div className={styles.footerNormalText}>#{overallRank}</div>
          </div>
          <div>
            <div className={styles.footerSmallHeader}>
              {t('leaderboard.summary-footer.consistency')}
            </div>
            <div className={styles.footerNormalText}>#{consistency}</div>
          </div>
          <div>
            <div className={styles.footerSmallHeader}>
              {t('leaderboard.summary-footer.gap-to-fastest')}
            </div>
            <div className={styles.footerNormalText}>{convertMsToString(gapToFastest)}</div>
          </div>

          <div>
            <div className={styles.footerSmallHeader}>
              {t('leaderboard.summary-footer.fastest-time')}
            </div>
            <div className={styles.footerNormalText}>{convertMsToString(fastestLapTime)}</div>
          </div>
          <div>
            <div className={styles.footerSmallHeader}>
              {t('leaderboard.summary-footer.avg-lap-time')}
            </div>
            <div className={styles.footerNormalText}>{convertMsToString(avgLapTime)}</div>
          </div>
          <div>
            <div className={styles.footerSmallHeader}>
              {t('leaderboard.summary-footer.lap-completion-ratio')}
            </div>
            <div className={styles.footerNormalText}>{lapCompletionRatio}%</div>
          </div>
          <div>
            <div className={styles.footerSmallHeader}>
              {t('leaderboard.summary-footer.avg-laps-per-attempt')}
            </div>
            <div className={styles.footerNormalText}>{avgLapsPerAttempt}</div>
          </div>
        </div>
      )}
    </>
  );
};

export { RaceSummaryFooter };
