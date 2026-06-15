import React from "react";
import { initials, hueFor } from "../lib/format.js";

// Avatar that shows the user/group picture, falling back to coloured initials.
export default function Avatar({ src, name = "", size = "", style }) {
  const cls = `avatar ${size}`.trim();
  if (src) {
    return <img className={cls} src={src} alt={name} style={style} onError={(e) => { e.currentTarget.style.display = "none"; }} />;
  }
  const h = hueFor(name);
  return (
    <div className={cls} style={{ background: `linear-gradient(135deg, hsl(${h},65%,52%), hsl(${(h + 40) % 360},65%,45%))`, ...style }}>
      {initials(name)}
    </div>
  );
}
