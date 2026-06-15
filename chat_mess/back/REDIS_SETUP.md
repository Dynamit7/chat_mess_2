# Настройка Redis для ChatMess

## Установка Redis

### Windows
```bash
# Скачайте Redis для Windows с https://github.com/microsoftarchive/redis/releases
# Или используйте WSL:
wsl sudo apt-get install redis-server
```

### Linux/Mac
```bash
# Ubuntu/Debian
sudo apt-get install redis-server

# Mac
brew install redis

# Запуск Redis
redis-server
```

## Настройка переменных окружения

Добавьте в ваш `.env` файл:
```env
REDIS_URL=redis://localhost:6379
```

Для удаленного Redis:
```env
REDIS_URL=redis://username:password@host:port
```

## Установка зависимостей

```bash
npm install
```

## Запуск воркера уведомлений (опционально)

Для обработки очереди уведомлений запустите отдельный процесс:
```bash
node utils/notificationWorker.js
```

Или добавьте в `package.json`:
```json
{
  "scripts": {
    "worker": "node utils/notificationWorker.js"
  }
}
```

## Использование Redis в коде

### Онлайн/Оффлайн статус

**Socket.IO события:**
```javascript
// При подключении пользователя
socket.emit('registerUser', { userId: 123 });

// При отключении автоматически устанавливается оффлайн
```

**API endpoints:**
- `GET /api/messages/user/:userId/online` - проверить онлайн статус
- `GET /api/messages/users/online` - получить список онлайн пользователей

### Статус "Печатает..."

**Socket.IO событие:**
```javascript
socket.emit('typing', { 
  userId: 123, 
  chatId: 'chat_123_456', 
  isTyping: true 
});

// Слушать события печатания
socket.on('userTyping', (data) => {
  console.log('User typing:', data);
});
```

### Кэширование

Redis автоматически кэширует:
- Профили пользователей (TTL: 1 час)
- Сообщения в чатах (TTL: 10 минут)
- Списки чатов (TTL: 30 минут)

Кэш автоматически инвалидируется при:
- Отправке нового сообщения
- Обновлении профиля
- Удалении чата

### Push уведомления

**Регистрация токена:**
```javascript
socket.emit('registerPushToken', { 
  userId: 123, 
  pushToken: 'ExponentPushToken[...]' 
});
```

Токены хранятся в Redis с TTL 30 дней.

### Очередь уведомлений

Уведомления автоматически добавляются в очередь Redis при:
- Получении нового сообщения
- Запросе в друзья
- Сообщении в группе/канале

Воркер обрабатывает очередь и отправляет push уведомления.

### Синхронизация между серверами

Redis Pub/Sub используется для синхронизации Socket.IO событий между несколькими серверами:

- События онлайн/оффлайн статусов
- События печатания
- Другие реального времени события

## Функции Redis

### Онлайн статус
- `setUserOnline(userId)` - установить пользователя онлайн
- `setUserOffline(userId)` - установить пользователя оффлайн
- `isUserOnline(userId)` - проверить онлайн статус
- `getOnlineUsers()` - получить список онлайн пользователей

### Печатает
- `setUserTyping(userId, chatId, isTyping)` - установить статус печатания
- `getUserTyping(chatId)` - получить список печатающих пользователей

### Кэширование
- `cacheUserProfile(userId, profileData)` - кэшировать профиль
- `getCachedUserProfile(userId)` - получить кэшированный профиль
- `invalidateUserProfile(userId)` - инвалидировать кэш профиля

### Push токены
- `setPushToken(userId, token)` - сохранить push токен
- `getPushToken(userId)` - получить push токен
- `removePushToken(userId)` - удалить push токен

### Уведомления
- `addNotificationToQueue(notification)` - добавить уведомление в очередь
- `getNotificationFromQueue()` - получить уведомление из очереди

## Масштабирование

Для масштабирования на несколько серверов:

1. Убедитесь, что все серверы подключены к одному Redis инстансу
2. Socket.IO события автоматически синхронизируются через Redis Pub/Sub
3. Онлайн статусы и кэш доступны всем серверам
4. Очередь уведомлений может обрабатываться любым сервером

## Мониторинг

Проверка подключения к Redis:
```bash
redis-cli ping
# Должно вернуть: PONG
```

Просмотр ключей:
```bash
redis-cli
> KEYS *
> GET user:online:123
> SMEMBERS users:online
```

## Производительность

- Онлайн статусы обновляются каждые 5 минут (TTL)
- Статусы печатания автоматически истекают через 10 секунд
- Кэш профилей обновляется при изменении данных
- Сообщения кэшируются на 10 минут для быстрого доступа

