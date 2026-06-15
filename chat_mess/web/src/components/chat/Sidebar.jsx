import { useState, useEffect, useRef } from "react";
import Avatar from "../Avatar";
import { ISearch, IClose, IMore, ITrash, IUser } from "../Icon";
import { usersApi } from "../../api/client";
import { chatStamp } from "../../lib/format";
import { useAuth } from "../../context/AuthContext";

function RowMenu({ items }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);
  return (
    <div className="row-menu" ref={ref} onClick={(e) => e.stopPropagation()}>
      <button className="row-menu-btn" onClick={() => setOpen((v) => !v)}><IMore size={16} /></button>
      {open && (
        <div className="menu" style={{ right: 0, top: 32 }}>
          {items.map((it, i) => (
            <button key={i} className={`menu-item ${it.danger ? "danger" : ""}`} onClick={() => { setOpen(false); it.onClick(); }}>
              {it.icon} {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const previewText = (chat) => {
  if (chat.lastMessageType === "image") return "📷 Photo";
  if (chat.lastMessageType === "video") return "🎬 Video";
  if (chat.lastMessageType === "voice" || chat.lastMessageType === "audio") return "🎙 Voice message";
  if (chat.lastMessageType === "file") return "📎 File";
  if (chat.lastMessageType === "poll") return "📊 Poll";
  return chat.lastMessage || "No messages yet";
};

export default function Sidebar({ chats, activePartnerId, onSelect, onlineIds, loading, onDeleteChat, onViewProfile }) {
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const timer = useRef();

  useEffect(() => {
    clearTimeout(timer.current);
    const term = q.trim();
    if (!term) {
      setResults(null);
      return;
    }
    setSearching(true);
    timer.current = setTimeout(async () => {
      try {
        const res = await usersApi.search(term, user.userId);
        setResults(res.filter((u) => u.id !== user.userId));
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 320);
    return () => clearTimeout(timer.current);
  }, [q, user.userId]);

  const pickResult = (u) => {
    setQ("");
    setResults(null);
    onSelect({
      partnerId: u.id,
      username: u.username || u.nickname || "User",
      picture: u.avatar || null,
    });
  };

  return (
    <section className="sidebar">
      <div className="sidebar-head">
        <div className="sidebar-title">
          <h1>Messages</h1>
        </div>
        <div className="search">
          <span className="icon"><ISearch size={18} /></span>
          <input
            placeholder="Search people by name…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoFocus={!loading && chats.length === 0}
          />
          {q && (
            <button
              className="icon-btn"
              style={{ position: "absolute", right: 4, width: 34, height: 34, background: "transparent", border: "none" }}
              onClick={() => setQ("")}
            >
              <IClose size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="chat-list">
        {results !== null ? (
          <>
            <div className="list-label">{searching ? "Searching…" : "People"}</div>
            {results.length === 0 && !searching && (
              <div className="empty-hint">No users found for “{q}”.</div>
            )}
            {results.map((u) => (
              <div key={u.id} className="search-result" onClick={() => pickResult(u)}>
                <Avatar src={u.avatar} name={u.username || u.nickname} size={44} />
                <div className="chat-meta">
                  <div className="chat-name">{u.username || u.nickname}</div>
                  <div className="nick">@{u.nickname || u.username}</div>
                </div>
              </div>
            ))}
          </>
        ) : loading ? (
          Array.from({ length: 7 }).map((_, i) => (
            <div className="chat-item" key={i} style={{ pointerEvents: "none" }}>
              <div className="skeleton" style={{ width: 46, height: 46, borderRadius: "50%" }} />
              <div className="chat-meta">
                <div className="skeleton" style={{ width: "55%", height: 13, marginBottom: 8 }} />
                <div className="skeleton" style={{ width: "80%", height: 11 }} />
              </div>
            </div>
          ))
        ) : chats.length === 0 ? (
          <div className="empty-hint" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
            <span style={{ fontSize: 34 }}>👋</span>
            <div>
              <b style={{ color: "var(--text)" }}>No conversations yet</b>
              <br />
              Type a name in the search box above to find someone and start your
              first encrypted chat.
            </div>
          </div>
        ) : (
          chats.map((c) => {
            const online = onlineIds.has(Number(c.partnerId));
            return (
              <div
                key={c.partnerId}
                className={`chat-item ${Number(activePartnerId) === Number(c.partnerId) ? "active" : ""}`}
                onClick={() => onSelect(c)}
              >
                <Avatar src={c.picture} name={c.username} size={46} online={online} presence />
                <div className="chat-meta">
                  <div className="chat-row1">
                    <span className="chat-name">{c.username}</span>
                    <span className="chat-time">{chatStamp(c.time)}</span>
                  </div>
                  <div className="chat-row2">
                    <span className="chat-preview">
                      {c.isForwarded ? "↪ " : ""}
                      {previewText(c)}
                    </span>
                    {c.unreadCount > 0 && <span className="badge">{c.unreadCount}</span>}
                  </div>
                </div>
                <RowMenu
                  items={[
                    { label: "View profile", icon: <IUser size={16} />, onClick: () => onViewProfile?.(c.partnerId) },
                    { label: "Delete chat", icon: <ITrash size={16} />, danger: true, onClick: () => onDeleteChat?.(c) },
                  ]}
                />
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
