import { useState, useEffect, useRef } from "react";
import Modal from "../Modal";
import Avatar from "../Avatar";
import { ISend } from "../Icon";
import { channelsApi } from "../../api/client";
import { useSocket } from "../../context/SocketContext";
import { useAuth } from "../../context/AuthContext";
import { timeShort } from "../../lib/format";

export default function CommentsModal({ channelId, post, canManage, onClose, onCommentAdded }) {
  const { user } = useAuth();
  const socket = useSocket();
  const me = Number(user.userId);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const listRef = useRef(null);

  useEffect(() => {
    channelsApi
      .comments(channelId, post.id)
      .then((c) => setComments(Array.isArray(c) ? c : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [channelId, post.id]);

  useEffect(() => {
    const onMsg = (m) => {
      if (Number(m.parentMessageId) === Number(post.id)) {
        setComments((prev) => (prev.some((c) => Number(c.id) === Number(m.id)) ? prev : [...prev, m]));
      }
    };
    const onUpdated = (m) => {
      if (Number(m.parentMessageId) === Number(post.id)) {
        setComments((prev) => prev.map((c) => (Number(c.id) === Number(m.id) ? { ...c, text: m.text } : c)));
      }
    };
    const onDeleted = ({ messageId }) => {
      setComments((prev) => prev.filter((c) => String(c.id) !== String(messageId)));
    };
    const onCleared = ({ messageId }) => {
      if (String(messageId) === String(post.id)) setComments([]);
    };
    socket.on("channelMessageReceived", onMsg);
    socket.on("channelMessageUpdated", onUpdated);
    socket.on("channelMessageDeleted", onDeleted);
    socket.on("channelCommentsCleared", onCleared);
    return () => {
      socket.off("channelMessageReceived", onMsg);
      socket.off("channelMessageUpdated", onUpdated);
      socket.off("channelMessageDeleted", onDeleted);
      socket.off("channelCommentsCleared", onCleared);
    };
  }, [socket, post.id]);

  const send = async () => {
    const t = text.trim();
    if (!t) return;
    setBusy(true);
    setText("");
    try {
      const c = await channelsApi.comment(channelId, post.id, { userId: me, text: t });
      setComments((prev) => (prev.some((x) => Number(x.id) === Number(c.id)) ? prev : [...prev, c]));
      onCommentAdded?.(post.id);
    } catch {
      setText(t);
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (c) => {
    setEditingId(c.id);
    setEditText(c.text || "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditText("");
  };

  const saveEdit = async (c) => {
    const t = editText.trim();
    if (!t) return;
    try {
      await channelsApi.editComment(channelId, c.id, { userId: me, text: t });
      setComments((prev) => prev.map((x) => (Number(x.id) === Number(c.id) ? { ...x, text: t } : x)));
      cancelEdit();
    } catch {}
  };

  const deleteComment = async (c) => {
    try {
      await channelsApi.deleteComment(channelId, c.id, me);
      setComments((prev) => prev.filter((x) => Number(x.id) !== Number(c.id)));
    } catch {}
  };

  return (
    <Modal title="Comments" onClose={onClose} width={520}>
      <div ref={listRef} style={{ maxHeight: 360, overflowY: "auto", margin: "0 -6px", paddingRight: 4 }}>
        {loading ? (
          <div className="center-load" style={{ padding: 24 }}><span className="spinner" /></div>
        ) : comments.length === 0 ? (
          <div className="empty-hint">No comments yet. Be the first!</div>
        ) : (
          comments.map((c) => {
            const isMine = Number(c.userId) === me;
            const canDelete = isMine || canManage;
            const canEdit = isMine;
            const isEditing = editingId === c.id;

            return (
              <div key={c.id} className="comment-row">
                <Avatar src={c.sender?.avatar} name={c.sender?.username} size={34} />
                <div className="comment-body" style={{ flex: 1 }}>
                  <div className="comment-meta" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <b>{c.sender?.username || "User"}</b>
                      <span style={{ marginLeft: 6 }}>{timeShort(c.createdAt)}</span>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                      {canEdit && !isEditing && (
                        <button
                          onClick={() => startEdit(c)}
                          title="Редактировать"
                          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-2, #888)", padding: 2, lineHeight: 1 }}
                        >
                          ✏️
                        </button>
                      )}
                      {canDelete && !isEditing && (
                        <button
                          onClick={() => deleteComment(c)}
                          title="Удалить"
                          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-2, #888)", padding: 2, lineHeight: 1 }}
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </div>

                  {c.fileUrl && c.type === "image" ? (
                    <a href={c.fileUrl} target="_blank" rel="noreferrer">
                      <img src={c.fileUrl} alt="" style={{ maxWidth: 220, borderRadius: 12, marginTop: 4 }} />
                    </a>
                  ) : null}

                  {isEditing ? (
                    <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                      <textarea
                        rows={2}
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saveEdit(c); }
                          if (e.key === "Escape") cancelEdit();
                        }}
                        autoFocus
                        style={{ flex: 1, resize: "none", border: "1px solid var(--border, #ddd)", borderRadius: 8, padding: "6px 8px", background: "var(--bg-2, #f5f5f5)", color: "var(--text)", fontSize: 14 }}
                      />
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <button
                          onClick={() => saveEdit(c)}
                          disabled={!editText.trim()}
                          style={{ background: "#7C5CFF", color: "#fff", border: "none", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 13 }}
                        >
                          Сохранить
                        </button>
                        <button
                          onClick={cancelEdit}
                          style={{ background: "none", border: "1px solid var(--border, #ddd)", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 13, color: "var(--text-2, #888)" }}
                        >
                          Отмена
                        </button>
                      </div>
                    </div>
                  ) : (
                    c.text && <div className="comment-text">{c.text}</div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="composer-box" style={{ marginTop: 14 }}>
        <textarea
          rows={1}
          placeholder="Write a comment…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          style={{ flex: 1, resize: "none", border: "none", background: "transparent", color: "var(--text)", fontSize: 15, padding: "10px 4px" }}
        />
        <button className="send-btn" onClick={send} disabled={busy || !text.trim()}><ISend size={20} /></button>
      </div>
    </Modal>
  );
}
