import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { Leaderboard } from '../pages/leaderboard';

const LeaderboardWrapper = () => {
  const { i18n } = useTranslation();

  const urlParams = useParams();
  const eventId = urlParams.eventId;

  const queryParams = new URLSearchParams(window.location.search);

  const language = queryParams.get('lang') ?? 'en';
  const trackId = queryParams.get('track') ?? 'combined';

  const showQRcodeParam = queryParams.get('qr');
  const showQRcode = showQRcodeParam !== null && showQRcodeParam !== 'false';

  const scrollParam = queryParams.get('scroll');
  const scroll = scrollParam === null ? true : /true/i.test(scrollParam);

  const raceFormat = queryParams.get('format') ?? 'fastest';

  const showFlagParam = queryParams.get('flag');
  const showFlag = showFlagParam === null ? true : /true/i.test(showFlagParam);

  console.debug('eventId: ' + eventId);
  console.debug('language: ' + language);
  console.debug('trackId: ' + trackId);
  console.debug('scroll: ' + scroll);
  console.debug('raceFormat: ' + raceFormat);
  console.debug('showQRcode: ' + showQRcode);
  console.debug('showFlag: ' + showFlag);

  useEffect(() => {
    i18n.changeLanguage(language);
  }, [language, i18n]);

  return (
    <Leaderboard
      eventId={eventId}
      trackId={trackId}
      raceFormat={raceFormat}
      language={language}
      showQrCode={showQRcode}
      scrollEnabled={scroll}
      showFlag={showFlag}
    />
  );
};

export { LeaderboardWrapper };
