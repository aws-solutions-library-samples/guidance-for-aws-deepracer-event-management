import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import Backend from 'i18next-xhr-backend';
import { initReactI18next } from 'react-i18next';

const isProduction = process.env.NODE_ENV === 'production';

i18n
  .use(Backend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    debug: !isProduction,
    // lng: 'de', // testing
    fallbackLng: {
      'en-US': ['en'],
      'en-GB': ['en'],
      default: ['en'],
    },
    interpolation: {
      escapeValue: false,
    },

    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json',
    },
  });

export default i18n;
