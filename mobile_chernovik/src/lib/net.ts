/**
 * Connectivity helpers built on @react-native-community/netinfo.
 * `isConnected !== false` is treated as online so an unknown state never
 * blocks the API (we'd rather try and fall back to cache on a real failure).
 */
import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';

export async function getIsOnline(): Promise<boolean> {
  try {
    const state = await NetInfo.fetch();
    return state.isConnected !== false;
  } catch {
    return true;
  }
}

/** Live online/offline flag for banners and conditional UI. */
export function useIsOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const unsub = NetInfo.addEventListener((s) => setOnline(s.isConnected !== false));
    NetInfo.fetch().then((s) => setOnline(s.isConnected !== false)).catch(() => {});
    return () => unsub();
  }, []);
  return online;
}
