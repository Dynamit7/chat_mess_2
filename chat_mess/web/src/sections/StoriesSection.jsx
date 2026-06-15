import { useState, useEffect, useCallback, useMemo } from "react";
import { AnimatePresence } from "framer-motion";
import Avatar from "../components/Avatar";
import StoryViewer from "../components/stories/StoryViewer";
import CreateStoryModal from "../components/stories/CreateStoryModal";
import { IPlus, ICamera } from "../components/Icon";
import { storiesApi } from "../api/client";
import { useSocket } from "../context/SocketContext";
import { useAuth } from "../context/AuthContext";
import { chatStamp } from "../lib/format";

export default function StoriesSection() {
  const { user } = useAuth();
  const socket = useSocket();
  const me = Number(user.userId);
  const viewedKey = `viewedStoryIds_${me}`;

  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewed, setViewed] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem(viewedKey) || "[]")); } catch { return new Set(); }
  });
  const [viewerAt, setViewerAt] = useState(null); // owner index
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    storiesApi
      .personalized(me)
      .then((data) => setStories(Array.isArray(data) ? data : []))
      .catch(() => setStories([]))
      .finally(() => setLoading(false));
  }, [me]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const onAdded = () => load();
    const onDeleted = ({ storyId }) =>
      setStories((prev) => prev.filter((s) => Number(s.id) !== Number(storyId)));
    socket.on("storyAdded", onAdded);
    socket.on("storyDeleted", onDeleted);
    return () => { socket.off("storyAdded", onAdded); socket.off("storyDeleted", onDeleted); };
  }, [socket, load]);

  // Group stories by owner, mine first, then unviewed, then recent.
  const owners = useMemo(() => {
    const map = new Map();
    for (const s of stories) {
      const uid = Number(s.userId ?? s.owner?.id);
      if (!map.has(uid))
        map.set(uid, { userId: uid, username: s.owner?.username || (uid === me ? user.username : "User"), avatar: s.owner?.avatar, stories: [] });
      map.get(uid).stories.push(s);
    }
    const list = [...map.values()].map((o) => {
      o.stories.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      o.hasUnviewed = o.stories.some((s) => !viewed.has(Number(s.id))) && o.userId !== me;
      o.latest = o.stories[o.stories.length - 1]?.createdAt;
      return o;
    });
    list.sort((a, b) => {
      if (a.userId === me) return -1;
      if (b.userId === me) return 1;
      if (a.hasUnviewed !== b.hasUnviewed) return a.hasUnviewed ? -1 : 1;
      return new Date(b.latest) - new Date(a.latest);
    });
    return list;
  }, [stories, viewed, me, user.username]);

  const markViewed = useCallback((_ownerId, storyId) => {
    setViewed((prev) => {
      if (prev.has(Number(storyId))) return prev;
      const next = new Set(prev).add(Number(storyId));
      localStorage.setItem(viewedKey, JSON.stringify([...next]));
      return next;
    });
  }, [viewedKey]);

  const onDeleted = (ownerId, storyId) =>
    setStories((prev) => prev.filter((s) => Number(s.id) !== Number(storyId)));

  return (
    <>
      <section className="sidebar">
        <div className="sidebar-head">
          <div className="sidebar-title">
            <h1>Stories</h1>
            <button className="icon-btn" title="Add story" onClick={() => setCreating(true)}><IPlus size={20} /></button>
          </div>
        </div>
        <div className="chat-list">
          <div className="chat-item" onClick={() => setCreating(true)}>
            <div className="story-add-ring"><IPlus size={20} /></div>
            <div className="chat-meta"><div className="chat-name">Add to your story</div><div className="chat-preview">Share a moment</div></div>
          </div>
          {loading ? (
            <div className="center-load" style={{ padding: 30 }}><span className="spinner" /></div>
          ) : (
            owners.map((o, idx) => (
              <div key={o.userId} className="chat-item" onClick={() => setViewerAt(idx)}>
                <div className={`story-ring ${o.hasUnviewed ? "unviewed" : ""}`}>
                  <Avatar src={o.avatar} name={o.username} size={44} />
                </div>
                <div className="chat-meta">
                  <div className="chat-name">{o.userId === me ? "Your story" : o.username}</div>
                  <div className="chat-preview">{o.stories.length} update{o.stories.length === 1 ? "" : "s"} · {chatStamp(o.latest)}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="pane">
        {owners.length === 0 && !loading ? (
          <div className="pane-empty">
            <div>
              <div className="glow"><ICamera size={46} color="#fff" /></div>
              <h2>Stories</h2>
              <p>Share moments that disappear in 24 hours. Tap “Add to your story” to begin.</p>
              <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={() => setCreating(true)}>Add to your story</button>
            </div>
          </div>
        ) : (
          <div className="story-tray">
            <button className="story-tile add" onClick={() => setCreating(true)}>
              <div className="story-add-ring big"><IPlus size={26} /></div>
              <span>Your story</span>
            </button>
            {owners.map((o, idx) => (
              <button key={o.userId} className="story-tile" onClick={() => setViewerAt(idx)}>
                <div className={`story-ring big ${o.hasUnviewed ? "unviewed" : ""}`}>
                  <Avatar src={o.avatar} name={o.username} size={76} />
                </div>
                <span>{o.userId === me ? "Your story" : o.username}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      <AnimatePresence>
        {viewerAt !== null && owners[viewerAt] && (
          <StoryViewer
            owners={owners}
            startOwnerIndex={viewerAt}
            onClose={() => setViewerAt(null)}
            onViewed={markViewed}
            onDeleted={onDeleted}
          />
        )}
      </AnimatePresence>

      {creating && (
        <CreateStoryModal onClose={() => setCreating(false)} onCreated={() => load()} />
      )}
    </>
  );
}
