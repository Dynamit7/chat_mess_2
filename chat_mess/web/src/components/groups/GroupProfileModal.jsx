import { useState, useEffect, useRef } from "react";
import Modal from "../Modal";
import Avatar from "../Avatar";
import { IUsers, ITrash, ILogout, IClose, ISearch, IPlus, IChat } from "../Icon";
import { groupsApi, channelsApi, usersApi } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";

// Group/channel info & management. `api` is groupsApi or channelsApi.
export default function GroupProfileModal({ entity, kind, onClose, onLeft, onUpdated, onOpenDM }) {
  const { user } = useAuth();
  const toast = useToast();
  const me = Number(user.userId);
  const isOwner = Number(entity.ownerId) === me;
  const api = kind === "channel" ? channelsApi : groupsApi;
  const noun = kind === "channel" ? "channel" : "group";

  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const timer = useRef();

  useEffect(() => {
    const loader = kind === "channel"
      ? channelsApi.members(entity.id, me)
      : groupsApi.members(entity.id);
    loader.then((m) => setMembers(m || [])).catch(() => {}).finally(() => setLoading(false));
  }, [entity.id, kind, me]);

  // Search people to add (owner only).
  useEffect(() => {
    if (!adding) return;
    clearTimeout(timer.current);
    if (!q.trim()) { setResults([]); return; }
    timer.current = setTimeout(async () => {
      try {
        const r = await usersApi.search(q.trim(), me);
        const memberIds = new Set(members.map((m) => Number(m.id)));
        setResults(r.filter((u) => !memberIds.has(Number(u.id))));
      } catch { setResults([]); }
    }, 300);
    return () => clearTimeout(timer.current);
  }, [q, adding, members, me]);

  const addMember = async (u) => {
    try {
      await api.join(entity.id, u.id, me);
      setMembers((prev) => [...prev, { id: u.id, username: u.username || u.nickname, avatar: u.avatar }]);
      setResults((prev) => prev.filter((x) => x.id !== u.id));
      setQ("");
      toast.success(`Added ${u.username || u.nickname}.`);
    } catch (e) {
      toast.error(e?.response?.data?.error || "Couldn't add member.");
    }
  };

  const call = async (fn, okMsg) => {
    setBusy(true);
    try {
      await fn();
      if (okMsg) toast.success(okMsg);
    } catch (e) {
      toast.error(e?.response?.data?.error || "Action failed.");
      throw e;
    } finally {
      setBusy(false);
    }
  };

  const leave = async () => {
    try {
      await call(() => api.leave(entity.id, me), `Left ${noun}.`);
      onLeft?.(entity.id);
      onClose();
    } catch {}
  };

  const remove = async () => {
    if (!confirm(`Delete this ${noun}? This cannot be undone.`)) return;
    try {
      await call(() => api.remove(entity.id, me), `${noun[0].toUpperCase() + noun.slice(1)} deleted.`);
      onLeft?.(entity.id);
      onClose();
    } catch {}
  };

  const kick = async (memberId) => {
    try {
      await call(() => api.removeMember(entity.id, memberId, me));
      setMembers((prev) => prev.filter((x) => Number(x.id) !== Number(memberId)));
    } catch {}
  };

  return (
    <Modal title={`${noun[0].toUpperCase() + noun.slice(1)} info`} onClose={onClose} width={460}>
      <div style={{ textAlign: "center", marginBottom: 18 }}>
        <Avatar src={entity.avatar} name={entity.name} size={88} zoomable />
        <h2 style={{ fontFamily: "var(--font-display)", marginTop: 12, fontSize: 22 }}>{entity.name}</h2>
        {entity.description && (
          <p style={{ color: "var(--text-dim)", marginTop: 6, fontSize: 14 }}>{entity.description}</p>
        )}
        <div style={{ color: "var(--text-faint)", fontSize: 13, marginTop: 8, display: "flex", gap: 6, justifyContent: "center", alignItems: "center" }}>
          <IUsers size={15} /> {members.length} member{members.length === 1 ? "" : "s"}
          {entity.isPublic ? " · Public" : " · Private"}
        </div>
      </div>

      {isOwner && (
        <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <div className="list-label" style={{ padding: "4px 2px" }}>Add members</div>
            <button className="icon-btn" title={adding ? "Close" : "Add members"} onClick={() => { setAdding((v) => !v); setQ(""); setResults([]); }}>
              {adding ? <IClose size={16} /> : <IPlus size={18} />}
            </button>
          </div>
          {adding && (
            <>
              <div className="search" style={{ marginBottom: 8 }}>
                <span className="icon"><ISearch size={17} /></span>
                <input placeholder="Search people by name…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
              </div>
              {results.length > 0 && (
                <div className="member-results" style={{ marginBottom: 14 }}>
                  {results.map((u) => (
                    <div key={u.id} className="search-result" onClick={() => addMember(u)}>
                      <Avatar src={u.avatar} name={u.username || u.nickname} size={38} />
                      <div className="chat-meta">
                        <div className="chat-name">{u.username || u.nickname}</div>
                        <div className="nick">@{u.nickname || u.username}</div>
                      </div>
                      <span className="add-ic"><IPlus size={16} /></span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}

      <div className="list-label" style={{ padding: "4px 2px 10px" }}>Members</div>
      <div style={{ maxHeight: 280, overflowY: "auto", margin: "0 -8px" }}>
        {loading ? (
          <div className="center-load" style={{ padding: 20 }}><span className="spinner" /></div>
        ) : (
          members.map((m) => (
            <div key={m.id} className="search-result">
              <Avatar src={m.avatar} name={m.username} size={40} />
              <div className="chat-meta">
                <div className="chat-name">
                  {m.username}
                  {Number(m.id) === Number(entity.ownerId) && <span className="tag-pill">owner</span>}
                  {Number(m.id) === me && <span className="nick"> · you</span>}
                </div>
              </div>
              {Number(m.id) !== me && (
                <div style={{ display: "flex", gap: 4 }}>
                  {onOpenDM && (
                    <button className="icon-btn" title="Send message" onClick={() => { onOpenDM(m.id); onClose(); }}>
                      <IChat size={16} />
                    </button>
                  )}
                  {isOwner && (
                    <button className="icon-btn" title="Remove from group" onClick={() => kick(m.id)} disabled={busy} style={{ color: "var(--danger, #e05)" }}>
                      <IClose size={16} />
                    </button>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <div className="menu-sep" style={{ margin: "14px 0" }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {!isOwner && (
          <button className="menu-item danger" onClick={leave} disabled={busy}>
            <ILogout size={18} /> Leave {noun}
          </button>
        )}
        {isOwner && (
          <button className="menu-item danger" onClick={remove} disabled={busy}>
            <ITrash size={18} /> Delete {noun}
          </button>
        )}
      </div>
    </Modal>
  );
}
