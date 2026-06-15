import React, { useEffect, useState, useCallback } from "react";
import Avatar from "./Avatar.jsx";
import MessageThread from "./MessageThread.jsx";
import { fetchDialogs, fetchDialogMessages, deleteDirectMessage } from "../api.js";
import { ago, previewText } from "../lib/format.js";
import socket from "../socket.js";

export default function DialogsView({ search }) {
  const [dialogs, setDialogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState(null);          // {user1, user2}
  const [msgs, setMsgs] = useState([]);

  const load = useCallback(() => {
    fetchDialogs().then((d) => { setDialogs(d); setLoading(false); });
  }, []);
  useEffect(() => { load(); }, [load]);

  const openDialog = (d) => {
    setSel(d);
    setMsgs([]);
    fetchDialogMessages(d.user1.id, d.user2.id).then(setMsgs);
  };

  // live: a new DM anywhere → refresh list; if it belongs to the open thread, append
  useEffect(() => {
    const onMsg = (m) => {
      load();
      if (sel && [m.fromUserId, m.toUserId].includes(sel.user1.id) && [m.fromUserId, m.toUserId].includes(sel.user2.id)) {
        setMsgs((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
      }
    };
    const onDel = ({ messageId }) => setMsgs((prev) => prev.map((x) => (x.id === messageId ? { ...x, isDeleted: true } : x)));
    socket.on("messageReceived", onMsg);
    socket.on("messageDeleted", onDel);
    return () => { socket.off("messageReceived", onMsg); socket.off("messageDeleted", onDel); };
  }, [sel, load]);

  const remove = async (id) => {
    await deleteDirectMessage(id);
    setMsgs((prev) => prev.map((x) => (x.id === id ? { ...x, isDeleted: true } : x)));
  };

  const q = search.trim().toLowerCase();
  const filtered = q
    ? dialogs.filter((d) => `${d.user1.username} ${d.user2.username}`.toLowerCase().includes(q))
    : dialogs;

  return (
    <div className="split">
      <div className="list-pane">
        {loading && <div className="loading">Загрузка диалогов…</div>}
        {!loading && !filtered.length && <div className="loading">Личных диалогов нет</div>}
        {filtered.map((d) => (
          <div
            key={d.id}
            className={`list-row ${sel?.id === d.id ? "active" : ""}`}
            onClick={() => openDialog(d)}
          >
            <div style={{ display: "flex" }}>
              <Avatar src={d.user1.avatar} name={d.user1.username} size="sm" />
              <Avatar src={d.user2.avatar} name={d.user2.username} size="sm" style={{ marginLeft: -10 }} />
            </div>
            <div className="row-body">
              <div className="row-top">
                <span className="row-name">{d.user1.username} ⇄ {d.user2.username}</span>
                <span className="row-time">{ago(d.lastTime)}</span>
              </div>
              <div className="row-last">{previewText({ text: d.lastMessage, type: d.lastType })}</div>
            </div>
            <span className="pill">{d.count}</span>
          </div>
        ))}
      </div>

      {sel ? (
        <div className="conv">
          <div className="conv-head">
            <Avatar src={sel.user1.avatar} name={sel.user1.username} />
            <Avatar src={sel.user2.avatar} name={sel.user2.username} style={{ marginLeft: -14 }} />
            <div>
              <div className="title">{sel.user1.username} ⇄ {sel.user2.username}</div>
              <div className="meta">личная переписка · {msgs.length} сообщений</div>
            </div>
          </div>
          <MessageThread messages={msgs} onDelete={remove} />
        </div>
      ) : (
        <div className="empty"><div><div className="big">🕵️</div>Выберите диалог слева,<br />чтобы читать переписку в реальном времени</div></div>
      )}
    </div>
  );
}
