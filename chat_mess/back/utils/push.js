/**
 * Expo push helper (Telegram-style notifications).
 *
 * Goal: notify a user only when they are NOT actively viewing the conversation.
 * We know who is viewing because the mobile client joins a socket.io room for
 * the open screen (chat_<a>_<b> / group_<id> / channel_<id>). So before pushing
 * we subtract the users currently present in that room.
 *
 * All functions are best-effort and never throw — a failed push must never break
 * message delivery.
 */
const { Expo } = require("expo-server-sdk");
const { getPushToken } = require("./redisClient");

const expo = new Expo();

/** Set of userIds currently joined to `room` (i.e. actively looking at it). */
async function userIdsInRoom(io, room) {
  try {
    const sockets = await io.in(room).fetchSockets();
    return new Set(sockets.map((s) => Number(s.authUserId)).filter((id) => id > 0));
  } catch {
    return new Set();
  }
}

/** Look up each user's saved Expo token and send them a notification. */
async function sendPushToUsers(userIds, { title, body, data } = {}) {
  const unique = [...new Set((userIds || []).map(Number))].filter((id) => id > 0);
  if (!unique.length) return;

  const messages = [];
  for (const uid of unique) {
    try {
      const token = await getPushToken(uid);
      if (token && Expo.isExpoPushToken(token)) {
        messages.push({ to: token, sound: "default", title, body, data });
      }
    } catch {
      /* ignore per-user lookup failures */
    }
  }
  if (!messages.length) return;

  for (const chunk of expo.chunkPushNotifications(messages)) {
    try {
      await expo.sendPushNotificationsAsync(chunk);
    } catch (err) {
      console.error("Push send error:", err);
    }
  }
}

/** Short, type-aware preview for the notification body. */
function previewBody(senderName, type, text) {
  const who = senderName || "Someone";
  if (type && type !== "text") {
    const label = { image: "📷 Photo", video: "🎬 Video", audio: "🎤 Voice", video_circle: "⭕ Video", file: "📎 File" }[type] || "Attachment";
    return `${who}: ${label}`;
  }
  return `${who}: ${text || ""}`;
}

module.exports = { sendPushToUsers, userIdsInRoom, previewBody };
