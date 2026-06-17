/**
 * Single axios instance against the Nexus backend. Attaches the JWT bearer token
 * and performs a silent refresh on 401 (mirrors the web client's behaviour).
 */
import { Platform } from 'react-native';
import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { BASE_URL } from './config';
import { sessionCache, patchSession, clearSession } from './storage';

/**
 * Append a picked file to FormData in a way that works on BOTH platforms.
 * Native RN accepts a { uri, name, type } object; web FormData needs a real
 * Blob/File, so we fetch the (blob:/data:/file:) uri into a Blob first.
 */
async function appendAsset(fd: FormData, key: string, asset: { uri: string; name?: string; type?: string }) {
  const name = asset.name || `file_${Date.now()}`;
  if (Platform.OS === 'web') {
    const blob = await fetch(asset.uri).then((r) => r.blob());
    fd.append(key, blob, name);
  } else {
    fd.append(key, { uri: asset.uri, name, type: asset.type || 'application/octet-stream' } as any);
  }
}

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = sessionCache.getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  // For multipart uploads the platform (RN/browser) must set Content-Type itself
  // so the multipart boundary is included. A manually-forced "multipart/form-data"
  // header has no boundary, so the backend (multer) can't parse the file and
  // req.file ends up empty — e.g. avatars never get saved. Drop it for FormData.
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    const h: any = config.headers;
    if (h && typeof h.delete === 'function') h.delete('Content-Type');
    else { delete h?.['Content-Type']; delete h?.['content-type']; }
  }
  return config;
});

let isRefreshing = false;
let queue: { resolve: (t: string) => void; reject: (e: unknown) => void }[] = [];
let onAuthExpired: (() => void) | null = null;

/** Allow the auth provider to react when refresh ultimately fails. */
export function setOnAuthExpired(cb: (() => void) | null) {
  onAuthExpired = cb;
}

const flush = (error: unknown, token: string | null) => {
  queue.forEach((p) => (error ? p.reject(error) : p.resolve(token as string)));
  queue = [];
};

api.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    if (error.response?.status === 401 && original && !original._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => queue.push({ resolve, reject })).then((token) => {
          original.headers.Authorization = `Bearer ${token}`;
          return api(original);
        });
      }
      original._retry = true;
      isRefreshing = true;
      const refreshToken = sessionCache.get()?.refreshToken;
      if (!refreshToken) {
        isRefreshing = false;
        await clearSession();
        onAuthExpired?.();
        return Promise.reject(error);
      }
      try {
        const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken });
        await patchSession({ token: data.token, refreshToken: data.refreshToken ?? refreshToken });
        original.headers.Authorization = `Bearer ${data.token}`;
        flush(null, data.token);
        return api(original);
      } catch (e) {
        flush(e, null);
        await clearSession();
        onAuthExpired?.();
        return Promise.reject(e);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export const chatKeyOf = (a: number | string, b: number | string) =>
  `${Math.min(Number(a), Number(b))}_${Math.max(Number(a), Number(b))}`;

export type UploadAsset = { uri: string; name?: string; type?: string };

/** Upload a file to MinIO via the backend; returns a presigned URL. */
export async function uploadFile(asset: UploadAsset): Promise<string> {
  const form = new FormData();
  await appendAsset(form, 'file', asset);
  const { data } = await api.post('/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data.url as string;
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export const authApi = {
  register: (p: { username: string; email: string; password: string }) =>
    api.post('/auth/register', p).then((r) => r.data),
  login: (p: { email: string; password: string }) => api.post('/auth/login', p).then((r) => r.data),
  verifyCode: (p: { userId: number; code: string }) =>
    api.post('/auth/verify-code', p).then((r) => r.data),
  verifyTwoFactor: (p: { userId: number; twoFactorPassword: string }) =>
    api.post('/auth/verify-two-factor', p).then((r) => r.data),
  twoFactorStatus: (userId: number) =>
    api.get(`/auth/two-factor-status/${userId}`).then((r) => r.data),
};

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export const usersApi = {
  search: (nickname: string, requesterId: number) =>
    api.get('/api/users/search', { params: { nickname, requesterId } }).then((r) => r.data),
  getById: (userId: number | string) => api.get(`/api/users/${userId}`).then((r) => r.data),
  online: (userId: number) =>
    api.get(`/api/messages/user/${userId}/online`).then((r) => r.data),
  updateProfile: (p: Record<string, unknown>) =>
    api.put('/api/users/updateProfile', p).then((r) => r.data),
  uploadAvatar: async (userId: number, asset: UploadAsset) => {
    const fd = new FormData();
    await appendAsset(fd, 'avatar', { ...asset, name: asset.name || 'avatar.jpg', type: asset.type || 'image/jpeg' });
    fd.append('userId', String(userId));
    return api.post('/api/users/uploadAvatar', fd, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data);
  },
  blockedUsers: (userId: number) =>
    api.get('/api/users/blockedUsers', { params: { userId } }).then((r) => r.data),
  block: (blockerId: number, blockedId: number) =>
    api.post('/api/users/blockUser', { blockerId, blockedId }).then((r) => r.data),
  unblock: (blockerId: number, blockedId: number) =>
    api.post('/api/users/unblockUser', { blockerId, blockedId }).then((r) => r.data),
};

// ---------------------------------------------------------------------------
// Messages / chats
// ---------------------------------------------------------------------------

export type ChatSummary = {
  partnerId: number;
  username?: string;
  picture?: string | null;
  lastMessage?: string;
  lastMessageType?: string;
  time?: string;
  unreadCount?: number;
  isOnline?: boolean;
  isForwarded?: boolean;
};

export type Message = {
  id: number | string;
  tempId?: string;
  fromUserId: number;
  toUserId: number;
  text?: string;
  type?: string;
  fileUrl?: string;
  filename?: string;
  createdAt: string;
  isRead?: boolean;
  isDelivered?: boolean;
  isEdited?: boolean;
  isDeleted?: boolean;
  reactions?: { messageId: number | string; userId: number; emoji: string }[];
  replyTo?: { id: number | string; text?: string; fromUserId: number } | null;
  status?: 'sending' | 'failed';
  forwardedFromType?: string | null;
  forwardedFromUsername?: string | null;
  groupId?: number;
  userId?: number;
};

export type ForwardPayload = {
  id: number;
  sourceType: 'direct' | 'group' | 'channel';
  text?: string;
  type?: string;
  fileUrl?: string | null;
  filename?: string | null;
  senderUsername: string;
};

export type MessagePage = { messages: Message[]; hasMore: boolean; nextBefore: number | null };

export const messagesApi = {
  getChats: (userId: number): Promise<ChatSummary[]> =>
    api.get('/api/messages/getChats', { params: { userId } }).then((r) => r.data),
  getMessages: (user1: number, user2: number): Promise<Message[]> =>
    api.get('/api/messages/getMessages', { params: { user1, user2 } }).then((r) => r.data),
  /**
   * Paginated history: returns the newest `limit` messages older than `before`
   * (a message id cursor), in chronological (ASC) order, plus `hasMore` and the
   * `nextBefore` cursor for loading the previous page.
   */
  getMessagesPage: (user1: number, user2: number, limit = 40, before?: number | null): Promise<MessagePage> =>
    api
      .get('/api/messages/getMessages', { params: { user1, user2, limit, before: before ?? undefined } })
      .then((r) => r.data),
  send: (p: Record<string, unknown>) =>
    api.post('/api/messages/sendMessage', p).then((r) => r.data),
  markAsRead: (currentUserId: number, partnerId: number) =>
    api.post('/api/messages/markAsRead', { currentUserId, partnerId }).then((r) => r.data),
  edit: (messageId: number | string, newText: string) =>
    api.put('/api/messages/editMessage', { messageId, newText }).then((r) => r.data),
  remove: (messageId: number | string) =>
    api.delete('/api/messages/deleteMessage', { params: { messageId } }).then((r) => r.data),
  react: (messageId: number | string, userId: number, emoji: string) =>
    api.post('/api/messages/react', { messageId, userId, emoji }).then((r) => r.data),
  removeReaction: (messageId: number | string, userId: number, emoji: string) =>
    api.post('/api/messages/removeReaction', { messageId, userId, emoji }).then((r) => r.data),
  deleteChats: (userId: number, partnerIds: number[]) =>
    api.delete('/api/messages/deleteChats', { data: { userId, partnerIds } }).then((r) => r.data),
  forward: (p: { userId: number; sourceMessage: ForwardPayload; destinations: { type: 'direct' | 'group' | 'channel'; id: number }[] }) =>
    api.post('/api/messages/forward', p).then((r) => r.data),
};

// ---------------------------------------------------------------------------
// Multipart helper — arrays JSON-encoded, {uri,name,type} appended as files.
// ---------------------------------------------------------------------------

const toForm = async (obj: Record<string, any>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined) continue;
    if (v && typeof v === 'object' && 'uri' in v) await appendAsset(fd, k, v);
    else if (Array.isArray(v)) fd.append(k, JSON.stringify(v));
    else fd.append(k, String(v));
  }
  return fd;
};
const mp = { headers: { 'Content-Type': 'multipart/form-data' } };

// ---------------------------------------------------------------------------
// Groups
// ---------------------------------------------------------------------------

export const groupsApi = {
  list: (userId: number, search?: string) =>
    api.get('/api/groups', { params: { userId, search } }).then((r) => r.data),
  getById: (groupId: number) => api.get(`/api/groups/id/${groupId}`).then((r) => r.data),
  members: (groupId: number) => api.get(`/api/groups/members/${groupId}`).then((r) => r.data),
  unreadCounts: (userId: number) => api.get(`/api/groups/${userId}/unread-counts`).then((r) => r.data),
  // Group message history is protobuf binary.
  messagesRaw: (groupId: number, userId: number) =>
    api.get(`/api/groups/${groupId}/messages`, { params: { userId }, responseType: 'arraybuffer' }).then((r) => r.data as ArrayBuffer),
  /**
   * Paginated group history (newest `limit` messages older than `before`).
   * Body stays protobuf; the cursor rides in X-Has-More / X-Next-Before headers.
   */
  messagesRawPage: (groupId: number, userId: number, limit = 40, before?: number | null) =>
    api
      .get(`/api/groups/${groupId}/messages`, {
        params: { userId, limit, before: before ?? undefined },
        responseType: 'arraybuffer',
      })
      .then((r) => ({
        buffer: r.data as ArrayBuffer,
        hasMore: r.headers['x-has-more'] === '1',
        nextBefore: r.headers['x-next-before'] ? Number(r.headers['x-next-before']) : null,
      })),
  create: async (p: { userId: number; name: string; description?: string; isPublic?: boolean; members?: number[]; avatar?: UploadAsset }) =>
    api.post('/api/groups', await toForm(p), mp).then((r) => r.data),
  sendMessage: async (groupId: number, p: { userId: number; text?: string; replyToId?: number; file?: UploadAsset; messageType?: string }) =>
    api.post(`/api/groups/${groupId}/message`, await toForm(p), mp).then((r) => r.data),
  join: (groupId: number, userId: number, addedBy?: number) =>
    api.post(`/api/groups/${groupId}/join`, { userId, addedBy }).then((r) => r.data),
  leave: (groupId: number, userId: number) =>
    api.delete(`/api/groups/${groupId}/leave`, { data: { userId } }).then((r) => r.data),
  update: async (groupId: number, p: { userId: number; name?: string; isPublic?: boolean; avatar?: UploadAsset }) =>
    api.put(`/api/groups/${groupId}`, await toForm(p), mp).then((r) => r.data),
  remove: (groupId: number, userId: number) =>
    api.delete(`/api/groups/${groupId}`, { data: { userId } }).then((r) => r.data),
  updateLastSeen: (groupId: number, userId: number) =>
    api.post(`/api/groups/${groupId}/update-last-seen`, { userId }).then((r) => r.data),
  deleteMessage: (groupId: number, messageId: number | string, userId: number) =>
    api.delete(`/api/groups/${groupId}/message/${messageId}`, { data: { userId } }).then((r) => r.data),
  editMessage: async (groupId: number, messageId: number | string, p: { userId: number; text?: string; file?: UploadAsset }) =>
    api.put(`/api/groups/${groupId}/message/${messageId}`, await toForm(p), mp).then((r) => r.data),
  react: (groupId: number, messageId: number | string, userId: number, emoji: string) =>
    api.post(`/api/groups/${groupId}/messages/${messageId}/react`, { userId, emoji }).then((r) => r.data),
  reactions: (groupId: number) => api.get(`/api/groups/${groupId}/reactions`).then((r) => r.data),
};

// ---------------------------------------------------------------------------
// Channels
// ---------------------------------------------------------------------------

export const channelsApi = {
  list: (userId: number, search?: string) =>
    api.get('/api/channels', { params: { userId, search } }).then((r) => r.data),
  getById: (channelId: number) => api.get(`/api/channels/id/${channelId}`).then((r) => r.data),
  members: (channelId: number, userId: number) =>
    api.get(`/api/channels/members/${channelId}`, { params: { userId } }).then((r) => r.data),
  messages: (channelId: number) => api.get(`/api/channels/${channelId}/messages`).then((r) => r.data),
  /** Paginated channel posts: { messages, hasMore, nextBefore } (chronological). */
  messagesPage: (channelId: number, limit = 40, before?: number | null): Promise<{ messages: any[]; hasMore: boolean; nextBefore: number | null }> =>
    api
      .get(`/api/channels/${channelId}/messages`, { params: { limit, before: before ?? undefined } })
      .then((r) => r.data),
  comments: (channelId: number, messageId: number) =>
    api.get(`/api/channels/${channelId}/message/${messageId}/comments`).then((r) => r.data),
  unreadCounts: (userId: number) => api.get(`/api/channels/${userId}/unread-counts`).then((r) => r.data),
  create: async (p: { userId: number; name: string; description?: string; isPublic?: boolean; members?: number[]; avatar?: UploadAsset }) =>
    api.post('/api/channels', await toForm(p), mp).then((r) => r.data),
  post: async (channelId: number, p: { userId: number; text?: string; file?: UploadAsset; replyToId?: number }) =>
    api.post(`/api/channels/${channelId}/message`, await toForm(p), mp).then((r) => r.data),
  comment: async (channelId: number, messageId: number, p: { userId: number; text?: string; file?: UploadAsset }) =>
    api.post(`/api/channels/${channelId}/message/${messageId}/comment`, await toForm(p), mp).then((r) => r.data),
  join: (channelId: number, userId: number, addedBy?: number) =>
    api.post(`/api/channels/${channelId}/join`, { userId, addedBy }).then((r) => r.data),
  leave: (channelId: number, userId: number) =>
    api.delete(`/api/channels/${channelId}/leave`, { data: { userId } }).then((r) => r.data),
  update: async (channelId: number, p: { userId: number; name?: string; isPublic?: boolean; avatar?: UploadAsset }) =>
    api.put(`/api/channels/${channelId}`, await toForm(p), mp).then((r) => r.data),
  remove: (channelId: number, userId: number) =>
    api.delete(`/api/channels/${channelId}`, { data: { userId } }).then((r) => r.data),
  updateLastSeen: (channelId: number, userId: number) =>
    api.post(`/api/channels/${channelId}/update-last-seen`, { userId }).then((r) => r.data),
  deleteMessage: (channelId: number, messageId: number, userId: number) =>
    api.delete(`/api/channels/${channelId}/message/${messageId}`, { data: { userId } }).then((r) => r.data),
  react: (channelId: number, messageId: number, userId: number, emoji: string) =>
    api.post(`/api/channels/react`, { channelId, messageId, userId, emoji }).then((r) => r.data),
  reactions: (messageId: number) => api.get(`/api/channels/reactions/${messageId}`).then((r) => r.data),
  removeMember: (channelId: number, memberId: number, ownerId: number) =>
    api.delete(`/api/channels/${channelId}/members/${memberId}`, { data: { userId: ownerId } }).then((r) => r.data),
  deleteComment: (channelId: number, messageId: number, commentId: number, userId: number) =>
    api.delete(`/api/channels/${channelId}/message/${messageId}/comment/${commentId}`, { data: { userId } }).then((r) => r.data),
};

// ---------------------------------------------------------------------------
// Reels
// ---------------------------------------------------------------------------

export const reelsApi = {
  feed: (userId: number, page = 1) =>
    api.get('/api/reels/feed', { params: { userId, page } }).then((r) => r.data),
  discover: (page = 1, userId?: number) => api.get('/api/reels/discover', { params: { page, userId } }).then((r) => r.data),
  userReels: (userId: number) => api.get(`/api/reels/user/${userId}`).then((r) => r.data),
  /** Universal feed post: image, video, or text-only (no media). */
  create: async (p: { userId: number; caption?: string; hashtags?: string[]; media?: UploadAsset; mediaType: 'image' | 'video' | 'text' }) =>
    api.post('/api/reels', await toForm(p), mp).then((r) => r.data),
  like: (reelId: number, userId: number) => api.post(`/api/reels/${reelId}/like`, { userId }).then((r) => r.data),
  view: (reelId: number, userId: number) => api.post(`/api/reels/${reelId}/view`, { userId }).then((r) => r.data),
  share: (reelId: number) => api.post(`/api/reels/${reelId}/share`).then((r) => r.data),
  remove: (reelId: number, userId: number) => api.delete(`/api/reels/${reelId}`, { data: { userId } }).then((r) => r.data),
  comments: (reelId: number, page = 1) => api.get(`/api/reels/${reelId}/comments`, { params: { page } }).then((r) => r.data),
  comment: (reelId: number, userId: number, text: string, parentCommentId?: number) =>
    api.post(`/api/reels/${reelId}/comment`, { userId, text, parentCommentId }).then((r) => r.data),
  deleteComment: (commentId: number, userId: number) =>
    api.delete(`/api/reels/comment/${commentId}`, { data: { userId } }).then((r) => r.data),
  follow: (followerId: number, followingId: number) =>
    api.post('/api/reels/follow', { followerId, followingId }).then((r) => r.data),
};

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

export const storiesApi = {
  personalized: (userId: number) => api.get('/api/stories/personalized', { params: { userId } }).then((r) => r.data),
  all: (userId: number) => api.get('/api/stories', { params: { userId } }).then((r) => r.data),
  create: async (p: { userId: number; caption?: string; file: UploadAsset }) =>
    api.post('/api/stories', await toForm(p), mp).then((r) => r.data),
  remove: (storyId: number, userId: number) => api.delete(`/api/stories/${storyId}`, { data: { userId } }).then((r) => r.data),
  view: (storyId: number, viewerId: number) => api.post(`/api/stories/${storyId}/view`, { viewerId }).then((r) => r.data),
  viewers: (storyId: number) => api.get(`/api/stories/${storyId}/viewers`).then((r) => r.data),
};

// ---------------------------------------------------------------------------
// Polls
// ---------------------------------------------------------------------------

export const pollsApi = {
  create: (p: Record<string, unknown>) => api.post('/api/polls', p).then((r) => r.data),
  get: (id: number, userId: number) => api.get(`/api/polls/${id}`, { params: { userId } }).then((r) => r.data),
  vote: (id: number, userId: number, optionIds: number[]) =>
    api.post(`/api/polls/${id}/vote`, { userId, optionIds }).then((r) => r.data),
  retract: (id: number, userId: number) => api.post(`/api/polls/${id}/retract`, { userId }).then((r) => r.data),
  groupPolls: (groupId: number, userId: number) =>
    api.get(`/api/polls/group/${groupId}`, { params: { userId } }).then((r) => r.data),
};

// ---------------------------------------------------------------------------
// User settings (privacy, 2FA, translation)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Calls (WebRTC ICE servers)
// ---------------------------------------------------------------------------

export type IceServer = { urls: string | string[]; username?: string; credential?: string };

export const callsApi = {
  iceServers: (): Promise<{ iceServers: IceServer[] }> =>
    api.get('/api/calls/ice-servers').then((r) => r.data),
};

export const settingsApi = {
  getPrivacy: (userId: number) => api.get(`/api/users/${userId}/privacy`).then((r) => r.data),
  updatePrivacy: (p: Record<string, unknown>) => api.put('/api/users/updatePrivacy', p).then((r) => r.data),
  updateGhostMode: (userId: number, ghostMode: boolean) =>
    api.put('/api/users/updateGhostMode', { userId, ghostMode }).then((r) => r.data),
  updateReadReceipts: (userId: number, readReceiptSetting: boolean) =>
    api.put('/api/users/updateReadReceipts', { userId, readReceiptSetting }).then((r) => r.data),
  updateTranslation: (userId: number, preferredLanguage: string, autoTranslate: boolean) =>
    api.put('/api/users/updateTranslationSettings', { userId, preferredLanguage, autoTranslate }).then((r) => r.data),
  setupTwoFactor: (p: { userId: number; password: string; twoFactorPassword: string }) =>
    api.post('/auth/setup-two-factor', p).then((r) => r.data),
  disableTwoFactor: (p: { userId: number; password: string }) =>
    api.post('/auth/disable-two-factor', p).then((r) => r.data),
};
