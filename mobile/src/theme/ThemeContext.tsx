import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { themes, ThemeId, applyThemeGradients, Palette } from './theme';

export type ThemeMode = 'light' | 'dark' | 'system';
export type Scheme = 'light' | 'dark';

const MODE_KEY = 'nexus.theme';
const THEME_KEY = 'nexus.themeId';
const isMode = (v: any): v is ThemeMode => v === 'light' || v === 'dark' || v === 'system';
const isThemeId = (v: any): v is ThemeId => typeof v === 'string' && v in themes;

type ThemeValue = {
  mode: ThemeMode;              // light / dark / system
  setMode: (m: ThemeMode) => void;
  themeId: ThemeId;             // colour theme (accent + canvas)
  setThemeId: (id: ThemeId) => void;
  scheme: Scheme;               // resolved (system → actual)
  c: Palette;                   // active palette
};

const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('light');
  const [themeId, setThemeIdState] = useState<ThemeId>('aurora');
  const [systemScheme, setSystemScheme] = useState<Scheme>(
    (Appearance.getColorScheme() as Scheme) || 'dark'
  );

  // Restore saved preferences on boot.
  useEffect(() => {
    let alive = true;
    AsyncStorage.multiGet([MODE_KEY, THEME_KEY]).then((pairs) => {
      if (!alive) return;
      const map = Object.fromEntries(pairs);
      if (isMode(map[MODE_KEY])) setModeState(map[MODE_KEY] as ThemeMode);
      if (isThemeId(map[THEME_KEY])) setThemeIdState(map[THEME_KEY] as ThemeId);
    });
    return () => { alive = false; };
  }, []);

  // Track OS appearance changes (only matters while mode === 'system').
  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme((colorScheme as Scheme) || 'dark');
    });
    return () => sub.remove();
  }, []);

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    AsyncStorage.setItem(MODE_KEY, m).catch(() => {});
  }, []);

  const setThemeId = useCallback((id: ThemeId) => {
    setThemeIdState(id);
    AsyncStorage.setItem(THEME_KEY, id).catch(() => {});
  }, []);

  const scheme: Scheme = mode === 'system' ? systemScheme : mode;
  const c = (themes[themeId] ?? themes.aurora)[scheme];

  // Keep the static gradient stops (FAB, send button, rings, bubbles) in sync
  // with the active theme so non-context consumers repaint on the next render.
  applyThemeGradients(c);

  const value = useMemo<ThemeValue>(
    () => ({ mode, setMode, themeId, setThemeId, scheme, c }),
    [mode, setMode, themeId, setThemeId, scheme, c]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}
