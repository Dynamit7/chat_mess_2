import { motion } from "framer-motion";
import Avatar from "../Avatar";
import PollMessage from "../polls/PollMessage";
import { ISmile, IReply, ITrash, IFile, IChat, IShare, ICheckSquare, ICheck } from "../Icon";
import { chatStamp } from "../../lib/format";

const QUICK = ["👍", "❤️", "🔥", "😂", "😮", "🎉"];

function Media({ msg }) {
  const url = msg.fileUrl;
  if (!url) return null;
  if (msg.type === "image")
    return <a href={url} target="_blank" rel="noreferrer"><img src={url} alt="" loading="lazy" /></a>;
  if (msg.type === "video") return <video src={url} controls preload="metadata" />;
  if (msg.type === "audio") return <audio src={url} controls style={{ width: "100%" }} />;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="file-att">
      <span className="file-ic"><IFile size={20} /></span>
      <span><div className="fn">{msg.filename || "Attachment"}</div><div className="fs">Tap to open</div></span>
    </a>
  );
}

// A single channel post (broadcast card) with reactions and a comments button.
export default function ChannelPost({ post, me, canManage, reactions, onReact, onComment, onDelete, onForward, selectionMode, isSelected, onSelect, onStartSelect }) {
  const isMine = Number(post.userId) === me;
  const isMedia = ["image", "video"].includes(post.type) && post.fileUrl;
  const entries = Object.entries(reactions || {}); // [emoji, {count, users}]
  const canSelect = isMine || canManage;

  return (
    <motion.div
      className="post-card"
      initial={{ y: 10 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.2 }}
      onClick={selectionMode && canSelect ? () => onSelect(post.id) : undefined}
      style={selectionMode && canSelect ? {
        cursor: "pointer",
        outline: isSelected ? "2px solid rgba(124,92,252,0.6)" : "2px solid transparent",
        background: isSelected ? "rgba(124,92,252,0.1)" : undefined,
        transition: "outline 0.15s, background 0.15s",
      } : undefined}
    >
      <div className="post-head">
        <Avatar src={post.sender?.avatar} name={post.sender?.username} size={40} />
        <div style={{ flex: 1 }}>
          <div className="post-author">{post.sender?.username || "Channel"}</div>
          <div className="post-time">{chatStamp(post.createdAt)}{post.isEdited ? " · edited" : ""}</div>
        </div>
        {selectionMode && canSelect ? (
          <div style={{
            width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
            border: `2px solid ${isSelected ? "#7c5cfc" : "rgba(255,255,255,0.35)"}`,
            background: isSelected ? "#7c5cfc" : "transparent",
            display: "flex", alignItems: "center", justifyContent: "center", color: "#fff",
            transition: "all 0.15s",
          }}>
            {isSelected && <ICheck size={12} />}
          </div>
        ) : (
          <>
            <button className="icon-btn" title="Forward" onClick={() => onForward(post)}><IShare size={16} /></button>
            {(isMine || canManage) && (
              <>
                <button className="icon-btn" title="Select" onClick={(e) => { e.stopPropagation(); onStartSelect?.(post); }}><ICheckSquare size={16} /></button>
                <button className="icon-btn" title="Delete" onClick={() => onDelete(post)}><ITrash size={16} /></button>
              </>
            )}
          </>
        )}
      </div>

      {post.forwardedFromUsername && (
        <div className="fwd" style={{ marginBottom: 6 }}><IReply size={12} /> Forwarded from {post.forwardedFromUsername}</div>
      )}

      {post.type === "poll" ? (
        <PollMessage pollId={post.pollId || post.poll?.id} initialPoll={post.poll} />
      ) : isMedia ? (
        <div className="post-media"><Media msg={post} />{post.text ? <p style={{ marginTop: 10 }}>{post.text}</p> : null}</div>
      ) : post.type === "file" || post.type === "audio" ? (
        <Media msg={post} />
      ) : (
        <p className="post-text">{post.text}</p>
      )}

      <div className="post-foot">
        <div className="post-reactions">
          {entries.map(([emoji, info]) => (
            <button
              key={emoji}
              className={`reaction ${info.users?.includes(me) ? "mine" : ""}`}
              onClick={() => onReact(post, emoji)}
            >
              {emoji} {info.count > 1 && <span className="cnt">{info.count}</span>}
            </button>
          ))}
          <div className="react-add">
            <button className="icon-btn react-trigger"><ISmile size={17} /></button>
            <div className="react-pop">
              {QUICK.map((e) => (
                <button key={e} onClick={() => onReact(post, e)}>{e}</button>
              ))}
            </div>
          </div>
        </div>
        <button className="post-comment-btn" onClick={() => onComment(post)}>
          <IChat size={16} /> {post.commentsCount > 0 ? post.commentsCount : ""} Comment{post.commentsCount === 1 ? "" : "s"}
        </button>
      </div>
    </motion.div>
  );
}
