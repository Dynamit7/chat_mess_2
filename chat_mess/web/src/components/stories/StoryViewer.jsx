import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import Avatar from "../Avatar";
import { IClose, ITrash, IArrowLeft } from "../Icon";
import { storiesApi } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { chatStamp, timeShort } from "../../lib/format";

const IMG_MS = 5000;

// Fullscreen story viewer across multiple owners, Instagram-style.
export default function StoryViewer({ owners, startOwnerIndex = 0, onClose, onDeleted, onViewed }) {
  const { user } = useAuth();
  const toast = useToast();
  const me = Number(user.userId);

  const [oi, setOi] = useState(startOwnerIndex);
  const [si, setSi] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [viewersOpen, setViewersOpen] = useState(false);
  const [viewers, setViewers] = useState([]);

  const owner = owners[oi];
  const story = owner?.stories[si];
  const isOwn = owner && Number(owner.userId) === me;

  const rafRef = useRef(null);
  const startRef = useRef(0);
  const videoRef = useRef(null);

  const close = onClose;

  const next = useCallback(() => {
    setViewersOpen(false);
    setSi((curSi) => {
      const stories = owners[oi]?.stories || [];
      if (curSi < stories.length - 1) return curSi + 1;
      // move to next owner
      if (oi < owners.length - 1) { setOi(oi + 1); return 0; }
      close();
      return curSi;
    });
  }, [oi, owners, close]);

  const prev = useCallback(() => {
    setViewersOpen(false);
    setSi((curSi) => {
      if (curSi > 0) return curSi - 1;
      if (oi > 0) { const po = owners[oi - 1]; setOi(oi - 1); return Math.max(0, (po?.stories.length || 1) - 1); }
      return 0;
    });
  }, [oi, owners]);

  // Mark viewed + reset progress on each story.
  useEffect(() => {
    if (!story) return;
    setProgress(0);
    startRef.current = 0;
    if (!isOwn) {
      storiesApi.view(story.id, me).catch(() => {});
      onViewed?.(owner.userId, story.id);
    }
  }, [story?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Image timer (videos drive their own progress via timeupdate).
  useEffect(() => {
    if (!story || story.type === "video") return;
    let last = performance.now();
    const tick = (now) => {
      if (!paused) {
        startRef.current += now - last;
        const p = Math.min(1, startRef.current / IMG_MS);
        setProgress(p);
        if (p >= 1) { next(); return; }
      }
      last = now;
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [story?.id, paused, next]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard nav
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [next, prev, close]);

  const openViewers = async () => {
    setPaused(true);
    setViewersOpen(true);
    try {
      const v = await storiesApi.viewers(story.id);
      setViewers(Array.isArray(v) ? v : []);
    } catch {
      setViewers([]);
    }
  };

  const remove = async () => {
    if (!confirm("Delete this story?")) return;
    try {
      await storiesApi.remove(story.id, me);
      onDeleted?.(owner.userId, story.id);
      next();
    } catch {
      toast.error("Couldn't delete.");
    }
  };

  if (!story) return null;

  return (
    <motion.div className="story-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <button className="story-nav-side left" onClick={prev} aria-label="Previous" />
      <button className="story-nav-side right" onClick={next} aria-label="Next" />

      <div className="story-stage" onMouseDown={() => setPaused(true)} onMouseUp={() => setPaused(false)}>
        {/* progress bars */}
        <div className="story-bars">
          {owner.stories.map((s, idx) => (
            <div key={s.id} className="story-bar">
              <div
                className="story-bar-fill"
                style={{ width: idx < si ? "100%" : idx === si ? `${progress * 100}%` : "0%" }}
              />
            </div>
          ))}
        </div>

        <div className="story-top">
          <div className="story-owner">
            <Avatar src={owner.avatar} name={owner.username} size={38} />
            <div>
              <div className="story-name">{owner.username}</div>
              <div className="story-when">{chatStamp(story.createdAt)}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {isOwn && <button className="story-icon" onClick={remove}><ITrash size={18} /></button>}
            <button className="story-icon" onClick={close}><IClose size={20} /></button>
          </div>
        </div>

        <div className="story-media" onClick={(e) => e.stopPropagation()}>
          {story.type === "video" ? (
            <video
              ref={videoRef}
              src={story.fileUrl}
              autoPlay
              playsInline
              onTimeUpdate={(e) => {
                const v = e.currentTarget;
                if (v.duration) setProgress(v.currentTime / v.duration);
              }}
              onEnded={next}
            />
          ) : (
            <img src={story.fileUrl} alt={story.caption || "story"} />
          )}
        </div>

        {story.caption && <div className="story-caption">{story.caption}</div>}

        {isOwn && (
          <button className="story-viewers-btn" onClick={openViewers}>
            👁 {viewersOpen ? viewers.length : ""} View{viewersOpen && viewers.length === 1 ? "" : "ers"}
          </button>
        )}

        {viewersOpen && (
          <div className="story-viewers-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="story-viewers-head">
              <b>👁 {viewers.length} viewer{viewers.length === 1 ? "" : "s"}</b>
              <button className="icon-btn" onClick={() => { setViewersOpen(false); setPaused(false); }}><IClose size={16} /></button>
            </div>
            <div className="story-viewers-list">
              {viewers.length === 0 ? (
                <div className="empty-hint">No viewers yet</div>
              ) : (
                viewers.map((v) => (
                  <div key={v.id} className="search-result">
                    <Avatar src={v.viewer?.avatar} name={v.viewer?.username} size={36} />
                    <div className="chat-meta"><div className="chat-name">{v.viewer?.username}</div></div>
                    <span className="chat-time">{timeShort(v.createdAt)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
