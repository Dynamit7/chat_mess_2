import { io } from "socket.io-client";
import { BASE_URL } from "./config";

// One shared Socket.IO connection for the whole app. Matches server v4.8.1.
const socket = io(BASE_URL, {
  transports: ["websocket"],
  forceNew: true,
  reconnection: true,
  reconnectionAttempts: 20,
  reconnectionDelay: 1000,
  autoConnect: false,
  // Токен берётся свежим при каждом подключении/reconnect (auth-функция).
  // Бэкенд проверяет его в io.use(socketAuth); при ENFORCE_AUTH=1 без токена
  // соединение отклоняется.
  auth: (cb) => cb({ token: localStorage.getItem("token") || undefined }),
});

// Register the logged-in user as online and join their private room.
// Called on connect and after login.
export const registerUser = (userId) => {
  if (!userId) return;
  if (socket.connected) {
    socket.emit("registerUser", { userId: Number(userId) });
    socket.emit("joinRoom", `user_${userId}`);
  }
};

socket.on("connect", () => {
  const userId = localStorage.getItem("userId");
  if (userId) registerUser(userId);
});

export default socket;
