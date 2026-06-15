import { useState, useEffect, useRef } from "react";
import Avatar from "./Avatar";
import { ISearch, IPlus, IClose, IMore } from "./Icon";
import { chatStamp } from "../lib/format";

function RowMenu({ items }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);
  if (!items?.length) return null;
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

const preview = (item) => {
  if (item.lastMessageType === "image") return "📷 Photo";
  if (item.lastMessageType === "video") return "🎬 Video";
  if (item.lastMessageType === "audio" || item.lastMessageType === "voice") return "🎙 Voice";
  if (item.lastMessageType === "file") return "📎 File";
  if (item.lastMessageType === "poll") return "📊 Poll";
  if (item.lastMessage) {
    const who = item.lastMessageSender ? `${item.lastMessageSender}: ` : "";
    return who + item.lastMessage;
  }
  return item.description || "No messages yet";
};

// Generic list for Groups & Channels: header, search, create button, items.
export default function EntityListSidebar({
  title,
  noun,
  items,
  loading,
  activeId,
  onSelect,
  onCreate,
  onSearch,
  rowMenuItems,
}) {
  const [q, setQ] = useState("");
  const timer = useRef();

  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => onSearch(q.trim()), 300);
    return () => clearTimeout(timer.current);
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section className="sidebar">
      <div className="sidebar-head">
        <div className="sidebar-title">
          <h1>{title}</h1>
          <button className="icon-btn" title={`New ${noun}`} onClick={onCreate}>
            <IPlus size={20} />
          </button>
        </div>
        <div className="search">
          <span className="icon"><ISearch size={18} /></span>
          <input placeholder={`Search ${title.toLowerCase()}…`} value={q} onChange={(e) => setQ(e.target.value)} />
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
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div className="chat-item" key={i} style={{ pointerEvents: "none" }}>
              <div className="skeleton" style={{ width: 46, height: 46, borderRadius: 14 }} />
              <div className="chat-meta">
                <div className="skeleton" style={{ width: "55%", height: 13, marginBottom: 8 }} />
                <div className="skeleton" style={{ width: "80%", height: 11 }} />
              </div>
            </div>
          ))
        ) : items.length === 0 ? (
          <div className="empty-hint" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 30 }}>✨</span>
            <div>
              No {title.toLowerCase()} yet.<br />
              Tap <b style={{ color: "var(--text)" }}>+</b> to create one, or search to discover.
            </div>
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className={`chat-item ${Number(activeId) === Number(item.id) ? "active" : ""}`}
              onClick={() => onSelect(item)}
            >
              <Avatar src={item.avatar} name={item.name} size={46} />
              <div className="chat-meta">
                <div className="chat-row1">
                  <span className="chat-name">
                    {item.name}
                    {!item.isMember && <span className="tag-pill">join</span>}
                  </span>
                  <span className="chat-time">{chatStamp(item.lastMessageTime)}</span>
                </div>
                <div className="chat-row2">
                  <span className="chat-preview">{preview(item)}</span>
                  {item.unreadCount > 0 && <span className="badge">{item.unreadCount}</span>}
                </div>
              </div>
              <RowMenu items={rowMenuItems?.(item)} />
            </div>
          ))
        )}
      </div>
    </section>
  );
}
