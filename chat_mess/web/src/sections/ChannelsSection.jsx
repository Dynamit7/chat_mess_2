import { useState, useEffect, useRef, useCallback } from "react";
import EntityListSidebar from "../components/EntityListSidebar";
import ChannelFeed from "../components/channels/ChannelFeed";
import GroupProfileModal from "../components/groups/GroupProfileModal";
import CreateEntityModal from "../components/CreateEntityModal";
import { IBroadcast, ITrash, ILogout } from "../components/Icon";
import { channelsApi } from "../api/client";
import { useSocket } from "../context/SocketContext";
import { useAuth } from "../context/AuthContext";
import { useUnread } from "../context/UnreadContext";

export default function ChannelsSection() {
  const { user } = useAuth();
  const socket = useSocket();
  const unread = useUnread();
  const me = Number(user.userId);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(null);
  const [creating, setCreating] = useState(false);
  const [profile, setProfile] = useState(false);

  const activeRef = useRef(null);
  activeRef.current = active;

  const merge = useCallback((id, patch, toTop = true) => {
    setItems((prev) => {
      const idx = prev.findIndex((c) => Number(c.id) === Number(id));
      if (idx === -1) return prev;
      const updated = { ...prev[idx], ...patch };
      const rest = prev.filter((_, i) => i !== idx);
      return toTop ? [updated, ...rest] : [...rest.slice(0, idx), updated, ...rest.slice(idx)];
    });
  }, []);

  const load = useCallback(
    (search) => {
      setLoading(true);
      Promise.all([channelsApi.list(me, search), channelsApi.unreadCounts(me).catch(() => [])])
        .then(([channels, unread]) => {
          const map = new Map((unread || []).map((u) => [Number(u.channelId), u.unreadCount]));
          const list = (channels || []).map((c) => ({ ...c, unreadCount: map.get(Number(c.id)) || 0 }));
          list.sort((a, b) => new Date(b.lastMessageTime || 0) - new Date(a.lastMessageTime || 0));
          setItems(list);
        })
        .catch(() => setItems([]))
        .finally(() => setLoading(false));
    },
    [me]
  );

  useEffect(() => { load(""); }, [load]);

  useEffect(() => {
    const onMsg = (m) => {
      if (m.parentMessageId) return;
      const cid = Number(m.channelId);
      const isActive = Number(activeRef.current?.id) === cid;
      merge(cid, {
        lastMessage: m.text || (m.type === "image" ? "📷 Photo" : "Post"),
        lastMessageType: m.type || "text",
        lastMessageTime: m.createdAt || new Date().toISOString(),
      });
      if (!isActive && Number(m.userId) !== me) {
        setItems((prev) => prev.map((c) => (Number(c.id) === cid ? { ...c, unreadCount: (c.unreadCount || 0) + 1 } : c)));
      }
    };
    const onAdded = () => load("");
    const onCreated = () => load("");
    const onRemoved = ({ channelId }) => {
      setItems((prev) => prev.filter((c) => Number(c.id) !== Number(channelId)));
      if (Number(activeRef.current?.id) === Number(channelId)) setActive(null);
    };
    const onUpdated = ({ channelId, updatedFields }) => merge(channelId, updatedFields || {}, false);

    socket.on("channelMessageReceived", onMsg);
    socket.on("channelAdded", onAdded);
    socket.on("channelCreated", onCreated);
    socket.on("channelRemoved", onRemoved);
    socket.on("channelUpdated", onUpdated);
    return () => {
      socket.off("channelMessageReceived", onMsg);
      socket.off("channelAdded", onAdded);
      socket.off("channelCreated", onCreated);
      socket.off("channelRemoved", onRemoved);
      socket.off("channelUpdated", onUpdated);
    };
  }, [socket, me, merge, load]);

  const select = (c) => {
    setActive(c);
    merge(c.id, { unreadCount: 0 }, false);
  };

  useEffect(() => {
    if (active?.id != null) {
      unread.setActiveConv("channels", active.id);
      unread.clear("channels", active.id);
    } else {
      unread.setActiveConv(null, null);
    }
    return () => unread.setActiveConv(null, null);
  }, [active?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleActivity = useCallback((id) => { merge(id, { unreadCount: 0 }, false); unread.clear("channels", id); }, [merge, unread]);
  const handleLastMessage = useCallback((id, patch) => merge(id, patch), [merge]);

  const removeFromList = (id) => {
    setItems((prev) => prev.filter((c) => Number(c.id) !== Number(id)));
    if (Number(activeRef.current?.id) === Number(id)) setActive(null);
  };
  const deleteChannel = async (c) => {
    if (!confirm(`Delete the channel "${c.name}"? This cannot be undone.`)) return;
    removeFromList(c.id);
    try { await channelsApi.remove(c.id, me); } catch {}
  };
  const leaveChannel = async (c) => {
    if (!confirm(`Unsubscribe from "${c.name}"?`)) return;
    removeFromList(c.id);
    try { await channelsApi.leave(c.id, me); } catch {}
  };
  const rowMenu = (c) =>
    Number(c.ownerId) === me
      ? [{ label: "Delete channel", icon: <ITrash size={16} />, danger: true, onClick: () => deleteChannel(c) }]
      : c.isMember !== false
      ? [{ label: "Unsubscribe", icon: <ILogout size={16} />, danger: true, onClick: () => leaveChannel(c) }]
      : [];

  return (
    <>
      <EntityListSidebar
        title="Channels"
        noun="channel"
        items={items}
        loading={loading}
        activeId={active?.id}
        onSelect={select}
        onCreate={() => setCreating(true)}
        onSearch={(term) => load(term)}
        rowMenuItems={rowMenu}
      />
      {active ? (
        <ChannelFeed
          key={active.id}
          channel={active}
          onBack={() => setActive(null)}
          onOpenProfile={() => setProfile(true)}
          onJoined={() => { merge(active.id, { isMember: true }); setActive((a) => ({ ...a, isMember: true })); }}
          onActivity={handleActivity}
          onLastMessage={handleLastMessage}
        />
      ) : (
        <section className="pane">
          <div className="pane-empty">
            <div>
              <div className="glow"><IBroadcast size={48} color="#fff" /></div>
              <h2>Channels</h2>
              <p>Broadcast to your audience. Select a channel or create one to start posting.</p>
            </div>
          </div>
        </section>
      )}

      {creating && (
        <CreateEntityModal
          kind="channel"
          onClose={() => setCreating(false)}
          onCreated={(c) => { setItems((prev) => [{ ...c, isMember: true }, ...prev]); setActive({ ...c, isMember: true }); }}
        />
      )}
      {profile && active && (
        <GroupProfileModal
          entity={active}
          kind="channel"
          onClose={() => setProfile(false)}
          onLeft={() => { setItems((prev) => prev.filter((c) => Number(c.id) !== Number(active.id))); setActive(null); setProfile(false); }}
        />
      )}
    </>
  );
}
