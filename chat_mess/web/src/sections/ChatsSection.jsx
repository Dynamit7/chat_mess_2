import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import Sidebar from "../components/chat/Sidebar";
import ConversationPane from "../components/chat/ConversationPane";
import UserProfileModal from "../components/UserProfileModal";
import { IChat } from "../components/Icon";
import { messagesApi, usersApi } from "../api/client";
import { useSocket } from "../context/SocketContext";
import { useAuth } from "../context/AuthContext";
import { useUnread } from "../context/UnreadContext";
import { getCachedList, setCachedList, listKeys } from "../lib/listCache";

// 1-on-1 direct messages section (sidebar + conversation pane).
export default function ChatsSection() {
  const { user } = useAuth();
  const socket = useSocket();
  const unread = useUnread();
  const me = Number(user.userId);

  // Paint the last list instantly from cache; only show a spinner on a true
  // cold start (no cache yet). The fresh copy loads quietly in the background.
  const [chats, setChats] = useState(() => getCachedList(listKeys.chats(me)) || []);
  const [loading, setLoading] = useState(() => !getCachedList(listKeys.chats(me)));
  const [onlineIds, setOnlineIds] = useState(() => new Set());
  const [active, setActive] = useState(null);
  const [profileUserId, setProfileUserId] = useState(null);

  const activeRef = useRef(null);
  activeRef.current = active;

  const [searchParams, setSearchParams] = useSearchParams();

  const upsertChat = useCallback((partnerId, patch, { toTop = true } = {}) => {
    setChats((prev) => {
      const idx = prev.findIndex((c) => Number(c.partnerId) === Number(partnerId));
      if (idx === -1) {
        const created = { partnerId: Number(partnerId), unreadCount: 0, ...patch };
        return toTop ? [created, ...prev] : [...prev, created];
      }
      const updated = { ...prev[idx], ...patch };
      const rest = prev.filter((_, i) => i !== idx);
      return toTop ? [updated, ...rest] : [...rest.slice(0, idx), updated, ...rest.slice(idx)];
    });
  }, []);

  useEffect(() => {
    let alive = true;
    messagesApi
      .getChats(me)
      .then((data) => {
        if (!alive) return;
        const list = Array.isArray(data) ? data : [];
        list.sort((a, b) => new Date(b.time || 0) - new Date(a.time || 0));
        setChats(list);
        setOnlineIds(new Set(list.filter((c) => c.isOnline).map((c) => Number(c.partnerId))));
        setCachedList(listKeys.chats(me), list.slice(0, 50));
        setLoading(false);
      })
      .catch(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [me]);

  useEffect(() => {
    const onChatUpdated = ({ partnerId, partnerInfo, lastMessage, unreadCount }) => {
      const isActive = Number(activeRef.current?.partnerId) === Number(partnerId);
      upsertChat(partnerId, {
        username: partnerInfo?.username || partnerInfo?.nickname || undefined,
        picture: partnerInfo?.avatar ?? undefined,
        lastMessage: typeof lastMessage === "object" ? lastMessage?.text : lastMessage,
        lastMessageType: lastMessage?.type || "text",
        time: lastMessage?.createdAt || new Date().toISOString(),
        unreadCount: isActive ? 0 : unreadCount ?? 0,
      });
    };
    const onLastMessage = ({ partnerId, lastMessage, lastMessageType, isForwarded, time }) => {
      upsertChat(partnerId, {
        lastMessage,
        lastMessageType: lastMessageType || "text",
        isForwarded: !!isForwarded,
        time: time || new Date().toISOString(),
      });
    };
    const onReceived = (m) => {
      if (Number(m.toUserId) !== me) return;
      const partnerId = Number(m.fromUserId);
      if (Number(activeRef.current?.partnerId) === partnerId) return;
      setChats((prev) => {
        const idx = prev.findIndex((c) => Number(c.partnerId) === partnerId);
        if (idx === -1) return prev;
        const updated = { ...prev[idx], unreadCount: (prev[idx].unreadCount || 0) + 1 };
        const rest = prev.filter((_, i) => i !== idx);
        return [updated, ...rest];
      });
    };
    const onReadByRecipient = ({ readerId, partnerId }) => {
      if (Number(readerId) === me) upsertChat(partnerId, { unreadCount: 0 }, { toTop: false });
    };
    const onUserOnline = ({ userId }) => setOnlineIds((s) => new Set(s).add(Number(userId)));
    const onUserOffline = ({ userId }) =>
      setOnlineIds((s) => {
        const n = new Set(s);
        n.delete(Number(userId));
        return n;
      });
    const onChatsDeleted = ({ partnerIds }) => {
      const ids = new Set((partnerIds || []).map(Number));
      setChats((prev) => prev.filter((c) => !ids.has(Number(c.partnerId))));
      if (ids.has(Number(activeRef.current?.partnerId))) setActive(null);
    };

    socket.on("chatUpdated", onChatUpdated);
    socket.on("lastMessageUpdated", onLastMessage);
    socket.on("messageReceived", onReceived);
    socket.on("messagesReadByRecipient", onReadByRecipient);
    socket.on("userOnline", onUserOnline);
    socket.on("userOffline", onUserOffline);
    socket.on("chatsDeleted", onChatsDeleted);
    return () => {
      socket.off("chatUpdated", onChatUpdated);
      socket.off("lastMessageUpdated", onLastMessage);
      socket.off("messageReceived", onReceived);
      socket.off("messagesReadByRecipient", onReadByRecipient);
      socket.off("userOnline", onUserOnline);
      socket.off("userOffline", onUserOffline);
      socket.off("chatsDeleted", onChatsDeleted);
    };
  }, [socket, me, upsertChat]);

  useEffect(() => {
    const to = searchParams.get("to");
    if (!to || Number(to) === me) return;
    usersApi
      .getById(to)
      .then((u) => {
        if (!u) return;
        setActive({
          partnerId: Number(u.id ?? to),
          username: u.username || u.nickname || "User",
          picture: u.avatar || null,
        });
      })
      .catch(() => {})
      .finally(() => {
        searchParams.delete("to");
        setSearchParams(searchParams, { replace: true });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the rail badge in sync: clear the open chat, mark it active.
  useEffect(() => {
    if (active?.partnerId != null) {
      unread.setActiveConv("chats", active.partnerId);
      unread.clear("chats", active.partnerId);
    } else {
      unread.setActiveConv(null, null);
    }
    return () => unread.setActiveConv(null, null);
  }, [active?.partnerId]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectChat = (partner) => {
    setActive(partner);
    upsertChat(
      partner.partnerId,
      { username: partner.username, picture: partner.picture, unreadCount: 0 },
      { toTop: false }
    );
  };

  const handlePartnerActivity = useCallback(
    (partnerId, { read }) => {
      if (read) upsertChat(partnerId, { unreadCount: 0 }, { toTop: false });
    },
    [upsertChat]
  );

  const deleteChat = (c) => {
    if (!confirm(`Delete your chat with ${c.username}?`)) return;
    setChats((prev) => prev.filter((x) => Number(x.partnerId) !== Number(c.partnerId)));
    if (Number(active?.partnerId) === Number(c.partnerId)) setActive(null);
    messagesApi.deleteChats(me, [c.partnerId]).catch(() => {});
  };

  return (
    <>
      <Sidebar
        chats={chats}
        activePartnerId={active?.partnerId}
        onSelect={selectChat}
        onlineIds={onlineIds}
        loading={loading}
        onDeleteChat={deleteChat}
        onViewProfile={(id) => setProfileUserId(id)}
      />
      {active ? (
        <ConversationPane
          key={active.partnerId}
          partner={{ ...active, isOnline: onlineIds.has(Number(active.partnerId)) }}
          onBack={() => setActive(null)}
          onPartnerActivity={handlePartnerActivity}
        />
      ) : (
        <section className="pane">
          <div className="pane-empty">
            <div>
              <div className="glow"><IChat size={48} color="#fff" /></div>
              <h2>Your messages</h2>
              <p>
                Select a conversation from the left, or search for someone by name
                to start a new encrypted chat.
              </p>
            </div>
          </div>
        </section>
      )}

      {profileUserId && (
        <UserProfileModal
          userId={profileUserId}
          onClose={() => setProfileUserId(null)}
          onMessage={(p) => { setProfileUserId(null); selectChat(p); }}
        />
      )}
    </>
  );
}
