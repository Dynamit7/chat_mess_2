import { io } from "socket.io-client";
import { BASE_URL } from "./config";
import { getAdminToken } from "./api.js";

const socket = io(BASE_URL, {
  transports: ["websocket"],
  forceNew: true,
  reconnection: true,
  reconnectionAttempts: 20,
  reconnectionDelay: 1000,
  autoConnect: false,
  // Токен передаётся при каждом подключении/переподключении — бэкенд
  // верифицирует admin-JWT в socketAuth и пропускает соединение.
  auth: (cb) => cb({ token: getAdminToken() }),
});

export const joinAsAdmin = () => {
  const token = getAdminToken();
  if (!token) return;
  if (socket.connected) socket.emit("admin:join", { token });
};

socket.on("connect", joinAsAdmin);

export default socket;
