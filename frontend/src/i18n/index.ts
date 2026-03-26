import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translation files
import en from './locales/en.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import de from './locales/de.json';
import ar from './locales/ar.json';
import hi from './locales/hi.json';
import zh from './locales/zh.json';

// Supported languages configuration
export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇺🇸', dir: 'ltr' },
  { code: 'es', name: 'Español', flag: '🇪🇸', dir: 'ltr' },
  { code: 'fr', name: 'Français', flag: '🇫🇷', dir: 'ltr' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪', dir: 'ltr' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦', dir: 'rtl' },
  { code: 'hi', name: 'हिन्दी', flag: '🇮🇳', dir: 'ltr' },
  { code: 'zh', name: '中文', flag: '🇨🇳', dir: 'ltr' },
] as const;

export type LanguageCode = typeof SUPPORTED_LANGUAGES[number]['code'];

// Resources object with all translations
const resources = {
  en: { translation: en },
  es: { translation: es },
  fr: { translation: fr },
  de: { translation: de },
  ar: { translation: ar },
  hi: { translation: hi },
  zh: { translation: zh },
};

// Get initial language from localStorage if available
const getInitialLanguage = (): string => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('pulse-language');
    if (stored && SUPPORTED_LANGUAGES.some(l => l.code === stored)) {
      return stored;
    }
  }
  return 'en';
};

// Initialize i18next
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    lng: getInitialLanguage(),
    fallbackLng: 'en',
    
    // Namespace configuration
    ns: ['translation'],
    defaultNS: 'translation',
    
    // Detection options
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      lookupLocalStorage: 'pulse-language',
      caches: ['localStorage'],
    },
    
    // Interpolation
    interpolation: {
      escapeValue: false, // React already escapes values
    },
    
    // React options
    react: {
      useSuspense: false,
    },
  });

// Export configured instance
export default i18n;

// Helper to check if language is RTL
export const isRTLLanguage = (lang: string): boolean => {
  return ['ar', 'he', 'fa', 'ur'].includes(lang);
};

// Helper to get language config
export const getLanguageConfig = (code: string) => {
  return SUPPORTED_LANGUAGES.find(l => l.code === code) || SUPPORTED_LANGUAGES[0];
};

// Change language with localStorage persistence
export const changeLanguage = async (lang: LanguageCode): Promise<void> => {
  await i18n.changeLanguage(lang);
  if (typeof window !== 'undefined') {
    localStorage.setItem('pulse-language', lang);
    
    // Apply RTL direction
    const isRTL = isRTLLanguage(lang);
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
    document.documentElement.setAttribute('data-dir', isRTL ? 'rtl' : 'ltr');
  }
};

// Initialize RTL on app load
export const initializeRTL = (): void => {
  if (typeof window !== 'undefined') {
    const currentLang = i18n.language || 'en';
    const isRTL = isRTLLanguage(currentLang);
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
    document.documentElement.setAttribute('data-dir', isRTL ? 'rtl' : 'ltr');
  }
};
