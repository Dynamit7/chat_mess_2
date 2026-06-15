import React, { useEffect, useState, useCallback } from "react";
import Avatar from "./Avatar.jsx";
import { fetchUsers, muteUser, unmuteUser } from "../api.js";
import { fmtDate, ago } from "../lib/format.js";

export default function UsersView({ search }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    fetchUsers(search).then((u) => { setUsers(u); setLoading(false); });
  }, [search]);
  useEffect(() => {
    const t = setTimeout(load, 250); // debounce search
    return () => clearTimeout(t);
  }, [load]);

  const doMute = async (u) => {
    await muteUser(u.id, 60);
    load();
  };
  const doUnmute = async (u) => {
    await unmuteUser(u.id);
    load();
  };

  return (
    <div style={{ overflow: "auto", height: "100%" }}>
      {loading ? (
        <div className="loading">Загрузка пользователей…</div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Пользователь</th>
              <th>Email</th>
              <th>Статус</th>
              <th>Регистрация</th>
              <th>Был(а)</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const muted = u.isMuted && (!u.mutedUntil || new Date(u.mutedUntil) > new Date());
              return (
                <tr key={u.id}>
                  <td>
                    <div className="u-cell">
                      <Avatar src={u.avatar} name={u.username} size="sm" />
                      <div>
                        <div style={{ fontWeight: 700 }}>{u.username} <span className="row-time mono">#{u.id}</span></div>
                        {u.nickname && <div className="row-time">@{u.nickname}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="mono" style={{ color: "var(--text-dim)" }}>{u.email}</td>
                  <td>
                    <div className="actions">
                      {u.isOnline && <span className="pill green">онлайн</span>}
                      {muted && <span className="pill amber">заглушён</span>}
                      {u.ghostMode && <span className="pill">ghost</span>}
                      {u.twoFactorEnabled && <span className="pill accent">2FA</span>}
                      {u.moderationWarnings > 0 && <span className="pill red">⚠ {u.moderationWarnings}</span>}
                    </div>
                  </td>
                  <td className="row-time">{fmtDate(u.createdAt)}</td>
                  <td className="row-time">{u.isOnline ? "сейчас" : ago(u.lastSeen)}</td>
                  <td>
                    {muted ? (
                      <button className="btn btn-sm btn-ghost" onClick={() => doUnmute(u)}>Снять mute</button>
                    ) : (
                      <button className="btn btn-sm btn-amber" onClick={() => doMute(u)}>Заглушить 1ч</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
