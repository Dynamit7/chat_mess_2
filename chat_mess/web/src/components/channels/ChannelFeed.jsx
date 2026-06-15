import { useState, useEffect, useRef, useCallback } from "react";
import Avatar from "../Avatar";
import ChannelPost from "./ChannelPost";
import CommentsModal from "./CommentsModal";
import { IArrowLeft, IBroadcast, ISend, IPaperclip, IUsers, IPoll, ISmile, IClose, ITrash } from "../Icon";
import PollCreator from "../polls/PollCreator";
import ForwardSheet from "../ForwardSheet";
import EmojiPicker from "../chat/EmojiPicker";
import { channelsApi } from "../../api/client";
import { useSocket } from "../../context/SocketContext";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";

export default function ChannelFeed({ channel, onBack, onOpenProfile, onJoined, onActivity, onLastMessage }) {
  const { user } = useAuth();
  const socket = useSocket();
  const toast = useToast();
  const me = Number(user.userId);
  const channelId = Number(channel.id);
  const canManage = Number(channel.ownerId) === me;

  const [posts, setPosts] = useState([]);
  const [reactions, setReactions] = useState({}); // messageId -> {emoji:{count,users[]}}
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const [member, setMember] = useState(channel.isMember !== false);
  const [joining, setJoining] = useState(false);
  const [commentsFor, setCommentsFor] = useState(null);
  const [pollOpen, setPollOpen] = useState(false);
  const [forwardSrc, setForwardSrc] = useState(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const fileRef = useRef(null);
  const scrollRef = useRef(null);
  const taRef = useRef(null);

  // Вставка эмодзи в позицию курсора (пикер остаётся открытым).
  const insertEmoji = (emoji) => {
    const ta = taRef.current;
    const start = ta?.selectionStart ?? text.length;
    const end = ta?.selectionEnd ?? text.length;
    setText(text.slice(0, start) + emoji + text.slice(end));
    requestAnimationFrame(() => {
      if (!ta) return;
      ta.focus();
      const pos = start + emoji.length;
      ta.setSelectionRange(pos, pos);
    });
  };

  const scrollToBottom = () => {
    const el = scrollRef.current;
    if (el) requestAnimationFrame(() => el.scrollTo({ top: el.scrollHeight, behavior: "smooth" }));
  };

  useEffect(() => {
    let alive = true;
    setLoading(true);
    socket.emit("joinChannel", { channelId, userId: me });
    socket.emit("joinRoom", `channel_${channelId}`);
    channelsApi
      .messages(channelId)
      .then(async (list) => {
        if (!alive) return;
        const arr = Array.isArray(list) ? list : [];
        setPosts(arr);
        setLoading(false);
        scrollToBottom();
        // Fetch reactions for visible posts.
        const pairs = await Promise.all(
          arr.map((p) => channelsApi.reactions(p.id).then((r) => [p.id, r]).catch(() => [p.id, {}]))
        );
        if (alive) setReactions(Object.fromEntries(pairs));
      })
      .catch(() => alive && setLoading(false));
    channelsApi.updateLastSeen(channelId, me).catch(() => {});
    onActivity?.(channelId);
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId, member]);

  useEffect(() => {
    const onMsg = (m) => {
      if (Number(m.channelId) !== channelId) return;
      if (m.parentMessageId) {
        setPosts((prev) => prev.map((p) => (Number(p.id) === Number(m.parentMessageId) ? { ...p, commentsCount: (p.commentsCount || 0) + 1 } : p)));
        return;
      }
      setPosts((prev) => (prev.some((p) => Number(p.id) === Number(m.id)) ? prev : [...prev, m]));
      onLastMessage?.(channelId, {
        lastMessage: m.text || (m.type === "image" ? "📷 Photo" : m.type === "poll" ? m.text || "Poll" : "Post"),
        lastMessageType: m.type || "text",
        lastMessageTime: m.createdAt || new Date().toISOString(),
      });
      scrollToBottom();
    };
    const onDeleted = ({ messageId }) =>
      setPosts((prev) => prev.filter((p) => Number(p.id) !== Number(messageId)));
    const onCleared = ({ channelId: cid }) => { if (Number(cid) === channelId) setPosts([]); };
    const onReaction = (add) => ({ messageId, userId, emoji }) => {
      setReactions((prev) => {
        const map = { ...(prev[messageId] || {}) };
        const cur = map[emoji] ? { ...map[emoji], users: [...(map[emoji].users || [])] } : { count: 0, users: [] };
        const has = cur.users.includes(Number(userId));
        if (add && !has) { cur.users.push(Number(userId)); cur.count = cur.users.length; map[emoji] = cur; }
        if (!add && has) { cur.users = cur.users.filter((u) => u !== Number(userId)); cur.count = cur.users.length; if (cur.count === 0) delete map[emoji]; else map[emoji] = cur; }
        return { ...prev, [messageId]: map };
      });
    };
    const added = onReaction(true);
    const removed = onReaction(false);
    socket.on("channelMessageReceived", onMsg);
    socket.on("channelMessageDeleted", onDeleted);
    socket.on("channelMessagesCleared", onCleared);
    socket.on("reactionAdded", added);
    socket.on("reactionRemoved", removed);
    return () => {
      socket.off("channelMessageReceived", onMsg);
      socket.off("channelMessageDeleted", onDeleted);
      socket.off("channelMessagesCleared", onCleared);
      socket.off("reactionAdded", added);
      socket.off("reactionRemoved", removed);
    };
  }, [socket, channelId, onLastMessage]);

  const publish = async () => {
    const t = text.trim();
    if (!t) return;
    setPosting(true);
    setText("");
    try {
      const post = await channelsApi.post(channelId, { userId: me, text: t });
      setPosts((prev) => (prev.some((p) => Number(p.id) === Number(post.id)) ? prev : [...prev, post]));
      onLastMessage?.(channelId, { lastMessage: t, lastMessageType: "text", lastMessageTime: post.createdAt || new Date().toISOString() });
      scrollToBottom();
    } catch (e) {
      setText(t);
      toast.error(e?.response?.data?.error || "Couldn't post.");
    } finally {
      setPosting(false);
    }
  };

  const publishFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPosting(true);
    try {
      const post = await channelsApi.post(channelId, { userId: me, text: "", file });
      setPosts((prev) => (prev.some((p) => Number(p.id) === Number(post.id)) ? prev : [...prev, post]));
      scrollToBottom();
    } catch {
      toast.error("Upload failed.");
    } finally {
      setPosting(false);
    }
  };

  const react = async (post, emoji) => {
    try {
      await channelsApi.react(channelId, post.id, me, emoji);
    } catch {
      toast.error("Reaction failed.");
    }
  };

  const deletePost = async (post) => {
    setPosts((prev) => prev.filter((p) => Number(p.id) !== Number(post.id)));
    try {
      await channelsApi.deleteMessage(channelId, post.id, me);
    } catch {
      toast.error("Couldn't delete.");
    }
  };

  const enterSelection = (post) => {
    setSelectionMode(true);
    setSelected(new Set([post.id]));
  };

  const toggleSelect = (postId) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(postId)) next.delete(postId);
      else next.add(postId);
      return next;
    });
  };

  const cancelSelection = () => {
    setSelectionMode(false);
    setSelected(new Set());
  };

  const deleteSelected = async () => {
    const ids = [...selected];
    setPosts((prev) => prev.filter((p) => !ids.map(Number).includes(Number(p.id))));
    cancelSelection();
    await Promise.all(ids.map((id) => channelsApi.deleteMessage(channelId, id, me).catch(() => {})));
  };

  const join = async () => {
    setJoining(true);
    try {
      await channelsApi.join(channelId, me);
      setMember(true);
      onJoined?.(channelId);
    } catch (e) {
      toast.error(e?.response?.data?.error || "Couldn't subscribe.");
    } finally {
      setJoining(false);
    }
  };

  return (
    <section className="pane">
      <header className="conv-head" style={{ cursor: "pointer" }} onClick={onOpenProfile}>
        {onBack && (
          <button className="icon-btn" onClick={(e) => { e.stopPropagation(); onBack(); }}><IArrowLeft size={18} /></button>
        )}
        <Avatar src={channel.avatar} name={channel.name} size={44} zoomable />
        <div className="who">
          <div className="nm">{channel.name}</div>
          <div className="st">{channel.membersCount || 0} subscriber{channel.membersCount === 1 ? "" : "s"} · Channel</div>
        </div>
        <div className="conv-actions">
          <button className="icon-btn" title="Channel info" onClick={(e) => { e.stopPropagation(); onOpenProfile(); }}><IUsers size={18} /></button>
        </div>
      </header>

      <div className="messages channel-feed" ref={scrollRef}>
        {loading ? (
          <div className="center-load"><span className="spinner" /></div>
        ) : posts.length === 0 ? (
          <div className="pane-empty" style={{ flex: 1 }}>
            <div><div className="glow"><IBroadcast size={46} color="#fff" /></div><h2>{channel.name}</h2><p>{channel.description || "No posts yet."}</p></div>
          </div>
        ) : (
          posts.map((p) => (
            <ChannelPost
              key={p.id}
              post={p}
              me={me}
              canManage={canManage}
              reactions={reactions[p.id]}
              onReact={react}
              onComment={(post) => setCommentsFor(post)}
              onDelete={deletePost}
              onForward={(post) => setForwardSrc({ id: post.id, text: post.text, type: post.type, fileUrl: post.fileUrl, filename: post.filename, pollId: post.pollId || post.poll?.id, sourceType: "channel", senderUsername: post.sender?.username })}
              selectionMode={selectionMode}
              isSelected={selected.has(p.id)}
              onSelect={toggleSelect}
              onStartSelect={enterSelection}
            />
          ))
        )}
      </div>

      {selectionMode && (
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
      )}

      {!member ? (
        <div className="composer">
          <button className="btn btn-primary btn-block" onClick={join} disabled={joining}>
            {joining ? <span className="spinner" /> : "Subscribe to channel"}
          </button>
        </div>
      ) : canManage && !selectionMode ? (
        <div className="composer">
          {emojiOpen && (
            <EmojiPicker onPick={insertEmoji} onClose={() => setEmojiOpen(false)} />
          )}
          <div className="composer-box">
            <input ref={fileRef} type="file" hidden onChange={publishFile} />
            <button className="icon-btn" style={{ background: "transparent", border: "none" }} title="Attach" onClick={() => fileRef.current?.click()}>
              <IPaperclip size={20} />
            </button>
            <button className="icon-btn" style={{ background: "transparent", border: "none" }} title="Create a poll" onClick={() => setPollOpen(true)}>
              <IPoll size={20} />
            </button>
            <button className={"icon-btn" + (emojiOpen ? " active" : "")} style={{ background: "transparent", border: "none" }} title="Emoji" onClick={() => setEmojiOpen((v) => !v)} type="button">
              <ISmile size={20} />
            </button>
            <textarea
              ref={taRef}
              rows={1}
              placeholder="Share something with your channel…"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); publish(); } }}
              style={{ flex: 1, resize: "none", border: "none", background: "transparent", color: "var(--text)", fontSize: 15, padding: "10px 4px", maxHeight: 140 }}
            />
            <button className="send-btn" onClick={publish} disabled={posting || !text.trim()}><ISend size={20} /></button>
          </div>
        </div>
      ) : (
        // Подписчик (не владелец/админ): канал только для чтения — поля ввода нет.
        <div className="composer" style={{ justifyContent: "center" }}>
          <span style={{ color: "var(--muted)", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
            <IBroadcast size={16} /> Only the channel owner can post here
          </span>
        </div>
      )}

      {commentsFor && (
        <CommentsModal
          channelId={channelId}
          post={commentsFor}
          canManage={canManage}
          onClose={() => setCommentsFor(null)}
          onCommentAdded={(postId) =>
            setPosts((prev) => prev.map((p) => (Number(p.id) === Number(postId) ? { ...p, commentsCount: (p.commentsCount || 0) + 1 } : p)))
          }
        />
      )}
      {pollOpen && (
        <PollCreator target={{ channelId }} onClose={() => setPollOpen(false)} onCreated={() => {}} />
      )}
      {forwardSrc && <ForwardSheet source={forwardSrc} onClose={() => setForwardSrc(null)} />}
    </section>
  );
}
