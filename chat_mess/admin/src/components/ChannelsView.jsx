import React, { useEffect, useState, useCallback } from "react";
import Avatar from "./Avatar.jsx";
import MessageThread from "./MessageThread.jsx";
import { fetchChannels, fetchChannelMessages, deleteChannelMessage } from "../api.js";
import { ago, previewText } from "../lib/format.js";
import socket from "../socket.js";

export default function ChannelsView({ search }) {
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState(null);
  const [msgs, setMsgs] = useState([]);

  const load = useCallback(() => {
    fetchChannels().then((c) => { setChannels(c); setLoading(false); });
  }, []);
  useEffect(() => { load(); }, [load]);

  const open = (c) => {
    setSel(c);
    setMsgs([]);
    fetchChannelMessages(c.id).then(setMsgs);
  };

  useEffect(() => {
    const onMsg = (m) => {
      if (!m || m.parentMessageId) return; // skip comments
      load();
      if (sel && Number(m.channelId) === Number(sel.id)) {
        setMsgs((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
      }
    };
    const onDel = ({ messageId }) =>
      setMsgs((prev) => prev.map((x) => (String(x.id) === String(messageId) ? { ...x, isDeleted: true } : x)));
    socket.on("channelMessageReceived", onMsg);
    socket.on("channelMessageDeleted", onDel);
    return () => { socket.off("channelMessageReceived", onMsg); socket.off("channelMessageDeleted", onDel); };
  }, [sel, load]);

  const remove = async (id) => {
    await deleteChannelMessage(id);
    setMsgs((prev) => prev.map((x) => (x.id === id ? { ...x, isDeleted: true } : x)));
  };

  const q = search.trim().toLowerCase();
  const filtered = q ? channels.filter((c) => c.name?.toLowerCase().includes(q)) : channels;

  return (
    <div className="split">
      <div className="list-pane">
        {loading && <div className="loading">Загрузка каналов…</div>}
        {!loading && !filtered.length && <div className="loading">Каналов нет</div>}
        {filtered.map((c) => (
          <div key={c.id} className={`list-row ${sel?.id === c.id ? "active" : ""}`} onClick={() => open(c)}>
            <Avatar src={c.avatar} name={c.name} />
            <div className="row-body">
              <div className="row-top">
                <span className="row-name">📢 {c.name}</span>
                <span className="row-time">{ago(c.lastTime)}</span>
              </div>
              <div className="row-last">{previewText({ text: c.lastMessage })}</div>
            </div>
            <span className="pill accent">👥 {c.memberCount}</span>
          </div>
        ))}
      </div>

      {sel ? (
        <div className="conv">
          <div className="conv-head">
            <Avatar src={sel.avatar} name={sel.name} />
            <div>
              <div className="title">📢 {sel.name}</div>
              <div className="meta">{sel.isPublic ? "публичный" : "приватный"} канал · 👥 {sel.memberCount} · 💬 {sel.messageCount} · владелец {sel.owner?.username || "?"}</div>
            </div>
          </div>
          <MessageThread messages={msgs} onDelete={remove} />
        </div>
      ) : (
        <div className="empty"><div><div className="big">📢</div>Выберите канал слева</div></div>
      )}
    </div>
  );
}
