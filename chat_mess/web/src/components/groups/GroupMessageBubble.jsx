import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import Avatar from "../Avatar";
import PollMessage from "../polls/PollMessage";
import { IReply, IEdit, ITrash, IFile, ICheck, ICheckDouble, IShare, ISmile, ICheckSquare } from "../Icon";
import { timeShort, gradientFor } from "../../lib/format";

const QUICK = ["👍", "❤️", "🔥", "😂", "😮", "😢", "🙏", "🎉"];

const groupReactions = (reactions = [], me) => {
  const map = new Map();
  for (const r of reactions) {
    const cur = map.get(r.emoji) || { emoji: r.emoji, count: 0, mine: false };
    cur.count += 1;
    if (Number(r.userId) === Number(me)) cur.mine = true;
    map.set(r.emoji, cur);
  }
  return [...map.values()];
};

function Media({ msg }) {
  const url = msg.fileUrl;
  if (!url) return null;
  if (msg.type === "image")
    return (
      <a href={url} target="_blank" rel="noreferrer">
        <img src={url} alt={msg.filename || "image"} loading="lazy" />
      </a>
    );
  if (msg.type === "video" || msg.type === "video_circle")
    return <video src={url} controls preload="metadata" />;
  if (msg.type === "audio" || msg.type === "voice")
    return <audio src={url} controls style={{ width: 260 }} />;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="file-att">
      <span className="file-ic"><IFile size={20} /></span>
      <span>
        <div className="fn">{msg.filename || "Attachment"}</div>
        <div className="fs">Tap to open</div>
      </span>
    </a>
  );
}

export default function GroupMessageBubble({
  msg,
  isOut,
  me,
  canManage,
  grouped,
  fresh,
  membersCount,
  pollId,
  reactions,
  onReply,
  onEdit,
  onDelete,
  onForward,
  onReact,
  onOpenProfile,
  selectionMode,
  isSelected,
  onSelect,
  onStartSelect,
}) {
  const senderName = msg.sender?.username || `User ${msg.fromUserId}`;
  const isPoll = msg.type === "poll";
  const isMedia = ["image", "video", "video_circle"].includes(msg.type) && msg.fileUrl;
  const isText = !msg.type || msg.type === "text";
  const canSelect = isOut || canManage;
  const [c1, c2] = gradientFor(senderName);
  const readCount = Array.isArray(msg.readBy) ? msg.readBy.filter((id) => Number(id) !== me).length : 0;
  const allRead = readCount > 0;

  const [emojiOpen, setEmojiOpen] = useState(false);
  const popRef = useRef(null);
  const grouped_reactions = groupReactions(reactions || [], me);

  useEffect(() => {
    if (!emojiOpen) return;
    const onDoc = (e) => {
      if (popRef.current && !popRef.current.contains(e.target)) setEmojiOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [emojiOpen]);

  const react = (emoji) => {
    setEmojiOpen(false);
    onReact?.(msg, emoji);
  };

  return (
    <motion.div
      className={`msg-row ${isOut ? "out" : "in"} ${grouped ? "grouped" : ""} ${fresh ? "fresh" : ""}`}
      initial={{ y: 8 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.18 }}
      onClick={selectionMode && canSelect ? () => onSelect(msg.id) : undefined}
      style={selectionMode && canSelect ? {
        cursor: "pointer",
        background: isSelected ? "rgba(124,92,252,0.13)" : undefined,
        borderRadius: 8,
        transition: "background 0.15s",
      } : undefined}
    >
      {!isOut && (
        <div style={{ width: 30, flexShrink: 0, cursor: !selectionMode && onOpenProfile ? "pointer" : "default" }} onClick={!selectionMode ? () => onOpenProfile?.(msg.fromUserId) : undefined}>
          {!grouped && <Avatar src={msg.sender?.avatar} name={senderName} size={30} />}
        </div>
      )}

      <div className={`bubble ${isMedia ? "media" : ""}`} style={{ position: "relative" }}>
        {selectionMode && canSelect && (
          <div style={{
            position: "absolute", top: -8, [isOut ? "right" : "left"]: -8, zIndex: 3,
            width: 20, height: 20, borderRadius: "50%",
            border: `2px solid ${isSelected ? "#7c5cfc" : "rgba(255,255,255,0.35)"}`,
            background: isSelected ? "#7c5cfc" : "rgba(20,20,30,0.6)",
            display: "flex", alignItems: "center", justifyContent: "center", color: "#fff",
            transition: "all 0.15s",
          }}>
            {isSelected && <ICheck size={11} />}
          </div>
        )}
        {!isOut && !grouped && (
          <div className="sender-name" style={{ color: c2 }}>{senderName}</div>
        )}

        {msg.forwardedFromUsername && (
          <div className="fwd"><IReply size={12} /> Forwarded from {msg.forwardedFromUsername}</div>
        )}

        {msg.replyTo && (
          <div className="reply-quote">
            <div className="q-name">{msg.replyTo.username || "Reply"}</div>
            <div className="q-text">{msg.replyTo.text || "Attachment"}</div>
          </div>
        )}

        {isPoll ? (
          <PollMessage pollId={pollId || msg.poll?.id} initialPoll={msg.poll} />
        ) : isMedia ? (
          <>
            <Media msg={msg} />
            {msg.text ? <div style={{ padding: "8px 6px 2px" }}>{msg.text}</div> : null}
          </>
        ) : msg.type === "file" || msg.type === "audio" || msg.type === "voice" ? (
          <Media msg={msg} />
        ) : (
          <span>{msg.text}</span>
        )}

        <span className="meta">
          {msg.isEdited && <span className="edited">edited</span>}
          {timeShort(msg.createdAt)}
          {isOut &&
            (allRead ? (
              <span className="tick read"><ICheckDouble size={15} /></span>
            ) : (
              <span className="tick"><ICheck size={14} /></span>
            ))}
        </span>

        {grouped_reactions.length > 0 && (
          <div className="reactions">
            {grouped_reactions.map((r) => (
              <button
                key={r.emoji}
                className={`reaction ${r.mine ? "mine" : ""}`}
                onClick={() => react(r.emoji)}
                title={r.mine ? "Remove reaction" : "React"}
              >
                {r.emoji} {r.count > 1 && <span className="cnt">{r.count}</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {!selectionMode && (
        <div className="msg-tools">
          <button className="tool" title="React" onClick={() => setEmojiOpen((v) => !v)}>
            <ISmile size={17} />
          </button>
          <button className="tool" title="Reply" onClick={() => onReply(msg)}>
            <IReply size={17} />
          </button>
          {onForward && (
            <button className="tool" title="Forward" onClick={() => onForward(msg)}>
              <IShare size={16} />
            </button>
          )}
          {isOut && isText && (
            <button className="tool" title="Edit" onClick={() => onEdit(msg)}>
              <IEdit size={16} />
            </button>
          )}
          {(isOut || canManage) && (
            <button className="tool" title="Delete" onClick={() => onDelete(msg)}>
              <ITrash size={16} />
            </button>
          )}
          {(isOut || canManage) && (
            <button className="tool" title="Select" onClick={(e) => { e.stopPropagation(); onStartSelect?.(msg); }}>
              <ICheckSquare size={16} />
            </button>
          )}
        </div>
      )}

      {!selectionMode && emojiOpen && (
        <div className="emoji-pop" ref={popRef}>
          {QUICK.map((e) => (
            <button key={e} onClick={() => react(e)}>{e}</button>
          ))}
        </div>
      )}
    </motion.div>
  );
}
