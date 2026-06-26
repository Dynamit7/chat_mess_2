/**
 * Tiny in-app event bus for group "last message" updates.
 *
 * Why: when YOU send a message in a group, the server broadcasts the realtime
 * list update (`newGroupMessage`) to the OTHER members — historically not to the
 * sender. So the sender's own Groups tab wouldn't refresh its lastMessage until
 * a refetch. This bus lets the group chat screen notify the Groups tab locally
 * the instant a message is sent, so the list updates immediately regardless of
 * what the server echoes back.
 */
export type GroupLastMessagePatch = {
  lastMessage?: string;
  lastMessageType?: string;
  lastMessageSender?: string;
  lastMessageTime?: string;
  lastMessageIsForwarded?: boolean;
};

type Listener = (groupId: number, patch: GroupLastMessagePatch) => void;

const listeners = new Set<Listener>();

/** Notify subscribers that a group's last message changed (e.g. after sending). */
export function publishGroupLastMessage(groupId: number, patch: GroupLastMessagePatch): void {
  listeners.forEach((l) => {
    try { l(Number(groupId), patch); } catch { /* ignore listener errors */ }
  });
}

/** Subscribe to group last-message updates. Returns an unsubscribe function. */
export function subscribeGroupLastMessage(cb: Listener): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}
