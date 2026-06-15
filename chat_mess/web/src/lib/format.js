// Small formatting helpers used across the chat UI.

export const initials = (name = "") =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || "")
    .join("") || "?";

// Stable, pleasant gradient per user for avatar fallbacks.
const PALETTES = [
  ["#6366F1", "#A855F7"],
  ["#EC4899", "#8B5CF6"],
  ["#06B6D4", "#3B82F6"],
  ["#F59E0B", "#EC4899"],
  ["#10B981", "#06B6D4"],
  ["#8B5CF6", "#EC4899"],
];
export const gradientFor = (seed = "") => {
  let h = 0;
  const s = String(seed);
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return PALETTES[h % PALETTES.length];
};

export const timeShort = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

export const chatStamp = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return "";
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const yest = new Date(now);
  yest.setDate(now.getDate() - 1);
  if (d.toDateString() === yest.toDateString()) return "Yesterday";
  const week = 7 * 864e5;
  if (now - d < week) return d.toLocaleDateString([], { weekday: "short" });
  return d.toLocaleDateString([], { day: "2-digit", month: "short" });
};

export const dayLabel = (iso) => {
  const d = new Date(iso);
  if (isNaN(d)) return "";
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return "Today";
  const yest = new Date(now);
  yest.setDate(now.getDate() - 1);
  if (d.toDateString() === yest.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { day: "numeric", month: "long", year: "numeric" });
};
