import React from "react";
import { fmtDateTime } from "../lib/format.js";

const KIND = {
  dm: { ico: "💬", label: "Личное" },
  group: { ico: "👥", label: "Группа" },
  channel: { ico: "📢", label: "Канал" },
};

export default function LiveFeed({ events, onClear }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 16 }}>
        <div className="topbar sub" style={{ padding: 0, height: "auto", border: "none" }}>
          Поток всех сообщений платформы в реальном времени — {events.length} событий
        </div>
        {events.length > 0 && (
          <button className="btn btn-sm btn-ghost" style={{ marginLeft: "auto" }} onClick={onClear}>Очистить</button>
        )}
      </div>

      {!events.length ? (
        <div className="empty"><div><div className="big">📡</div>Ожидание сообщений…<br />Как только кто-то напишет — оно появится здесь</div></div>
      ) : (
        <div className="feed">
          {events.map((e) => {
            const k = KIND[e.kind];
            return (
              <div key={e.uid} className={`feed-item ${e.kind}`}>
                <div className="kind">{k.ico}</div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="feed-meta">
                    <span className="pill">{k.label}</span>
                    <b>{e.from}</b>
                    {e.scope && <span>→ {e.scope}</span>}
                    <span style={{ marginLeft: "auto" }}>{fmtDateTime(e.time)}</span>
                  </div>
                  <div className={`feed-text ${e.system ? "sys" : ""}`}>{e.text}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
