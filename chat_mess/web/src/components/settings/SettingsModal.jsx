import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import Avatar from "../Avatar";
import {
  IClose, ICamera, IUser, ILock, IShield, IBan, IGlobe, ILogout, ICheck, ITrash,
} from "../Icon";
import { usersApi, authApi } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";

const VIS = [
  { value: "Все", label: "Everyone" },
  { value: "Только друзья", label: "Friends" },
  { value: "Никто", label: "Nobody" },
];
const LANGS = [
  ["en", "English"], ["ru", "Русский"], ["uz", "Oʻzbek"], ["es", "Español"], ["fr", "Français"],
  ["de", "Deutsch"], ["zh", "中文"], ["ja", "日本語"], ["ko", "한국어"], ["ar", "العربية"],
  ["tr", "Türkçe"], ["uk", "Українська"], ["pt", "Português"], ["it", "Italiano"],
];

function Switch({ on, onClick }) {
  return <span className={`switch ${on ? "on" : ""}`} onClick={onClick}><span className="knob" /></span>;
}

function Segmented({ value, options, onChange }) {
  return (
    <div className="segmented">
      {options.map((o) => (
        <button key={o.value} className={value === o.value ? "active" : ""} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ---- Profile ----
function ProfileTab() {
  const { user, updateProfile } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ username: user.username || "", nickname: user.nickname || "", bio: "", avatar: user.avatar || "" });
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    usersApi.getById(user.userId).then((u) => setForm((f) => ({ ...f, nickname: u.nickname || f.nickname, bio: u.bio || "", avatar: u.avatar || f.avatar }))).catch(() => {});
  }, [user.userId]);

  const pickAvatar = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const { url } = await usersApi.uploadAvatar(user.userId, file);
      setForm((f) => ({ ...f, avatar: url }));
    } catch { toast.error("Avatar upload failed."); }
    finally { setUploading(false); }
  };

  const save = async () => {
    setBusy(true);
    try {
      await usersApi.updateProfile({ userId: user.userId, username: form.username, nickname: form.nickname, avatar: form.avatar, bio: form.bio });
      updateProfile({ username: form.username, nickname: form.nickname, avatar: form.avatar });
      toast.success("Profile saved.");
    } catch (e) { toast.error(e?.response?.data?.error || "Couldn't save."); }
    finally { setBusy(false); }
  };

  return (
    <div className="settings-pane">
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 22 }}>
        <button className="avatar-edit" onClick={() => fileRef.current?.click()}>
          <Avatar src={form.avatar} name={form.username} size={96} />
          <span className="avatar-edit-badge">{uploading ? <span className="spinner" /> : <ICamera size={16} />}</span>
        </button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickAvatar} />
      </div>
      <div className="field"><label>Username</label><input className="input" value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))} /></div>
      <div className="field" style={{ marginTop: 14 }}><label>Nickname</label><input className="input" value={form.nickname} onChange={(e) => setForm((f) => ({ ...f, nickname: e.target.value }))} /></div>
      <div className="field" style={{ marginTop: 14 }}><label>Bio</label>
        <textarea className="input" style={{ height: 84, paddingTop: 12, resize: "none" }} maxLength={200} value={form.bio} onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))} placeholder="Tell people about yourself" />
      </div>
      <button className="btn btn-primary btn-block" style={{ marginTop: 20 }} onClick={save} disabled={busy}>
        {busy ? <span className="spinner" /> : "Save profile"}
      </button>
    </div>
  );
}

// ---- Privacy ----
function PrivacyTab() {
  const { user } = useAuth();
  const toast = useToast();
  const [p, setP] = useState(null);

  useEffect(() => { usersApi.getPrivacy(user.userId).then(setP).catch(() => setP({})); }, [user.userId]);

  const patch = (k, v) => setP((s) => ({ ...s, [k]: v }));
  const setVis = async (key, value) => {
    patch(key, value);
    try { await usersApi.updatePrivacy({ userId: user.userId, [key]: value }); } catch { toast.error("Update failed."); }
  };
  const toggleGhost = async () => { const v = !p.ghostMode; patch("ghostMode", v); try { await usersApi.updateGhostMode(user.userId, v); } catch { toast.error("Update failed."); } };
  const toggleReceipts = async () => { const v = p.readReceiptSetting === "everyone" ? "nobody" : "everyone"; patch("readReceiptSetting", v); try { await usersApi.updateReadReceipts(user.userId, v); } catch { toast.error("Update failed."); } };

  if (!p) return <div className="center-load" style={{ padding: 40 }}><span className="spinner" /></div>;

  return (
    <div className="settings-pane">
      <div className="settings-group-label">Visibility</div>
      {[["profileVisibility", "Profile"], ["statusVisibility", "Last seen & online"], ["photoVisibility", "Profile photo"]].map(([k, lbl]) => (
        <div className="settings-row col" key={k}>
          <div className="toggle-title">{lbl}</div>
          <Segmented value={p[k] || "Все"} options={VIS} onChange={(v) => setVis(k, v)} />
        </div>
      ))}
      <div className="settings-group-label" style={{ marginTop: 18 }}>Activity</div>
      <div className="settings-row">
        <div><div className="toggle-title">Show online status</div><div className="toggle-sub">Off enables ghost mode</div></div>
        <Switch on={!p.ghostMode} onClick={toggleGhost} />
      </div>
      <div className="settings-row">
        <div><div className="toggle-title">Read receipts</div><div className="toggle-sub">Let others see when you’ve read</div></div>
        <Switch on={p.readReceiptSetting === "everyone"} onClick={toggleReceipts} />
      </div>
    </div>
  );
}

// ---- Security / 2FA ----
function SecurityTab() {
  const { user } = useAuth();
  const toast = useToast();
  const [enabled, setEnabled] = useState(null);
  const [pw, setPw] = useState("");
  const [twoPw, setTwoPw] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { authApi.twoFactorStatus(user.userId).then((r) => setEnabled(r.twoFactorEnabled)).catch(() => setEnabled(false)); }, [user.userId]);

  const enable = async () => {
    if (!pw || twoPw.length < 4) return toast.error("Enter your password and a 2FA password (4+ chars).");
    setBusy(true);
    try { await authApi.setupTwoFactor({ userId: user.userId, password: pw, twoFactorPassword: twoPw }); setEnabled(true); setPw(""); setTwoPw(""); toast.success("Two-factor enabled."); }
    catch (e) { toast.error(e?.response?.data?.error || "Couldn't enable 2FA."); }
    finally { setBusy(false); }
  };
  const disable = async () => {
    if (!pw) return toast.error("Enter your account password.");
    setBusy(true);
    try { await authApi.disableTwoFactor({ userId: user.userId, password: pw }); setEnabled(false); setPw(""); toast.success("Two-factor disabled."); }
    catch (e) { toast.error(e?.response?.data?.error || "Couldn't disable 2FA."); }
    finally { setBusy(false); }
  };

  if (enabled === null) return <div className="center-load" style={{ padding: 40 }}><span className="spinner" /></div>;

  return (
    <div className="settings-pane">
      <div className="settings-row">
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <span className="settings-ic"><IShield size={20} /></span>
          <div><div className="toggle-title">Two-factor authentication</div><div className="toggle-sub">{enabled ? "Enabled — extra password on login" : "Add a second password at login"}</div></div>
        </div>
        <span className={`status-dot ${enabled ? "on" : ""}`}>{enabled ? "On" : "Off"}</span>
      </div>
      <div className="field" style={{ marginTop: 18 }}><label>Account password</label><input className="input" type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="••••••••" /></div>
      {!enabled && (
        <div className="field" style={{ marginTop: 14 }}><label>New 2FA password</label><input className="input" type="password" value={twoPw} onChange={(e) => setTwoPw(e.target.value)} placeholder="At least 4 characters" /></div>
      )}
      <button className={`btn ${enabled ? "btn-ghost" : "btn-primary"} btn-block`} style={{ marginTop: 20 }} onClick={enabled ? disable : enable} disabled={busy}>
        {busy ? <span className="spinner" /> : enabled ? "Disable 2FA" : "Enable 2FA"}
      </button>
    </div>
  );
}

// ---- Blocked ----
function BlockedTab() {
  const { user } = useAuth();
  const toast = useToast();
  const [list, setList] = useState(null);

  useEffect(() => { usersApi.blockedUsers(user.userId).then((l) => setList(Array.isArray(l) ? l : [])).catch(() => setList([])); }, [user.userId]);

  const unblock = async (id) => {
    try { await usersApi.unblock(user.userId, id); setList((l) => l.filter((u) => Number(u.id) !== Number(id))); toast.success("Unblocked."); }
    catch { toast.error("Couldn't unblock."); }
  };

  if (!list) return <div className="center-load" style={{ padding: 40 }}><span className="spinner" /></div>;
  if (list.length === 0) return <div className="settings-pane"><div className="empty-hint" style={{ paddingTop: 40 }}>😊 You haven’t blocked anyone.</div></div>;

  return (
    <div className="settings-pane">
      {list.map((u) => (
        <div key={u.id} className="search-result">
          <Avatar src={u.avatar} name={u.username || u.nickname} size={40} />
          <div className="chat-meta"><div className="chat-name">{u.username || u.nickname}</div><div className="nick">@{u.nickname || u.username}</div></div>
          <button className="btn btn-ghost" style={{ height: 36, padding: "0 14px" }} onClick={() => unblock(u.id)}>Unblock</button>
        </div>
      ))}
    </div>
  );
}

// ---- Translation ----
function TranslationTab() {
  const { user } = useAuth();
  const toast = useToast();
  const [status, setStatus] = useState(null);
  const [key, setKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => { usersApi.apiKeyStatus(user.userId).then(setStatus).catch(() => setStatus({ hasApiKey: false, preferredLanguage: "en", autoTranslate: false })); }, [user.userId]);

  const saveKey = async () => {
    if (!key.trim()) return;
    setBusy(true);
    try { await usersApi.updateApiKey(user.userId, key.trim()); setStatus((s) => ({ ...s, hasApiKey: true })); setKey(""); toast.success("API key saved."); }
    catch { toast.error("Couldn't save key."); } finally { setBusy(false); }
  };
  const removeKey = async () => {
    try { await usersApi.updateApiKey(user.userId, null); setStatus((s) => ({ ...s, hasApiKey: false })); toast.success("API key removed."); }
    catch { toast.error("Couldn't remove key."); }
  };
  const setLang = async (lang) => { setStatus((s) => ({ ...s, preferredLanguage: lang })); try { await usersApi.updateTranslationSettings(user.userId, lang, status.autoTranslate); } catch {} };
  const toggleAuto = async () => { const v = !status.autoTranslate; setStatus((s) => ({ ...s, autoTranslate: v })); try { await usersApi.updateTranslationSettings(user.userId, status.preferredLanguage, v); } catch {} };

  if (!status) return <div className="center-load" style={{ padding: 40 }}><span className="spinner" /></div>;

  return (
    <div className="settings-pane">
      <div className="settings-group-label">OpenAI API key {status.hasApiKey && <span className="tag-pill">active</span>}</div>
      <div className="input-wrap">
        <input className="input" type={showKey ? "text" : "password"} value={key} onChange={(e) => setKey(e.target.value)} placeholder={status.hasApiKey ? "Key set — enter new to replace" : "sk-…"} />
        <button className="icon-btn" style={{ position: "absolute", right: 5, width: 36, height: 36, background: "transparent", border: "none" }} onClick={() => setShowKey((v) => !v)}>{showKey ? "🙈" : "👁"}</button>
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={saveKey} disabled={busy || !key.trim()}>{busy ? <span className="spinner" /> : "Save key"}</button>
        {status.hasApiKey && <button className="btn btn-ghost" onClick={removeKey}><ITrash size={17} /></button>}
      </div>

      <div className="settings-group-label" style={{ marginTop: 20 }}>Preferred language</div>
      <div className="lang-grid">
        {LANGS.map(([code, name]) => (
          <button key={code} className={`lang-chip ${status.preferredLanguage === code ? "active" : ""}`} onClick={() => setLang(code)}>
            {name}{status.preferredLanguage === code && <ICheck size={14} />}
          </button>
        ))}
      </div>

      <div className="settings-row" style={{ marginTop: 18 }}>
        <div><div className="toggle-title">Auto-translate</div><div className="toggle-sub">Translate incoming messages automatically</div></div>
        <Switch on={status.autoTranslate} onClick={toggleAuto} />
      </div>
    </div>
  );
}

const TABS = [
  { key: "profile", label: "Profile", Icon: IUser, C: ProfileTab },
  { key: "privacy", label: "Privacy", Icon: ILock, C: PrivacyTab },
  { key: "security", label: "Security", Icon: IShield, C: SecurityTab },
  { key: "blocked", label: "Blocked", Icon: IBan, C: BlockedTab },
  { key: "translation", label: "Translation", Icon: IGlobe, C: TranslationTab },
];

export default function SettingsModal({ onClose }) {
  const { user, signOut } = useAuth();
  const [tab, setTab] = useState("profile");
  const Active = TABS.find((t) => t.key === tab)?.C || ProfileTab;

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose?.();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <motion.div
        className="settings-modal"
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      >
        <aside className="settings-nav">
          <div className="settings-me">
            <Avatar src={user.avatar} name={user.username} size={52} />
            <div style={{ minWidth: 0 }}>
              <div className="chat-name">{user.username}</div>
              <div className="nick">@{user.nickname || user.username}</div>
            </div>
          </div>
          {TABS.map(({ key, label, Icon }) => (
            <button key={key} className={`settings-tab ${tab === key ? "active" : ""}`} onClick={() => setTab(key)}>
              <Icon size={18} /> {label}
            </button>
          ))}
          <div className="rail-spacer" />
          <button className="settings-tab danger" onClick={signOut}><ILogout size={18} /> Sign out</button>
        </aside>
        <div className="settings-content">
          <div className="settings-head">
            <h3>{TABS.find((t) => t.key === tab)?.label}</h3>
            <button className="icon-btn" onClick={onClose}><IClose size={18} /></button>
          </div>
          <div className="settings-scroll"><Active /></div>
        </div>
      </motion.div>
    </div>
  );
}
