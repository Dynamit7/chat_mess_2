import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { dictionaries, LANGUAGES, LangCode, TKey } from './translations';

export { LANGUAGES } from './translations';
export type { LangCode, TKey } from './translations';

const STORAGE_KEY = 'nexus.lang';
const DEFAULT_LANG: LangCode = 'ru';
const isLang = (v: any): v is LangCode => LANGUAGES.some((l) => l.code === v);

type TVars = Record<string, string | number>;
type I18nValue = {
  lang: LangCode;
  setLang: (code: LangCode) => void;
  t: (key: TKey, vars?: TVars) => string;
  ready: boolean;
};

const interpolate = (s: string, vars?: TVars) =>
  vars ? s.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`)) : s;

const I18nContext = createContext<I18nValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<LangCode>(DEFAULT_LANG);
  const [ready, setReady] = useState(false);

  // Restore the saved interface language on boot.
  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (alive && isLang(saved)) setLangState(saved);
    }).finally(() => { if (alive) setReady(true); });
    return () => { alive = false; };
  }, []);

  const setLang = useCallback((code: LangCode) => {
    setLangState(code);
    AsyncStorage.setItem(STORAGE_KEY, code).catch(() => {});
  }, []);

  const value = useMemo<I18nValue>(() => {
    const dict = dictionaries[lang] || dictionaries[DEFAULT_LANG];
    return {
      lang,
      setLang,
      ready,
      // Fall back to English, then the raw key, so a missing string never crashes.
      t: (key: TKey, vars?: TVars) => interpolate(dict[key] ?? dictionaries.en[key] ?? key, vars),
    };
  }, [lang, setLang, ready]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useT() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useT must be used within a LanguageProvider');
  return ctx;
}
