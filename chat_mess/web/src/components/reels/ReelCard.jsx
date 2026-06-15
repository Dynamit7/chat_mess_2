import { useRef, useEffect, useState } from "react";
import Avatar from "../Avatar";
import { IHeart, IChat, IShare, IVolume, IMute, ITrash, IPlay } from "../Icon";
import { useAuth } from "../../context/AuthContext";

const fmt = (n) => {
  n = Number(n) || 0;
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return String(n);
};

export default function ReelCard({ reel, active, muted, onToggleMute, onLike, onComment, onShare, onFollow, onDelete }) {
  const { user } = useAuth();
  const me = Number(user.userId);
  const videoRef = useRef(null);
  const [playing, setPlaying] = useState(true);
  const creator = reel.creator || {};
  const isMine = Number(reel.userId) === me;

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (active) {
      v.currentTime = v.currentTime; // keep position
      v.play().then(() => setPlaying(true)).catch(() => {});
    } else {
      v.pause();
    }
  }, [active]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play(); setPlaying(true); } else { v.pause(); setPlaying(false); }
  };

  return (
    <div className="reel-card">
      <video
        ref={videoRef}
        src={reel.videoUrl}
        poster={reel.thumbnailUrl || undefined}
        loop
        muted={muted}
        playsInline
        onClick={togglePlay}
      />
      {!playing && (
        <button className="reel-play-overlay" onClick={togglePlay}><IPlay size={56} /></button>
      )}

      <button className="reel-mute" onClick={onToggleMute}>
        {muted ? <IMute size={20} /> : <IVolume size={20} />}
      </button>

      <div className="reel-gradient" />

      <div className="reel-info">
        <div className="reel-creator">
          <Avatar src={creator.avatar} name={creator.username} size={40} />
          <span className="reel-name">{creator.username || creator.nickname || "User"}</span>
          {!isMine && !reel.isFollowing && (
            <button className="reel-follow" onClick={() => onFollow(reel)}>Follow</button>
          )}
        </div>
        {reel.caption && <div className="reel-caption">{reel.caption}</div>}
        {Array.isArray(reel.hashtags) && reel.hashtags.length > 0 && (
          <div className="reel-tags">{reel.hashtags.map((t) => <span key={t}>#{t}</span>)}</div>
        )}
        {reel.music?.title && <div className="reel-music">🎵 {reel.music.title}</div>}
      </div>

      <div className="reel-actions">
        <button className={`reel-act ${reel.isLiked ? "liked" : ""}`} onClick={() => onLike(reel)}>
          <IHeart size={30} filled={reel.isLiked} />
          <span>{fmt(reel.likesCount)}</span>
        </button>
        <button className="reel-act" onClick={() => onComment(reel)}>
          <IChat size={28} />
          <span>{fmt(reel.commentsCount)}</span>
        </button>
        <button className="reel-act" onClick={() => onShare(reel)}>
          <IShare size={28} />
          <span>{fmt(reel.sharesCount)}</span>
        </button>
        {isMine && (
          <button className="reel-act" onClick={() => onDelete(reel)}>
            <ITrash size={26} />
          </button>
        )}
      </div>
    </div>
  );
}
