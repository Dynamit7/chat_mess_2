import { useState, useEffect } from "react";
import Modal from "./Modal";
import Avatar from "./Avatar";
import { IChat, IBan } from "./Icon";
import { usersApi } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

const lastSeenText = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return "";
  const diff = Date.now() - d.getTime();
  if (diff < 60e3) return "last seen just now";
  if (diff < 3600e3) return `last seen ${Math.floor(diff / 60e3)} min ago`;
  if (diff < 86400e3) return `last seen ${Math.floor(diff / 3600e3)} h ago`;
  return `last seen ${d.toLocaleDateString()}`;
};

// View another user's public profile. `onMessage` opens a DM with them.
export default function UserProfileModal({ userId, onClose, onMessage }) {
  const { user } = useAuth();
  const toast = useToast();
  const me = Number(user.userId);
  const isSelf = Number(userId) === me;

  const [profile, setProfile] = useState(null);
  const [blocked, setBlocked] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    usersApi.getById(userId).then(setProfile).catch(() => setProfile({}));
    if (!isSelf) usersApi.isBlocked(me, userId).then((r) => setBlocked(!!r.isBlocked)).catch(() => {});
  }, [userId, me, isSelf]);

  const toggleBlock = async () => {
    setBusy(true);
    try {
      if (blocked) { await usersApi.unblock(me, userId); setBlocked(false); toast.success("Unblocked."); }
      else { await usersApi.block(me, userId); setBlocked(true); toast.success("Blocked."); }
    } catch { toast.error("Action failed."); } finally { setBusy(false); }
  };

  return (
    <Modal title="Profile" onClose={onClose} width={420}>
      {!profile ? (
        <div className="center-load" style={{ padding: 40 }}><span className="spinner" /></div>
      ) : (
        <div style={{ textAlign: "center" }}>
          <Avatar src={profile.avatar} name={profile.username} size={104} zoomable />
          <h2 style={{ fontFamily: "var(--font-display)", marginTop: 14, fontSize: 23 }}>{profile.username || "User"}</h2>
          {profile.nickname && <div style={{ color: "var(--text-faint)", fontSize: 14, marginTop: 2 }}>@{profile.nickname}</div>}
          {profile.lastSeen && <div style={{ color: "var(--text-dim)", fontSize: 13, marginTop: 6 }}>{lastSeenText(profile.lastSeen)}</div>}

          {profile.bio && (
            <div style={{ marginTop: 16, padding: "12px 16px", borderRadius: "var(--r-md)", background: "var(--glass)", border: "1px solid var(--stroke)", fontSize: 14, color: "var(--text)", textAlign: "left" }}>
              {profile.bio}
            </div>
          )}

          {!isSelf && (
            <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
              {onMessage && (
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => { onMessage({ partnerId: Number(userId), username: profile.username, picture: profile.avatar }); onClose(); }}>
                  <IChat size={18} /> Message
                </button>
              )}
              <button className={`btn ${blocked ? "btn-primary" : "btn-ghost"}`} style={onMessage ? undefined : { flex: 1 }} onClick={toggleBlock} disabled={busy} title={blocked ? "Unblock" : "Block"}>
                <IBan size={18} /> {blocked ? "Unblock" : "Block"}
              </button>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
