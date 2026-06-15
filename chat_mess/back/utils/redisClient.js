require('dotenv').config();
const { createClient } = require('redis');

// Создание Redis клиента
const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 10) {
        console.error('Redis: Too many reconnection attempts');
        return new Error('Too many retries');
      }
      return Math.min(retries * 100, 3000);
    },
  },
});

// Обработка ошибок
redisClient.on('error', (err) => {
  console.error('Redis Client Error:', err);
});

redisClient.on('connect', () => {
  console.log('Redis Client: Connecting...');
});

redisClient.on('ready', () => {
  console.log('Redis Client: Ready');
});

redisClient.on('reconnecting', () => {
  console.log('Redis Client: Reconnecting...');
});

// Подключение к Redis
let isConnected = false;

async function connectRedis() {
  if (!isConnected) {
    try {
      await redisClient.connect();
      isConnected = true;
      console.log('Redis Client: Connected successfully');
    } catch (err) {
      console.error('Redis Client: Connection failed', err);
      isConnected = false;
    }
  }
  return isConnected;
}

// Утилиты для работы с Redis

// Онлайн/оффлайн статус
async function setUserOnline(userId) {
  try {
    await redisClient.setEx(`user:online:${userId}`, 600, '1'); // 10 минут TTL
    await redisClient.sAdd('users:online', userId.toString());
  } catch (err) {
    console.error('Redis: Error setting user online', err);
  }
}

// Обновление TTL для онлайн пользователя (вызывать при активности)
async function refreshUserOnline(userId) {
  try {
    const exists = await redisClient.exists(`user:online:${userId}`);
    if (exists === 1) {
      await redisClient.setEx(`user:online:${userId}`, 600, '1'); // Обновляем TTL до 10 минут
    }
  } catch (err) {
    console.error('Redis: Error refreshing user online', err);
  }
}

async function setUserOffline(userId) {
  try {
    await redisClient.del(`user:online:${userId}`);
    await redisClient.sRem('users:online', userId.toString());
  } catch (err) {
    console.error('Redis: Error setting user offline', err);
  }
}

async function isUserOnline(userId) {
  try {
    const result = await redisClient.exists(`user:online:${userId}`);
    return result === 1;
  } catch (err) {
    console.error('Redis: Error checking user online', err);
    return false;
  }
}

async function getOnlineUsers() {
  try {
    const userIds = await redisClient.sMembers('users:online');
    return userIds.map(id => parseInt(id));
  } catch (err) {
    console.error('Redis: Error getting online users', err);
    return [];
  }
}

// Статус "Печатает..."
async function setUserTyping(userId, chatId, isTyping = true) {
  try {
    const key = `user:typing:${chatId}:${userId}`;
    if (isTyping) {
      await redisClient.setEx(key, 10, '1'); // 10 секунд TTL
      await redisClient.publish(`typing:${chatId}`, JSON.stringify({ userId, isTyping: true }));
    } else {
      await redisClient.del(key);
      await redisClient.publish(`typing:${chatId}`, JSON.stringify({ userId, isTyping: false }));
    }
  } catch (err) {
    console.error('Redis: Error setting typing status', err);
  }
}

async function getUserTyping(chatId) {
  try {
    const keys = await redisClient.keys(`user:typing:${chatId}:*`);
    const userIds = keys.map(key => {
      const parts = key.split(':');
      return parseInt(parts[parts.length - 1]);
    });
    return userIds;
  } catch (err) {
    console.error('Redis: Error getting typing users', err);
    return [];
  }
}

// Кэширование профилей
async function cacheUserProfile(userId, profileData) {
  try {
    await redisClient.setEx(
      `user:profile:${userId}`,
      3600, // 1 час
      JSON.stringify(profileData)
    );
  } catch (err) {
    console.error('Redis: Error caching user profile', err);
  }
}

async function getCachedUserProfile(userId) {
  try {
    const cached = await redisClient.get(`user:profile:${userId}`);
    return cached ? JSON.parse(cached) : null;
  } catch (err) {
    console.error('Redis: Error getting cached user profile', err);
    return null;
  }
}

async function invalidateUserProfile(userId) {
  try {
    await redisClient.del(`user:profile:${userId}`);
  } catch (err) {
    console.error('Redis: Error invalidating user profile', err);
  }
}

// Push токены
async function setPushToken(userId, token) {
  try {
    await redisClient.setEx(`push:token:${userId}`, 86400 * 30, token); // 30 дней
  } catch (err) {
    console.error('Redis: Error setting push token', err);
  }
}

async function getPushToken(userId) {
  try {
    return await redisClient.get(`push:token:${userId}`);
  } catch (err) {
    console.error('Redis: Error getting push token', err);
    return null;
  }
}

async function removePushToken(userId) {
  try {
    await redisClient.del(`push:token:${userId}`);
  } catch (err) {
    console.error('Redis: Error removing push token', err);
  }
}

// Кэширование чатов
async function cacheChat(userId, partnerId, chatData) {
  try {
    const key = `chat:${Math.min(userId, partnerId)}:${Math.max(userId, partnerId)}`;
    await redisClient.setEx(key, 1800, JSON.stringify(chatData)); // 30 минут
  } catch (err) {
    console.error('Redis: Error caching chat', err);
  }
}

async function getCachedChat(userId, partnerId) {
  try {
    const key = `chat:${Math.min(userId, partnerId)}:${Math.max(userId, partnerId)}`;
    const cached = await redisClient.get(key);
    return cached ? JSON.parse(cached) : null;
  } catch (err) {
    console.error('Redis: Error getting cached chat', err);
    return null;
  }
}

async function invalidateChat(userId, partnerId) {
  try {
    const key = `chat:${Math.min(userId, partnerId)}:${Math.max(userId, partnerId)}`;
    await redisClient.del(key);
  } catch (err) {
    console.error('Redis: Error invalidating chat', err);
  }
}

// Кэширование сообщений
async function cacheMessages(chatKey, messages) {
  try {
    await redisClient.setEx(`messages:${chatKey}`, 120, JSON.stringify(messages)); // 10 минут
  } catch (err) {
    console.error('Redis: Error caching messages', err);
  }
}

async function getCachedMessages(chatKey) {
  try {
    const cached = await redisClient.get(`messages:${chatKey}`);
    return cached ? JSON.parse(cached) : null;
  } catch (err) {
    console.error('Redis: Error getting cached messages', err);
    return null;
  }
}

async function invalidateMessages(chatKey) {
  try {
    await redisClient.del(`messages:${chatKey}`);
  } catch (err) {
    console.error('Redis: Error invalidating messages', err);
  }
}

// Очередь уведомлений
async function addNotificationToQueue(notification) {
  try {
    await redisClient.lPush('notifications:queue', JSON.stringify(notification));
  } catch (err) {
    console.error('Redis: Error adding notification to queue', err);
  }
}

async function getNotificationFromQueue() {
  try {
    const notification = await redisClient.rPop('notifications:queue');
    return notification ? JSON.parse(notification) : null;
  } catch (err) {
    console.error('Redis: Error getting notification from queue', err);
    return null;
  }
}

// Синхронизация Socket.IO между серверами
async function publishSocketEvent(channel, event, data) {
  try {
    await redisClient.publish(`socket:${channel}`, JSON.stringify({ event, data }));
  } catch (err) {
    console.error('Redis: Error publishing socket event', err);
  }
}

// Подписка на события Socket.IO
async function subscribeToSocketEvents(callback) {
  try {
    const subscriber = redisClient.duplicate();
    await subscriber.connect();
    
    subscriber.pSubscribe('socket:*', (message, channel) => {
      try {
        const data = JSON.parse(message);
        callback(channel, data.event, data.data);
      } catch (err) {
        console.error('Redis: Error parsing socket event', err);
      }
    });
    
    return subscriber;
  } catch (err) {
    console.error('Redis: Error subscribing to socket events', err);
    return null;
  }
}

// Подписка на события печатания
async function subscribeToTypingEvents(callback) {
  try {
    const subscriber = redisClient.duplicate();
    await subscriber.connect();
    
    subscriber.pSubscribe('typing:*', (message, channel) => {
      try {
        const data = JSON.parse(message);
        // Извлекаем chatId из канала (формат может быть "typing:1_2" или "typing:*")
        const chatId = channel.replace(/^typing:/, '');
        console.log('Redis typing event received:', { channel, chatId, data });
        callback(chatId, data);
      } catch (err) {
        console.error('Redis: Error parsing typing event', err);
      }
    });
    
    return subscriber;
  } catch (err) {
    console.error('Redis: Error subscribing to typing events', err);
    return null;
  }
}

// Универсальные функции кэширования
async function setCache(key, value, ttl = 3600) {
  try {
    await redisClient.setEx(key, ttl, JSON.stringify(value));
  } catch (err) {
    console.error('Redis: Error setting cache', err);
  }
}

async function getCache(key) {
  try {
    const cached = await redisClient.get(key);
    return cached ? JSON.parse(cached) : null;
  } catch (err) {
    console.error('Redis: Error getting cache', err);
    return null;
  }
}

async function deleteCache(key) {
  try {
    await redisClient.del(key);
  } catch (err) {
    console.error('Redis: Error deleting cache', err);
  }
}



// Дополнительные функции для Redis

// Управление пользователями в каналах
async function setUserInChannel(userId, channelId) {
  try {
    const key = `channel:${channelId}:users`;
    await redisClient.hSet(key, userId.toString(), new Date().toISOString());
    // Устанавливаем TTL 1 день для автоматической очистки неактивных каналов
    await redisClient.expire(key, 86400);
  } catch (err) {
    console.error('Redis: Error setting user in channel', err);
  }
}

async function removeUserFromChannel(userId, channelId) {
  try {
    const key = `channel:${channelId}:users`;
    await redisClient.hDel(key, userId.toString());
  } catch (err) {
    console.error('Redis: Error removing user from channel', err);
  }
}

async function getChannelOnlineUsers(channelId) {
  try {
    const key = `channel:${channelId}:users`;
    const channelUsers = await redisClient.hGetAll(key);
    
    const onlineUsers = [];
    for (const [userId, joinTime] of Object.entries(channelUsers)) {
      const isOnline = await isUserOnline(userId);
      if (isOnline) {
        onlineUsers.push({
          userId: parseInt(userId),
          joinTime,
          isOnline: true
        });
      }
    }
    
    return onlineUsers;
  } catch (err) {
    console.error('Redis: Error getting channel online users', err);
    return [];
  }
}

// Отслеживание прочитанных сообщений
async function setMessageReadStatus(messageId, userId) {
  try {
    const key = `message:read:${messageId}`;
    await redisClient.sAdd(key, userId.toString());
    await redisClient.expire(key, 86400 * 7); // 7 дней
  } catch (err) {
    console.error('Redis: Error setting message read status', err);
  }
}

async function getMessageReadStatus(messageId) {
  try {
    const key = `message:read:${messageId}`;
    const readers = await redisClient.sMembers(key);
    return readers.map(id => parseInt(id));
  } catch (err) {
    console.error('Redis: Error getting message read status', err);
    return [];
  }
}

// Rate limiting
async function rateLimitCheck(userId, endpoint, maxRequests = 10, windowMs = 60000) {
  try {
    const key = `rate_limit:${userId}:${endpoint}`;
    const current = await redisClient.get(key);
    
    if (!current) {
      await redisClient.setEx(key, windowMs / 1000, '1');
      return true;
    }
    
    const count = parseInt(current);
    if (count >= maxRequests) {
      return false;
    }
    
    return true;
  } catch (err) {
    console.error('Redis: Error checking rate limit', err);
    return true; // Разрешаем если Redis недоступен
  }
}

async function incrementRateLimit(userId, endpoint) {
  try {
    const key = `rate_limit:${userId}:${endpoint}`;
    await redisClient.incr(key);
  } catch (err) {
    console.error('Redis: Error incrementing rate limit', err);
  }
}

// Атомарный rate-limit на основе INCR + EXPIRE (скользящее окно фиксированной
// длины). За один проход и считает, и инкрементирует — без гонок между
// несколькими процессами/серверами, т.к. счётчик живёт в Redis.
// Возвращает { allowed, count, remaining }.
async function consumeRateLimit(identifier, action, maxRequests = 20, windowSec = 10) {
  try {
    const key = `rl:${action}:${identifier}`;
    const count = await redisClient.incr(key);
    if (count === 1) {
      // Первый запрос в окне — выставляем TTL.
      await redisClient.expire(key, windowSec);
    }
    return {
      allowed: count <= maxRequests,
      count,
      remaining: Math.max(0, maxRequests - count),
    };
  } catch (err) {
    console.error('Redis: Error in consumeRateLimit', err);
    // Если Redis недоступен — не блокируем пользователей.
    return { allowed: true, count: 0, remaining: maxRequests };
  }
}

// Статистика и аналитика
async function incrementMessageCounter(userId, type = 'text') {
  try {
    const today = new Date().toISOString().split('T')[0];
    const key = `stats:messages:${userId}:${today}`;
    await redisClient.hIncrBy(key, type, 1);
    await redisClient.expire(key, 86400 * 30); // 30 дней
  } catch (err) {
    console.error('Redis: Error incrementing message counter', err);
  }
}

async function getUserMessageStats(userId, days = 7) {
  try {
    const stats = {};
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const key = `stats:messages:${userId}:${dateStr}`;
      
      const dayStats = await redisClient.hGetAll(key);
      if (Object.keys(dayStats).length > 0) {
        stats[dateStr] = dayStats;
      }
    }
    return stats;
  } catch (err) {
    console.error('Redis: Error getting user message stats', err);
    return {};
  }
}

// Кэширование сообщений каналов
async function cacheChannelMessages(channelId, messages) {
  try {
    await redisClient.setEx(`channel:messages:${channelId}`, 600, JSON.stringify(messages)); // 10 минут
  } catch (err) {
    console.error('Redis: Error caching channel messages', err);
  }
}

async function getCachedChannelMessages(channelId) {
  try {
    const cached = await redisClient.get(`channel:messages:${channelId}`);
    return cached ? JSON.parse(cached) : null;
  } catch (err) {
    console.error('Redis: Error getting cached channel messages', err);
    return null;
  }
}

async function invalidateChannelMessages(channelId) {
  try {
    await redisClient.del(`channel:messages:${channelId}`);
  } catch (err) {
    console.error('Redis: Error invalidating channel messages', err);
  }
}

// Кэширование сообщений групп
async function cacheGroupMessages(groupId, messages) {
  try {
    await redisClient.setEx(`group:messages:${groupId}`, 600, JSON.stringify(messages)); // 10 минут
  } catch (err) {
    console.error('Redis: Error caching group messages', err);
  }
}

async function getCachedGroupMessages(groupId) {
  try {
    const cached = await redisClient.get(`group:messages:${groupId}`);
    return cached ? JSON.parse(cached) : null;
  } catch (err) {
    console.error('Redis: Error getting cached group messages', err);
    return null;
  }
}

async function invalidateGroupMessages(groupId) {
  try {
    await redisClient.del(`group:messages:${groupId}`);
  } catch (err) {
    console.error('Redis: Error invalidating group messages', err);
  }
}

// Кэширование списка каналов
async function cacheChannelsList(userId, search, channels) {
  try {
    const key = search ? `channels:list:${userId}:search:${search}` : `channels:list:${userId}`;
    await redisClient.setEx(key, 300, JSON.stringify(channels)); // 5 минут
  } catch (err) {
    console.error('Redis: Error caching channels list', err);
  }
}

async function getCachedChannelsList(userId, search) {
  try {
    const key = search ? `channels:list:${userId}:search:${search}` : `channels:list:${userId}`;
    const cached = await redisClient.get(key);
    return cached ? JSON.parse(cached) : null;
  } catch (err) {
    console.error('Redis: Error getting cached channels list', err);
    return null;
  }
}

async function invalidateChannelsList(userId) {
  try {
    // Инвалидируем все варианты кэша для этого пользователя
    const keys = await redisClient.keys(`channels:list:${userId}*`);
    if (keys.length > 0) {
      await redisClient.del(keys);
    }
  } catch (err) {
    console.error('Redis: Error invalidating channels list', err);
  }
}

// Кэширование списка групп
async function cacheGroupsList(userId, search, groups) {
  try {
    const key = search ? `groups:list:${userId}:search:${search}` : `groups:list:${userId}`;
    await redisClient.setEx(key, 300, JSON.stringify(groups)); // 5 минут
  } catch (err) {
    console.error('Redis: Error caching groups list', err);
  }
}

async function getCachedGroupsList(userId, search) {
  try {
    const key = search ? `groups:list:${userId}:search:${search}` : `groups:list:${userId}`;
    const cached = await redisClient.get(key);
    return cached ? JSON.parse(cached) : null;
  } catch (err) {
    console.error('Redis: Error getting cached groups list', err);
    return null;
  }
}

async function invalidateGroupsList(userId) {
  try {
    // Инвалидируем все варианты кэша для этого пользователя
    const keys = await redisClient.keys(`groups:list:${userId}*`);
    if (keys.length > 0) {
      await redisClient.del(keys);
    }
  } catch (err) {
    console.error('Redis: Error invalidating groups list', err);
  }
}

// Кэширование участников канала
async function cacheChannelMembers(channelId, members) {
  try {
    await redisClient.setEx(`channel:members:${channelId}`, 600, JSON.stringify(members)); // 10 минут
  } catch (err) {
    console.error('Redis: Error caching channel members', err);
  }
}

async function getCachedChannelMembers(channelId) {
  try {
    const cached = await redisClient.get(`channel:members:${channelId}`);
    return cached ? JSON.parse(cached) : null;
  } catch (err) {
    console.error('Redis: Error getting cached channel members', err);
    return null;
  }
}

async function invalidateChannelMembers(channelId) {
  try {
    await redisClient.del(`channel:members:${channelId}`);
  } catch (err) {
    console.error('Redis: Error invalidating channel members', err);
  }
}

// Кэширование участников группы
async function cacheGroupMembers(groupId, members) {
  try {
    await redisClient.setEx(`group:members:${groupId}`, 600, JSON.stringify(members)); // 10 минут
  } catch (err) {
    console.error('Redis: Error caching group members', err);
  }
}

async function getCachedGroupMembers(groupId) {
  try {
    const cached = await redisClient.get(`group:members:${groupId}`);
    return cached ? JSON.parse(cached) : null;
  } catch (err) {
    console.error('Redis: Error getting cached group members', err);
    return null;
  }
}

async function invalidateGroupMembers(groupId) {
  try {
    await redisClient.del(`group:members:${groupId}`);
  } catch (err) {
    console.error('Redis: Error invalidating group members', err);
  }
}

module.exports = {
  redisClient,
  connectRedis,
  // Онлайн статус
  setUserOnline,
  setUserOffline,
  isUserOnline,
  getOnlineUsers,
  refreshUserOnline,
  // Печатает
  setUserTyping,
  getUserTyping,
  // Профили
  cacheUserProfile,
  getCachedUserProfile,
  invalidateUserProfile,
  // Push токены
  setPushToken,
  getPushToken,
  removePushToken,
  // Чаты
  cacheChat,
  getCachedChat,
  invalidateChat,
  // Сообщения
  cacheMessages,
  getCachedMessages,
  invalidateMessages,
  // Уведомления
  addNotificationToQueue,
  getNotificationFromQueue,
  // Socket.IO синхронизация
  publishSocketEvent,
  subscribeToSocketEvents,
  subscribeToTypingEvents,
  // Универсальные
  setCache,
  getCache,
  deleteCache,
  setUserInChannel,
  removeUserFromChannel,
  getChannelOnlineUsers,
  setMessageReadStatus,
  getMessageReadStatus,
  rateLimitCheck,
  incrementRateLimit,
  consumeRateLimit,
  incrementMessageCounter,
  getUserMessageStats,
  // Каналы
  cacheChannelMessages,
  getCachedChannelMessages,
  invalidateChannelMessages,
  cacheChannelsList,
  getCachedChannelsList,
  invalidateChannelsList,
  cacheChannelMembers,
  getCachedChannelMembers,
  invalidateChannelMembers,
  // Группы
  cacheGroupMessages,
  getCachedGroupMessages,
  invalidateGroupMessages,
  cacheGroupsList,
  getCachedGroupsList,
  invalidateGroupsList,
  cacheGroupMembers,
  getCachedGroupMembers,
  invalidateGroupMembers
};

