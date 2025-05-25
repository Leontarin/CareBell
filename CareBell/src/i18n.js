import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en.json';
import he from './locales/he.json';
import de from './locales/de.json';
import fi from './locales/fi.json';

i18n
  .use(LanguageDetector)           // detect user language
  .use(initReactI18next)           // hook into React
  .init({
    resources: {
      en: { translation: en },
      he: { translation: he },
      de: { translation: de },
      fi: { translation: fi }
    },
    fallbackLng: 'en',              // default if detection fails
    interpolation: { escapeValue: false }
  });

export default i18n;
