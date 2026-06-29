/**
 * Offline cache backed by expo-sqlite.
 *
 * Strategy: while the user is ONLINE we proactively write the latest server data
 * here (chats, groups, channels, recent messages). While OFFLINE the screens read
 * from this local DB instead of hitting the API.
 *
 * A single `cache` table holds JSON blobs keyed by a string (e.g. `chats:42`). This
 * keeps the schema trivial while still being real SQLite, and JSON round-trips the
 * exact shapes the screens already render.
 */
import * as SQLite from 'expo-sqlite';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync('rossi-offline.db').then(async (db) => {
      await db.execAsync(
        'CREATE TABLE IF NOT EXISTS cache (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL, updatedAt INTEGER NOT NULL);'
      );
      return db;
    });
  }
  return dbPromise;
}

/** Persist a JSON-serialisable value under a key. Never throws. */
export async function cacheSet(key: string, value: unknown): Promise<void> {
  try {
    const db = await getDb();
    await db.runAsync(
      'INSERT OR REPLACE INTO cache (key, value, updatedAt) VALUES (?, ?, ?);',
      key,
      JSON.stringify(value),
      Date.now()
    );
  } catch {
    /* caching is best-effort — ignore failures (e.g. web without SQLite) */
  }
}

/** Read a previously cached value, or null if missing/unavailable. Never throws. */
export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const db = await getDb();
    const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM cache WHERE key = ?;', key);
    return row ? (JSON.parse(row.value) as T) : null;
  } catch {
    return null;
  }
}

// Key builders — keep cache keys consistent across screens.
export const cacheKeys = {
  chats: (userId: number) => `chats:${userId}`,
  groups: (userId: number) => `groups:${userId}`,
  channels: (userId: number) => `channels:${userId}`,
  directMessages: (chatKey: string) => `messages:direct:${chatKey}`,
  groupMessages: (groupId: number) => `messages:group:${groupId}`,
  channelMessages: (channelId: number) => `messages:channel:${channelId}`,
  // Single-entity profile/info screens — cached so opening a profile paints
  // instantly and the network refresh happens behind a thin top bar.
  userProfile: (userId: number) => `profile:user:${userId}`,
  groupInfo: (groupId: number) => `info:group:${groupId}`,
  groupMembers: (groupId: number) => `members:group:${groupId}`,
  channelInfo: (channelId: number) => `info:channel:${channelId}`,
  channelMembers: (channelId: number) => `members:channel:${channelId}`,
};
