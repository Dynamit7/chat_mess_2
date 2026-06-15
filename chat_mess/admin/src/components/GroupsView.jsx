import React, { useEffect, useState, useCallback } from "react";
import Avatar from "./Avatar.jsx";
import MessageThread from "./MessageThread.jsx";
import { fetchGroups, fetchGroupMessages, deleteGroupMessage } from "../api.js";
import { ago, previewText } from "../lib/format.js";
import socket from "../socket.js";
import { decodeGroupMessage } from "../proto/groupMessage.js";

export default function GroupsView({ search }) {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState(null);
  const [msgs, setMsgs] = useState([]);

  const load = useCallback(() => {
    fetchGroups().then((g) => { setGroups(g); setLoading(false); });
  }, []);
  useEffect(() => { load(); }, [load]);

  const open = (g) => {
    setSel(g);
    setMsgs([]);
    fetchGroupMessages(g.id).then(setMsgs);
  };

  // live: group messages arrive as protobuf buffers OR plain objects
  useEffect(() => {
    const onMsg = (raw) => {
      let m;
      try {
        m = raw && (raw instanceof ArrayBuffer || raw?.byteLength != null || raw?.buffer)
          ? decodeGroupMessage(raw)
          : raw;
      } catch { m = raw; }
      if (!m) return;
      load();
      if (sel && Number(m.groupId) === Number(sel.id)) {
        setMsgs((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
      }
    };
    const onDel = ({ messageId }) => setMsgs((prev) => prev.map((x) => (x.id === messageId ? { ...x, isDeleted: true } : x)));
    socket.on("groupMessageReceived", onMsg);
    socket.on("groupMessageDeleted", onDel);
    return () => { socket.off("groupMessageReceived", onMsg); socket.off("groupMessageDeleted", onDel); };
  }, [sel, load]);

  const remove = async (id) => {
    await deleteGroupMessage(id);
    setMsgs((prev) => prev.map((x) => (x.id === id ? { ...x, isDeleted: true } : x)));
  };

  const q = search.trim().toLowerCase();
  const filtered = q ? groups.filter((g) => g.name?.toLowerCase().includes(q)) : groups;

  return (
    <div className="split">
      <div className="list-pane">
        {loading && <div className="loading">Загрузка групп…</div>}
        {!loading && !filtered.length && <div className="loading">Групп нет</div>}
        {filtered.map((g) => (
          <div key={g.id} className={`list-row ${sel?.id === g.id ? "active" : ""}`} onClick={() => open(g)}>
            <Avatar src={g.avatar} name={g.name} />
            <div className="row-body">
              <div className="row-top">
                <span className="row-name">{g.name}</span>
                <span className="row-time">{ago(g.lastTime)}</span>
              </div>
              <div className="row-last">
                {g.lastSender ? <b style={{ color: "var(--text-dim)" }}>{g.lastSender}: </b> : null}
                {previewText({ text: g.lastMessage })}
              </div>
            </div>
            <span className="pill green">👥 {g.memberCount}</span>
          </div>
        ))}
      </div>

      {sel ? (
        <div className="conv">
          <div className="conv-head">
            <Avatar src={sel.avatar} name={sel.name} />
            <div>
              <div className="title">{sel.name}</div>
              <div className="meta">{sel.isPublic ? "публичная" : "приватная"} группа · 👥 {sel.memberCount} · 💬 {sel.messageCount} · владелец {sel.owner?.username || "?"}</div>
            </div>
          </div>
          <MessageThread messages={msgs} onDelete={remove} />
        </div>
      ) : (
        <div className="empty"><div><div className="big">👥</div>Выберите группу слева</div></div>
      )}
    </div>
  );
}
