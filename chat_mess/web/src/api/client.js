import axios from "axios";
import { BASE_URL } from "../config";

// Single axios instance. The backend uses a JWT bearer token for protected
// routes; we attach it automatically when present.
export const api = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// --- Silent token refresh on 401 ---
let _isRefreshing = false;
let _failedQueue = [];

const _processQueue = (error, token = null) => {
  _failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token)));
  _failedQueue = [];
};

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      if (_isRefreshing) {
        return new Promise((resolve, reject) => {
          _failedQueue.push({ resolve, reject });
        }).then((token) => {
          original.headers.Authorization = `Bearer ${token}`;
          return api(original);
        });
      }
      original._retry = true;
      _isRefreshing = true;
      const storedRefresh = localStorage.getItem("refreshToken");
      if (!storedRefresh) {
        _isRefreshing = false;
        localStorage.clear();
        window.location.href = "/";
        return Promise.reject(error);
      }
      try {
        const { data } = await axios.post(`${BASE_URL}/auth/refresh`, {
          refreshToken: storedRefresh,
        });
        localStorage.setItem("token", data.token);
        if (data.refreshToken) localStorage.setItem("refreshToken", data.refreshToken);
        api.defaults.headers.common.Authorization = `Bearer ${data.token}`;
        original.headers.Authorization = `Bearer ${data.token}`;
        _processQueue(null, data.token);
        return api(original);
      } catch (refreshError) {
        _processQueue(refreshError, null);
        localStorage.clear();
        window.location.href = "/";
        return Promise.reject(refreshError);
      } finally {
        _isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

// ---- Auth ----
export const authApi = {
  register: (payload) => api.post("/auth/register", payload).then((r) => r.data),
  login: (payload) => api.post("/auth/login", payload).then((r) => r.data),
  verifyCode: (payload) => api.post("/auth/verify-code", payload).then((r) => r.data),
  verifyTwoFactor: (payload) =>
    api.post("/auth/verify-two-factor", payload).then((r) => r.data),
  twoFactorStatus: (userId) =>
    api.get(`/auth/two-factor-status/${userId}`).then((r) => r.data),
  setupTwoFactor: (payload) =>
    api.post("/auth/setup-two-factor", payload).then((r) => r.data),
  disableTwoFactor: (payload) =>
    api.post("/auth/disable-two-factor", payload).then((r) => r.data),
};

// ---- Users ----
export const usersApi = {
  search: (nickname, requesterId) =>
    api
      .get("/api/users/search", { params: { nickname, requesterId } })
      .then((r) => r.data),
  getById: (userId) => api.get(`/api/users/${userId}`).then((r) => r.data),
  online: (userId) =>
    api.get(`/api/messages/user/${userId}/online`).then((r) => r.data),
  updateProfile: (payload) =>
    api.put("/api/users/updateProfile", payload).then((r) => r.data),
  uploadAvatar: (userId, file) => {
    const fd = new FormData();
    fd.append("avatar", file);
    fd.append("userId", userId);
    return api.post("/api/users/uploadAvatar", fd, { headers: { "Content-Type": "multipart/form-data" } }).then((r) => r.data);
  },
  getPrivacy: (userId) => api.get(`/api/users/${userId}/privacy`).then((r) => r.data),
  updatePrivacy: (payload) =>
    api.put("/api/users/updatePrivacy", payload).then((r) => r.data),
  updateGhostMode: (userId, ghostMode) =>
    api.put("/api/users/updateGhostMode", { userId, ghostMode }).then((r) => r.data),
  updateReadReceipts: (userId, readReceiptSetting) =>
    api.put("/api/users/updateReadReceipts", { userId, readReceiptSetting }).then((r) => r.data),
  blockedUsers: (userId) =>
    api.get("/api/users/blockedUsers", { params: { userId } }).then((r) => r.data),
  isBlocked: (blockerId, blockedId) =>
    api.get("/api/users/isBlocked", { params: { blockerId, blockedId } }).then((r) => r.data),
  block: (blockerId, blockedId) =>
    api.post("/api/users/blockUser", { blockerId, blockedId }).then((r) => r.data),
  unblock: (blockerId, blockedId) =>
    api.post("/api/users/unblockUser", { blockerId, blockedId }).then((r) => r.data),
  apiKeyStatus: (userId) =>
    api.get(`/api/users/${userId}/apiKeyStatus`).then((r) => r.data),
  updateApiKey: (userId, openaiApiKey) =>
    api.put("/api/users/updateApiKey", { userId, openaiApiKey }).then((r) => r.data),
  updateTranslationSettings: (userId, preferredLanguage, autoTranslate) =>
    api.put("/api/users/updateTranslationSettings", { userId, preferredLanguage, autoTranslate }).then((r) => r.data),
};

// ---- Messages / Chats ----
export const messagesApi = {
  getChats: (userId) =>
    api.get("/api/messages/getChats", { params: { userId } }).then((r) => r.data),
  getMessages: (user1, user2) =>
    api
      .get("/api/messages/getMessages", { params: { user1, user2 } })
      .then((r) => r.data),
  send: (payload) =>
    api.post("/api/messages/sendMessage", payload).then((r) => r.data),
  markAsRead: (currentUserId, partnerId) =>
    api
      .post("/api/messages/markAsRead", { currentUserId, partnerId })
      .then((r) => r.data),
  edit: (messageId, newText) =>
    api.put("/api/messages/editMessage", { messageId, newText }).then((r) => r.data),
  remove: (messageId) =>
    api
      .delete("/api/messages/deleteMessage", { params: { messageId } })
      .then((r) => r.data),
  react: (messageId, userId, emoji) =>
    api.post("/api/messages/react", { messageId, userId, emoji }).then((r) => r.data),
  removeReaction: (messageId, userId, emoji) =>
    api
      .post("/api/messages/removeReaction", { messageId, userId, emoji })
      .then((r) => r.data),
  deleteChats: (userId, partnerIds) =>
    api
      .delete("/api/messages/deleteChats", { data: { userId, partnerIds } })
      .then((r) => r.data),
  forward: (userId, sourceMessage, destinations) =>
    api
      .post("/api/messages/forward", { userId, sourceMessage, destinations })
      .then((r) => r.data),
};

// ---- File upload (MinIO via backend) ----
export const uploadFile = async (file, onProgress) => {
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.post("/upload", form, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: (e) => {
      if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100));
    },
  });
  return data.url; // presigned MinIO URL
};

// Helper: a stable room key for a 1-1 chat (matches backend `${min}_${max}`).
export const chatKeyOf = (a, b) =>
  `${Math.min(Number(a), Number(b))}_${Math.max(Number(a), Number(b))}`;

// Build a multipart FormData body from a plain object. Arrays are JSON-encoded,
// File/Blob values are appended as files, null/undefined are skipped.
const toForm = (obj) => {
  const fd = new FormData();
  Object.entries(obj).forEach(([k, v]) => {
    if (v === null || v === undefined) return;
    if (v instanceof File || v instanceof Blob) fd.append(k, v);
    else if (Array.isArray(v)) fd.append(k, JSON.stringify(v));
    else fd.append(k, v);
  });
  return fd;
};
const mp = { headers: { "Content-Type": "multipart/form-data" } };

// ---- Groups ----
export const groupsApi = {
  list: (userId, search) =>
    api.get("/api/groups", { params: { userId, search } }).then((r) => r.data),
  getById: (groupId) =>
    api.get(`/api/groups/id/${groupId}`).then((r) => r.data),
  members: (groupId) =>
    api.get(`/api/groups/members/${groupId}`).then((r) => r.data),
  // Group messages are protobuf binary.
  messagesRaw: (groupId, userId) =>
    api
      .get(`/api/groups/${groupId}/messages`, {
        params: { userId },
        responseType: "arraybuffer",
      })
      .then((r) => r.data),
  create: ({ userId, name, description, isPublic, members, avatar }) =>
    api
      .post("/api/groups", toForm({ userId, name, description, isPublic, members, avatar }), mp)
      .then((r) => r.data),
  sendMessage: (groupId, { userId, text, replyToId, file, messageType }) =>
    api
      .post(`/api/groups/${groupId}/message`, toForm({ userId, text, replyToId, file, messageType }), mp)
      .then((r) => r.data),
  join: (groupId, userId, addedBy) =>
    api.post(`/api/groups/${groupId}/join`, { userId, addedBy }).then((r) => r.data),
  leave: (groupId, userId) =>
    api.delete(`/api/groups/${groupId}/leave`, { data: { userId } }).then((r) => r.data),
  remove: (groupId, userId) =>
    api.delete(`/api/groups/${groupId}`, { data: { userId } }).then((r) => r.data),
  removeMember: (groupId, memberId, userId) =>
    api.delete(`/api/groups/${groupId}/members/${memberId}`, { data: { userId } }).then((r) => r.data),
  update: (groupId, { userId, name, isPublic, existingImages, avatar }) =>
    api
      .put(`/api/groups/${groupId}`, toForm({ userId, name, isPublic, existingImages, avatar }), mp)
      .then((r) => r.data),
  updateLastSeen: (groupId, userId) =>
    api.post(`/api/groups/${groupId}/update-last-seen`, { userId }).then((r) => r.data),
  unreadCounts: (userId) =>
    api.get(`/api/groups/${userId}/unread-counts`).then((r) => r.data),
  deleteMessage: (groupId, messageId, userId) =>
    api.delete(`/api/groups/${groupId}/message/${messageId}`, { data: { userId } }).then((r) => r.data),
  editMessage: (groupId, messageId, { userId, text, file }) =>
    api
      .put(`/api/groups/${groupId}/message/${messageId}`, toForm({ userId, text, file }), mp)
      .then((r) => r.data),
  clearMessages: (groupId, userId) =>
    api.delete(`/api/groups/${groupId}/messages`, { data: { userId } }).then((r) => r.data),
  report: (groupId, userId) =>
    api.post(`/api/groups/${groupId}/report`, { userId }).then((r) => r.data),
  react: (groupId, messageId, userId, emoji) =>
    api.post(`/api/groups/${groupId}/messages/${messageId}/react`, { userId, emoji }).then((r) => r.data),
  reactions: (groupId) =>
    api.get(`/api/groups/${groupId}/reactions`).then((r) => r.data),
};

// ---- Polls ----
export const pollsApi = {
  create: (payload) => api.post("/api/polls", payload).then((r) => r.data),
  get: (id, userId) => api.get(`/api/polls/${id}`, { params: { userId } }).then((r) => r.data),
  vote: (id, userId, optionIds) =>
    api.post(`/api/polls/${id}/vote`, { userId, optionIds }).then((r) => r.data),
  retract: (id, userId) => api.post(`/api/polls/${id}/retract`, { userId }).then((r) => r.data),
  groupPolls: (groupId, userId) =>
    api.get(`/api/polls/group/${groupId}`, { params: { userId } }).then((r) => r.data),
  voters: (id) => api.get(`/api/polls/${id}/voters`).then((r) => r.data),
};

// ---- Reels ----
export const reelsApi = {
  feed: (userId, page = 1) =>
    api.get("/api/reels/feed", { params: { userId, page } }).then((r) => r.data),
  discover: (page = 1) =>
    api.get("/api/reels/discover", { params: { page } }).then((r) => r.data),
  userReels: (userId) => api.get(`/api/reels/user/${userId}`).then((r) => r.data),
  create: ({ userId, caption, hashtags, video, thumbnail }) =>
    api.post("/api/reels", toForm({ userId, caption, hashtags, video, thumbnail }), mp).then((r) => r.data),
  like: (reelId, userId) =>
    api.post(`/api/reels/${reelId}/like`, { userId }).then((r) => r.data),
  view: (reelId, userId) =>
    api.post(`/api/reels/${reelId}/view`, { userId }).then((r) => r.data),
  share: (reelId) => api.post(`/api/reels/${reelId}/share`).then((r) => r.data),
  remove: (reelId, userId) =>
    api.delete(`/api/reels/${reelId}`, { data: { userId } }).then((r) => r.data),
  comments: (reelId, page = 1) =>
    api.get(`/api/reels/${reelId}/comments`, { params: { page } }).then((r) => r.data),
  comment: (reelId, userId, text, parentCommentId) =>
    api.post(`/api/reels/${reelId}/comment`, { userId, text, parentCommentId }).then((r) => r.data),
  follow: (followerId, followingId) =>
    api.post("/api/reels/follow", { followerId, followingId }).then((r) => r.data),
};

// ---- Stories ----
export const storiesApi = {
  personalized: (userId) =>
    api.get("/api/stories/personalized", { params: { userId } }).then((r) => r.data),
  all: (userId) =>
    api.get("/api/stories", { params: { userId } }).then((r) => r.data),
  create: ({ userId, caption, file }) =>
    api.post("/api/stories", toForm({ userId, caption, file }), mp).then((r) => r.data),
  remove: (storyId, userId) =>
    api.delete(`/api/stories/${storyId}`, { data: { userId } }).then((r) => r.data),
  view: (storyId, viewerId) =>
    api.post(`/api/stories/${storyId}/view`, { viewerId }).then((r) => r.data),
  viewers: (storyId) =>
    api.get(`/api/stories/${storyId}/viewers`).then((r) => r.data),
};

// ---- Channels ----
export const channelsApi = {
  list: (userId, search) =>
    api.get("/api/channels", { params: { userId, search } }).then((r) => r.data),
  getById: (channelId) =>
    api.get(`/api/channels/id/${channelId}`).then((r) => r.data),
  members: (channelId, userId) =>
    api.get(`/api/channels/members/${channelId}`, { params: { userId } }).then((r) => r.data),
  messages: (channelId) =>
    api.get(`/api/channels/${channelId}/messages`).then((r) => r.data),
  comments: (channelId, messageId) =>
    api.get(`/api/channels/${channelId}/message/${messageId}/comments`).then((r) => r.data),
  create: ({ userId, name, description, isPublic, members, avatar }) =>
    api
      .post("/api/channels", toForm({ userId, name, description, isPublic, members, avatar }), mp)
      .then((r) => r.data),
  post: (channelId, { userId, text, file, replyToId }) =>
    api
      .post(`/api/channels/${channelId}/message`, toForm({ userId, text, file, replyToId }), mp)
      .then((r) => r.data),
  comment: (channelId, messageId, { userId, text, file }) =>
    api
      .post(`/api/channels/${channelId}/message/${messageId}/comment`, toForm({ userId, text, file }), mp)
      .then((r) => r.data),
  deleteComment: (channelId, commentId, userId) =>
    api.delete(`/api/channels/${channelId}/message/${commentId}`, { data: { userId } }).then((r) => r.data),
  editComment: (channelId, commentId, { userId, text }) =>
    api.put(`/api/channels/${channelId}/message/${commentId}`, { userId, text }).then((r) => r.data),
  join: (channelId, userId, addedBy) =>
    api.post(`/api/channels/${channelId}/join`, { userId, addedBy }).then((r) => r.data),
  leave: (channelId, userId) =>
    api.delete(`/api/channels/${channelId}/leave`, { data: { userId } }).then((r) => r.data),
  remove: (channelId, userId) =>
    api.delete(`/api/channels/${channelId}`, { data: { userId } }).then((r) => r.data),
  removeMember: (channelId, memberId, userId) =>
    api.delete(`/api/channels/${channelId}/members/${memberId}`, { data: { userId } }).then((r) => r.data),
  update: (channelId, { userId, name, isPublic, existingImages, avatar }) =>
    api
      .put(`/api/channels/${channelId}`, toForm({ userId, name, isPublic, existingImages, avatar }), mp)
      .then((r) => r.data),
  updateLastSeen: (channelId, userId) =>
    api.post(`/api/channels/${channelId}/update-last-seen`, { userId }).then((r) => r.data),
  unreadCounts: (userId) =>
    api.get(`/api/channels/${userId}/unread-counts`).then((r) => r.data),
  deleteMessage: (channelId, messageId, userId) =>
    api.delete(`/api/channels/${channelId}/message/${messageId}`, { data: { userId } }).then((r) => r.data),
  editMessage: (channelId, messageId, { userId, text, file }) =>
    api
      .put(`/api/channels/${channelId}/message/${messageId}`, toForm({ userId, text, file }), mp)
      .then((r) => r.data),
  react: (channelId, messageId, userId, emoji) =>
    api.post(`/api/channels/react`, { channelId, messageId, userId, emoji }).then((r) => r.data),
  reactions: (messageId) =>
    api.get(`/api/channels/reactions/${messageId}`).then((r) => r.data),
  report: (channelId, userId) =>
    api.post(`/api/channels/${channelId}/report`, { userId }).then((r) => r.data),
};
