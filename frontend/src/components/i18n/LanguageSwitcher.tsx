import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, Check } from 'lucide-react';
import { SUPPORTED_LANGUAGES, changeLanguage, type LanguageCode } from '@/i18n';
import { cn } from '@/lib/utils';

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const currentLang = i18n.language || 'en';
  const currentConfig = SUPPORTED_LANGUAGES.find(l => l.code === currentLang) || SUPPORTED_LANGUAGES[0];

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLanguageChange = async (code: LanguageCode) => {
    await changeLanguage(code);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-1.5 px-2 py-1.5 rounded-md text-sm transition-colors",
          "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800",
          isOpen && "bg-zinc-800 text-zinc-200"
        )}
        title="Change language"
        aria-label="Change language"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <span className="text-base" role="img" aria-label={currentConfig.name}>
          {currentConfig.flag}
        </span>
        <span className="hidden sm:inline text-xs font-medium uppercase">
          {currentLang}
        </span>
        <Globe className="h-3.5 w-3.5 opacity-60" />
      </button>

      {isOpen && (
        <div 
          className="absolute right-0 mt-2 w-48 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl z-50 py-1"
          role="listbox"
          aria-label="Select language"
        >
          <div className="px-3 py-2 text-xs font-medium text-zinc-500 uppercase tracking-wider border-b border-zinc-800 mb-1">
            Select Language
          </div>
          {SUPPORTED_LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              type="button"
              onClick={() => handleLanguageChange(lang.code as LanguageCode)}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2 text-sm transition-colors",
                currentLang === lang.code
                  ? "bg-zinc-800/50 text-zinc-100"
                  : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
              )}
              role="option"
              aria-selected={currentLang === lang.code}
            >
              <div className="flex items-center gap-2.5">
                <span className="text-lg" role="img" aria-label={lang.name}>
                  {lang.flag}
                </span>
                <span className={cn(
                  "text-sm",
                  lang.dir === 'rtl' && "font-arabic"
                )}>
                  {lang.name}
                </span>
              </div>
              {currentLang === lang.code && (
                <Check className="h-4 w-4 text-indigo-400" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
