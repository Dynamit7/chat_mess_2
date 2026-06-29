/**
 * Lightweight stale-while-revalidate cache for the section list screens
 * (chats / groups / channels). Goal: switching sections shows the LAST list
 * instantly — no spinner, no flash — while a fresh copy is fetched quietly in
 * the background (Telegram-style). Lists still update live over sockets.
 *
 * Two layers:
 *  - in-memory Map: survives a section unmount/remount within the SPA session,
 *    so flipping tabs never shows a blocking spinner.
 *  - localStorage: survives a full page reload / cold start, so the first paint
 *    after F5 isn't a blank spinner either.
 *
 * Only the DEFAULT list (no search term) is cached; search queries keep their
 * normal loading behaviour.
 */
const mem = new Map();

const lsKey = (key) => `listcache:${key}`;

/** Read a cached list, or null if none. Never throws. */
export function getCachedList(key) {
  if (mem.has(key)) return mem.get(key);
  try {
    const raw = localStorage.getItem(lsKey(key));
    if (raw) {
      const val = JSON.parse(raw);
      mem.set(key, val);
      return val;
    }
  } catch {
    /* corrupt JSON / unavailable storage — treat as cache miss */
  }
  return null;
}

/** Persist a list (best-effort). Keep it small so localStorage stays healthy. */
export function setCachedList(key, value) {
  mem.set(key, value);
  try {
    localStorage.setItem(lsKey(key), JSON.stringify(value));
  } catch {
    /* quota exceeded / serialization issue — in-memory copy still set */
  }
}

export const listKeys = {
  chats: (userId) => `chats:${userId}`,
  groups: (userId) => `groups:${userId}`,
  channels: (userId) => `channels:${userId}`,
};

/** Drop all cached lists — call on sign-out so message previews don't linger
 *  in localStorage on a shared browser. */
export function clearListCache() {
  mem.clear();
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith("listcache:"))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    /* storage unavailable — nothing to clear */
  }
}
