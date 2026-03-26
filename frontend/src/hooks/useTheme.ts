import { useState, useEffect, useCallback } from 'react';

export type Theme = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'pulse-theme';

interface UseThemeReturn {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  resolvedTheme: 'light' | 'dark';
}

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'system';
  const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
  return stored && ['light', 'dark', 'system'].includes(stored) ? stored : 'system';
}

function applyTheme(theme: Theme): void {
  if (typeof window === 'undefined') return;
  
  const resolvedTheme = theme === 'system' ? getSystemTheme() : theme;
  const html = document.documentElement;
  
  // Remove both classes first
  html.classList.remove('light', 'dark');
  // Add the resolved theme class
  html.classList.add(resolvedTheme);
  // Set data-theme attribute for CSS selectors
  html.setAttribute('data-theme', resolvedTheme);
}

export function useTheme(): UseThemeReturn {
  const [theme, setThemeState] = useState<Theme>('system');
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('dark');

  // Initialize theme from localStorage
  useEffect(() => {
    const stored = getStoredTheme();
    setThemeState(stored);
    const resolved = stored === 'system' ? getSystemTheme() : stored;
    setResolvedTheme(resolved);
    applyTheme(stored);
  }, []);

  // Listen for system theme changes when in 'system' mode
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = () => {
      if (theme === 'system') {
        const newResolved = getSystemTheme();
        setResolvedTheme(newResolved);
        applyTheme('system');
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem(STORAGE_KEY, newTheme);
    const resolved = newTheme === 'system' ? getSystemTheme() : newTheme;
    setResolvedTheme(resolved);
    applyTheme(newTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prevTheme: Theme) => {
      // Cycle: light -> dark -> system -> light
      const nextTheme: Theme = prevTheme === 'light' ? 'dark' : prevTheme === 'dark' ? 'system' : 'light';
      localStorage.setItem(STORAGE_KEY, nextTheme);
      const resolved = nextTheme === 'system' ? getSystemTheme() : nextTheme;
      setResolvedTheme(resolved);
      applyTheme(nextTheme);
      return nextTheme;
    });
  }, []);

  return { theme, setTheme, toggleTheme, resolvedTheme };
}

// Utility to initialize theme early (call in AppLayout or main.tsx)
export function initializeTheme(): void {
  if (typeof window === 'undefined') return;
  
  const stored = getStoredTheme();
  applyTheme(stored);
}
