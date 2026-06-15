import { useState, useEffect, useMemo } from "react";
import Modal from "./Modal";
import Avatar from "./Avatar";
import { ISearch, ICheck } from "./Icon";
import { messagesApi, groupsApi, channelsApi } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

// Forward a message/poll to any of the user's direct chats, groups or channels.
// `source` = { id, text, type, fileUrl, filename, pollId, senderUsername, sourceType }.
export default function ForwardSheet({ source, onClose, onDone }) {
  const { user } = useAuth();
  const toast = useToast();
  const me = Number(user.userId);

  const [dests, setDests] = useState([]); // {kind, id, name, avatar}
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState([]); // {type, id}
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([
      messagesApi.getChats(me).catch(() => []),
      groupsApi.list(me).catch(() => []),
      channelsApi.list(me).catch(() => []),
    ]).then(([chats, groups, channels]) => {
      const d = [
        ...(chats || []).map((c) => ({ kind: "direct", id: Number(c.partnerId), name: c.username, avatar: c.picture })),
        ...(groups || []).filter((g) => g.isMember !== false).map((g) => ({ kind: "group", id: Number(g.id), name: g.name, avatar: g.avatar })),
        ...(channels || []).filter((c) => c.isMember !== false || Number(c.ownerId) === me).map((c) => ({ kind: "channel", id: Number(c.id), name: c.name, avatar: c.avatar })),
      ];
      setDests(d);
    }).finally(() => setLoading(false));
  }, [me]);

  const filtered = useMemo(
    () => dests.filter((d) => d.name?.toLowerCase().includes(q.trim().toLowerCase())),
    [dests, q]
  );

  const isSel = (d) => selected.some((s) => s.type === d.kind && s.id === d.id);
  const toggle = (d) =>
    setSelected((s) => (isSel(d) ? s.filter((x) => !(x.type === d.kind && x.id === d.id)) : [...s, { type: d.kind, id: d.id }]));

  const forward = async () => {
    if (selected.length === 0) return;
    setBusy(true);
    try {
      const res = await messagesApi.forward(me, {
        id: source.id,
        text: source.text || "",
        type: source.type || "text",
        fileUrl: source.fileUrl || null,
        filename: source.filename || null,
        pollId: source.pollId || null,
        senderUsername: source.senderUsername || user.username,
        sourceType: source.sourceType || "direct",
      }, selected);
      const results = res?.results || [];
      const ok = results.filter((r) => r.success).length || (results.length === 0 ? selected.length : 0);
      const failed = results.filter((r) => r.error).length;
      if (ok > 0) toast.success(`Forwarded to ${ok} chat${ok === 1 ? "" : "s"}.`);
      if (failed > 0) toast.error(`${failed} couldn't be forwarded (not a member or blocked).`);
      onDone?.();
      onClose();
    } catch (e) {
      toast.error(e?.response?.data?.error || e?.message || "Couldn't forward.");
    } finally {
      setBusy(false);
    }
  };

  const label = { direct: "Chat", group: "Group", channel: "Channel" };

  return (
    <Modal
      title="Forward to…"
      onClose={onClose}
      width={460}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={forward} disabled={busy || selected.length === 0}>
            {busy ? <span className="spinner" /> : `Send${selected.length ? ` (${selected.length})` : ""}`}
          </button>
        </>
      }
    >
      <div className="search" style={{ marginBottom: 10 }}>
        <span className="icon"><ISearch size={17} /></span>
        <input placeholder="Search chats, groups, channels…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
      </div>
      <div style={{ maxHeight: 360, overflowY: "auto", margin: "0 -6px" }}>
        {loading ? (
          <div className="center-load" style={{ padding: 24 }}><span className="spinner" /></div>
        ) : filtered.length === 0 ? (
          <div className="empty-hint">Nothing to forward to yet.</div>
        ) : (
          filtered.map((d) => (
            <div key={`${d.kind}_${d.id}`} className="search-result" onClick={() => toggle(d)}>
              <Avatar src={d.avatar} name={d.name} size={40} />
              <div className="chat-meta">
                <div className="chat-name">{d.name}</div>
                <div className="nick">{label[d.kind]}</div>
              </div>
              <span className={`fwd-check ${isSel(d) ? "on" : ""}`}>{isSel(d) && <ICheck size={14} />}</span>
            </div>
          ))
        )}
      </div>
    </Modal>
  );
}
