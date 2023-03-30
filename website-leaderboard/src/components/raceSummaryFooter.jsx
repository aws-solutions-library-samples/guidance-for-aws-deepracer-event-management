import React from 'react';
import { Flag } from './flag';
import styles from './raceSummaryFooter.module.css';

// import { useTranslation } from 'react-i18next';

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
  const convertMsToString = (timeInMS) => {
    const millisecondsAsString = String(Math.floor(timeInMS % 1000)).padStart(3, '0');
    const secondsAsString = String(Math.floor(timeInMS / 1000)).padStart(2, '0');
    const seconds = Math.floor(timeInMS / 1000);
    const minutesAsString = String(Math.floor(seconds / 60)).padStart(2, '0');
    const timeAsString = `${minutesAsString}:${secondsAsString}.${millisecondsAsString}`;
    return timeAsString;
  };

  return (
    <>
      {visible && (
        <div className={styles.footerRoot}>
          <div>
            <div className={styles.footerBigHeader}>NEW FINISHER</div>
            <div className={styles.footerNormalText}>
              <span className={styles.racerCountryFlag}>
                <Flag countryCode={countryCode} />
              </span>
              <span>{username.length < 18 ? username : username.substr(0, 18) + '...'}</span>
            </div>
          </div>
          <div>
            <div className={styles.footerSmallHeader}>OVERALL RANK</div>
            <div className={styles.footerNormalText}>#{overallRank}</div>
          </div>
          <div>
            <div className={styles.footerSmallHeader}>CONSISTENCY</div>
            <div className={styles.footerNormalText}>#{consistency}</div>
          </div>
          <div>
            <div className={styles.footerSmallHeader}>GAP TO FASTEST</div>
            <div className={styles.footerNormalText}>{convertMsToString(gapToFastest)}</div>
          </div>

          <div>
            <div className={styles.footerSmallHeader}>FASTEST TIME</div>
            <div className={styles.footerNormalText}>{convertMsToString(fastestLapTime)}</div>
          </div>
          <div>
            <div className={styles.footerSmallHeader}>AVG. LAP TIME</div>
            <div className={styles.footerNormalText}>{convertMsToString(avgLapTime)}</div>
          </div>
          <div>
            <div className={styles.footerSmallHeader}>LAP COMPLETION RATIO</div>
            <div className={styles.footerNormalText}>{lapCompletionRatio}%</div>
          </div>
          <div>
            <div className={styles.footerSmallHeader}>AVG. LAPS PER ATTEMPT</div>
            <div className={styles.footerNormalText}>{avgLapsPerAttempt}</div>
          </div>
        </div>
      )}
    </>
  );
};

export { RaceSummaryFooter };
