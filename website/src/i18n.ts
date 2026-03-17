import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import Backend from 'i18next-http-backend';
import { initReactI18next } from 'react-i18next';

const isProduction = import.meta.env.PROD;

i18n.use(Backend)
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
