import { useState, useRef, useEffect } from "react";
import { ISend, IPaperclip, IClose, IReply, IEdit, IPoll, ISmile } from "../Icon";
import EmojiPicker from "./EmojiPicker";

export default function Composer({
  replyTo,
  editing,
  onCancelReply,
  onCancelEdit,
  onSaveEdit,
  onSend,
  onSendFile,
  onTyping,
  onPoll,
  partnerName,
}) {
  const [text, setText] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const taRef = useRef(null);
  const fileRef = useRef(null);
  const typingTimer = useRef(null);

  // Вставка эмодзи в позицию курсора (пикер остаётся открытым — можно
  // выбрать несколько подряд, как в обычных мессенджерах).
  const insertEmoji = (emoji) => {
    const ta = taRef.current;
    const start = ta?.selectionStart ?? text.length;
    const end = ta?.selectionEnd ?? text.length;
    const next = text.slice(0, start) + emoji + text.slice(end);
    setText(next);
    onTyping?.(true);
    requestAnimationFrame(() => {
      if (!ta) return;
      ta.focus();
      const pos = start + emoji.length;
      ta.setSelectionRange(pos, pos);
      autosize();
    });
  };

  // When entering edit mode, prefill and focus.
  useEffect(() => {
    if (editing) {
      setText(editing.text || "");
      taRef.current?.focus();
    }
  }, [editing]);

  useEffect(() => {
    if (replyTo) taRef.current?.focus();
  }, [replyTo]);

  const autosize = () => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 160) + "px";
  };

  const change = (e) => {
    setText(e.target.value);
    autosize();
    onTyping?.(true);
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => onTyping?.(false), 1400);
  };

  const reset = () => {
    setText("");
    requestAnimationFrame(() => {
      if (taRef.current) taRef.current.style.height = "auto";
    });
  };

  const submit = () => {
    const t = text.trim();
    if (!t) return;
    onTyping?.(false);
    clearTimeout(typingTimer.current);
    if (editing) onSaveEdit?.(t);
    else onSend(t);
    reset();
  };

  const onKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
    if (e.key === "Escape") {
      if (editing) onCancelEdit?.();
      else if (replyTo) onCancelReply?.();
    }
  };

  const pickFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) onSendFile(file);
  };

  return (
    <div className="composer">
      {editing && (
        <div className="reply-bar">
          <IEdit size={18} color="var(--brand-2)" />
          <div className="rb-body">
            <div className="rb-name">Editing message</div>
            <div className="rb-text">{editing.text}</div>
          </div>
          <button className="icon-btn" onClick={() => onCancelEdit?.()}>
            <IClose size={16} />
          </button>
        </div>
      )}
      {replyTo && !editing && (
        <div className="reply-bar">
          <IReply size={18} color="var(--brand-2)" />
          <div className="rb-body">
            <div className="rb-name">
              Reply to {Number(replyTo.fromUserId) === Number(replyTo.me) ? "yourself" : partnerName}
            </div>
            <div className="rb-text">{replyTo.text || "Attachment"}</div>
          </div>
          <button className="icon-btn" onClick={onCancelReply}>
            <IClose size={16} />
          </button>
        </div>
      )}

      {emojiOpen && (
        <EmojiPicker onPick={insertEmoji} onClose={() => setEmojiOpen(false)} />
      )}

      <div className="composer-box">
        {!editing && (
          <>
            <input ref={fileRef} type="file" hidden onChange={pickFile} />
            <button
              className="icon-btn"
              style={{ background: "transparent", border: "none" }}
              title="Attach a file"
              onClick={() => fileRef.current?.click()}
            >
              <IPaperclip size={20} />
            </button>
            {onPoll && (
              <button
                className="icon-btn"
                style={{ background: "transparent", border: "none" }}
                title="Create a poll"
                onClick={onPoll}
              >
                <IPoll size={20} />
              </button>
            )}
          </>
        )}
        <button
          className={"icon-btn" + (emojiOpen ? " active" : "")}
          style={{ background: "transparent", border: "none" }}
          title="Emoji"
          onClick={() => setEmojiOpen((v) => !v)}
          type="button"
        >
          <ISmile size={20} />
        </button>
        <textarea
          ref={taRef}
          rows={1}
          placeholder={editing ? "Edit your message…" : "Write a message…"}
          value={text}
          onChange={change}
          onKeyDown={onKey}
        />
        <button className="send-btn" onClick={submit} disabled={!text.trim()}>
          <ISend size={20} />
        </button>
      </div>
    </div>
  );
}
