import { useTranslation } from 'react-i18next';
import { useEffect } from 'react';
import { Leaderboard } from '../pages/leaderboard';
import { useParams } from 'react-router-dom';



const LeaderboardWrapper = () => {
  const { i18n } = useTranslation();

  const urlParams = useParams();
  const eventId = urlParams.eventId;


  const queryParams = new URLSearchParams(window.location.search);

  let language = queryParams.get('lang');
  if (language === null) language = 'en';

  let trackId = queryParams.get('track');
  if (trackId === null) trackId = 1;

  let showQRcode = queryParams.get('qr')
  if (showQRcode === null || showQRcode === "false") showQRcode = false;

  console.info('eventId: ' + eventId);
  console.info('language: ' + language);
  console.info('trackId: ' + trackId);

  useEffect(() => {
    i18n.changeLanguage(language);
  }, [language, i18n]);

  return <Leaderboard eventId={eventId} trackId={trackId} language={language} showQrCode={showQRcode}/>
};

export { LeaderboardWrapper };
