import { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from "react";
import socket from "../socket";
import { useAuth } from "./AuthContext";
import { messagesApi, groupsApi, channelsApi } from "../api/client";

const UnreadContext = createContext(null);

// Tracks unread counts per section (chats/groups/channels) so the rail can show
// live badges that clear when a conversation is opened/read — like mobile.
export function UnreadProvider({ children }) {
  const { user } = useAuth();
  const me = Number(user?.userId);
  const [counts, setCounts] = useState({ chats: {}, groups: {}, channels: {} });
  const activeRef = useRef({ section: null, id: null });

  const setActiveConv = useCallback((section, id) => {
    activeRef.current = { section, id: id == null ? null : Number(id) };
  }, []);

  const clear = useCallback((section, id) => {
    setCounts((c) => {
      if (!c[section] || !c[section][Number(id)]) return c;
      const next = { ...c, [section]: { ...c[section] } };
      delete next[section][Number(id)];
      return next;
    });
  }, []);

  const bump = useCallback((section, id, delta = 1) => {
    setCounts((c) => ({ ...c, [section]: { ...c[section], [Number(id)]: (c[section][Number(id)] || 0) + delta } }));
  }, []);

  const hydrate = useCallback((section, map) => {
    setCounts((c) => ({ ...c, [section]: map }));
  }, []);

  // Initial counts.
  useEffect(() => {
    if (!me) return;
    messagesApi.getChats(me).then((chats) => {
      const m = {};
      (chats || []).forEach((c) => { if (c.unreadCount > 0) m[Number(c.partnerId)] = c.unreadCount; });
      hydrate("chats", m);
    }).catch(() => {});
    groupsApi.unreadCounts(me).then((arr) => {
      const m = {};
      (arr || []).forEach((u) => { if (u.unreadCount > 0) m[Number(u.groupId)] = u.unreadCount; });
      hydrate("groups", m);
    }).catch(() => {});
    channelsApi.unreadCounts(me).then((arr) => {
      const m = {};
      (arr || []).forEach((u) => { if (u.unreadCount > 0) m[Number(u.channelId)] = u.unreadCount; });
      hydrate("channels", m);
    }).catch(() => {});
  }, [me, hydrate]);

  // Live increments / clears via sockets.
  useEffect(() => {
    if (!me) return;
    const isActive = (section, id) => activeRef.current.section === section && activeRef.current.id === Number(id);

    const onMsg = (m) => {
      if (Number(m.toUserId) !== me) return;       // only messages addressed to me
      // Подтверждаем доставку отправителю (галочки ✓✓), даже если этот чат
      // сейчас не открыт — глобальный обработчик ловит ВСЕ входящие мне.
      if (m.id) socket.emit("messageDelivered", { messageId: m.id });
      const pid = Number(m.fromUserId);
      if (!isActive("chats", pid)) bump("chats", pid);
    };
    const onGroup = (d) => {
      if (Number(d.senderId) === me) return;
      const gid = Number(d.groupId);
      if (!isActive("groups", gid)) bump("groups", gid);
    };
    const onChannel = (m) => {
      if (m.parentMessageId || Number(m.userId) === me) return;
      const cid = Number(m.channelId);
      if (!isActive("channels", cid)) bump("channels", cid);
    };
    const onRead = ({ readerId, partnerId }) => {
      if (Number(readerId) === me) clear("chats", partnerId);
    };
    const onChatsDeleted = ({ partnerIds }) => (partnerIds || []).forEach((p) => clear("chats", p));

    socket.on("messageReceived", onMsg);
    socket.on("newGroupMessage", onGroup);
    socket.on("channelMessageReceived", onChannel);
    socket.on("messagesReadByRecipient", onRead);
    socket.on("chatsDeleted", onChatsDeleted);
    return () => {
      socket.off("messageReceived", onMsg);
      socket.off("newGroupMessage", onGroup);
      socket.off("channelMessageReceived", onChannel);
      socket.off("messagesReadByRecipient", onRead);
      socket.off("chatsDeleted", onChatsDeleted);
    };
  }, [me, bump, clear]);

  const totals = useMemo(() => ({
    chats: Object.values(counts.chats).reduce((a, b) => a + b, 0),
    groups: Object.values(counts.groups).reduce((a, b) => a + b, 0),
    channels: Object.values(counts.channels).reduce((a, b) => a + b, 0),
  }), [counts]);

  const value = { counts, totals, bump, clear, hydrate, setActiveConv };
  return <UnreadContext.Provider value={value}>{children}</UnreadContext.Provider>;
}

export const useUnread = () =>
  useContext(UnreadContext) || { counts: {}, totals: {}, bump: () => {}, clear: () => {}, hydrate: () => {}, setActiveConv: () => {} };
