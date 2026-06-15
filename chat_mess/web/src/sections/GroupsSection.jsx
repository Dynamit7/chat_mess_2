import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import EntityListSidebar from "../components/EntityListSidebar";
import GroupConversation from "../components/groups/GroupConversation";
import GroupProfileModal from "../components/groups/GroupProfileModal";
import CreateEntityModal from "../components/CreateEntityModal";
import { IUsers, ITrash, ILogout } from "../components/Icon";
import { groupsApi } from "../api/client";
import { useSocket } from "../context/SocketContext";
import { useAuth } from "../context/AuthContext";
import { useUnread } from "../context/UnreadContext";

export default function GroupsSection({ onOpenDM }) {
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
      const idx = prev.findIndex((g) => Number(g.id) === Number(id));
      if (idx === -1) return prev;
      const updated = { ...prev[idx], ...patch };
      const rest = prev.filter((_, i) => i !== idx);
      return toTop ? [updated, ...rest] : [...rest.slice(0, idx), updated, ...rest.slice(idx)];
    });
  }, []);

  const load = useCallback(
    (search) => {
      setLoading(true);
      Promise.all([groupsApi.list(me, search), groupsApi.unreadCounts(me).catch(() => [])])
        .then(([groups, unread]) => {
          const map = new Map((unread || []).map((u) => [Number(u.groupId), u.unreadCount]));
          const list = (groups || []).map((g) => ({ ...g, unreadCount: map.get(Number(g.id)) || 0 }));
          list.sort((a, b) => new Date(b.lastMessageTime || 0) - new Date(a.lastMessageTime || 0));
          setItems(list);
        })
        .catch(() => setItems([]))
        .finally(() => setLoading(false));
    },
    [me]
  );

  const [searchParams] = useSearchParams();
  useEffect(() => { load(""); }, [load]);

  // Deep-link: ?section=groups&open=<id> auto-opens that group once loaded.
  useEffect(() => {
    const openId = searchParams.get("open");
    if (!openId || active) return;
    const found = items.find((g) => Number(g.id) === Number(openId));
    if (found) setActive(found);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  useEffect(() => {
    const onNewGroupMessage = (d) => {
      const gid = Number(d.groupId);
      const isActive = Number(activeRef.current?.id) === gid;
      merge(gid, {
        lastMessage: d.lastMessage,
        lastMessageType: d.lastMessageType || "text",
        lastMessageSender: d.lastMessageSender,
        lastMessageTime: d.lastMessageTime || new Date().toISOString(),
        unreadCount: isActive || Number(d.senderId) === me ? 0 : undefined,
      });
      if (!isActive && Number(d.senderId) !== me) {
        setItems((prev) =>
          prev.map((g) => (Number(g.id) === gid ? { ...g, unreadCount: (g.unreadCount || 0) + 1 } : g))
        );
      }
    };
    const onGroupAdded = () => load("");
    const onGroupCreated = () => load("");
    const onGroupRemoved = ({ groupId }) => {
      setItems((prev) => prev.filter((g) => Number(g.id) !== Number(groupId)));
      if (Number(activeRef.current?.id) === Number(groupId)) setActive(null);
    };
    const onGroupUpdated = ({ groupId, updatedFields }) => merge(groupId, updatedFields || {}, false);

    socket.on("newGroupMessage", onNewGroupMessage);
    socket.on("groupAdded", onGroupAdded);
    socket.on("groupCreated", onGroupCreated);
    socket.on("groupRemoved", onGroupRemoved);
    socket.on("groupUpdated", onGroupUpdated);
    return () => {
      socket.off("newGroupMessage", onNewGroupMessage);
      socket.off("groupAdded", onGroupAdded);
      socket.off("groupCreated", onGroupCreated);
      socket.off("groupRemoved", onGroupRemoved);
      socket.off("groupUpdated", onGroupUpdated);
    };
  }, [socket, me, merge, load]);

  const select = (g) => {
    setActive(g);
    merge(g.id, { unreadCount: 0 }, false);
  };

  useEffect(() => {
    if (active?.id != null) {
      unread.setActiveConv("groups", active.id);
      unread.clear("groups", active.id);
    } else {
      unread.setActiveConv(null, null);
    }
    return () => unread.setActiveConv(null, null);
  }, [active?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleActivity = useCallback((id) => { merge(id, { unreadCount: 0 }, false); unread.clear("groups", id); }, [merge, unread]);
  const handleLastMessage = useCallback((id, patch) => merge(id, patch), [merge]);

  const removeFromList = (id) => {
    setItems((prev) => prev.filter((g) => Number(g.id) !== Number(id)));
    if (Number(activeRef.current?.id) === Number(id)) setActive(null);
  };
  const deleteGroup = async (g) => {
    if (!confirm(`Delete the group "${g.name}"? This cannot be undone.`)) return;
    removeFromList(g.id);
    try { await groupsApi.remove(g.id, me); } catch {}
  };
  const leaveGroup = async (g) => {
    if (!confirm(`Leave the group "${g.name}"?`)) return;
    removeFromList(g.id);
    try { await groupsApi.leave(g.id, me); } catch {}
  };
  const rowMenu = (g) =>
    Number(g.ownerId) === me
      ? [{ label: "Delete group", icon: <ITrash size={16} />, danger: true, onClick: () => deleteGroup(g) }]
      : g.isMember !== false
      ? [{ label: "Leave group", icon: <ILogout size={16} />, danger: true, onClick: () => leaveGroup(g) }]
      : [];

  return (
    <>
      <EntityListSidebar
        title="Groups"
        noun="group"
        items={items}
        loading={loading}
        activeId={active?.id}
        onSelect={select}
        onCreate={() => setCreating(true)}
        onSearch={(term) => load(term)}
        rowMenuItems={rowMenu}
      />
      {active ? (
        <GroupConversation
          key={active.id}
          group={active}
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
              <div className="glow"><IUsers size={48} color="#fff" /></div>
              <h2>Groups</h2>
              <p>Select a group, or create a new one to start chatting with multiple people at once.</p>
            </div>
          </div>
        </section>
      )}

      {creating && (
        <CreateEntityModal
          kind="group"
          onClose={() => setCreating(false)}
          onCreated={(g) => { setItems((prev) => [{ ...g, isMember: true }, ...prev]); setActive({ ...g, isMember: true }); }}
        />
      )}
      {profile && active && (
        <GroupProfileModal
          entity={active}
          kind="group"
          onClose={() => setProfile(false)}
          onLeft={() => { setItems((prev) => prev.filter((g) => Number(g.id) !== Number(active.id))); setActive(null); setProfile(false); }}
          onOpenDM={onOpenDM}
        />
      )}
    </>
  );
}
