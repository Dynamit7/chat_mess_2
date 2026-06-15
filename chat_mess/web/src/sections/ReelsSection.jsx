import { useState, useEffect, useRef, useCallback } from "react";
import ReelCard from "../components/reels/ReelCard";
import ReelCommentsModal from "../components/reels/ReelCommentsModal";
import CreateReelModal from "../components/reels/CreateReelModal";
import { IFilm, IPlus } from "../components/Icon";
import { reelsApi } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

export default function ReelsSection() {
  const { user } = useAuth();
  const toast = useToast();
  const me = Number(user.userId);

  const [tab, setTab] = useState("feed"); // feed | discover
  const [reels, setReels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState(null);
  const [muted, setMuted] = useState(true);
  const [commentsFor, setCommentsFor] = useState(null);
  const [creating, setCreating] = useState(false);

  const containerRef = useRef(null);
  const viewed = useRef(new Set());

  const load = useCallback(() => {
    setLoading(true);
    const p = tab === "feed" ? reelsApi.feed(me) : reelsApi.discover();
    p.then((data) => {
      const arr = Array.isArray(data) ? data : data?.reels || [];
      setReels(arr);
      if (arr[0]) setActiveId(arr[0].id);
    })
      .catch(() => setReels([]))
      .finally(() => setLoading(false));
  }, [tab, me]);

  useEffect(() => { load(); }, [load]);

  // Track which reel is centered → it becomes active (plays).
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting && e.intersectionRatio > 0.6) {
            const id = Number(e.target.dataset.id);
            setActiveId(id);
            if (!viewed.current.has(id)) { viewed.current.add(id); reelsApi.view(id, me).catch(() => {}); }
          }
        });
      },
      { root, threshold: [0.6] }
    );
    root.querySelectorAll(".reel-slide").forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [reels, me]);

  const patch = (id, fn) => setReels((prev) => prev.map((r) => (Number(r.id) === Number(id) ? fn(r) : r)));

  const onLike = async (reel) => {
    patch(reel.id, (r) => ({ ...r, isLiked: !r.isLiked, likesCount: (r.likesCount || 0) + (r.isLiked ? -1 : 1) }));
    try { await reelsApi.like(reel.id, me); } catch { patch(reel.id, (r) => ({ ...r, isLiked: !r.isLiked, likesCount: (r.likesCount || 0) + (r.isLiked ? -1 : 1) })); }
  };
  const onShare = async (reel) => {
    patch(reel.id, (r) => ({ ...r, sharesCount: (r.sharesCount || 0) + 1 }));
    try { await reelsApi.share(reel.id); await navigator.clipboard?.writeText(reel.videoUrl); toast.success("Link copied!"); } catch {}
  };
  const onFollow = async (reel) => {
    setReels((prev) => prev.map((r) => (Number(r.userId) === Number(reel.userId) ? { ...r, isFollowing: true } : r)));
    try { await reelsApi.follow(me, reel.userId); } catch {}
  };
  const onDelete = async (reel) => {
    if (!confirm("Delete this reel?")) return;
    setReels((prev) => prev.filter((r) => Number(r.id) !== Number(reel.id)));
    try { await reelsApi.remove(reel.id, me); } catch { toast.error("Couldn't delete."); }
  };

  return (
    <>
      <section className="sidebar">
        <div className="sidebar-head">
          <div className="sidebar-title">
            <h1>Reels</h1>
            <button className="icon-btn" title="New reel" onClick={() => setCreating(true)}><IPlus size={20} /></button>
          </div>
          <div className="segmented" style={{ marginTop: 6 }}>
            <button className={tab === "feed" ? "active" : ""} onClick={() => setTab("feed")}>For You</button>
            <button className={tab === "discover" ? "active" : ""} onClick={() => setTab("discover")}>Discover</button>
          </div>
        </div>
        <div className="chat-list">
          <div className="empty-hint" style={{ paddingTop: 30 }}>
            Scroll the feed on the right.<br />Tap a video to pause, ♥ to like.
          </div>
        </div>
      </section>

      <section className="pane reels-pane">
        {loading ? (
          <div className="center-load"><span className="spinner" /></div>
        ) : reels.length === 0 ? (
          <div className="pane-empty">
            <div>
              <div className="glow"><IFilm size={46} color="#fff" /></div>
              <h2>Reels</h2>
              <p>No reels yet. Be the first to post a short video!</p>
              <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={() => setCreating(true)}>Create a reel</button>
            </div>
          </div>
        ) : (
          <div className="reels-feed" ref={containerRef}>
            {reels.map((reel) => (
              <div key={reel.id} className="reel-slide" data-id={reel.id}>
                <ReelCard
                  reel={reel}
                  active={Number(activeId) === Number(reel.id)}
                  muted={muted}
                  onToggleMute={() => setMuted((m) => !m)}
                  onLike={onLike}
                  onComment={(r) => setCommentsFor(r)}
                  onShare={onShare}
                  onFollow={onFollow}
                  onDelete={onDelete}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      {commentsFor && (
        <ReelCommentsModal
          reel={commentsFor}
          onClose={() => setCommentsFor(null)}
          onAdded={(id) => patch(id, (r) => ({ ...r, commentsCount: (r.commentsCount || 0) + 1 }))}
        />
      )}
      {creating && (
        <CreateReelModal onClose={() => setCreating(false)} onCreated={() => load()} />
      )}
    </>
  );
}
