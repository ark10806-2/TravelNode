import { useEffect, useMemo, useState } from 'react';
import { usePersistedState } from './usePersistedState';
import type { ResolvedThemeMode, ThemeMode } from '@/types/theme';

const themeStorageKey = 'japan-trip-theme';

function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'light' || value === 'dark' || value === 'system';
}

function getSystemTheme(): ResolvedThemeMode {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function useTheme() {
  const [theme, setTheme] = usePersistedState<ThemeMode>(themeStorageKey, 'system', isThemeMode);
  const [systemTheme, setSystemTheme] = useState<ResolvedThemeMode>(getSystemTheme);
  const resolvedTheme = useMemo<ResolvedThemeMode>(
    () => (theme === 'system' ? systemTheme : theme),
    [systemTheme, theme]
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const syncSystemTheme = () => setSystemTheme(mediaQuery.matches ? 'dark' : 'light');

    syncSystemTheme();
    mediaQuery.addEventListener('change', syncSystemTheme);
    return () => mediaQuery.removeEventListener('change', syncSystemTheme);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolvedTheme === 'dark');
    document.documentElement.style.colorScheme = resolvedTheme;
  }, [resolvedTheme]);

  return {
    theme,
    resolvedTheme,
    setTheme
  };
}
