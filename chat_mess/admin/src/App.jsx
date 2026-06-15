import React, { useEffect, useRef, useState } from "react";
import Login from "./components/Login.jsx";
import Overview from "./components/Overview.jsx";
import LiveFeed from "./components/LiveFeed.jsx";
import DialogsView from "./components/DialogsView.jsx";
import GroupsView from "./components/GroupsView.jsx";
import ChannelsView from "./components/ChannelsView.jsx";
import UsersView from "./components/UsersView.jsx";
import socket, { joinAsAdmin } from "./socket.js";
import { getAdminToken, clearAdminToken, fetchUsers, fetchGroups, fetchChannels } from "./api.js";
import { decodeGroupMessage } from "./proto/groupMessage.js";
import { previewText } from "./lib/format.js";

const NAV = [
  { id: "overview", ico: "📊", label: "Обзор" },
  { id: "live", ico: "📡", label: "Прямой эфир" },
  { id: "dialogs", ico: "💬", label: "Личные чаты" },
  { id: "groups", ico: "👥", label: "Группы" },
  { id: "channels", ico: "📢", label: "Каналы" },
  { id: "users", ico: "🧑‍🤝‍🧑", label: "Пользователи" },
];

const TITLES = {
  overview: ["Обзор платформы", "ключевые метрики, обновляются автоматически"],
  live: ["Прямой эфир", "все сообщения всех чатов в реальном времени"],
  dialogs: ["Личные чаты", "переписка любых двух пользователей"],
  groups: ["Группы", "сообщения во всех группах"],
  channels: ["Каналы", "публикации во всех каналах"],
  users: ["Пользователи", "управление и модерация аккаунтов"],
};

let uidSeq = 0;

export default function App() {
  const [authed, setAuthed] = useState(!!getAdminToken());
  const [section, setSection] = useState("overview");
  const [search, setSearch] = useState("");
  const [connected, setConnected] = useState(false);
  const [events, setEvents] = useState([]);
  const maps = useRef({ users: {}, groups: {}, channels: {} });

  // connect socket + load name maps once authed
  useEffect(() => {
    if (!authed) return;
    socket.connect();
    joinAsAdmin();
    const onConn = () => setConnected(true);
    const onDisc = () => setConnected(false);
    socket.on("connect", onConn);
    socket.on("disconnect", onDisc);
    if (socket.connected) setConnected(true);

    const buildMaps = async () => {
      try {
        const [u, g, c] = await Promise.all([fetchUsers(), fetchGroups(), fetchChannels()]);
        maps.current.users = Object.fromEntries(u.map((x) => [x.id, x.username]));
        maps.current.groups = Object.fromEntries(g.map((x) => [x.id, x.name]));
        maps.current.channels = Object.fromEntries(c.map((x) => [x.id, x.name]));
      } catch {}
    };
    buildMaps();

    return () => {
      socket.off("connect", onConn);
      socket.off("disconnect", onDisc);
    };
  }, [authed]);

  // global live-feed capture (independent of the per-section listeners)
  useEffect(() => {
    if (!authed) return;
    const push = (ev) => setEvents((prev) => [{ ...ev, uid: ++uidSeq }, ...prev].slice(0, 250));
    const U = (id) => maps.current.users[id] || `Пользователь #${id}`;

    const onDM = (m) => push({
      kind: "dm", time: m.createdAt || Date.now(),
      from: U(m.fromUserId), scope: U(m.toUserId),
      text: previewText(m) || "(вложение)",
    });
    const onGroup = (raw) => {
      let m = raw;
      try {
        if (raw && (raw instanceof ArrayBuffer || raw?.byteLength != null || raw?.buffer)) m = decodeGroupMessage(raw);
      } catch { return; }
      if (!m) return;
      push({
        kind: "group", time: m.createdAt || Date.now(),
        from: m.sender?.username || U(m.userId || m.fromUserId),
        scope: maps.current.groups[m.groupId] || `группа #${m.groupId}`,
        text: previewText(m) || "(вложение)",
      });
    };
    const onChannel = (m) => {
      if (!m || m.parentMessageId) return;
      push({
        kind: "channel", time: m.createdAt || Date.now(),
        from: m.sender?.username || U(m.userId),
        scope: maps.current.channels[m.channelId] || `канал #${m.channelId}`,
        text: previewText(m) || "(вложение)",
      });
    };
    socket.on("messageReceived", onDM);
    socket.on("groupMessageReceived", onGroup);
    socket.on("channelMessageReceived", onChannel);
    return () => {
      socket.off("messageReceived", onDM);
      socket.off("groupMessageReceived", onGroup);
      socket.off("channelMessageReceived", onChannel);
    };
  }, [authed]);

  const logout = () => {
    clearAdminToken();
    socket.disconnect();
    setAuthed(false);
    setEvents([]);
  };

  if (!authed) return <Login onSuccess={() => setAuthed(true)} />;

  const [title, sub] = TITLES[section];
  const showSearch = ["dialogs", "groups", "channels", "users"].includes(section);

  return (
    <div className="shell">
      <aside className="rail">
        <div className="brand">
          <div className="brand-logo">🛡️</div>
          <div>
            <div className="brand-name">DeFensy</div>
            <div className="brand-sub">ADMIN CONSOLE</div>
          </div>
        </div>
        <nav className="nav">
          {NAV.map((n) => (
            <button
              key={n.id}
              className={`nav-item ${section === n.id ? "active" : ""}`}
              onClick={() => { setSection(n.id); setSearch(""); }}
            >
              <span className="nav-ico">{n.ico}</span>
              {n.label}
              {n.id === "live" && events.length > 0 && <span className="nav-badge">{events.length}</span>}
            </button>
          ))}
        </nav>
        <div className="rail-foot">
          <div className="conn">
            <span className={`dot ${connected ? "on" : ""}`} />
            {connected ? "В эфире" : "Нет связи"}
          </div>
          <button className="nav-item" onClick={logout}>
            <span className="nav-ico">⏻</span> Выйти
          </button>
        </div>
      </aside>

      <main className="main">
        <div className="topbar">
          <div>
            <h2>{title}</h2>
            <div className="sub">{sub}</div>
          </div>
          {showSearch && (
            <input
              className="search"
              placeholder="Поиск…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          )}
        </div>

        <div className="content" style={["dialogs", "groups", "channels"].includes(section) ? { padding: 0, overflow: "hidden" } : undefined}>
          {section === "overview" && <Overview liveCount={events.length} />}
          {section === "live" && <LiveFeed events={events} onClear={() => setEvents([])} />}
          {section === "dialogs" && <DialogsView search={search} />}
          {section === "groups" && <GroupsView search={search} />}
          {section === "channels" && <ChannelsView search={search} />}
          {section === "users" && <UsersView search={search} />}
        </div>
      </main>
    </div>
  );
}
