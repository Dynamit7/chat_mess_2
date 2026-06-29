require('dotenv').config();

// ── Sentry (error monitoring) — инициализировать ДО всего остального ────────
// Получи DSN на https://sentry.io → новый проект → Node.js
// Добавь в .env: SENTRY_DSN=https://...@sentry.io/...
const Sentry = require("@sentry/node");
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || "production",
    tracesSampleRate: 0.1, // 10% запросов трейсим
  });
  console.log("[Sentry] Initialized");
}

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const { createServer } = require("http");
const { Server } = require("socket.io");
const { createAdapter } = require("@socket.io/redis-adapter");
const path = require("path");

const { initializeMinIO, uploadToMinio, generatePresignedUrl, s3 } = require("./utils/minioClient");
const { uploadLarge } = require("./utils/multerConfig");
require("./utils/cronStoriesCleaner");
const scheduledMessagesCron = require("./utils/cronScheduledMessages");
const {
  register: metricsRegister,
  httpMetricsMiddleware,
  socketConnectionsActive,
  socketEventsTotal,
  messagesTotal,
  messagesDeletedTotal,
  usersOnline,
  rateLimitHitsTotal,
} = require("./utils/metrics");
const {
  redisClient,
  connectRedis,
  setUserOnline,
  setUserOffline,
  isUserOnline,
  refreshUserOnline,
  setUserTyping,
  getUserTyping,
  setPushToken,
  getPushToken,
  publishSocketEvent,
  subscribeToSocketEvents,
  subscribeToTypingEvents,
  invalidateMessages,
  invalidateChat,
  getCache,
  setCache,
  consumeRateLimit,
} = require("./utils/redisClient");

const messagesRoutes = require("./routes/messagesRoutes");
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const groupRoutes = require("./routes/groupRoutes");
const channelRoutes = require("./routes/channelRoutes");
const storiesRoutes = require("./routes/storiesRoutes");
const reelsRoutes = require("./routes/reelsRoutes");
const stickersRoutes = require("./routes/stickersRoutes");
const pollsRoutes = require("./routes/pollsRoutes");
const adminRoutes = require("./routes/adminRoutes");
const scheduledMessagesRoutes = require("./routes/scheduledMessagesRoutes");
const callsRoutes = require("./routes/callsRoutes");
const { router: adminAuthRouter, requireAdminJWT } = require("./routes/adminAuthRoutes");
const { sequelize } = require("./models");
const {
  Message,
  Chat,
  User,
  GroupUser,
  GroupMessage,
  BlockedUser,
  Reaction,
  Channel,
  Story,
  AdminUser,
} = require("./models/index");
const bcrypt = require("bcrypt");

const { Expo } = require("expo-server-sdk");
const { sendPushToUsers, userIdsInRoom, previewBody } = require("./utils/push");
const { Op } = require("sequelize");
const { decrypt } = require("./utils/encryption");

// --- Логирование -----------------------------------------------------------
// Информационные логи на ГОРЯЧИХ путях (каждое сообщение, typing, join)
// синхронно пишут в stdout и под нагрузкой блокируют event loop. Поэтому в
// проде они отключены. Включить для отладки:  DEBUG_LOG=1 в .env
// Ошибки (console.error) логируем ВСЕГДА — они редки и важны.
const DEBUG_LOG = process.env.DEBUG_LOG === "1";
const log = DEBUG_LOG ? console.log.bind(console) : () => {};

const app = express();
const server = createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

// --- Аутентификация сокетов (handshake) ------------------------------------
// Проверяет JWT при подключении и кладёт доверенный id в socket.authUserId.
// Флаг ENFORCE_AUTH: мягкий режим (по умолчанию) — пускает всех; строгий —
// отклоняет соединения без валидного токена. resolveActor() ниже не даёт
// действовать от чужого имени в критичных хендлерах.
const { socketAuth, resolveActor } = require("./middleware/enforceAuth");
io.use(socketAuth);

// За nginx (upstream): доверяем X-Forwarded-For, иначе rate-limit и req.ip
// видят IP прокси (127.0.0.1) у всех, и лимит срабатывает на всех сразу.
app.set("trust proxy", 1);

// --- Безопасность и производительность HTTP --------------------------------
// helmet: безопасные заголовки (XSS, clickjacking и т.п.). crossOriginResourcePolicy
// отключаем, т.к. медиа отдаётся на другой origin (web/mobile) и иначе браузер
// блокирует картинки. CSP не включаем глобально — это API, не сайт.
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: false,
}));
// compression: gzip ответов — большие списки чатов/сообщений ужимаются в разы.
app.use(compression());

// --- Rate limiting (HTTP) --------------------------------------------------
// Строгий лимит на авторизацию — защита от перебора паролей/кодов.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 минут
  max: 30,                   // не более 30 попыток с IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Слишком много попыток. Попробуйте позже." },
});
// Общий мягкий лимит на остальное API (чат идёт через сокеты, так что HTTP
// частит мало; лимит щедрый, чтобы не мешать нормальной работе).
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,       // 1 минута
  max: 300,                  // 300 запросов в минуту с IP
  standardHeaders: true,
  legacyHeaders: false,
});

app.use((req, res, next) => {
  req.io = io;
  next();
});

// CORS: в .env задай ALLOWED_ORIGINS=https://yourdomain.com,https://admin.yourdomain.com
// Если не задано — разрешаем localhost (только для разработки)
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
  : ["http://localhost:3333", "http://localhost:5173", "http://localhost:5174", "http://localhost:5180", "http://localhost:8081"];

// В dev разрешаем любой localhost/127.0.0.1 порт (Expo web берёт случайный порт: 8081/8082/19006…)
const isDevLocalhost = (origin) =>
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

app.use(cors({
  origin: (origin, cb) => {
    // Запросы без origin (мобильные приложения, curl, Postman) — разрешаем
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    if (isDevLocalhost(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
  // Пагинация бинарных (protobuf) сообщений групп отдаёт курсор в заголовках —
  // браузерному клиенту их надо явно разрешить читать.
  exposedHeaders: ["X-Has-More", "X-Next-Before"],
}));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// HTTP метрики — подключаем после cors/json, до роутов
app.use(httpMetricsMiddleware);

// --- Prometheus /metrics ---------------------------------------------------
// Доступен для localhost и Docker-сети (172.x.x.x) — не выставляем в nginx наружу.
app.get("/metrics", async (req, res) => {
  const ip = req.ip || "";
  const allowed =
    ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1" ||
    ip.startsWith("172.") || ip.startsWith("::ffff:172.");
  if (!allowed) return res.status(403).end();
  res.set("Content-Type", metricsRegister.contentType);
  res.end(await metricsRegister.metrics());
});

// --- Health-check ----------------------------------------------------------
// Лёгкий эндпоинт для PM2 / балансировщика / мониторинга: проверяет, что процесс
// жив и БД отвечает. Отдаёт 200 если всё ОК, 503 если БД недоступна.
app.get("/health", async (req, res) => {
  try {
    await sequelize.authenticate();
    res.json({ status: "ok", uptime: process.uptime(), pid: process.pid });
  } catch (err) {
    res.status(503).json({ status: "db_unavailable" });
  }
});

initializeMinIO().catch((err) => console.error("MinIO initialization failed:", err));

app.get("/minio/:bucket/:key", async (req, res) => {
  const { bucket, key } = req.params;
  const params = {
    Bucket: bucket,
    Key: key,
  };
  try {
    const data = await s3.getObject(params).promise();
    res.set("Content-Type", data.ContentType);
    res.send(data.Body);
  } catch (err) {
    console.error("Error fetching from MinIO:", err);
    if (err.code === "AccessDenied") {
      res.status(403).json({ error: "Access denied to the requested resource" });
    } else if (err.code === "NoSuchKey") {
      res.status(404).json({ error: "File not found" });
    } else {
      res.status(500).json({ error: "Error fetching file", details: err.message });
    }
  }
});

app.use('/Uploads', express.static(path.join(__dirname, 'Uploads')));

app.use(
  "/api/stories/static",
  express.static(path.join(__dirname, "Uploads/stories"), {
    setHeaders: (res, path) => {
      const ext = path.extname(path).toLowerCase();
      const mimeTypes = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".gif": "image/gif",
        ".mp4": "video/mp4",
        ".mov": "video/quicktime",
      };
      if (mimeTypes[ext]) {
        res.set("Content-Type", mimeTypes[ext]);
      }
    },
  })
);

app.post("/upload", (req, res, next) => {
  uploadLarge.single("file")(req, res, (err) => {
    if (err) {
      console.error("Multer upload error:", err.message);
      return res.status(400).json({ error: err.message || "Ошибка загрузки файла" });
    }
    next();
  });
}, async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Нет файла для загрузки" });
  }
  try {
    const fileName = `${Date.now()}-${req.file.originalname}`;
    await uploadToMinio(req.file.buffer, fileName, req.file.mimetype);
    const presignedUrl = generatePresignedUrl(fileName);
    res.json({ url: presignedUrl });
  } catch (err) {
    console.error("Ошибка загрузки в MinIO:", err);
    res.status(500).json({ error: "Ошибка загрузки файла" });
  }
});

app.get("/file/:fileName", (req, res) => {
  const { fileName } = req.params;
  try {
    const presignedUrl = generatePresignedUrl(fileName);
    res.json({ url: presignedUrl });
  } catch (err) {
    console.error("Ошибка генерации presigned URL:", err);
    res.status(500).json({ error: "Не удалось сгенерировать ссылку" });
  }
});

const { authenticate, ENFORCE } = require("./middleware/enforceAuth");

app.use("/auth", authLimiter, authRoutes);   // строгий лимит на вход/регистрацию
app.use("/api", apiLimiter);                  // мягкий лимит на всё API
console.log(`[auth] API authentication enforcement: ${ENFORCE ? "ON (strict)" : "OFF (soft)"}`);

// authenticate — на все ПОЛЬЗОВАТЕЛЬСКИЕ группы (требует пользовательский JWT).
// /api/admin сюда НЕ входит: у админки своя авторизация (x-admin-key).
app.use("/api/stories", authenticate, storiesRoutes);
app.use("/api/users", authenticate, userRoutes);
app.use("/api/messages", authenticate, messagesRoutes);
app.use("/api/groups", authenticate, groupRoutes);
app.use("/api/channels", authenticate, channelRoutes);
app.use("/api/reels", authenticate, reelsRoutes);
app.use("/api/stickers", authenticate, stickersRoutes);
app.use("/api/polls", authenticate, pollsRoutes);
app.use("/api/scheduled-messages", authenticate, scheduledMessagesRoutes);
app.use("/api/calls", authenticate, callsRoutes);
// Admin auth (login, create) — без JWT middleware, только static key
app.use("/api/admin/auth", adminAuthRouter);
// Все остальные admin роуты — через JWT или static key
app.use("/api/admin", requireAdminJWT, adminRoutes);

// --- 404 для несуществующих API-роутов ------------------------------------
app.use("/api", (req, res) => {
  res.status(404).json({ error: "Not found" });
});

// --- Централизованный обработчик ошибок ------------------------------------
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  // Отправляем ошибку в Sentry (если настроен)
  if (process.env.SENTRY_DSN) {
    Sentry.captureException(err);
  }
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({ error: "Internal server error" });
});

const expo = new Expo();

scheduledMessagesCron.init(io);

let socketSubscriber = null;
let typingSubscriber = null;

connectRedis().then(async () => {
  // --- Socket.IO Redis adapter ---------------------------------------
  // С адаптером любые io.to(room).emit() и socket.broadcast.emit()
  // автоматически доставляются на ВСЕ инстансы сервера через Redis.
  // Это позволяет запускать много процессов (PM2 cluster / несколько машин),
  // и пользователи на разных серверах продолжают видеть сообщения друг друга.
  try {
    const pubClient = redisClient;          // уже подключён через connectRedis()
    const subClient = redisClient.duplicate();
    await subClient.connect();
    io.adapter(createAdapter(pubClient, subClient));
    console.log("Socket.IO Redis adapter attached");
  } catch (err) {
    console.error("Failed to attach Socket.IO Redis adapter:", err);
  }

  // ПРИМЕЧАНИЕ: ручные re-emit подписки ниже больше НЕ НУЖНЫ.
  // Раньше они вручную ретранслировали события между инстансами через
  // глобальный io.emit(...), но теперь это делает адаптер на уровне комнат.
  // Оставлять их означало бы доставлять каждое событие ДВАЖДЫ, поэтому
  // подписки отключены. publishSocketEvent()/setUserTyping() остаются как
  // no-op (хранение typing-статуса в Redis по-прежнему работает).
}).catch(err => {
  console.error("Failed to setup Redis adapter:", err);
});

// Краткий профиль пользователя (id/username/nickname/email/avatar) с кэшем
// в Redis. Используется в горячем пути sendMessage, чтобы не дёргать базу
// за одними и теми же данными на каждое сообщение. Отдельный namespace
// "userbrief:" не конфликтует с другими кэшами профилей.
async function getUserBrief(userId) {
  const key = `userbrief:${userId}`;
  try {
    const cached = await getCache(key);
    if (cached) return cached;
  } catch (_) {}

  const user = await User.findByPk(userId, {
    attributes: ["id", "username", "nickname", "email", "avatar"],
  });
  if (!user) return null;
  const brief = user.toJSON();
  setCache(key, brief, 300).catch(() => {}); // кэш на 5 минут, не блокируем
  return brief;
}

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);
  let currentUserId = null;
  socketConnectionsActive.inc();


  socket.on("registerUser", async ({ userId }) => {
    try {
      // Защита от спуфинга: в строгом режиме можно зарегистрироваться только
      // под собственным id из токена. Иначе атакующий вошёл бы в чужую комнату
      // user_${userId} и получал чужие сообщения.
      const resolvedId = resolveActor(socket, userId);
      if (resolvedId === null) {
        socket.emit("authError", { reason: "Unauthorized registerUser" });
        return;
      }
      userId = resolvedId;

      currentUserId = userId;
      socket.join(`user_${userId}`);
      await setUserOnline(userId);
      
    
      const user = await User.findByPk(userId, {
        attributes: ["id", "ghostMode"],
      });
      
     
      if (!user || !user.ghostMode) {
        socket.broadcast.emit("userOnline", { userId });
     
        await publishSocketEvent("status", "userOnline", { userId });
      }
    } catch (err) {
      console.error("Error registering user:", err);
    }
  });


  // ----- ADMIN real-time oversight -------------------------------------
  // An authenticated admin socket subscribes to EVERY user_/group_/channel_
  // room, so it receives the exact same broadcasts (messageReceived,
  // groupMessageReceived, channelMessageReceived, edits, deletes, typing…)
  // as ordinary clients — live moderation of the whole platform.
  socket.on("admin:join", async ({ adminKey, token } = {}) => {
    try {
      // Accept JWT token (preferred) or legacy ADMIN_KEY
      const jwt = require("jsonwebtoken");
      const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET;
      const ADMIN_KEY = process.env.ADMIN_KEY;
      let authorized = false;
      if (token) {
        try {
          const payload = jwt.verify(token, ADMIN_JWT_SECRET);
          authorized = payload.role === "superadmin" || payload.role === "moderator";
        } catch { authorized = false; }
      } else if (ADMIN_KEY && adminKey === ADMIN_KEY) {
        authorized = true;
      }
      if (!authorized) {
        socket.emit("admin:error", { error: "invalid admin key" });
        return;
      }
      const { Group: GroupModel, Channel: ChannelModel } = require("./models/index");
      const [users, groups, channels] = await Promise.all([
        User.findAll({ attributes: ["id"] }),
        GroupModel.findAll({ attributes: ["id"] }),
        ChannelModel.findAll({ attributes: ["id"] }),
      ]);
      const rooms = [
        ...users.map((u) => `user_${u.id}`),
        ...groups.map((g) => `group_${g.id}`),
        ...channels.map((c) => `channel_${c.id}`),
      ];
      socket.join(rooms);
      socket.join("admins");
      socket.emit("admin:joined", {
        rooms: rooms.length,
        users: users.length,
        groups: groups.length,
        channels: channels.length,
      });
      console.log(`Admin socket ${socket.id} subscribed to ${rooms.length} rooms`);
    } catch (err) {
      console.error("admin:join error", err);
      socket.emit("admin:error", { error: err.message });
    }
  });


  socket.on("registerPushToken", async ({ userId, pushToken }) => {
    try {
      if (resolveActor(socket, userId) === null) return; // только свой push-токен
      if (Expo.isExpoPushToken(pushToken)) {
        await setPushToken(userId, pushToken);
        console.log(`Registered push token for user ${userId} in Redis`);
      } else {
        console.log(`Invalid Expo push token: ${pushToken}`);
      }
    } catch (err) {
      console.error("Error registering push token:", err);
    }
  });


socket.on("typing", async ({ userId, chatId, isTyping, groupId }) => {
  try {
    if (resolveActor(socket, userId) === null) return; // нельзя «печатать» от чужого имени
    log(`User ${userId} is typing: ${isTyping} in chat ${chatId}, groupId: ${groupId}`);

    if (groupId) {
   
      const roomName = `group_${groupId}`;
      const user = await User.findByPk(userId, { attributes: ["id", "username"] });
      
      
      io.to(roomName).emit("groupTyping", {
        userId,
        username: user ? user.username : `User ${userId}`,
        isTyping
      });

      log(`Sent group typing event to room: ${roomName}, userId: ${userId}, username: ${user?.username}`);
    } else {
      const user = await User.findByPk(userId, {
        attributes: ["id", "ghostMode"],
      });
      

      if (!user || !user.ghostMode) {
        await refreshUserOnline(userId);
      }
      

      await setUserTyping(userId, chatId, isTyping);
      
  
  
      const roomName = `chat_${chatId}`;
      socket.to(roomName).emit("userTyping", {
        userId,
        isTyping
      });

      log(`Sent typing event to room: ${roomName}, userId: ${userId}, isTyping: ${isTyping}`);
    }
  } catch (err) {
    console.error("Error setting typing status:", err);
  }
});


  // socket.on("typing", async ({ userId, chatId, isTyping }) => {
  //   try {
  //     await setUserTyping(userId, chatId, isTyping);
  //     // Событие уже отправлено через Redis подписку
  //   } catch (err) {
  //     console.error("Error setting typing status:", err);
  //   }
  // });





  socket.on("newStoryCreated", async ({ userId }) => {
    try {
      if (resolveActor(socket, userId) === null) return; // только своя история
      socket.broadcast.emit("storyAdded", { userId });
      console.log(`New story created by user ${userId}`);
    } catch (err) {
      console.error("Error in newStoryCreated:", err);
    }
  });

  socket.on("callUser", ({ to, callerId, callerName, callerPicture, video }) => {
    if (resolveActor(socket, callerId) === null) return;
    io.to(`user_${to}`).emit("incomingCall", { callerId, callerName, callerPicture, video: !!video });
  });

  socket.on("acceptCall", ({ to }) => {
    io.to(`user_${to}`).emit("callAccepted");
  });

  socket.on("declineCall", ({ to }) => {
    io.to(`user_${to}`).emit("callDeclined");
  });

  socket.on("endCall", ({ to }) => {
    io.to(`user_${to}`).emit("callEnded");
  });

  socket.on("offer", ({ to, sdp }) => {
    io.to(`user_${to}`).emit("offer", {
      from: socket.authUserId,
      sdp,
    });
  });

  socket.on("answer", ({ to, sdp }) => {
    io.to(`user_${to}`).emit("answer", {
      from: socket.authUserId,
      sdp,
    });
  });

  socket.on("iceCandidate", ({ to, candidate }) => {
    io.to(`user_${to}`).emit("iceCandidate", {
      from: socket.authUserId,
      candidate,
    });
  });

  socket.on("joinRoom", (roomName) => {
    // В строгом режиме нельзя войти в ЧУЖУЮ личную комнату user_<id> и читать
    // чужие сообщения. Свою — можно; групповые/канальные комнаты тут не трогаем.
    if (typeof roomName === "string" && roomName.startsWith("user_")) {
      const targetId = roomName.slice("user_".length);
      if (resolveActor(socket, targetId) === null) return;
    }
    socket.join(roomName);
    log(`User joined room: ${roomName}`);
  });

  socket.on("startChat", async ({ fromUserId, toUserId }) => {
    try {
      if (resolveActor(socket, fromUserId) === null) return; // чат начинаешь от себя
      const [senderChat] = await Chat.findOrCreate({
        where: { userId: fromUserId, partnerId: toUserId },
        defaults: { userId: fromUserId, partnerId: toUserId, status: 1 },
      });
      const [recipientChat] = await Chat.findOrCreate({
        where: { userId: toUserId, partnerId: fromUserId },
        defaults: { userId: toUserId, partnerId: fromUserId, status: 1 },
      });
      const recipientInfo = await User.findByPk(toUserId, {
        attributes: ["id", "username", "nickname", "email", "avatar"],
      });
      const senderInfo = await User.findByPk(fromUserId, {
        attributes: ["id", "username", "nickname", "email", "avatar"],
      });
      io.to(`user_${fromUserId}`).emit("chatUpdated", {
        partnerId: toUserId,
        partnerInfo: recipientInfo,
        lastMessage: { text: "", createdAt: new Date() },
      });
      io.to(`user_${toUserId}`).emit("chatUpdated", {
        partnerId: fromUserId,
        partnerInfo: senderInfo,
        lastMessage: { text: "", createdAt: new Date() },
      });
      console.log(`startChat: Чаты созданы между ${fromUserId} и ${toUserId}`);
    } catch (err) {
      console.error("Error in startChat:", err);
    }
  });

  // В обработчике socket.on("deleteMessage") ЗАМЕНИТЕ код обновления lastMessage:
socket.on("deleteMessage", async ({ roomName, messageId }) => {
  try {
    const message = await Message.findByPk(messageId);
    if (!message) return;

    // Ownership: удалить сообщение может ТОЛЬКО его автор (строгий режим).
    // Раньше любой мог удалить чужое сообщение, передав его messageId.
    if (ENFORCE && Number(socket.authUserId) !== Number(message.fromUserId)) {
      socket.emit("authError", { reason: "Unauthorized deleteMessage", messageId });
      return;
    }

    io.to(roomName).emit("messageDeleted", { messageId });

    {
      const fromUserId = message.fromUserId;
      const toUserId = message.toUserId;
      const wasUnread = !message.isRead;

      await message.update({ isDeleted: true });

      // Инвалидируем кэш сообщений для этого чата
      const chatKey = `${Math.min(fromUserId, toUserId)}_${Math.max(fromUserId, toUserId)}`;
      await invalidateMessages(chatKey);

      // Получаем оба чата
      const senderChat = await Chat.findOne({
        where: { userId: fromUserId, partnerId: toUserId },
      });
      
      const recipientChat = await Chat.findOne({
        where: { userId: toUserId, partnerId: fromUserId },
      });

      const chatsToUpdate = [];
      if (senderChat) chatsToUpdate.push(senderChat);
      if (recipientChat) chatsToUpdate.push(recipientChat);

      // Ищем последнее не удаленное сообщение для этого чата
      const lastMessage = await Message.findOne({
        where: {
          [Op.or]: [
            { fromUserId: fromUserId, toUserId: toUserId },
            { fromUserId: toUserId, toUserId: fromUserId },
          ],
          isDeleted: false,
        },
        order: [["createdAt", "DESC"]],
      });

      // ВАЖНО: Правильно определяем новый lastMessage
      let newLastMessage = "";
      let newTime = "";
      let newLastMessageType = "text";
      let newIsForwarded = false;

      if (lastMessage) {
        try {
          // РАСШИФРОВЫВАЕМ текст сообщения
          newLastMessage = decrypt(lastMessage.text) || "";
          newTime = lastMessage.createdAt ? lastMessage.createdAt.toISOString() : "";
          newLastMessageType = lastMessage.type || "text";
          newIsForwarded = !!lastMessage.forwardedFromType;
        } catch (err) {
          console.error("Error decrypting last message:", err);
          newLastMessage = lastMessage.filename || "";
        }
      }

      console.log("🔄 Updating lastMessage after deletion:", {
        messageId,
        newLastMessage,
        newTime,
        hasLastMessage: !!lastMessage
      });

      // Обновляем lastMessage для всех чатов
      for (const chat of chatsToUpdate) {
        await chat.update({ 
          lastMessage: newLastMessage 
        });
        
        // Инвалидируем кэш чатов для обоих пользователей
        await invalidateChat(chat.userId, chat.partnerId);
        await invalidateChat(chat.partnerId, chat.userId);
        
        // Отправляем событие обновления lastMessage с ПРАВИЛЬНЫМИ данными
        io.to(`user_${chat.userId}`).emit("lastMessageUpdated", {
          partnerId: chat.partnerId,
          lastMessage: newLastMessage, // Уже расшифрованный текст
          lastMessageType: newLastMessageType,
          isForwarded: newIsForwarded,
          time: newTime,
        });

        console.log(`✅ Sent lastMessageUpdated to user_${chat.userId}:`, {
          partnerId: chat.partnerId,
          lastMessage: newLastMessage,
          time: newTime
        });
      }

      // Обновляем счетчик непрочитанных сообщений
      if (wasUnread) {
        const unreadCount = await Message.count({
          where: {
            fromUserId: fromUserId,
            toUserId: toUserId,
            isRead: false,
            isDeleted: false,
          },
        });

        // Отправляем событие обновления чата с новым счетчиком
        io.to(`user_${toUserId}`).emit("chatUpdated", {
          partnerId: fromUserId,
          unreadCount: unreadCount,
        });

        console.log(`Updated unread count after socket deletion: ${unreadCount} for user ${toUserId}`);
      }
    }
  } catch (err) {
    console.error("Error updating last message after deletion:", err);
  }
});

  socket.on("editMessage", async ({ roomName, messageId, newText }) => {
    // Ownership: транслировать "сообщение отредактировано" может только автор.
    // В мягком режиме лишний запрос в БД не делаем (быстрый ретранслятор).
    if (ENFORCE) {
      const message = await Message.findByPk(messageId, { attributes: ["fromUserId"] });
      if (!message || Number(socket.authUserId) !== Number(message.fromUserId)) {
        socket.emit("authError", { reason: "Unauthorized editMessage", messageId });
        return;
      }
    }
    io.to(roomName).emit("messageEdited", { messageId, newText, isEdited: true });
  });

  socket.on("updateLastMessage", async ({ messageId, newText }) => {
    try {
      const message = await Message.findByPk(messageId);
      if (message) {
        // Ownership: обновлять превью «последнее сообщение» может только автор.
        if (ENFORCE && Number(socket.authUserId) !== Number(message.fromUserId)) return;
        const fromUserId = message.fromUserId;
        const toUserId = message.toUserId;
        const time = message.createdAt ? message.createdAt.toISOString() : new Date().toISOString();
        // Emit to each user's personal room with correct partnerId field
        io.to(`user_${fromUserId}`).emit("lastMessageUpdated", {
          partnerId: toUserId,
          lastMessage: newText,
          lastMessageType: message.type || "text",
          isForwarded: !!message.forwardedFromType,
          time,
        });
        io.to(`user_${toUserId}`).emit("lastMessageUpdated", {
          partnerId: fromUserId,
          lastMessage: newText,
          lastMessageType: message.type || "text",
          isForwarded: !!message.forwardedFromType,
          time,
        });
      }
    } catch (err) {
      console.error("Error updating last message:", err);
    }
  });

socket.on("sendMessage", async (data) => {
  const { roomName, message, tempId } = data;
  try {
    const { fromUserId, toUserId, text, type, fileUrl, filename, replyToId, latitude, longitude } = message;

    // Защита от спуфинга: нельзя отправить сообщение от чужого имени.
    if (resolveActor(socket, fromUserId) === null) {
      socket.emit("authError", { reason: "Unauthorized sendMessage", tempId });
      return;
    }

    // 0. Rate-limit: не более 20 сообщений за 10 секунд от одного отправителя.
    //    Защищает базу и сокеты от флуда/ботов. Счётчик общий для всех
    //    инстансов (хранится в Redis).
    const rl = await consumeRateLimit(fromUserId, "sendMessage", 20, 10);
    if (!rl.allowed) {
      socket.emit("rateLimited", {
        action: "sendMessage",
        tempId,
        message: "Слишком много сообщений. Подождите немного.",
      });
      return;
    }

    // 1. Проверка блокировки — ОДНИМ запросом в обе стороны вместо двух.
    const block = await BlockedUser.findOne({
      where: {
        [Op.or]: [
          { blockerId: fromUserId, blockedId: toUserId },
          { blockerId: toUserId, blockedId: fromUserId },
        ],
      },
      attributes: ["id"],
    });
    if (block) {
      return;
    }

    // 2. Создаём сообщение. isRead всегда false (ghostMode тут ни на что
    //    не влиял — старая ветка isGhostMode?false:false была no-op), поэтому
    //    лишний запрос за recipient.ghostMode убран.
    const newMessage = await Message.create({
      fromUserId,
      toUserId,
      text: text || "",
      type: type || "text",
      fileUrl: fileUrl || null,
      filename: filename || null,
      isRead: false,
      replyToId: replyToId || null,
      latitude: latitude ?? null,
      longitude: longitude ?? null,
    });

    // 3. Цитируемое сообщение (нужно до отправки клиенту).
    let replyTo = null;
    if (newMessage.replyToId) {
      const replyToMessage = await Message.findByPk(newMessage.replyToId, {
        attributes: ["id", "text", "fromUserId", "filename"],
      });
      if (replyToMessage) {
        replyTo = {
          id: replyToMessage.id,
          text: replyToMessage.text || replyToMessage.filename || "",
          fromUserId: replyToMessage.fromUserId,
        };
      }
    }

    messagesTotal.inc({ chat_type: "direct" });

    const messageToSend = {
      ...newMessage.toJSON(),
      createdAt: newMessage.createdAt.toISOString(),
      tempId,
      replyTo,
      reactions: [],
    };

    // 4. МГНОВЕННАЯ доставка сообщения обоим участникам — это и даёт
    //    ощущение реального времени. Тяжёлую работу (чаты, профили, счётчик,
    //    push) делаем дальше, НЕ задерживая саму доставку сообщения.
    io.to(`user_${fromUserId}`).emit("messageReceived", messageToSend);
    io.to(`user_${toUserId}`).emit("messageReceived", messageToSend);

    // 5. Все независимые запросы — ПАРАЛЛЕЛЬНО (вместо 5 последовательных):
    //    оба чата, краткие профили (из кэша) и счётчик непрочитанных.
    const [
      [senderChat],
      [recipientChat],
      senderInfo,
      recipientInfo,
      unreadCount,
    ] = await Promise.all([
      Chat.findOrCreate({
        where: { userId: fromUserId, partnerId: toUserId },
        defaults: { userId: fromUserId, partnerId: toUserId },
      }),
      Chat.findOrCreate({
        where: { userId: toUserId, partnerId: fromUserId },
        defaults: { userId: toUserId, partnerId: fromUserId },
      }),
      getUserBrief(fromUserId),
      getUserBrief(toUserId),
      Message.count({
        where: { fromUserId, toUserId, isRead: false },
      }),
    ]);

    // 6. Обновляем lastMessage в базе данных для обоих чатов
    let lastMessageText = "";
    if (text && text.trim() !== "") {
      lastMessageText = text;
    } else if (filename) {
      lastMessageText = `File: ${filename}`;
    } else if (type === "image" && fileUrl) {
      lastMessageText = "📷 Image";
    } else {
      lastMessageText = "Empty message";
    }

    log("🔄 Socket: Updating lastMessage in database:", {
      fromUserId,
      toUserId,
      lastMessageText,
      messageId: newMessage.id
    });

    await Promise.all([
      senderChat.update({ lastMessage: lastMessageText }),
      recipientChat.update({ lastMessage: lastMessageText }),
    ]);

    // ВАЖНО: Отправляем события обновления lastMessage ОБОИМ пользователям
    const lastMessageTime = newMessage.createdAt.toISOString();
    
    log(`📤 Socket: Sending lastMessageUpdated events:`, {
      toUser: toUserId,
      fromUser: fromUserId,
      lastMessage: lastMessageText,
      time: lastMessageTime
    });

    io.to(`user_${fromUserId}`).emit("lastMessageUpdated", {
      partnerId: toUserId,
      lastMessage: lastMessageText,
      lastMessageType: type || "text",
      isForwarded: false,
      time: lastMessageTime,
    });

    io.to(`user_${toUserId}`).emit("lastMessageUpdated", {
      partnerId: fromUserId,
      lastMessage: lastMessageText,
      lastMessageType: type || "text",
      isForwarded: false,
      time: lastMessageTime,
    });

    // Также отправляем chatUpdated события
    io.to(`user_${fromUserId}`).emit("chatUpdated", {
      partnerId: toUserId,
      partnerInfo: recipientInfo,
      lastMessage: messageToSend,
      unreadCount: 0,
    });

    io.to(`user_${toUserId}`).emit("chatUpdated", {
      partnerId: fromUserId,
      partnerInfo: senderInfo,
      lastMessage: messageToSend,
      unreadCount,
    });

    log(`✅ Socket: Last message updated for chat between ${fromUserId} and ${toUserId}: "${lastMessageText}"`);

    // Push the recipient — but only if they aren't currently viewing this chat
    // (Telegram-style). The chat screen joins room `chat_<min>_<max>`.
    const dmRoom = `chat_${Math.min(Number(fromUserId), Number(toUserId))}_${Math.max(Number(fromUserId), Number(toUserId))}`;
    const viewing = await userIdsInRoom(io, dmRoom);
    if (!viewing.has(Number(toUserId))) {
      sendPushToUsers([toUserId], {
        title: senderInfo.username || "New message",
        body: previewBody(senderInfo.username, type, text),
        // `type: 'message'` + fromUserId is what the client's tap-router expects.
        data: {
          type: "message",
          fromUserId: Number(fromUserId),
          senderUsername: senderInfo.username || "",
          senderPicture: senderInfo.avatar || "",
        },
      }).catch(() => {});
    }
  } catch (err) {
    console.error("Error in sendMessage socket handler:", err);
  }
});

  socket.on("sendRequestToFriend", async (data) => {
    const { fromUserId, toUserId } = data;
    try {
      if (resolveActor(socket, fromUserId) === null) return; // заявку шлёшь от себя
      const [chat, created] = await Chat.findOrCreate({
        where: { userId: fromUserId, partnerId: toUserId },
        defaults: { userId: fromUserId, partnerId: toUserId, status: 0 },
      });
      if (!created) {
        await chat.update({ status: 0 });
      }
      io.to(`user_${toUserId}`).emit("friendRequestReceived", {
        fromUserId,
        toUserId,
      });
      log(`Friend request from ${fromUserId} to ${toUserId}`);
    } catch (err) {
      console.error("Error in sendRequestToFriend:", err);
    }
  });

  socket.on("acceptFriendRequest", async (request) => {
    const { fromUserId, toUserId } = request;
    try {
      // Заявку принимает ПОЛУЧАТЕЛЬ (toUserId) — он и есть действующее лицо.
      if (resolveActor(socket, toUserId) === null) return;
      const chatFrom = await Chat.findOne({
        where: { userId: fromUserId, partnerId: toUserId },
      });
      if (chatFrom) {
        await chatFrom.update({ status: 1 });
      }
      const [chatTo] = await Chat.findOrCreate({
        where: { userId: toUserId, partnerId: fromUserId },
        defaults: { userId: toUserId, partnerId: fromUserId, status: 1 },
      });
      if (chatTo && chatTo.status !== 1) {
        await chatTo.update({ status: 1 });
      }
      const fromUser = await User.findByPk(fromUserId, {
        attributes: ["id", "username", "nickname", "email", "avatar"],
      });
      const toUser = await User.findByPk(toUserId, {
        attributes: ["id", "username", "nickname", "email", "avatar"],
      });
      io.to(`user_${fromUserId}`).emit("friendRequestAccepted", {
        partnerId: toUserId,
        partnerInfo: toUser,
      });
      io.to(`user_${toUserId}`).emit("friendRequestAccepted", {
        partnerId: fromUserId,
        partnerInfo: fromUser,
      });
      log(`Friend request accepted by ${toUserId} from ${fromUserId}`);
    } catch (err) {
      console.error("Error in acceptFriendRequest:", err);
    }
  });

  socket.on("joinGroup", async ({ groupId, userId }) => {
    try {
      if (resolveActor(socket, userId) === null) return; // входишь в комнату как сам себя
      const membership = await GroupUser.findOne({
        where: { groupId, userId },
      });
      if (!membership) {
        log(`Пользователь ${userId} не состоит в группе ${groupId}`);
        return;
      }
      socket.join(`group_${groupId}`);
      log(`User ${userId} joined group room: group_${groupId}`);
    } catch (err) {
      console.error("Error in joinGroup:", err);
    }
  });

  socket.on("sendGroupMessage", async ({ groupId, userId, text, replyToId }) => {
    try {
      // Защита от спуфинга: нельзя писать в группу от чужого имени.
      if (resolveActor(socket, userId) === null) {
        socket.emit("authError", { reason: "Unauthorized sendGroupMessage", groupId });
        return;
      }

      // Rate-limit групповых сообщений (рассылка идёт всей группе — выше
      // риск флуда). 20 сообщений / 10 секунд на пользователя.
      const rl = await consumeRateLimit(userId, "sendGroupMessage", 20, 10);
      if (!rl.allowed) {
        socket.emit("rateLimited", {
          action: "sendGroupMessage",
          groupId,
          message: "Слишком много сообщений. Подождите немного.",
        });
        return;
      }

      const membership = await GroupUser.findOne({ where: { groupId, userId } });
      if (!membership) {
        log(`Пользователь ${userId} не состоит в группе ${groupId}`);
        return;
      }
      const { encrypt } = require("./utils/encryption");
      const newMessage = await GroupMessage.create({
        groupId,
        userId,
        text: encrypt(text || ""),
        replyToId: replyToId || null,
      });
      messagesTotal.inc({ chat_type: "group" });
      io.to(`group_${groupId}`).emit("groupMessageReceived", {
        id: newMessage.id,
        groupId,
        userId,
        text,
        replyToId: newMessage.replyToId || null,
        createdAt: newMessage.createdAt,
      });
      log(`Message sent to group_${groupId}`);
    } catch (err) {
      console.error("Error in sendGroupMessage:", err);
    }
  });

  socket.on("joinChannel", ({ channelId, userId }) => {
    if (resolveActor(socket, userId) === null) return; // входишь как сам себя
    socket.join(`channel_${channelId}`);
    log(`User ${userId} joined room: channel_${channelId}`);
  });

  socket.on("messagesRead", async ({ readerId, partnerId, unreadCount }) => {
    try {
      if (resolveActor(socket, readerId) === null) return; // отмечаешь прочитанным за себя
      log(`Messages read by ${readerId} for partner ${partnerId}`);

      const reader = await User.findByPk(readerId, {
        attributes: ["ghostMode", "readReceiptSetting"],
      });
      if (reader && (reader.ghostMode || reader.readReceiptSetting === "nobody")) {
        console.log(`Read receipts disabled for user ${readerId}, skipping read receipt emission`);
        return;
      }

      const roomName = `chat_${Math.min(readerId, partnerId)}_${Math.max(readerId, partnerId)}`;

      io.to(roomName).emit("messagesReadByRecipient", {
        readerId,
        partnerId,
        unreadCount: 0,
      });

      io.to(`user_${readerId}`).emit("messagesReadByRecipient", {
        readerId,
        partnerId,
        unreadCount: 0,
      });

      io.to(`user_${partnerId}`).emit("messagesReadByRecipient", {
        readerId,
        partnerId,
        unreadCount: 0,
      });

      console.log(`Emitted messagesReadByRecipient to room ${roomName} and users`);
    } catch (err) {
      console.error("Error in messagesRead socket handler:", err);
    }
  });

  // Получатель подтвердил, что сообщение дошло до его устройства.
  // Помечаем isDelivered и сообщаем ОТПРАВИТЕЛЮ (для галочек ✓✓).
  socket.on("messageDelivered", async ({ messageId }) => {
    try {
      const message = await Message.findByPk(messageId);
      if (!message) return;
      // Подтвердить доставку может только получатель (анти-спуфинг в строгом режиме).
      if (ENFORCE && Number(socket.authUserId) !== Number(message.toUserId)) return;
      if (!message.isDelivered) {
        await message.update({ isDelivered: true, deliveredAt: new Date() });
      }
      io.to(`user_${message.fromUserId}`).emit("messageStatus", {
        messageId: message.id,
        partnerId: message.toUserId,
        status: "delivered",
      });
    } catch (err) {
      console.error("Error in messageDelivered handler:", err);
    }
  });

  // Обработчик явного выхода (logout)
  socket.on("logout", async ({ userId }) => {
    try {
      if (resolveActor(socket, userId) === null) return; // разлогинить можно только себя
      log("User logging out:", userId);
      await setUserOffline(userId);
      
      // Проверяем ghostMode пользователя
      const user = await User.findByPk(userId, {
        attributes: ["id", "ghostMode"],
      });
      
      // Уведомляем других пользователей только если ghostMode выключен
      if (!user || !user.ghostMode) {
        socket.broadcast.emit("userOffline", { userId });
        await publishSocketEvent("status", "userOffline", { userId });
      }
    } catch (err) {
      console.error("Error in logout handler:", err);
    }
  });

  socket.on("disconnect", async () => {
    console.log("User disconnected:", socket.id);
    if (currentUserId) {
      try {
        await setUserOffline(currentUserId);

        // Проверяем ghostMode пользователя
        const user = await User.findByPk(currentUserId, {
          attributes: ["id", "ghostMode"],
        });

        // Сохраняем lastSeen в БД
        await User.update({ lastSeen: new Date() }, { where: { id: currentUserId } });

        // Уведомляем других пользователей только если ghostMode выключен
        // (хотя если был ghostMode, то userOnline не отправлялся, но для консистентности проверяем)
        if (!user || !user.ghostMode) {
          socket.broadcast.emit("userOffline", { userId: currentUserId });
          await publishSocketEvent("status", "userOffline", { userId: currentUserId });
        }
      } catch (err) {
        console.error("Error setting user offline:", err);
      }
    }
    socketConnectionsActive.dec();
  });
});

// При запуске нескольких процессов (PM2 cluster/fork) схему БД должен
// менять ТОЛЬКО один из них, иначе несколько одновременных ALTER TABLE
// вызовут блокировки и ошибки. PM2 задаёт NODE_APP_INSTANCE: "0" — первый
// процесс. Если переменной нет (одиночный запуск), считаем себя первым.
const isPrimaryInstance =
  process.env.NODE_APP_INSTANCE === undefined ||
  process.env.NODE_APP_INSTANCE === "0";

sequelize.authenticate()
  .then(() => {
    console.log("Connection has been established successfully.");
    if (isPrimaryInstance) {
      return sequelize.sync({ alter: true });
    }
    console.log("Skipping schema sync on secondary instance.");
    return null;
  })
  .then(async () => {
    if (isPrimaryInstance) {
      console.log("All models were synchronized successfully.");
      // Auto-create superadmin on first run if none exists
      const ADMIN_KEY = process.env.ADMIN_KEY;
      if (ADMIN_KEY) {
        const existing = await AdminUser.findOne({ where: { role: "superadmin" } }).catch(() => null);
        if (!existing) {
          const hash = await bcrypt.hash(ADMIN_KEY, 12);
          await AdminUser.create({
            username: "superadmin",
            passwordHash: hash,
            role: "superadmin",
            isActive: true,
          });
          console.log("✅ Superadmin created. Login: superadmin / <your ADMIN_KEY>");
          console.log("   You can now remove ADMIN_KEY from .env");
        }
      }
    }
  })
  .catch((err) => {
    console.error("Unable to connect to the database:", err);
  });

// Порт = базовый + номер инстанса PM2. PM2 ВСЕГДА задаёт NODE_APP_INSTANCE
// (0,1,2,3...), поэтому инстансы слушают 3000,3001,3002,3003 без зависимости
// от капризного increment_var. nginx (upstream) ожидает именно эти порты.
const BASE_PORT = Number(process.env.PORT) || 3000;
const INSTANCE = Number(process.env.NODE_APP_INSTANCE) || 0;
const PORT = BASE_PORT + INSTANCE;
server.listen(PORT, () => {
  console.log(`Server started on port ${PORT} (instance ${INSTANCE})`);
});
