/**
 * Глобальный перехватчик для fetch И axios.
 *
 * Патчит global.fetch и добавляет axios interceptors — добавляют
 * Authorization: Bearer <token> ко всем запросам к нашему API,
 * а при 401 автоматически обновляют токен через /auth/refresh
 * без ручного выхода/входа.
 *
 * Подключение: импортировать ОДИН раз как можно раньше — в самом верху App.js:
 *     import './src/authFetch';
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { BASE_URL } from "./config";

const originalFetch = global.fetch;

let cachedToken = null;
let cacheLoaded = false;

async function getToken() {
  if (cacheLoaded) return cachedToken;
  try {
    cachedToken = await AsyncStorage.getItem("token");
  } catch (_) {
    cachedToken = null;
  }
  cacheLoaded = true;
  return cachedToken;
}

export function refreshAuthToken() {
  cacheLoaded = false;
  cachedToken = null;
}

function isOurApi(url) {
  if (typeof url !== "string") return false;
  return url.startsWith(BASE_URL) || url.startsWith("/");
}

// --- Тихое обновление токена ---
let _isRefreshing = false;
let _pendingQueue = [];

const _processQueue = (error, token = null) => {
  _pendingQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token)));
  _pendingQueue = [];
};

async function _tryRefresh() {
  const storedRefresh = await AsyncStorage.getItem("refreshToken");
  if (!storedRefresh) throw new Error("no_refresh_token");

  const res = await originalFetch(`${BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: storedRefresh }),
  });

  if (!res.ok) throw new Error("refresh_failed");
  const data = await res.json();

  await AsyncStorage.setItem("token", data.token);
  if (data.refreshToken) await AsyncStorage.setItem("refreshToken", data.refreshToken);
  cachedToken = data.token;
  cacheLoaded = true;
  return data.token;
}

async function _forceLogout() {
  await AsyncStorage.multiRemove(["token", "refreshToken", "userId", "username", "nickname", "avatar"]);
  cacheLoaded = false;
  cachedToken = null;
  // Импортируем динамически чтобы избежать circular dependency при старте
  try {
    const { navigationRef } = require("../AppContainer");
    navigationRef.current?.reset({ index: 0, routes: [{ name: "Login" }] });
  } catch (_) {}
}

// --- Патч global.fetch ---
global.fetch = async function patchedFetch(input, init = {}) {
  try {
    const url = typeof input === "string" ? input : input?.url;
    if (isOurApi(url)) {
      const token = await getToken();
      if (token) {
        const headers = new Headers(init.headers || {});
        if (!headers.has("Authorization")) {
          headers.set("Authorization", `Bearer ${token}`);
        }
        init = { ...init, headers };
      }
    }
  } catch (_) {}

  const response = await originalFetch(input, init);

  // Тихий refresh при 401 для fetch-запросов
  if (response.status === 401) {
    const url = typeof input === "string" ? input : input?.url;
    // Не пытаемся обновить токен для самого endpoint'а refresh
    if (isOurApi(url) && !url.includes("/auth/refresh") && !url.includes("/auth/login") && !url.includes("/auth/verify")) {
      try {
        const newToken = await _tryRefresh();
        const headers = new Headers(init.headers || {});
        headers.set("Authorization", `Bearer ${newToken}`);
        return originalFetch(input, { ...init, headers });
      } catch (_) {
        await _forceLogout();
      }
    }
  }

  return response;
};

// --- Патч axios (глобальный interceptor) ---
axios.interceptors.request.use(
  async (config) => {
    try {
      if (isOurApi(config.url)) {
        const token = await getToken();
        if (token && !config.headers["Authorization"]) {
          config.headers["Authorization"] = `Bearer ${token}`;
        }
      }
    } catch (_) {}
    return config;
  },
  (error) => Promise.reject(error)
);

axios.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (
      error.response?.status === 401 &&
      !original._retry &&
      isOurApi(original.url) &&
      !original.url.includes("/auth/refresh")
    ) {
      if (_isRefreshing) {
        return new Promise((resolve, reject) => {
          _pendingQueue.push({ resolve, reject });
        }).then((token) => {
          original.headers["Authorization"] = `Bearer ${token}`;
          return axios(original);
        });
      }
      original._retry = true;
      _isRefreshing = true;
      try {
        const token = await _tryRefresh();
        _processQueue(null, token);
        original.headers["Authorization"] = `Bearer ${token}`;
        return axios(original);
      } catch (e) {
        _processQueue(e, null);
        await _forceLogout();
        return Promise.reject(error);
      } finally {
        _isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);
