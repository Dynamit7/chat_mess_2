import { useState, useEffect, useRef, useCallback } from "react";
import Avatar from "../Avatar";
import MessageBubble from "./MessageBubble";
import Composer from "./Composer";
import ForwardSheet from "../ForwardSheet";
import UserProfileModal from "../UserProfileModal";
import { IArrowLeft, IPhone, IVideo, IMore, IUser, ITrash, IClose } from "../Icon";
import { messagesApi, uploadFile, chatKeyOf } from "../../api/client";
import { useSocket } from "../../context/SocketContext";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { useCall } from "../../context/CallContext";
import { dayLabel } from "../../lib/format";

const fileType = (mime = "") => {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  return "file";
};

const newTempId = () =>
  `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export default function ConversationPane({ partner, onBack, onPartnerActivity }) {
  const { user } = useAuth();
  const socket = useSocket();
  const toast = useToast();
  const call = useCall();
  const me = Number(user.userId);
  const partnerId = Number(partner.partnerId);
  const chatKey = chatKeyOf(me, partnerId);

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [partnerOnline, setPartnerOnline] = useState(!!partner.isOnline);
  const [typing, setTyping] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [editing, setEditing] = useState(null);
  const [uploading, setUploading] = useState(null);
  const [forwardSrc, setForwardSrc] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [headerMenu, setHeaderMenu] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selected, setSelected] = useState(new Set());

  const scrollRef = useRef(null);
  const typingHideTimer = useRef(null);
  const headerMenuRef = useRef(null);

  useEffect(() => {
    if (!headerMenu) return;
    const onDoc = (e) => { if (headerMenuRef.current && !headerMenuRef.current.contains(e.target)) setHeaderMenu(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [headerMenu]);

  const deleteChat = async () => {
    setHeaderMenu(false);
    if (!confirm(`Delete your chat with ${partner.username}?`)) return;
    try {
      await messagesApi.deleteChats(me, [partnerId]);
      onBack?.();
    } catch {
      toast.error("Couldn't delete the chat.");
    }
  };

  const belongs = useCallback(
    (m) => {
      const a = Number(m.fromUserId);
      const b = Number(m.toUserId);
      return (a === me && b === partnerId) || (a === partnerId && b === me);
    },
    [me, partnerId]
  );

  const scrollToBottom = (smooth = true) => {
    const el = scrollRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
    });
  };

  // Merge an incoming/confirmed message, reconciling optimistic temp rows.
  const mergeMessage = useCallback((incoming) => {
    setMessages((prev) => {
      if (incoming.tempId) {
        const ti = prev.findIndex((p) => p.tempId && p.tempId === incoming.tempId);
        if (ti >= 0) {
          const next = [...prev];
          // Сохраняем isRead: true если temp уже был помечен прочитанным
          const prevIsRead = prev[ti].isRead;
          next[ti] = { ...incoming, status: undefined, isRead: prevIsRead || incoming.isRead };
          return next;
        }
      }
      if (prev.some((p) => Number(p.id) === Number(incoming.id))) return prev;
      return [...prev, incoming];
    });
  }, []);

  // ---- Load history + join room when the conversation opens ----
  useEffect(() => {
    let alive = true;
    setLoading(true);
    socket.emit("joinRoom", `chat_${chatKey}`);

    messagesApi
      .getMessages(me, partnerId)
      .then((data) => {
        if (!alive) return;
        setMessages(Array.isArray(data) ? data : []);
        setLoading(false);
        scrollToBottom(false);
      })
      .catch(() => {
        if (alive) setLoading(false);
      });

    // Mark partner's messages as read on open — socket FIRST для мгновенного ✓✓
    socket.emit("messagesRead", { readerId: me, partnerId, unreadCount: 0 });
    messagesApi.markAsRead(me, partnerId).catch(() => {});
    onPartnerActivity?.(partnerId, { read: true });

    cancelSelection();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatKey]);

  // ---- Realtime listeners ----
  useEffect(() => {
    const onReceived = (m) => {
      if (!belongs(m)) return;
      mergeMessage(m);
      scrollToBottom();
      if (Number(m.fromUserId) === partnerId) {
        // МГНОВЕННО: socket emit ДО HTTP → отправитель получит ✓✓ сразу
        socket.emit("messagesRead", { readerId: me, partnerId, unreadCount: 0 });
        // Обновляем БД в фоне
        messagesApi.markAsRead(me, partnerId).catch(() => {});
        onPartnerActivity?.(partnerId, { read: true });
      }
    };

    const onEdited = ({ messageId, newText, isEdited }) => {
      setMessages((prev) =>
        prev.map((m) =>
          Number(m.id) === Number(messageId)
            ? { ...m, text: newText, isEdited: isEdited ?? true }
            : m
        )
      );
    };

    const onDeleted = ({ messageId }) => {
      setMessages((prev) => prev.filter((m) => Number(m.id) !== Number(messageId)));
    };

    const onTypingEvt = ({ userId, isTyping }) => {
      if (Number(userId) !== partnerId) return;
      setTyping(isTyping);
      clearTimeout(typingHideTimer.current);
      if (isTyping) {
        typingHideTimer.current = setTimeout(() => setTyping(false), 4000);
        scrollToBottom();
      }
    };

    const onReadByRecipient = ({ readerId }) => {
      if (Number(readerId) === partnerId) {
        setMessages((prev) =>
          prev.map((m) => (Number(m.fromUserId) === me ? { ...m, isRead: true } : m))
        );
      }
    };

    // Получатель подтвердил доставку моего сообщения → галочка ✓✓ (серая).
    const onStatus = ({ messageId, status }) => {
      if (status !== "delivered") return;
      setMessages((prev) =>
        prev.map((m) => (Number(m.id) === Number(messageId) ? { ...m, isDelivered: true } : m))
      );
    };

    const onReactionAdded = (r) => {
      setMessages((prev) =>
        prev.map((m) => {
          if (Number(m.id) !== Number(r.messageId)) return m;
          const exists = (m.reactions || []).some(
            (x) => Number(x.userId) === Number(r.userId) && x.emoji === r.emoji
          );
          if (exists) return m;
          return { ...m, reactions: [...(m.reactions || []), { messageId: r.messageId, userId: r.userId, emoji: r.emoji }] };
        })
      );
    };

    const onReactionRemoved = ({ messageId, userId, emoji }) => {
      setMessages((prev) =>
        prev.map((m) =>
          Number(m.id) === Number(messageId)
            ? {
                ...m,
                reactions: (m.reactions || []).filter(
                  (x) => !(Number(x.userId) === Number(userId) && x.emoji === emoji)
                ),
              }
            : m
        )
      );
    };

    const onUserOnline = ({ userId }) => {
      if (Number(userId) === partnerId) setPartnerOnline(true);
    };
    const onUserOffline = ({ userId }) => {
      if (Number(userId) === partnerId) setPartnerOnline(false);
    };

    socket.on("messageReceived", onReceived);
    socket.on("messageEdited", onEdited);
    socket.on("messageDeleted", onDeleted);
    socket.on("userTyping", onTypingEvt);
    socket.on("messagesReadByRecipient", onReadByRecipient);
    socket.on("messageStatus", onStatus);
    socket.on("reactionAdded", onReactionAdded);
    socket.on("reactionRemoved", onReactionRemoved);
    socket.on("userOnline", onUserOnline);
    socket.on("userOffline", onUserOffline);

    return () => {
      socket.off("messageReceived", onReceived);
      socket.off("messageEdited", onEdited);
      socket.off("messageDeleted", onDeleted);
      socket.off("userTyping", onTypingEvt);
      socket.off("messagesReadByRecipient", onReadByRecipient);
      socket.off("messageStatus", onStatus);
      socket.off("reactionAdded", onReactionAdded);
      socket.off("reactionRemoved", onReactionRemoved);
      socket.off("userOnline", onUserOnline);
      socket.off("userOffline", onUserOffline);
      clearTimeout(typingHideTimer.current);
    };
  }, [socket, belongs, me, partnerId, mergeMessage, onPartnerActivity]);

  // ---- Actions ----
  const sendText = async (text) => {
    const tempId = newTempId();
    const optimistic = {
      id: tempId,
      tempId,
      fromUserId: me,
      toUserId: partnerId,
      text,
      type: "text",
      createdAt: new Date().toISOString(),
      isRead: false,
      reactions: [],
      replyTo: replyTo ? { id: replyTo.id, text: replyTo.text, fromUserId: replyTo.fromUserId } : null,
      status: "sending",
    };
    setMessages((prev) => [...prev, optimistic]);
    scrollToBottom();
    const payload = {
      fromUserId: me,
      toUserId: partnerId,
      text,
      type: "text",
      replyToId: replyTo?.id || null,
      tempId,
    };
    setReplyTo(null);
    try {
      const res = await messagesApi.send(payload);
      if (res?.message) mergeMessage(res.message);
    } catch (e) {
      setMessages((prev) =>
        prev.map((m) => (m.tempId === tempId ? { ...m, status: "failed" } : m))
      );
      toast.error(e?.response?.data?.error || "Message failed to send.");
    }
  };

  const sendFile = async (file) => {
    const type = fileType(file.type);
    setUploading({ name: file.name, pct: 0 });
    try {
      const url = await uploadFile(file, (pct) => setUploading({ name: file.name, pct }));
      const tempId = newTempId();
      const optimistic = {
        id: tempId,
        tempId,
        fromUserId: me,
        toUserId: partnerId,
        text: "",
        type,
        fileUrl: url,
        filename: file.name,
        createdAt: new Date().toISOString(),
        isRead: false,
        reactions: [],
        status: "sending",
      };
      setMessages((prev) => [...prev, optimistic]);
      scrollToBottom();
      const res = await messagesApi.send({
        fromUserId: me,
        toUserId: partnerId,
        text: "",
        type,
        fileUrl: url,
        filename: file.name,
        tempId,
      });
      if (res?.message) mergeMessage(res.message);
    } catch (e) {
      toast.error("Upload failed. Try a smaller file.");
    } finally {
      setUploading(null);
    }
  };

  const saveEdit = async (newText) => {
    const target = editing;
    setEditing(null);
    if (!target || newText === target.text) return;
    setMessages((prev) =>
      prev.map((m) => (Number(m.id) === Number(target.id) ? { ...m, text: newText, isEdited: true } : m))
    );
    try {
      await messagesApi.edit(target.id, newText);
      socket.emit("editMessage", { roomName: `chat_${chatKey}`, messageId: target.id, newText });
    } catch {
      toast.error("Couldn't edit the message.");
    }
  };

  const deleteMessage = async (msg) => {
    setMessages((prev) => prev.filter((m) => Number(m.id) !== Number(msg.id)));
    try {
      await messagesApi.remove(msg.id);
      socket.emit("deleteMessage", { roomName: `chat_${chatKey}`, messageId: msg.id });
    } catch {
      toast.error("Couldn't delete the message.");
    }
  };

  const enterSelection = (msg) => {
    setSelectionMode(true);
    setSelected(new Set([msg.id]));
  };

  const toggleSelect = (msgId) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(msgId)) next.delete(msgId);
      else next.add(msgId);
      return next;
    });
  };

  const cancelSelection = () => {
    setSelectionMode(false);
    setSelected(new Set());
  };

  const deleteSelected = async () => {
    const ids = [...selected];
    setMessages((prev) => prev.filter((m) => !ids.map(Number).includes(Number(m.id))));
    cancelSelection();
    await Promise.all(
      ids.map(async (id) => {
        try {
          await messagesApi.remove(id);
          socket.emit("deleteMessage", { roomName: `chat_${chatKey}`, messageId: id });
        } catch {}
      })
    );
  };

  const react = async (msg, emoji) => {
    const mine = (msg.reactions || []).find(
      (r) => Number(r.userId) === me && r.emoji === emoji
    );
    try {
      if (mine) {
        setMessages((prev) =>
          prev.map((m) =>
            Number(m.id) === Number(msg.id)
              ? { ...m, reactions: m.reactions.filter((r) => !(Number(r.userId) === me && r.emoji === emoji)) }
              : m
          )
        );
        await messagesApi.removeReaction(msg.id, me, emoji);
      } else {
        setMessages((prev) =>
          prev.map((m) =>
            Number(m.id) === Number(msg.id)
              ? { ...m, reactions: [...(m.reactions || []), { messageId: msg.id, userId: me, emoji }] }
              : m
          )
        );
        await messagesApi.react(msg.id, me, emoji);
      }
    } catch {
      toast.error("Reaction failed.");
    }
  };

  // ---- Typing emit ----
  const emitTyping = (isTyping) => {
    socket.emit("typing", { userId: me, chatId: chatKey, isTyping });
  };

  // ---- Render helpers ----
  const visible = messages.filter((m) => !m.isDeleted);

  return (
    <section className="pane">
      <header className="conv-head">
        {onBack && (
          <button className="icon-btn" onClick={onBack}>
            <IArrowLeft size={18} />
          </button>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 14, flex: 1, minWidth: 0, cursor: "pointer" }} onClick={() => setProfileOpen(true)}>
          <Avatar src={partner.picture} name={partner.username} size={44} online={partnerOnline} presence zoomable />
          <div className="who">
            <div className="nm">{partner.username}</div>
            <div className={`st ${partnerOnline ? "online" : ""}`}>
              {typing ? "typing…" : partnerOnline ? "online" : "offline"}
            </div>
          </div>
        </div>
        <div className="conv-actions">
          <button className="icon-btn" title="Voice call" onClick={() => call.startCall(partner, { video: false })}><IPhone size={18} /></button>
          <button className="icon-btn" title="Video call" onClick={() => call.startCall(partner, { video: true })}><IVideo size={18} /></button>
          <div style={{ position: "relative" }} ref={headerMenuRef}>
            <button className="icon-btn" title="More" onClick={() => setHeaderMenu((v) => !v)}><IMore size={18} /></button>
            {headerMenu && (
              <div className="menu" style={{ right: 0, top: 46 }}>
                <button className="menu-item" onClick={() => { setHeaderMenu(false); setProfileOpen(true); }}>
                  <IUser size={18} /> View profile
                </button>
                <button className="menu-item danger" onClick={deleteChat}>
                  <ITrash size={18} /> Delete chat
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="messages" ref={scrollRef}>
        {loading ? (
          <div className="center-load"><span className="spinner" /></div>
        ) : visible.length === 0 ? (
          <div className="pane-empty" style={{ flex: 1 }}>
            <div>
              <p style={{ color: "var(--text-dim)" }}>
                This is the very beginning of your conversation with{" "}
                <b style={{ color: "var(--text)" }}>{partner.username}</b>.
              </p>
            </div>
          </div>
        ) : (
          visible.map((m, i) => {
            const prev = visible[i - 1];
            const isOut = Number(m.fromUserId) === me;
            const sameSender = prev && Number(prev.fromUserId) === Number(m.fromUserId);
            const closeInTime =
              prev && new Date(m.createdAt) - new Date(prev.createdAt) < 4 * 60 * 1000;
            const grouped = sameSender && closeInTime;
            const newDay =
              !prev || dayLabel(prev.createdAt) !== dayLabel(m.createdAt);

            return (
              <div key={m.id} style={{ display: "contents" }}>
                {newDay && <div className="day-sep">{dayLabel(m.createdAt)}</div>}
                <MessageBubble
                  msg={m}
                  isOut={isOut}
                  grouped={grouped && !newDay}
                  fresh={!grouped || newDay}
                  me={me}
                  partnerName={partner.username}
                  onReply={(mm) => setReplyTo({ ...mm })}
                  onEdit={(mm) => setEditing(mm)}
                  onDelete={deleteMessage}
                  onReact={react}
                  onForward={(mm) => setForwardSrc({ id: mm.id, text: mm.text, type: mm.type, fileUrl: mm.fileUrl, filename: mm.filename, pollId: mm.pollId, sourceType: "direct", senderUsername: user.username })}
                  selectionMode={selectionMode}
                  isSelected={selected.has(m.id)}
                  onSelect={toggleSelect}
                  onStartSelect={enterSelection}
                />
              </div>
            );
          })
        )}

        {typing && (
          <div className="typing-row">
            <Avatar src={partner.picture} name={partner.username} size={30} />
            <div className="typing-bubble"><span /><span /><span /></div>
          </div>
        )}
      </div>

      {uploading && (
        <div className="composer" style={{ paddingBottom: 0 }}>
          <div className="upload-chip">
            <span className="spinner" />
            Uploading {uploading.name}… {uploading.pct}%
          </div>
        </div>
      )}

      {selectionMode ? (
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "10px 14px",
          background: "rgba(124,92,252,0.08)",
          borderTop: "1px solid rgba(124,92,252,0.2)",
        }}>
          <button className="icon-btn" onClick={cancelSelection} title="Cancel"><IClose size={18} /></button>
          <span style={{ flex: 1, fontSize: 14, color: "var(--text-dim, rgba(255,255,255,0.6))" }}>
            {selected.size} selected
          </span>
          <button
            className="icon-btn"
            style={{ color: selected.size > 0 ? "#e05566" : "rgba(255,255,255,0.25)" }}
            onClick={deleteSelected}
            disabled={selected.size === 0}
            title="Delete selected"
          >
            <ITrash size={18} />
          </button>
        </div>
      ) : (
        <Composer
          replyTo={replyTo ? { ...replyTo, me } : null}
          editing={editing}
          partnerName={partner.username}
          onCancelReply={() => setReplyTo(null)}
          onCancelEdit={() => setEditing(null)}
          onSaveEdit={saveEdit}
          onSend={sendText}
          onSendFile={sendFile}
          onTyping={emitTyping}
        />
      )}

      {forwardSrc && <ForwardSheet source={forwardSrc} onClose={() => setForwardSrc(null)} />}
      {profileOpen && <UserProfileModal userId={partnerId} onClose={() => setProfileOpen(false)} onMessage={() => {}} />}
    </section>
  );
}
