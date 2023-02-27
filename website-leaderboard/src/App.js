import { Amplify } from 'aws-amplify';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import './App.css';
import { Leaderboard } from './components/leaderboard';
import awsconfig from './config.json';

Amplify.configure(awsconfig);

//Example event ID
//const eventId = '80f0f15c-a830-4cee-a751-4dfea59a69c6';

function App() {
  const { i18n } = useTranslation();

  const queryParams = new URLSearchParams(window.location.search);
  const eventId = queryParams.get('event');

  let language = queryParams.get('lang');
  if (language === null) language = 'en';

  let trackId = queryParams.get('track');
  if (trackId === null) trackId = 1;

  console.info('eventId: ' + eventId);
  console.info('language: ' + language);
  console.info('trackId: ' + trackId);

  useEffect(() => {
    i18n.changeLanguage(language);
  }, [language]);

  return <Leaderboard eventId={eventId} trackId={trackId} language={language} />;
}

export default App;
