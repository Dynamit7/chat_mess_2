/**
 * Token / session storage.
 *
 * On native we use SecureStore (keychain / keystore). On web SecureStore isn't
 * available, so we fall back to AsyncStorage (which is backed by localStorage).
 * A synchronous in-memory cache lets request interceptors and the socket auth
 * callback read the token without awaiting.
 */
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type Session = {
  token: string;
  refreshToken?: string;
  userId: number;
  username: string;
  nickname?: string;
  avatar?: string;
};

const KEY = 'nexus.session';
const useSecure = Platform.OS !== 'web';

const backend = {
  get: (k: string) => (useSecure ? SecureStore.getItemAsync(k) : AsyncStorage.getItem(k)),
  set: (k: string, v: string) => (useSecure ? SecureStore.setItemAsync(k, v) : AsyncStorage.setItem(k, v)),
  del: (k: string) => (useSecure ? SecureStore.deleteItemAsync(k) : AsyncStorage.removeItem(k)),
};

let cache: Session | null = null;

export const sessionCache = {
  get: () => cache,
  getToken: () => cache?.token,
};

export async function loadSession(): Promise<Session | null> {
  try {
    const raw = await backend.get(KEY);
    cache = raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    cache = null;
  }
  return cache;
}

export async function saveSession(s: Session): Promise<void> {
  cache = s;
  try {
    await backend.set(KEY, JSON.stringify(s));
  } catch {
    // Persistence failed (e.g. unsupported platform) — keep the in-memory session
    // so the current run still works.
  }
}

export async function patchSession(patch: Partial<Session>): Promise<Session | null> {
  if (!cache) return null;
  cache = { ...cache, ...patch };
  try {
    await backend.set(KEY, JSON.stringify(cache));
  } catch {
    /* ignore */
  }
  return cache;
}

export async function clearSession(): Promise<void> {
  cache = null;
  try {
    await backend.del(KEY);
  } catch {
    /* ignore */
  }
}
