import { useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChromaBg } from '../ChromaBg';
import { Leaderboard } from './Leaderboard';
import { LowerThird } from './LowerThird';
import { useOverlayData } from './useOverlayData';
import styles from './OverlayApp.module.css';

export default function OverlayApp() {
  const { t } = useTranslation();
  const { eventId } = useParams();
  const [searchParams] = useSearchParams();

  const trackId = searchParams.get('trackId') || '1';
  const raceFormat = searchParams.get('format') || 'fastest';
  const showLeaderboardParam = (searchParams.get('showLeaderboard') ?? '1') === '1';
  const gapToLeader = searchParams.get('gapToLeader') !== 'false';

  const {
    leaderboardEntries,
    eventName,
    raceName,
    eventBestLapMs,
    highlightedUsername,
    showLeaderboard,
    showLowerThird,
    currentRacer,
  } = useOverlayData({
    eventId: eventId ?? '',
    trackId,
    raceFormat,
  });

  const leaderboardLabels = {
    first: t('leaderboard.first-place'),
    second: t('leaderboard.second-place'),
    third: t('leaderboard.third-place'),
    fourth: t('leaderboard.fourth-place'),
    footer: t('leaderboard.lower-text'),
  };

  const fastestLabel =
    raceFormat === 'average' ? t('lower-thirds.fastest-avg-lap') : t('lower-thirds.fastest-lap');

  const lowerThirdLabels = {
    racer: t('lower-thirds.racer-name'),
    remaining: t('lower-thirds.time-remaining'),
    fastest: fastestLabel,
    previous: t('lower-thirds.previous-lap'),
  };

  // Replicate the legacy SVG overlay's effect of dimming the track view
  // when the leaderboard is on screen at idle. The lower-third runs during
  // live racing where the track action is the point — no tint there.
  const backdropVisible = showLeaderboard && showLeaderboardParam;

  return (
    <div className={styles.root}>
      <ChromaBg />
      <div className={`${styles.backdrop} ${backdropVisible ? styles.backdropVisible : ''}`} />
      <Leaderboard
        entries={leaderboardEntries}
        raceFormat={raceFormat}
        gapToLeader={gapToLeader}
        eventName={eventName}
        raceName={raceName}
        highlightedUsername={highlightedUsername}
        labels={leaderboardLabels}
        visible={showLeaderboard && showLeaderboardParam}
      />
      <LowerThird
        username={currentRacer?.username ?? ''}
        timeLeftMs={currentRacer?.timeLeftMs ?? 180000}
        fastestLapMs={currentRacer?.fastestLapMs ?? null}
        lastLapMs={currentRacer?.lastLapMs ?? null}
        eventBestLapMs={eventBestLapMs}
        eventName={eventName}
        labels={lowerThirdLabels}
        visible={showLowerThird}
        avatarConfig={currentRacer?.avatarConfig ?? null}
        countryCode={currentRacer?.countryCode ?? null}
        highlightColour={currentRacer?.highlightColour ?? null}
      />
    </div>
  );
}
