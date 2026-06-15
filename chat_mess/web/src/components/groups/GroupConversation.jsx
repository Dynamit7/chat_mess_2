import { useState, useEffect, useRef, useCallback } from "react";
import Avatar from "../Avatar";
import GroupMessageBubble from "./GroupMessageBubble";
import Composer from "../chat/Composer";
import { IArrowLeft, IUsers, IMore, IClose, ITrash } from "../Icon";
import { groupsApi, pollsApi } from "../../api/client";
import PollCreator from "../polls/PollCreator";
import ForwardSheet from "../ForwardSheet";
import UserProfileModal from "../UserProfileModal";
import { decodeGroupMessageList, decodeGroupMessage } from "../../proto/groupMessage";
import { useSocket } from "../../context/SocketContext";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { dayLabel } from "../../lib/format";

const isBinary = (d) =>
  d instanceof ArrayBuffer || d instanceof Uint8Array || (d && d.byteLength !== undefined && d.constructor !== Object);

const newTempId = () => `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

export default function GroupConversation({ group, onBack, onOpenProfile, onJoined, onActivity, onLastMessage }) {
  const { user } = useAuth();
  const socket = useSocket();
  const toast = useToast();
  const me = Number(user.userId);
  const groupId = Number(group.id);
  const canManage = Number(group.ownerId) === me;

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState([]);
  const [typingUsers, setTypingUsers] = useState({}); // userId -> username
  const [replyTo, setReplyTo] = useState(null);
  const [editing, setEditing] = useState(null);
  const [uploading, setUploading] = useState(null);
  const [member, setMember] = useState(group.isMember !== false);
  const [joining, setJoining] = useState(false);
  const [pollMap, setPollMap] = useState({}); // groupMessageId -> pollId
  const [pollOpen, setPollOpen] = useState(false);
  const [forwardSrc, setForwardSrc] = useState(null);
  const [profileUser, setProfileUser] = useState(null);
  const [reactionsMap, setReactionsMap] = useState({}); // messageId -> [{userId,emoji}]
  const [selectionMode, setSelectionMode] = useState(false);
  const [selected, setSelected] = useState(new Set());

  const scrollRef = useRef(null);
  const typingTimers = useRef({});

  // Tell the groups list about the newest message so its preview/time updates
  // (the backend doesn't send `newGroupMessage` to the sender).
  const reportLast = useCallback((m) => {
    onLastMessage?.(groupId, {
      lastMessage: m.text || "",
      lastMessageType: m.type || "text",
      lastMessageSender: m.sender?.username || user.username,
      lastMessageTime: m.createdAt || new Date().toISOString(),
    });
  }, [onLastMessage, groupId, user.username]);

  const scrollToBottom = (smooth = true) => {
    const el = scrollRef.current;
    if (!el) return;
    requestAnimationFrame(() =>
      el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" })
    );
  };

  const addMessage = useCallback((m, { fromMe = false } = {}) => {
    setMessages((prev) => {
      if (prev.some((p) => Number(p.id) === Number(m.id))) return prev;
      // Reconcile an optimistic message of ours with the server echo.
      if (fromMe) {
        const ti = prev.findIndex((p) => p.status === "sending" && p.text === m.text && Number(p.fromUserId) === me);
        if (ti >= 0) {
          const next = [...prev];
          next[ti] = m;
          return next;
        }
      }
      return [...prev, m];
    });
  }, [me]);

  // ---- Load when group opens ----
  useEffect(() => {
    if (!member) {
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    socket.emit("joinGroup", { groupId, userId: me });
    socket.emit("joinRoom", `group_${groupId}`);

    groupsApi
      .messagesRaw(groupId, me)
      .then((buf) => {
        if (!alive) return;
        setMessages(decodeGroupMessageList(buf));
        setLoading(false);
        scrollToBottom(false);
      })
      .catch(() => alive && setLoading(false));

    groupsApi.members(groupId).then((m) => alive && setMembers(m || [])).catch(() => {});
    // Map historical poll messages (protobuf carries no pollId) to their polls.
    pollsApi.groupPolls(groupId, me).then((r) => {
      if (!alive) return;
      const map = {};
      (r?.polls || []).forEach((p) => { if (p.groupMessageId) map[p.groupMessageId] = p.id; });
      setPollMap(map);
    }).catch(() => {});
    groupsApi.updateLastSeen(groupId, me).catch(() => {});
    onActivity?.(groupId, { read: true });
    groupsApi.reactions(groupId).then((map) => alive && setReactionsMap(map || {})).catch(() => {});

    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, member]);

  // ---- Realtime ----
  useEffect(() => {
    if (!member) return;

    const onReceived = (data) => {
      let m;
      if (isBinary(data)) m = decodeGroupMessage(data);
      else if (data && Number(data.groupId) === groupId)
        m = {
          id: data.id, groupId: data.groupId, fromUserId: data.userId, text: data.text || "",
          type: data.type || "text", fileUrl: data.fileUrl || null, filename: data.filename || null,
          createdAt: data.createdAt ? new Date(data.createdAt).toISOString() : new Date().toISOString(),
          sender: data.sender || null, readBy: data.readBy || [], poll: data.poll,
        };
      if (!m || Number(m.groupId) !== groupId) return;
      addMessage(m, { fromMe: Number(m.fromUserId) === me });
      reportLast(m);
      scrollToBottom();
      if (Number(m.fromUserId) !== me) {
        groupsApi.updateLastSeen(groupId, me).catch(() => {});
      }
    };

    const onUpdated = (data) => {
      const m = isBinary(data) ? decodeGroupMessage(data) : data;
      if (!m || Number(m.groupId) !== groupId) return;
      setMessages((prev) => prev.map((x) => (Number(x.id) === Number(m.id) ? { ...x, ...m } : x)));
    };

    const onDeleted = ({ messageId }) => {
      setMessages((prev) => prev.filter((x) => Number(x.id) !== Number(messageId)));
    };

    const onTyping = ({ userId, username, isTyping }) => {
      if (Number(userId) === me) return;
      setTypingUsers((prev) => {
        const next = { ...prev };
        if (isTyping) next[userId] = username || `User ${userId}`;
        else delete next[userId];
        return next;
      });
      clearTimeout(typingTimers.current[userId]);
      if (isTyping)
        typingTimers.current[userId] = setTimeout(
          () => setTypingUsers((p) => { const n = { ...p }; delete n[userId]; return n; }),
          4000
        );
    };

    const onRead = ({ groupId: gid, userId, messageIds }) => {
      if (Number(gid) !== groupId) return;
      const ids = new Set((messageIds || []).map(Number));
      setMessages((prev) =>
        prev.map((x) =>
          ids.has(Number(x.id)) && !x.readBy?.includes(Number(userId))
            ? { ...x, readBy: [...(x.readBy || []), Number(userId)] }
            : x
        )
      );
    };

    const onCleared = ({ groupId: gid }) => {
      if (Number(gid) === groupId) setMessages([]);
    };

    const onReactionAdded = ({ messageId, userId, emoji }) => {
      setReactionsMap((prev) => {
        const list = prev[messageId] || [];
        if (list.some((r) => r.userId === userId && r.emoji === emoji)) return prev;
        return { ...prev, [messageId]: [...list, { userId, emoji }] };
      });
    };

    const onReactionRemoved = ({ messageId, userId, emoji }) => {
      setReactionsMap((prev) => ({
        ...prev,
        [messageId]: (prev[messageId] || []).filter((r) => !(r.userId === userId && r.emoji === emoji)),
      }));
    };

    socket.on("groupMessageReceived", onReceived);
    socket.on("groupMessageUpdated", onUpdated);
    socket.on("groupMessageDeleted", onDeleted);
    socket.on("groupTyping", onTyping);
    socket.on("messagesRead", onRead);
    socket.on("groupMessagesCleared", onCleared);
    socket.on("groupReactionAdded", onReactionAdded);
    socket.on("groupReactionRemoved", onReactionRemoved);
    return () => {
      socket.off("groupMessageReceived", onReceived);
      socket.off("groupMessageUpdated", onUpdated);
      socket.off("groupMessageDeleted", onDeleted);
      socket.off("groupTyping", onTyping);
      socket.off("messagesRead", onRead);
      socket.off("groupMessagesCleared", onCleared);
      socket.off("groupReactionAdded", onReactionAdded);
      socket.off("groupReactionRemoved", onReactionRemoved);
    };
  }, [socket, groupId, me, member, addMessage, reportLast]);

  // ---- Actions ----
  const sendText = async (text) => {
    const tempId = newTempId();
    setMessages((prev) => [
      ...prev,
      {
        id: tempId, groupId, fromUserId: me, text, type: "text",
        createdAt: new Date().toISOString(), sender: { id: me, username: user.username },
        readBy: [me], replyTo: replyTo ? { id: replyTo.id, text: replyTo.text, username: replyTo.sender?.username } : null,
        status: "sending",
      },
    ]);
    reportLast({ text, type: "text", sender: { username: user.username }, createdAt: new Date().toISOString() });
    scrollToBottom();
    const r = replyTo;
    setReplyTo(null);
    try {
      await groupsApi.sendMessage(groupId, { userId: me, text, replyToId: r?.id || undefined });
    } catch (e) {
      setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, status: "failed" } : m)));
      toast.error("Message failed to send.");
    }
  };

  const sendFile = async (file) => {
    // The group message endpoint accepts the file directly and uploads to MinIO.
    setUploading({ name: file.name });
    try {
      await groupsApi.sendMessage(groupId, { userId: me, text: "", file });
    } catch {
      toast.error("Upload failed.");
    } finally {
      setUploading(null);
    }
  };

  const saveEdit = async (newText) => {
    const target = editing;
    setEditing(null);
    if (!target || newText === target.text) return;
    setMessages((prev) => prev.map((m) => (Number(m.id) === Number(target.id) ? { ...m, text: newText, isEdited: true } : m)));
    try {
      await groupsApi.editMessage(groupId, target.id, { userId: me, text: newText });
    } catch {
      toast.error("Couldn't edit.");
    }
  };

  const deleteMessage = async (msg) => {
    setMessages((prev) => prev.filter((m) => Number(m.id) !== Number(msg.id)));
    try {
      await groupsApi.deleteMessage(groupId, msg.id, me);
    } catch {
      toast.error("Couldn't delete.");
    }
  };

  const join = async () => {
    setJoining(true);
    try {
      await groupsApi.join(groupId, me);
      setMember(true);
      onJoined?.(groupId);
    } catch (e) {
      toast.error(e?.response?.data?.error || "Couldn't join.");
    } finally {
      setJoining(false);
    }
  };

  const handleReact = async (msg, emoji) => {
    const messageId = Number(msg.id);
    const existing = (reactionsMap[messageId] || []).find((r) => r.userId === me && r.emoji === emoji);
    setReactionsMap((prev) => {
      const list = prev[messageId] || [];
      return {
        ...prev,
        [messageId]: existing
          ? list.filter((r) => !(r.userId === me && r.emoji === emoji))
          : [...list, { userId: me, emoji }],
      };
    });
    try {
      await groupsApi.react(groupId, messageId, me, emoji);
    } catch {
      toast.error("Couldn't save reaction.");
      groupsApi.reactions(groupId).then((map) => setReactionsMap(map || {})).catch(() => {});
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
    await Promise.all(ids.map((id) => groupsApi.deleteMessage(groupId, id, me).catch(() => {})));
  };

  const emitTyping = (isTyping) => socket.emit("typing", { userId: me, groupId, isTyping });

  const typingNames = Object.values(typingUsers);
  const visible = messages.filter((m) => !m.isDeleted);

  return (
    <section className="pane">
      <header className="conv-head" style={{ cursor: "pointer" }} onClick={onOpenProfile}>
        {onBack && (
          <button className="icon-btn" onClick={(e) => { e.stopPropagation(); onBack(); }}>
            <IArrowLeft size={18} />
          </button>
        )}
        <Avatar src={group.avatar} name={group.name} size={44} zoomable />
        <div className="who">
          <div className="nm">{group.name}</div>
          <div className="st">
            {typingNames.length
              ? `${typingNames.slice(0, 2).join(", ")} typing…`
              : `${members.length || group.membersCount || ""} member${members.length === 1 ? "" : "s"}`}
          </div>
        </div>
        <div className="conv-actions">
          <button className="icon-btn" title="Group info" onClick={(e) => { e.stopPropagation(); onOpenProfile(); }}>
            <IUsers size={18} />
          </button>
        </div>
      </header>

      {!member ? (
        <div className="pane-empty" style={{ flex: 1 }}>
          <div>
            <div className="glow"><IUsers size={46} color="#fff" /></div>
            <h2>{group.name}</h2>
            <p>{group.description || "Join this group to see messages and participate."}</p>
            <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={join} disabled={joining}>
              {joining ? <span className="spinner" /> : "Join group"}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="messages" ref={scrollRef}>
            {loading ? (
              <div className="center-load"><span className="spinner" /></div>
            ) : visible.length === 0 ? (
              <div className="pane-empty" style={{ flex: 1 }}>
                <div><p style={{ color: "var(--text-dim)" }}>No messages yet. Say hello! 👋</p></div>
              </div>
            ) : (
              visible.map((m, i) => {
                const prev = visible[i - 1];
                const isOut = Number(m.fromUserId) === me;
                const sameSender = prev && Number(prev.fromUserId) === Number(m.fromUserId);
                const closeInTime = prev && new Date(m.createdAt) - new Date(prev.createdAt) < 4 * 60 * 1000;
                const grouped = sameSender && closeInTime;
                const newDay = !prev || dayLabel(prev.createdAt) !== dayLabel(m.createdAt);
                return (
                  <div key={m.id} style={{ display: "contents" }}>
                    {newDay && <div className="day-sep">{dayLabel(m.createdAt)}</div>}
                    <GroupMessageBubble
                      msg={m}
                      isOut={isOut}
                      me={me}
                      canManage={canManage}
                      membersCount={members.length}
                      grouped={grouped && !newDay}
                      fresh={!grouped || newDay}
                      pollId={pollMap[m.id] || m.poll?.id}
                      reactions={reactionsMap[Number(m.id)] || []}
                      onReply={(mm) => setReplyTo(mm)}
                      onEdit={(mm) => setEditing(mm)}
                      onDelete={deleteMessage}
                      onForward={(mm) => setForwardSrc({ id: mm.id, text: mm.text, type: mm.type, fileUrl: mm.fileUrl, filename: mm.filename, pollId: pollMap[mm.id] || mm.poll?.id, sourceType: "group", senderUsername: mm.sender?.username })}
                      onReact={handleReact}
                      onOpenProfile={(uid) => setProfileUser(uid)}
                      selectionMode={selectionMode}
                      isSelected={selected.has(m.id)}
                      onSelect={toggleSelect}
                      onStartSelect={enterSelection}
                    />
                  </div>
                );
              })
            )}
            {typingNames.length > 0 && (
              <div className="typing-row">
                <div className="typing-bubble"><span /><span /><span /></div>
              </div>
            )}
          </div>

          {uploading && (
            <div className="composer" style={{ paddingBottom: 0 }}>
              <div className="upload-chip"><span className="spinner" /> Uploading {uploading.name}…</div>
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
              replyTo={replyTo ? { id: replyTo.id, text: replyTo.text, fromUserId: replyTo.fromUserId, me } : null}
              editing={editing}
              partnerName={replyTo?.sender?.username}
              onCancelReply={() => setReplyTo(null)}
              onCancelEdit={() => setEditing(null)}
              onSaveEdit={saveEdit}
              onSend={sendText}
              onSendFile={sendFile}
              onTyping={emitTyping}
              onPoll={() => setPollOpen(true)}
            />
          )}
        </>
      )}

      {pollOpen && (
        <PollCreator
          target={{ groupId }}
          onClose={() => setPollOpen(false)}
          onCreated={(res) => { if (res?.poll?.groupMessageId) setPollMap((m) => ({ ...m, [res.poll.groupMessageId]: res.poll.id })); }}
        />
      )}
      {forwardSrc && <ForwardSheet source={forwardSrc} onClose={() => setForwardSrc(null)} />}
      {profileUser && <UserProfileModal userId={profileUser} onClose={() => setProfileUser(null)} onMessage={(p) => { window.location.href = `/?to=${p.partnerId}`; }} />}
    </section>
  );
}
