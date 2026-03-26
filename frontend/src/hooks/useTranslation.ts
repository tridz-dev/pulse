import { useTranslation as useReactI18Next } from 'react-i18next';
import { useCallback } from 'react';
import { changeLanguage, type LanguageCode } from '@/i18n';

// Re-export the original hook for direct use
export { useTranslation as useReactI18n } from 'react-i18next';

/**
 * Enhanced translation hook with additional utilities
 * Provides: t(), i18n instance, currentLanguage, and changeLanguage helper
 */
export function useTranslation() {
  const { t, i18n } = useReactI18Next();
  
  const currentLanguage = i18n.language || 'en';

  /**
   * Change the current language
   * @param lang - Language code to switch to
   */
  const handleChangeLanguage = useCallback(async (lang: LanguageCode) => {
    await changeLanguage(lang);
  }, []);

  /**
   * Translate with fallback
   * @param key - Translation key
   * @param options - Translation options
   * @param fallback - Fallback text if translation not found
   */
  const translateWithFallback = useCallback(
    (key: string, options?: Record<string, unknown>, fallback?: string): string => {
      const translated = t(key, options);
      // If translation returns the key itself, use fallback
      if (translated === key && fallback) {
        return fallback;
      }
      return translated;
    },
    [t]
  );

  return {
    /** Translation function */
    t,
    /** i18next instance */
    i18n,
    /** Current language code */
    currentLanguage,
    /** Change language function */
    changeLanguage: handleChangeLanguage,
    /** Translate with fallback */
    translateWithFallback,
    /** Check if translation exists */
    exists: i18n.exists.bind(i18n),
  };
}

export default useTranslation;
