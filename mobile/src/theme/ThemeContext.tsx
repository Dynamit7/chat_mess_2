import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { palettes, Palette } from './theme';

export type ThemeMode = 'light' | 'dark' | 'system';
export type Scheme = 'light' | 'dark';

const STORAGE_KEY = 'nexus.theme';
const isMode = (v: any): v is ThemeMode => v === 'light' || v === 'dark' || v === 'system';

type ThemeValue = {
  mode: ThemeMode;          // user's choice
  setMode: (m: ThemeMode) => void;
  scheme: Scheme;           // resolved (system → actual)
  c: Palette;               // active palette
};

const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('dark');
  const [systemScheme, setSystemScheme] = useState<Scheme>(
    (Appearance.getColorScheme() as Scheme) || 'dark'
  );

  // Restore the saved preference on boot.
  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (alive && isMode(saved)) setModeState(saved);
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
    AsyncStorage.setItem(STORAGE_KEY, m).catch(() => {});
  }, []);

  const scheme: Scheme = mode === 'system' ? systemScheme : mode;

  const value = useMemo<ThemeValue>(
    () => ({ mode, setMode, scheme, c: palettes[scheme] }),
    [mode, setMode, scheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}
