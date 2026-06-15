import { useState, useEffect } from "react";
import Modal from "../Modal";
import Avatar from "../Avatar";
import { ISend } from "../Icon";
import { reelsApi } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { chatStamp } from "../../lib/format";

export default function ReelCommentsModal({ reel, onClose, onAdded }) {
  const { user } = useAuth();
  const me = Number(user.userId);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    reelsApi.comments(reel.id).then((r) => setComments(r?.comments || [])).catch(() => {}).finally(() => setLoading(false));
  }, [reel.id]);

  const send = async () => {
    const t = text.trim();
    if (!t) return;
    setBusy(true);
    setText("");
    try {
      const c = await reelsApi.comment(reel.id, me, t);
      setComments((prev) => [c, ...prev]);
      onAdded?.(reel.id);
    } catch { setText(t); } finally { setBusy(false); }
  };

  return (
    <Modal title="Comments" onClose={onClose} width={500}>
      <div style={{ maxHeight: 380, overflowY: "auto", margin: "0 -6px" }}>
        {loading ? (
          <div className="center-load" style={{ padding: 24 }}><span className="spinner" /></div>
        ) : comments.length === 0 ? (
          <div className="empty-hint">No comments yet. Start the conversation!</div>
        ) : (
          comments.map((c) => (
            <div key={c.id} className="comment-row">
              <Avatar src={c.author?.avatar} name={c.author?.username} size={34} />
              <div className="comment-body">
                <div className="comment-meta"><b>{c.author?.username || "User"}</b><span>{chatStamp(c.createdAt)}</span></div>
                <div className="comment-text">{c.text}</div>
              </div>
            </div>
          ))
        )}
      </div>
      <div className="composer-box" style={{ marginTop: 14 }}>
        <textarea rows={1} placeholder="Add a comment…" value={text} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          style={{ flex: 1, resize: "none", border: "none", background: "transparent", color: "var(--text)", fontSize: 15, padding: "10px 4px" }} />
        <button className="send-btn" onClick={send} disabled={busy || !text.trim()}><ISend size={20} /></button>
      </div>
    </Modal>
  );
}
