import { useState, useRef, useEffect } from "react";
import { IShield, IChat, IUsers, IBroadcast, ICamera, IFilm, ILogout, ICog } from "../Icon";
import Avatar from "../Avatar";
import { useAuth } from "../../context/AuthContext";

const NAV = [
  { key: "chats", label: "Chats", Icon: IChat },
  { key: "groups", label: "Groups", Icon: IUsers },
  { key: "channels", label: "Channels", Icon: IBroadcast },
  { key: "stories", label: "Stories", Icon: ICamera },
  { key: "reels", label: "Reels", Icon: IFilm },
];

// Slim left rail: brand, section nav, and the user menu.
export default function Rail({ section, onSection, onOpenSettings, badges = {} }) {
  const { user, signOut } = useAuth();
  const [menu, setMenu] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setMenu(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <aside className="rail">
      <div className="rail-logo">
        <IShield size={22} />
      </div>

      {NAV.map(({ key, label, Icon }) => (
        <button
          key={key}
          className={`rail-btn ${section === key ? "active" : ""}`}
          title={label}
          onClick={() => onSection(key)}
        >
          <Icon size={22} />
          {badges[key] > 0 && <span className="rail-badge">{badges[key] > 99 ? "99+" : badges[key]}</span>}
        </button>
      ))}

      <div className="rail-spacer" />

      <button className="rail-btn" title="Settings" onClick={onOpenSettings}>
        <ICog size={22} />
      </button>

      <div ref={ref} style={{ position: "relative" }}>
        <button className="rail-btn" onClick={() => setMenu((m) => !m)} title="Account">
          <Avatar src={user?.avatar} name={user?.username} size={40} />
        </button>
        {menu && (
          <div className="menu" style={{ bottom: 0, left: 56 }}>
            <div style={{ padding: "8px 12px 10px" }}>
              <div style={{ fontWeight: 600 }}>{user?.username}</div>
              <div style={{ fontSize: 12.5, color: "var(--text-faint)" }}>
                @{user?.nickname || user?.username}
              </div>
            </div>
            <div className="menu-sep" />
            <button className="menu-item" onClick={() => { setMenu(false); onOpenSettings(); }}>
              <ICog size={18} /> Settings & Profile
            </button>
            <button className="menu-item danger" onClick={signOut}>
              <ILogout size={18} /> Sign out
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
