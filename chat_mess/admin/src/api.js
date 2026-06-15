import axios from "axios";
import { BASE_URL } from "./config";

const ADMIN_TOKEN_KEY = "defensy_admin_token";

export const getAdminToken = () => localStorage.getItem(ADMIN_TOKEN_KEY) || "";
export const setAdminToken = (token) => localStorage.setItem(ADMIN_TOKEN_KEY, token);
export const clearAdminToken = () => localStorage.removeItem(ADMIN_TOKEN_KEY);

// Axios instance that injects JWT on every request.
const api = axios.create({ baseURL: `${BASE_URL}/api/admin` });

api.interceptors.request.use((cfg) => {
  const token = getAdminToken();
  if (token) cfg.headers["Authorization"] = `Bearer ${token}`;
  return cfg;
});

// ---- auth ----------------------------------------------------------------
export const loginWithPassword = (username, password) =>
  axios.post(`${BASE_URL}/api/admin/auth/login`, { username, password }).then((r) => r.data);

// ---- read endpoints ------------------------------------------------------
export const fetchOverview = () => api.get("/overview").then((r) => r.data);
export const fetchUsers = (search) => api.get("/users", { params: { search } }).then((r) => r.data);
export const fetchDialogs = () => api.get("/dialogs").then((r) => r.data);
export const fetchDialogMessages = (user1, user2) =>
  api.get("/dialogs/messages", { params: { user1, user2 } }).then((r) => r.data);
export const fetchGroups = () => api.get("/groups").then((r) => r.data);
export const fetchGroupMessages = (id) => api.get(`/groups/${id}/messages`).then((r) => r.data);
export const fetchGroupMembers = (id) => api.get(`/groups/${id}/members`).then((r) => r.data);
export const fetchChannels = () => api.get("/channels").then((r) => r.data);
export const fetchChannelMessages = (id) => api.get(`/channels/${id}/messages`).then((r) => r.data);

// ---- moderation actions --------------------------------------------------
export const muteUser = (id, minutes) => api.post(`/users/${id}/mute`, { minutes }).then((r) => r.data);
export const unmuteUser = (id) => api.post(`/users/${id}/unmute`).then((r) => r.data);
export const deleteDirectMessage = (id) => api.delete(`/messages/${id}`).then((r) => r.data);
export const deleteGroupMessage = (id) => api.delete(`/group-messages/${id}`).then((r) => r.data);
export const deleteChannelMessage = (id) => api.delete(`/channel-messages/${id}`).then((r) => r.data);

export default api;
