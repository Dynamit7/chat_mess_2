import { useState } from "react";
import { initials, gradientFor } from "../lib/format";
import { useLightbox } from "../context/LightboxContext";

// Avatar with image + graceful gradient/initials fallback and optional presence dot.
// Pass `zoomable` to open the full picture in a fullscreen lightbox on click.
export default function Avatar({ src, name = "", size = 46, online = false, presence = false, zoomable = false }) {
  const [broken, setBroken] = useState(false);
  const lightbox = useLightbox();
  const [c1, c2] = gradientFor(name);
  const showImg = src && !broken;
  const canZoom = zoomable && showImg;

  return (
    <div
      className="avatar"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.38),
        background: showImg ? "transparent" : `linear-gradient(135deg, ${c1}, ${c2})`,
        cursor: canZoom ? "zoom-in" : undefined,
      }}
      onClick={canZoom ? (e) => { e.stopPropagation(); lightbox.open(src); } : undefined}
    >
      {showImg ? (
        <img src={src} alt={name} onError={() => setBroken(true)} />
      ) : (
        <span>{initials(name)}</span>
      )}
      {presence && online && <span className="presence" />}
    </div>
  );
}
