import { useTranslation } from 'react-i18next';
import { useWindowSize } from '../hooks/useWindowSize';
import { convertMsToString } from '../support-functions/time';
import { Flag } from './flag';
import styles from './raceSummaryFooter.module.css';

const RaceSummaryFooter = (params: any) => {
  const { t } = useTranslation();

  const windowSize = useWindowSize();
  const aspectRatio = (windowSize.width ?? 0) / (windowSize.height ?? 1);

  const {
    avgLapTime,
    avgLapsPerAttempt,
    consistency,
    countryCode,
    fastestAverageLap,
    fastestLapTime,
    gapToFastest,
    lapCompletionRatio,
    mostConcecutiveLaps,
    overallRank,
    visible,
    raceFormat,
  } = params;

  let username = params['username'];

  const displayInformation = {
    itemOne: (
      <div>
        <div className={styles.footerSmallHeader}>{t('leaderboard.summary-footer.fastest-time')}</div>
        <div className={styles.footerNormalText}>{convertMsToString(fastestLapTime)}</div>
      </div>
    ),
    itemTwo: (
      <div>
        <div className={styles.footerSmallHeader}>{t('leaderboard.summary-footer.avg-lap-time')}</div>
        <div className={styles.footerNormalText}>{convertMsToString(avgLapTime)}</div>
      </div>
    ),
    itemThree: (
      <div>
        <div className={styles.footerSmallHeader}>{t('leaderboard.summary-footer.lap-completion-ratio')}</div>
        <div className={styles.footerNormalText}>{lapCompletionRatio}%</div>
      </div>
    ),
    itemFour: (
      <div>
        <div className={styles.footerSmallHeader}>{t('leaderboard.summary-footer.avg-laps-per-attempt')}</div>
        <div className={styles.footerNormalText}>{avgLapsPerAttempt}</div>
      </div>
    ),
  };

  if (raceFormat === 'average' && visible) {
    displayInformation.itemOne = (
      <div>
        <div className={styles.footerSmallHeader}>{t('leaderboard.summary-footer.avg.fastest-time')}</div>
        <div className={styles.footerNormalText}>
          {fastestAverageLap ? convertMsToString(fastestAverageLap.avgTime) : t('leaderboard.DNF')}
        </div>
      </div>
    );

    displayInformation.itemTwo = (
      <div>
        <div className={styles.footerSmallHeader}>{t('leaderboard.summary-footer.avg.fastest-laps')}</div>
        <div className={styles.footerNormalText}>
          {fastestAverageLap
            ? `${fastestAverageLap.startLapId + 1} - ${fastestAverageLap.endLapId + 1}`
            : t('leaderboard.DNF')}
        </div>
      </div>
    );

    displayInformation.itemThree = (
      <div>
        <div className={styles.footerSmallHeader}>{t('leaderboard.summary-footer.avg.max-concecutive')}</div>
        <div className={styles.footerNormalText}>{mostConcecutiveLaps}</div>
      </div>
    );
  }

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
            <div className={styles.footerSmallHeader}>{t('leaderboard.summary-footer.consistency')}</div>
            <div className={styles.footerNormalText}>#{consistency}</div>
          </div>
          <div>
            <div className={styles.footerSmallHeader}>{t('leaderboard.summary-footer.gap-to-fastest')}</div>
            <div className={styles.footerNormalText}>
              {gapToFastest >= 0 ? convertMsToString(gapToFastest) : t('leaderboard.DNF')}
            </div>
          </div>

          {displayInformation.itemOne}
          {displayInformation.itemTwo}
          {displayInformation.itemThree}
          {displayInformation.itemFour}
        </div>
      )}
    </>
  );
};

export { RaceSummaryFooter };
