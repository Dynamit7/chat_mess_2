// src/socket.js
import io from 'socket.io-client';
import { BASE_URL } from './config';
import AsyncStorage from '@react-native-async-storage/async-storage';

const socket = io(BASE_URL, {
  transports: ['websocket'],
  forceNew: true,
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  // Токен передаётся при КАЖДОМ подключении и reconnect (auth-функция).
  // Бэкенд проверяет его в io.use(socketAuth); при ENFORCE_AUTH=1 без токена
  // соединение отклоняется и нельзя действовать от чужого имени.
  auth: async (cb) => {
    try {
      const token = await AsyncStorage.getItem('token');
      cb({ token: token || undefined });
    } catch (_) {
      cb({});
    }
  },
});

// Функция для регистрации пользователя (можно вызывать вручную)
const registerUserIfNeeded = async () => {
  try {
    const userId = await AsyncStorage.getItem('userId');
    if (userId && socket.connected) {
      socket.emit('registerUser', { userId: Number(userId) });
      socket.emit('joinRoom', `user_${userId}`);
      console.log('User registered as online:', userId);
      return true;
    } else if (userId && !socket.connected) {
      // Если socket не подключен, ждем подключения
      console.log('Socket not connected, waiting for connection...');
      return false;
    }
    return false;
  } catch (error) {
    console.log('Ошибка получения userId', error);
    return false;
  }
};

// 'connect' fires on both initial connection and every reconnect in socket.io-client v4
socket.on('connect', async () => {
  await registerUserIfNeeded();
  console.log('Socket connected/reconnected, user registered');
});

// Переподключиться с актуальным токеном — вызывать ПОСЛЕ логина, чтобы
// handshake прошёл с токеном (важно при ENFORCE_AUTH=1). В мягком режиме
// просто переустанавливает соединение — безопасно.
export const reconnectWithAuth = () => {
  try { socket.disconnect(); } catch (_) {}
  socket.connect();
};

// Экспортируем функцию для ручного вызова
export { registerUserIfNeeded };
export default socket;

