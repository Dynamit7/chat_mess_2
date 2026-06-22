/**
 * A Set<number> of ids backed by AsyncStorage — used for per-user UI prefs such
 * as pinned / muted conversations that must survive an app relaunch. Pass a null
 * key (e.g. while the user id isn't known yet) to keep it inert; the set loads
 * once the key becomes available and only writes on explicit toggles.
 */
import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export function usePersistentIdSet(key: string | null) {
  const [set, setSet] = useState<Set<number>>(() => new Set());

  useEffect(() => {
    if (!key) return;
    let alive = true;
    AsyncStorage.getItem(key)
      .then((raw) => {
        if (!alive || !raw) return;
        try {
          const arr = JSON.parse(raw);
          if (Array.isArray(arr)) setSet(new Set(arr.map(Number)));
        } catch {
          /* corrupt value — ignore */
        }
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [key]);

  const toggle = useCallback((id: number) => {
    setSet((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      if (key) AsyncStorage.setItem(key, JSON.stringify([...next])).catch(() => {});
      return next;
    });
  }, [key]);

  return [set, toggle] as const;
}
