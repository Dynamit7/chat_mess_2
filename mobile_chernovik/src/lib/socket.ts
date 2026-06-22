/**
 * One shared Socket.IO connection. Matches the server (socket.io v4). The JWT is
 * read fresh from the session cache on every (re)connect via the auth callback.
 */
import { io } from 'socket.io-client';
import { BASE_URL } from './config';
import { sessionCache } from './storage';

const socket = io(BASE_URL, {
  transports: ['websocket'],
  forceNew: true,
  reconnection: true,
  reconnectionAttempts: 20,
  reconnectionDelay: 1000,
  autoConnect: false,
  auth: (cb) => cb({ token: sessionCache.getToken() || undefined }),
});

/** Register the logged-in user as online and join their private room. */
export const registerUser = (userId?: number) => {
  if (!userId) return;
  if (socket.connected) {
    socket.emit('registerUser', { userId: Number(userId) });
    socket.emit('joinRoom', `user_${userId}`);
  }
};

socket.on('connect', () => {
  const id = sessionCache.get()?.userId;
  if (id) registerUser(id);
});

export default socket;
