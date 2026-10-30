import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import commonPt from './locales/pt-BR/common.json';
import playerPt from './locales/pt-BR/player.json';
import adminPt from './locales/pt-BR/admin.json';
import commonEn from './locales/en/common.json';
import playerEn from './locales/en/player.json';
import adminEn from './locales/en/admin.json';

export const I18N_STORAGE_KEY = 'limboos_lang';
export const SUPPORTED_LANGS = ['pt-BR', 'en'] as const;
export type AppLanguage = (typeof SUPPORTED_LANGS)[number];

const resources = {
  'pt-BR': {
    common: commonPt,
    player: playerPt,
    admin: adminPt,
  },
  en: {
    common: commonEn,
    player: playerEn,
    admin: adminEn,
  },
};

function syncDocumentLang(lng: string) {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = lng.startsWith('en') ? 'en' : 'pt-BR';
}

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'pt-BR',
    supportedLngs: [...SUPPORTED_LANGS],
    // Com true, isSupportedCode('pt-BR') reduz para 'pt' e rejeita o locale
    // se 'pt' não estiver em supportedLngs — t() devolve a chave crua.
    nonExplicitSupportedLngs: false,
    load: 'currentOnly',
    // Resources são bundlados; init sync evita race com o primeiro paint.
    initAsync: false,
    defaultNS: 'common',
    ns: ['common', 'player', 'admin'],
    interpolation: { escapeValue: false },
    react: {
      useSuspense: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: I18N_STORAGE_KEY,
      caches: ['localStorage'],
      convertDetectedLanguage: (lng: string) => {
        const lower = lng.toLowerCase();
        if (lower.startsWith('en')) return 'en';
        if (lower.startsWith('pt')) return 'pt-BR';
        return 'pt-BR';
      },
    },
  });

syncDocumentLang(i18n.language || 'pt-BR');
i18n.on('languageChanged', syncDocumentLang);

export function setAppLanguage(lng: AppLanguage) {
  localStorage.setItem(I18N_STORAGE_KEY, lng);
  return i18n.changeLanguage(lng);
}

export default i18n;
