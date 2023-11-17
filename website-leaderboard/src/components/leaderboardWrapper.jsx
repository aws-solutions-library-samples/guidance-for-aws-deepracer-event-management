import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { Leaderboard } from '../pages/leaderboard';

const LeaderboardWrapper = () => {
  const { i18n } = useTranslation();

  const urlParams = useParams();
  const eventId = urlParams.eventId;

  const queryParams = new URLSearchParams(window.location.search);

  let language = queryParams.get('lang');
  if (language === null) language = 'en';

  let trackId = queryParams.get('track');
  if (trackId === null) trackId = 'combined';

  let showQRcode = queryParams.get('qr');
  if (showQRcode === null || showQRcode === 'false') showQRcode = false;
  console.debug(`showQRcode: ${showQRcode}`);

  let scroll = queryParams.get('scroll');
  if (scroll === null) {
    scroll = true;
  } else {
    scroll = /true/i.test(scroll);
  }

  let raceFormat = queryParams.get('format');
  if (raceFormat == null) raceFormat = 'fastest';

  console.debug('eventId: ' + eventId);
  console.debug('language: ' + language);
  console.debug('trackId: ' + trackId);
  console.debug('scroll: ' + scroll);
  console.debug('raceFormat: ' + raceFormat);

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
    />
  );
};

export { LeaderboardWrapper };
