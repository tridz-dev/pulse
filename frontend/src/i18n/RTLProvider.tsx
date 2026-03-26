import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { isRTLLanguage, initializeRTL } from './index';

/**
 * RTL Provider Component
 * 
 * Wraps the application to handle RTL (Right-to-Left) language support.
 * Automatically updates the document direction when the language changes.
 */
export function RTLProvider({ children }: { children: React.ReactNode }) {
  const { i18n } = useTranslation();

  useEffect(() => {
    // Initialize RTL on mount
    initializeRTL();

    // Listen for language changes
    const handleLanguageChanged = (lng: string) => {
      const isRTL = isRTLLanguage(lng);
      document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
      document.documentElement.setAttribute('data-dir', isRTL ? 'rtl' : 'ltr');
      document.documentElement.lang = lng;
      
      // Add/remove RTL class for CSS targeting
      if (isRTL) {
        document.documentElement.classList.add('rtl');
      } else {
        document.documentElement.classList.remove('rtl');
      }
    };

    // Subscribe to language change events
    i18n.on('languageChanged', handleLanguageChanged);

    return () => {
      i18n.off('languageChanged', handleLanguageChanged);
    };
  }, [i18n]);

  return <>{children}</>;
}

export default RTLProvider;
