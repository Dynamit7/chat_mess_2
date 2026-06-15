import React, { useEffect, useRef } from "react";
import Avatar from "./Avatar.jsx";
import { fmtTime, fmtDate } from "../lib/format.js";
import { fixFileUrl } from "../config.js";

const isImg = (m) => m.type === "image" || (m.fileUrl && /\.(png|jpe?g|gif|webp)$/i.test(m.fileUrl));

function PollBlock({ poll }) {
  if (!poll) return null;
  const max = Math.max(0, ...poll.options.map((o) => o.votesCount));
  return (
    <div className="poll">
      <div className="poll-q">
        📊 {poll.question}
        {poll.isQuiz && <span className="pill accent" style={{ marginLeft: 8 }}>викторина</span>}
        {poll.isClosed && <span className="pill" style={{ marginLeft: 6 }}>закрыт</span>}
      </div>
      {poll.options.map((o, i) => {
        const correct = poll.isQuiz && poll.correctOptionIndex === i;
        const voters = o.voters || [];
        return (
          <div className="poll-opt" key={o.id}>
            <div className="poll-opt-head">
              <span>{correct ? "✓ " : ""}{o.text}</span>
              <span className="poll-opt-num">{o.votesCount} · {o.percentage}%</span>
            </div>
            <div className="poll-bar"><div className="poll-bar-fill" style={{ width: `${o.percentage}%`, opacity: o.votesCount === max && max > 0 ? 1 : 0.6 }} /></div>
            {voters.length > 0 && (
              <div className="poll-voters">
                {voters.map((v) => (
                  <span key={v.id} className="poll-voter">{v.username}</span>
                ))}
              </div>
            )}
          </div>
        );
      })}
      <div className="poll-foot">{poll.totalVotes} голосов{poll.isAnonymous ? " · анонимный" : ""}</div>
    </div>
  );
}

function Attachment({ m }) {
  if (!m.fileUrl) return null;
  if (isImg(m)) return <img className="media" src={fixFileUrl(m.fileUrl)} alt="" />;
  const icon = { video: "🎬", audio: "🎙", voice: "🎙", file: "📎", poll: "📊" }[m.type] || "📎";
  return (
    <a className="attach" href={fixFileUrl(m.fileUrl)} target="_blank" rel="noreferrer">
      {icon} {m.filename || m.type || "вложение"}
    </a>
  );
}

// Shared chat thread renderer for DM / group / channel oversight.
export default function MessageThread({ messages, onDelete }) {
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView(); }, [messages]);

  if (!messages?.length) {
    return <div className="empty"><div><div className="big">💬</div>В этой переписке пока нет сообщений</div></div>;
  }

  let lastDate = null;
  return (
    <div className="conv-body">
      {messages.map((m) => {
        const senderName = m.sender?.username || `Пользователь #${m.fromUserId ?? m.userId}`;
        const date = fmtDate(m.createdAt);
        const showDate = date !== lastDate;
        lastDate = date;
        const isPoll = m.type === "poll" || m.poll;
        // for a poll the question lives in poll.question; m.text may duplicate it
        const bodyText = isPoll ? (m.poll ? "" : (m.text || "📊 Опрос")) : m.text;
        return (
          <React.Fragment key={m.id}>
            {showDate && <div className="date-sep">{date}</div>}
            <div className="msg-row">
              <Avatar src={m.sender?.avatar} name={senderName} size="sm" />
              <div className="bubble">
                <div className="sender">{senderName} <span className="row-time mono">#{m.id}</span></div>
                {m.forwardedFromUsername && (
                  <div className="time" style={{ marginBottom: 4 }}>↪ переслано от {m.forwardedFromUsername}</div>
                )}
                <>
                  {bodyText && <div className="text" style={m.isDeleted ? { opacity: 0.6 } : undefined}>{bodyText}</div>}
                  {m.poll && <PollBlock poll={m.poll} />}
                  {isPoll && !m.poll && <div className="text" style={{ color: "var(--text-faint)" }}>📊 опрос</div>}
                  <Attachment m={m} />
                  {m.isDeleted && <div className="text deleted" style={{ marginTop: 2 }}>сообщение удалено</div>}
                </>
                <div className="b-foot">
                  <span className="time">{fmtTime(m.createdAt)}{m.isEdited ? " · изм." : ""}</span>
                  {!m.isDeleted && onDelete && (
                    <button className="del-btn" onClick={() => onDelete(m.id)}>удалить</button>
                  )}
                </div>
              </div>
            </div>
          </React.Fragment>
        );
      })}
      <div ref={endRef} />
    </div>
  );
}
