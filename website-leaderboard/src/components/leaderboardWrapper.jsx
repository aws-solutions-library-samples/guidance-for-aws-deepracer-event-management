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
  if (trackId === null) trackId = 1;

  let showQRcode = queryParams.get('qr');
  if (showQRcode === null || showQRcode === 'false') showQRcode = false;

  let scroll = queryParams.get('scroll');
  console.info(scroll);
  if (scroll === null) {
    scroll = true;
  } else {
    scroll = /true/i.test(scroll);
  }

  console.info('eventId: ' + eventId);
  console.info('language: ' + language);
  console.info('trackId: ' + trackId);
  console.info('scroll: ' + scroll);

  useEffect(() => {
    i18n.changeLanguage(language);
  }, [language, i18n]);

  return (
    <Leaderboard
      eventId={eventId}
      trackId={trackId}
      language={language}
      showQrCode={showQRcode}
      scrollEnabled={scroll}
    />
  );
};

export { LeaderboardWrapper };
