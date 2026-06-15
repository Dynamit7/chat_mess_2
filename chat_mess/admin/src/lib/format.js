export const fmtTime = (t) => {
  if (!t) return "";
  const d = new Date(t);
  return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
};

export const fmtDateTime = (t) => {
  if (!t) return "";
  const d = new Date(t);
  return d.toLocaleString("ru-RU", {
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
};

export const fmtDate = (t) => {
  if (!t) return "";
  return new Date(t).toLocaleDateString("ru-RU", { day: "2-digit", month: "short", year: "numeric" });
};

// "5 минут назад" style relative time
export const ago = (t) => {
  if (!t) return "";
  const s = Math.floor((Date.now() - new Date(t).getTime()) / 1000);
  if (s < 60) return "только что";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} мин назад`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ч назад`;
  const d = Math.floor(h / 24);
  return `${d} дн назад`;
};

export const initials = (name = "") =>
  name.trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "?";

// Deterministic accent colour from a string (avatars).
export const hueFor = (str = "") => {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 360;
  return h;
};

export const previewText = (m) => {
  if (!m) return "";
  if (m.isDeleted) return "удалено";
  if (m.type && m.type !== "text") {
    const map = { image: "🖼 Фото", video: "🎬 Видео", audio: "🎙 Аудио", voice: "🎙 Голос", file: "📎 Файл", poll: "📊 Опрос" };
    return map[m.type] || m.type;
  }
  return m.text || m.lastMessage || "";
};
