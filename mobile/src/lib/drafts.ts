/**
 * Per-conversation message drafts (Telegram-style). Stored in AsyncStorage so the
 * unsent text survives navigation and relaunch, and surfaced in the chat/group/
 * channel lists as a "Черновик: …" preview.
 *
 * `writeDraft` persists silently (used for live typing); `commitDraft` persists
 * AND notifies subscribers (used when leaving a screen / clearing) so any mounted
 * list refreshes its previews.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export type DraftKind = 'chat' | 'group' | 'channel';

export const draftKey = (userId: number, kind: DraftKind, id: number | string) =>
  `draft.${userId}.${kind}.${id}`;

const listeners = new Set<() => void>();
export function subscribeDrafts(cb: () => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}
const notify = () => listeners.forEach((l) => l());

export async function getDraft(key: string): Promise<string> {
  try { return (await AsyncStorage.getItem(key)) || ''; } catch { return ''; }
}

/** Persist without notifying — for high-frequency live typing. */
export async function writeDraft(key: string, text: string): Promise<void> {
  try {
    if (text.trim()) await AsyncStorage.setItem(key, text);
    else await AsyncStorage.removeItem(key);
  } catch { /* ignore */ }
}

/** Persist and notify subscribers — for leaving a screen / clearing on send. */
export async function commitDraft(key: string, text: string): Promise<void> {
  await writeDraft(key, text);
  notify();
}

/** Batch-read drafts for a list of conversation ids → Map<id, text>. */
export async function getDraftsFor(
  userId: number,
  kind: DraftKind,
  ids: (number | string)[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!ids.length) return map;
  try {
    const keys = ids.map((id) => draftKey(userId, kind, id));
    const pairs = await AsyncStorage.multiGet(keys);
    pairs.forEach(([, v], i) => { if (v && v.trim()) map.set(String(ids[i]), v); });
  } catch { /* ignore */ }
  return map;
}
