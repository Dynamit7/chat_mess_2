import React, { useState } from "react";
import { loginWithPassword, setAdminToken } from "../api.js";

export default function Login({ onSuccess }) {
  const [username, setUsername] = useState("superadmin");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;
    setBusy(true);
    setErr("");
    try {
      const { token, role } = await loginWithPassword(username.trim(), password.trim());
      setAdminToken(token, role);
      onSuccess();
    } catch (e) {
      setErr(e.response?.status === 401 ? "Неверный логин или пароль" : "Сервер недоступен");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <div className="login-logo">🛡️</div>
        <h1>Admin Console</h1>
        <p>Мониторинг и модерация всех чатов, групп и каналов в реальном времени.</p>

        <label className="field-label">Логин</label>
        <input
          className="input"
          type="text"
          placeholder="superadmin"
          value={username}
          autoFocus
          onChange={(e) => setUsername(e.target.value)}
        />
        <label className="field-label" style={{ marginTop: 10 }}>Пароль</label>
        <input
          className="input mono"
          type="password"
          placeholder="••••••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button className="btn" disabled={busy}>{busy ? "Вход…" : "Войти"}</button>
        <div className="err">{err}</div>
      </form>
    </div>
  );
}
