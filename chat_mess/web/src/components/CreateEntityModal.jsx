import { useState, useEffect, useRef } from "react";
import Modal from "./Modal";
import Avatar from "./Avatar";
import { ICamera, ISearch, IClose, ICheck } from "./Icon";
import { usersApi, groupsApi, channelsApi } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

// Create a group or channel. `kind` is "group" | "channel".
export default function CreateEntityModal({ kind, onClose, onCreated }) {
  const { user } = useAuth();
  const toast = useToast();
  const isGroup = kind === "group";

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState("");
  const [members, setMembers] = useState([]); // {id, username, avatar}
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  const timer = useRef();

  useEffect(() => {
    clearTimeout(timer.current);
    if (!q.trim()) return setResults([]);
    timer.current = setTimeout(async () => {
      try {
        const r = await usersApi.search(q.trim(), user.userId);
        setResults(r.filter((u) => u.id !== user.userId && !members.some((m) => m.id === u.id)));
      } catch {
        setResults([]);
      }
    }, 300);
    return () => clearTimeout(timer.current);
  }, [q, members, user.userId]);

  const pickAvatar = (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setAvatarFile(f);
    setAvatarPreview(URL.createObjectURL(f));
  };

  const addMember = (u) => {
    setMembers((m) => [...m, { id: u.id, username: u.username || u.nickname, avatar: u.avatar }]);
    setQ("");
    setResults([]);
  };
  const removeMember = (id) => setMembers((m) => m.filter((x) => x.id !== id));

  const submit = async () => {
    if (!name.trim()) return toast.error("Please enter a name.");
    setBusy(true);
    try {
      const api = isGroup ? groupsApi : channelsApi;
      const entity = await api.create({
        userId: user.userId,
        name: name.trim(),
        description: description.trim(),
        isPublic: String(isPublic),
        members: members.map((m) => m.id),
        avatar: avatarFile || undefined,
      });
      toast.success(`${isGroup ? "Group" : "Channel"} created!`);
      onCreated?.(entity);
      onClose();
    } catch (e) {
      toast.error(e?.response?.data?.error || "Could not create. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={isGroup ? "Create a group" : "Create a channel"}
      onClose={onClose}
      width={520}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={busy}>
            {busy ? <span className="spinner" /> : "Create"}
          </button>
        </>
      }
    >
      <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 18 }}>
        <button className="avatar-edit" onClick={() => fileRef.current?.click()}>
          <Avatar src={avatarPreview} name={name || "?"} size={72} />
          <span className="avatar-edit-badge"><ICamera size={15} /></span>
        </button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickAvatar} />
        <div style={{ flex: 1 }}>
          <input
            className="input"
            placeholder={isGroup ? "Group name" : "Channel name"}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>
      </div>

      <div className="field" style={{ marginBottom: 16 }}>
        <textarea
          className="input"
          style={{ height: 76, paddingTop: 12, resize: "none" }}
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <button className="toggle-row" onClick={() => setIsPublic((v) => !v)}>
        <div>
          <div className="toggle-title">{isPublic ? "Public" : "Private"}</div>
          <div className="toggle-sub">
            {isPublic ? "Anyone can find and join" : "Only invited people can join"}
          </div>
        </div>
        <span className={`switch ${isPublic ? "on" : ""}`}><span className="knob" /></span>
      </button>

      <div className="field" style={{ marginTop: 18 }}>
        <label>Add members</label>
        {members.length > 0 && (
          <div className="chips">
            {members.map((m) => (
              <span key={m.id} className="chip">
                <Avatar src={m.avatar} name={m.username} size={20} />
                {m.username}
                <button onClick={() => removeMember(m.id)}><IClose size={13} /></button>
              </span>
            ))}
          </div>
        )}
        <div className="search" style={{ marginTop: 8 }}>
          <span className="icon"><ISearch size={17} /></span>
          <input placeholder="Search people…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {results.length > 0 && (
          <div className="member-results">
            {results.map((u) => (
              <div key={u.id} className="search-result" onClick={() => addMember(u)}>
                <Avatar src={u.avatar} name={u.username || u.nickname} size={38} />
                <div className="chat-meta">
                  <div className="chat-name">{u.username || u.nickname}</div>
                  <div className="nick">@{u.nickname || u.username}</div>
                </div>
                <span className="add-ic"><ICheck size={16} /></span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
