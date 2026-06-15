

const { Sequelize, DataTypes } = require('sequelize');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

// MinIO URL helpers for avatar getter/setter
const _MINIO_PUBLIC_URL = process.env.MINIO_PUBLIC_URL || "http://localhost:9000";
const _MINIO_BUCKET = process.env.MINIO_BUCKET || "my-bucket";

function _resolveAvatar(raw) {
  if (!raw) return null;
  if (raw.startsWith('http') && !raw.includes('X-Amz-')) return raw;
  if (raw.startsWith('http')) {
    try {
      const u = new URL(raw);
      const key = u.pathname.replace(`/${_MINIO_BUCKET}/`, '');
      return `${_MINIO_PUBLIC_URL}/${_MINIO_BUCKET}/${key}`;
    } catch { return raw; }
  }
  return `${_MINIO_PUBLIC_URL}/${_MINIO_BUCKET}/${raw}`;
}

function _extractKey(value) {
  if (!value) return null;
  if (value.startsWith('http')) {
    try {
      const u = new URL(value);
      return u.pathname.replace(`/${_MINIO_BUCKET}/`, '');
    } catch { return value; }
  }
  return value;
}


const connectionString = `postgres://${process.env.DB_USER}:${process.env.DB_PASSWORD}` +
                        `@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;

const sequelize = new Sequelize(connectionString, {
  dialect: 'postgres',
  logging: false,
  // Пул соединений к Postgres. Применяется К КАЖДОМУ процессу PM2.
  // ВАЖНО: при N процессах суммарно открывается до N * pool.max соединений.
  // Postgres по умолчанию max_connections=100. При 4 процессах: 4*20=80 — ОК.
  // Если поднимаете instances в PM2 выше 4-5 — ставьте PgBouncer (transaction
  // pooling) и держите pool.max небольшим, иначе упрётесь в лимит Postgres.
  pool: {
    max: Number(process.env.DB_POOL_MAX) || 20, // макс. соединений на процесс
    min: Number(process.env.DB_POOL_MIN) || 2,  // держим тёплыми
    acquire: 30000, // ждать соединение из пула не более 30с, иначе ошибка
    idle: 10000,    // закрыть простаивающее соединение через 10с
  },
  retry: { max: 2 }, // повтор при кратковременной потере соединения
});


const User = sequelize.define('User', {
  username: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  nickname: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true,
  },
  statusVisibility: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: "Все",
  },
  profileVisibility: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: "Все",
  },
  photoVisibility: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: "Все",
  },
  avatar: {
    type: DataTypes.TEXT,
    allowNull: true,
    get() { return _resolveAvatar(this.getDataValue('avatar')); },
    set(v) { this.setDataValue('avatar', _extractKey(v)); },
  },
  verificationCode: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  verificationCodeExpires: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  ghostMode: { // Новое поле
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  // 2026: Privacy & Preferences
  preferredLanguage: {
    type: DataTypes.STRING(10),
    defaultValue: 'en',
  },
  autoTranslate: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  openaiApiKey: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  moderationWarnings: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  isMuted: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  mutedUntil: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  biometricEnabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  biometricType: {
    type: DataTypes.STRING(20), // 'face_id', 'fingerprint', 'both'
    allowNull: true,
  },
  screenshotNotifyEnabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  readReceiptSetting: {
    type: DataTypes.STRING(20),
    defaultValue: 'everyone', // 'everyone', 'contacts', 'nobody'
  },
  lastSeenSetting: {
    type: DataTypes.STRING(20),
    defaultValue: 'everyone',
  },
  twoFactorEnabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  twoFactorPassword: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  bio: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  lastSeen: {
    type: DataTypes.DATE,
    allowNull: true,
  },
});

const Message = sequelize.define('Message', {
  fromUserId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: User,
      key: 'id',
    },
  },
  toUserId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: User,
      key: 'id',
    },
  },
  text: {
    type: DataTypes.TEXT,  //encrypted message
    allowNull: false,
  },
  type: {
    type: DataTypes.STRING,
    defaultValue: 'text', // text, image, video, file, voice 
  },
  fileUrl: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  filename: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  isRead: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  // Статус доставки: сообщение дошло до устройства получателя (✓✓ серые).
  // isRead — прочитано (✓✓ синие). isDelivered=false + не read = только отправлено (✓).
  isDelivered: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  deliveredAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  isDeleted: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  replyToId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: 'Messages', key: 'id' }
  },
  // Poll attached to a direct message (e.g. a forwarded poll)
  pollId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  // 2026: Disappearing messages
  disappearAfter: {
    type: DataTypes.INTEGER, // Seconds: 3600, 86400, 604800, 2592000
    allowNull: true,
  },
  readAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  isDisappearing: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  isEdited: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  // 2026: Translation
  translatedText: {
    type: DataTypes.JSONB, // { lang: translation }
    allowNull: true,
  },
  detectedLanguage: {
    type: DataTypes.STRING(10),
    allowNull: true,
  },
  // Forward
  forwardedFromType: {
    type: DataTypes.STRING(20),
    allowNull: true,
  },
  forwardedFromId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  forwardedFromUsername: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  latitude: {
    type: DataTypes.DOUBLE,
    allowNull: true,
  },
  longitude: {
    type: DataTypes.DOUBLE,
    allowNull: true,
  },
}, {
  indexes: [
    // Загрузка переписки между двумя пользователями по времени.
    // Запросы идут в обе стороны (from→to и to→from), поэтому держим
    // два зеркальных индекса с createdAt в конце для сортировки/пагинации.
    { fields: ['fromUserId', 'toUserId', 'createdAt'] },
    { fields: ['toUserId', 'fromUserId', 'createdAt'] },
    // Быстрый подсчёт непрочитанных входящих сообщений
    // (Message.count where toUserId + isRead=false).
    { fields: ['toUserId', 'isRead'] },
  ],
});

const Chat = sequelize.define('Chat', {
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: User,
      key: 'id',
    },
  },
  partnerId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: User,
      key: 'id',
    },
  },
  status: { // FRIEND REQUEST 1=ACCEPT, -1=NOT ACCEPT, 0=DEFAULT
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
});



// ----- Группы -----
const Group = sequelize.define('Group', {
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  description: {
    type: DataTypes.STRING,
  },
  isPublic: {
    type: DataTypes.BOOLEAN,
    defaultValue: true, // по умолчанию пусть будет публичная
  },
  inviteLink: {
    type: DataTypes.STRING,
    unique: true,
  },
  ownerId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: User,
      key: 'id',
    },
  },
  avatar: {
    type: DataTypes.TEXT,
    allowNull: true,
    get() { return _resolveAvatar(this.getDataValue('avatar')); },
    set(v) { this.setDataValue('avatar', _extractKey(v)); },
  },
}, {
  indexes: [
    { fields: ['ownerId'] },        // "мои группы" / группы пользователя
  ],
});

const GroupUser = sequelize.define('GroupUser', {
  groupId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Group,
      key: 'id',
    },
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: User,
      key: 'id',
    },
  },
  role: {
    type: DataTypes.STRING,
    defaultValue: 'member', // 'admin', 'member'
  },
  lastSeen:{
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  indexes: [
    { fields: ['userId'] },                  // "мои группы"
    { fields: ['groupId'] },                 // "участники группы"
    { fields: ['groupId', 'userId'] },       // быстрая проверка членства
    // ↑ хотите запрет дублей участников? Сначала удалите дубли в БД,
    //   затем поменяйте на { unique: true, fields: ['groupId','userId'] }.
  ],
});

const GroupMessage = sequelize.define('GroupMessage', {
  groupId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Group,
      key: 'id',
    },
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: User,
      key: 'id',
    },
  },
  text: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  type: {
    type: DataTypes.STRING,
    defaultValue: 'text', // 'text', 'image', 'video', 'audio', 'file'
  },
  fileUrl: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  filename: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  parentMessageId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'GroupMessages',
      key: 'id',
    },
    onDelete: 'CASCADE',
  },
  replyToId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'GroupMessages',
      key: 'id',
    },
    onUpdate: 'CASCADE',
    onDelete: 'SET NULL',
  },

  isDeleted: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
    readBy: {
    type: DataTypes.ARRAY(DataTypes.INTEGER),
    allowNull: true,
    defaultValue: [],
  },
  isEdited: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  // 2026: Disappearing messages
  disappearAfter: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  isDisappearing: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  // Forward
  forwardedFromType: {
    type: DataTypes.STRING(20),
    allowNull: true,
  },
  forwardedFromId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  forwardedFromUsername: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  pollId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
}, {
  indexes: [
    { fields: ['groupId', 'createdAt'] },   // загрузка истории группы (горячий путь)
    { fields: ['parentMessageId'] },        // ответы/треды
    { fields: ['userId'] },                 // сообщения конкретного автора
  ],
});

const BlockedUser = sequelize.define('BlockedUser', {
  blockerId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: User,
      key: 'id'
    }
  },
  blockedId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: User,
      key: 'id'
    }
  },
}, {
  indexes: [
    {
      unique: true,
      fields: ['blockerId', 'blockedId']
    }
  ]
});

const Reaction = sequelize.define('Reaction', {
  messageId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Messages',
      key: 'id',
    },
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id',
    },
  },
  emoji: {
    type: DataTypes.STRING,
    allowNull: false,
  },
}, {
  indexes: [
    { fields: ['messageId'] },                   // реакции сообщения
    { fields: ['messageId', 'userId'] },
  ],
});


// ----- Каналы -----
const Channel = sequelize.define('Channel', {
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  description: {
    type: DataTypes.STRING,
  },
  isPublic: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  inviteLink: {
    type: DataTypes.STRING,
    unique: true,
  },
  ownerId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id',
    },
  },
  avatar: {
    type: DataTypes.STRING,
    allowNull: true,
    get() { return _resolveAvatar(this.getDataValue('avatar')); },
    set(v) { this.setDataValue('avatar', _extractKey(v)); },
  },
}, {
  indexes: [
    { fields: ['ownerId'] },
  ],
});


// ----- Подписчики канала (membership) -----
const ChannelUser = sequelize.define('ChannelUser', {
  channelId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Channel,
      key: 'id',
    },
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id',
    },
  },
  role: {
    type: DataTypes.STRING,
    defaultValue: 'member',
  },
   lastSeen:{
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  indexes: [
    { fields: ['userId'] },                  // "мои каналы"
    { fields: ['channelId'] },               // подписчики канала
    { fields: ['channelId', 'userId'] },     // быстрая проверка подписки
  ],
});






const Story = sequelize.define('Story', {
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  fileUrl: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  type: {
    type: DataTypes.STRING,
    defaultValue: 'image', // или 'video'
  },
  caption: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false,
  },
}, {
  indexes: [
    { fields: ['userId', 'expiresAt'] },    // активные истории пользователя
    { fields: ['expiresAt'] },              // очистка просроченных
  ],
});

const StoryView = sequelize.define('StoryView', {
  storyId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'Stories', key: 'id' },
  },
  viewerId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'Users', key: 'id' },
  },
}, {
  indexes: [
    { fields: ['storyId'] },                 // просмотры истории
    { fields: ['storyId', 'viewerId'] },
  ],
});




// ----- Сообщения канала -----

const ChannelMessage = sequelize.define('ChannelMessage', {
  channelId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Channel,
      key: 'id',
    },
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id',
    },
  },
  text: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  type: {
    type: DataTypes.STRING,
    defaultValue: 'text', 
  },
  fileUrl: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  filename: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  parentMessageId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'ChannelMessages',
      key: 'id',
    },
    onDelete: 'CASCADE',
  },

  isDeleted: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  // Forward
  forwardedFromType: {
    type: DataTypes.STRING(20),
    allowNull: true,
  },
  forwardedFromId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  forwardedFromUsername: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  // Poll attached to a channel post
  pollId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
}, {
  indexes: [
    { fields: ['channelId', 'createdAt'] },  // лента канала (горячий путь)
    { fields: ['parentMessageId'] },         // комментарии к посту
    { fields: ['userId'] },
  ],
});



const ChannelReaction = sequelize.define('ChannelReaction', {
  messageId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'ChannelMessages',
      key: 'id',
    },
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id',
    },
  },
  emoji: {
    type: DataTypes.STRING,
    allowNull: false,
  },
}, {
  indexes: [
    { fields: ['messageId'] },
    { fields: ['messageId', 'userId'] },
  ],
});


const GroupMessageReaction = sequelize.define('GroupMessageReaction', {
  messageId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'GroupMessages', key: 'id' },
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'Users', key: 'id' },
  },
  emoji: {
    type: DataTypes.STRING,
    allowNull: false,
  },
}, {
  indexes: [
    { fields: ['messageId'] },
    { unique: true, fields: ['messageId', 'userId', 'emoji'] },
  ],
});

// ==========================================
// ===== 2026 SECURITY & PRIVACY MODELS =====
// ==========================================

// ----- Disappearing Messages Settings -----
const DisappearingSetting = sequelize.define('DisappearingSetting', {
  chatType: {
    type: DataTypes.STRING(20),
    allowNull: false, // 'direct', 'group', 'channel'
  },
  chatId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  disappearAfter: {
    type: DataTypes.INTEGER, // Seconds: 3600(1h), 86400(24h), 604800(7d), 2592000(30d)
    allowNull: true,
  },
  setByUserId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: 'Users', key: 'id' },
  },
}, {
  indexes: [
    { unique: true, fields: ['chatType', 'chatId'] },
  ],
});

// ----- Screenshot Detection -----
const ScreenshotEvent = sequelize.define('ScreenshotEvent', {
  chatType: {
    type: DataTypes.STRING(20),
    allowNull: false,
  },
  chatId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'Users', key: 'id' },
  },
  deviceType: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  notifiedUsers: {
    type: DataTypes.JSONB,
    defaultValue: [],
  },
});

// ----- Biometric Locks -----
const BiometricLock = sequelize.define('BiometricLock', {
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'Users', key: 'id' },
  },
  chatType: {
    type: DataTypes.STRING(20),
    allowNull: false,
  },
  chatId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  isEnabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  lockOnAppBackground: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  lockAfterSeconds: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  requireBiometricForMedia: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
}, {
  indexes: [
    { unique: true, fields: ['userId', 'chatType', 'chatId'] },
  ],
});

// ----- Secret Chats -----
const SecretChat = sequelize.define('SecretChat', {
  chatType: {
    type: DataTypes.STRING(20),
    allowNull: false,
  },
  originalChatId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'Users', key: 'id' },
  },
  passcodeHash: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  passcodeHint: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  isHidden: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  hideFromSearch: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  hideFromNotifications: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  customName: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  fakeIcon: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  wrongPasscodeAttempts: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  lockoutUntil: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  indexes: [
    { unique: true, fields: ['userId', 'chatType', 'originalChatId'] },
  ],
});

// ----- Read Receipt Privacy -----
const ReadReceiptSetting = sequelize.define('ReadReceiptSetting', {
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true,
    references: { model: 'Users', key: 'id' },
  },
  globalSetting: {
    type: DataTypes.STRING(20),
    defaultValue: 'everyone', // 'everyone', 'contacts', 'nobody'
  },
  showTypingIndicator: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  showOnlineStatus: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
});

const ReadReceiptOverride = sequelize.define('ReadReceiptOverride', {
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'Users', key: 'id' },
  },
  targetUserId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'Users', key: 'id' },
  },
  showReadReceipts: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
  },
  showTypingIndicator: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
  },
  showOnlineStatus: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
  },
}, {
  indexes: [
    { unique: true, fields: ['userId', 'targetUserId'] },
  ],
});

// ----- Anti-Spam System -----
const SpamLog = sequelize.define('SpamLog', {
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'Users', key: 'id' },
  },
  actionType: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  severity: {
    type: DataTypes.STRING(20), // 'low', 'medium', 'high'
    allowNull: true,
  },
  reason: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  metadata: {
    type: DataTypes.JSONB,
    allowNull: true,
  },
});

const UserReputationScore = sequelize.define('UserReputationScore', {
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true,
    references: { model: 'Users', key: 'id' },
  },
  score: {
    type: DataTypes.DECIMAL(5, 2),
    defaultValue: 100.00,
  },
  messagesPerMinute: {
    type: DataTypes.DECIMAL(5, 2),
    defaultValue: 0,
  },
  reportCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  spamFlagCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
});

const SpamPattern = sequelize.define('SpamPattern', {
  patternType: {
    type: DataTypes.STRING(20), // 'regex', 'keyword', 'link'
    allowNull: true,
  },
  pattern: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  severity: {
    type: DataTypes.STRING(20),
    defaultValue: 'medium',
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
});

// ----- Content Moderation -----
const ContentReport = sequelize.define('ContentReport', {
  reporterId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'Users', key: 'id' },
  },
  reportedUserId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'Users', key: 'id' },
  },
  messageId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  groupMessageId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  reason: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  details: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  aiAnalysis: {
    type: DataTypes.JSONB,
    allowNull: true,
  },
  status: {
    type: DataTypes.STRING(20),
    defaultValue: 'pending', // 'pending', 'reviewed', 'actioned', 'dismissed'
  },
  actionTaken: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  reviewedBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
});

const ModerationLog = sequelize.define('ModerationLog', {
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'Users', key: 'id' },
  },
  messageId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  moderationType: {
    type: DataTypes.STRING,
    allowNull: true, // 'text', 'image', 'spam'
  },
  flagged: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  categories: {
    type: DataTypes.JSONB,
    allowNull: true,
  },
  scores: {
    type: DataTypes.JSONB,
    allowNull: true,
  },
  actionTaken: {
    type: DataTypes.STRING,
    allowNull: true,
  },
});

// ==========================================
// ===== 2026 REAL-TIME FEATURES =====
// ==========================================

// ----- Live Location Sharing -----
const LiveLocationSession = sequelize.define('LiveLocationSession', {
  sharerId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'Users', key: 'id' },
  },
  chatType: {
    type: DataTypes.STRING(20),
    allowNull: false,
  },
  chatId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  latitude: {
    type: DataTypes.DECIMAL(10, 8),
    allowNull: true,
  },
  longitude: {
    type: DataTypes.DECIMAL(11, 8),
    allowNull: true,
  },
  altitude: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
  },
  accuracy: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
  },
  heading: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
  },
  speed: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
  },
  duration: {
    type: DataTypes.INTEGER, // minutes
    allowNull: false,
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  lastUpdateAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
});

const LocationHistory = sequelize.define('LocationHistory', {
  sessionId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'LiveLocationSessions', key: 'id' },
  },
  latitude: {
    type: DataTypes.DECIMAL(10, 8),
    allowNull: false,
  },
  longitude: {
    type: DataTypes.DECIMAL(11, 8),
    allowNull: false,
  },
  altitude: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
  },
  accuracy: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
  },
});

// ----- Watch Parties -----
const WatchPartySession = sequelize.define('WatchPartySession', {
  hostId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'Users', key: 'id' },
  },
  chatType: {
    type: DataTypes.STRING(20),
    allowNull: false,
  },
  chatId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  videoUrl: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  videoTitle: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  videoDuration: {
    type: DataTypes.INTEGER, // seconds
    allowNull: true,
  },
  currentTimestamp: {
    type: DataTypes.DECIMAL(10, 3),
    defaultValue: 0,
  },
  playbackState: {
    type: DataTypes.STRING(20),
    defaultValue: 'paused', // 'playing', 'paused', 'buffering'
  },
  playbackSpeed: {
    type: DataTypes.DECIMAL(3, 2),
    defaultValue: 1.00,
  },
  endedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  maxParticipants: {
    type: DataTypes.INTEGER,
    defaultValue: 50,
  },
  settings: {
    type: DataTypes.JSONB,
    defaultValue: {},
  },
});

const WatchPartyParticipant = sequelize.define('WatchPartyParticipant', {
  sessionId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'WatchPartySessions', key: 'id' },
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'Users', key: 'id' },
  },
  leftAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  syncOffset: {
    type: DataTypes.DECIMAL(10, 3),
    defaultValue: 0,
  },
}, {
  indexes: [
    { unique: true, fields: ['sessionId', 'userId'] },
  ],
});

// ----- Screen Sharing -----
const ScreenSharingSession = sequelize.define('ScreenSharingSession', {
  callId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  sharerId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'Users', key: 'id' },
  },
  chatType: {
    type: DataTypes.STRING(20),
    allowNull: false,
  },
  chatId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  streamType: {
    type: DataTypes.STRING(20),
    defaultValue: 'screen', // 'screen', 'window', 'tab'
  },
  resolution: {
    type: DataTypes.STRING(20),
    allowNull: true,
  },
  frameRate: {
    type: DataTypes.INTEGER,
    defaultValue: 30,
  },
  withAudio: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  endedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
});

const ScreenAnnotation = sequelize.define('ScreenAnnotation', {
  sessionId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'ScreenSharingSessions', key: 'id' },
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'Users', key: 'id' },
  },
  annotationType: {
    type: DataTypes.STRING(20),
    allowNull: false, // 'draw', 'arrow', 'text', 'highlight', 'pointer'
  },
  color: {
    type: DataTypes.STRING(20),
    defaultValue: '#FF0000',
  },
  strokeWidth: {
    type: DataTypes.INTEGER,
    defaultValue: 3,
  },
  pathData: {
    type: DataTypes.JSONB,
    allowNull: true,
  },
  text: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  position: {
    type: DataTypes.JSONB,
    allowNull: true,
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  isVisible: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
});

// ==========================================
// ===== 2026 AI FEATURES =====
// ==========================================

// ----- AI Translation Cache -----
const TranslationCache = sequelize.define('TranslationCache', {
  messageHash: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  sourceLanguage: {
    type: DataTypes.STRING(10),
    allowNull: false,
  },
  targetLanguage: {
    type: DataTypes.STRING(10),
    allowNull: false,
  },
  translatedText: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
}, {
  indexes: [
    { unique: true, fields: ['messageHash', 'sourceLanguage', 'targetLanguage'] },
  ],
});

// ----- Conversation Summaries -----
const ConversationSummary = sequelize.define('ConversationSummary', {
  chatId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  groupId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  channelId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'Users', key: 'id' },
  },
  summary: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  keyPoints: {
    type: DataTypes.JSONB,
    allowNull: true,
  },
  actionItems: {
    type: DataTypes.JSONB,
    allowNull: true,
  },
  messageRange: {
    type: DataTypes.JSONB,
    allowNull: true, // { fromId, toId, count }
  },
});

// ----- Generated Stickers -----
const GeneratedSticker = sequelize.define('GeneratedSticker', {
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'Users', key: 'id' },
  },
  prompt: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  style: {
    type: DataTypes.STRING,
    allowNull: true, // 'cartoon', 'anime', 'realistic', 'pixel'
  },
  imageUrl: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  savedToPackId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: 'StickerPacks', key: 'id' },
  },
  isPublic: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
});

// ==========================================
// ===== NEW MODELS FOR SUPER-APP 2026 =====
// ==========================================

// ----- User Following System -----
const UserFollow = sequelize.define('UserFollow', {
  followerId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'Users', key: 'id' },
  },
  followingId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'Users', key: 'id' },
  },
}, {
  indexes: [
    { unique: true, fields: ['followerId', 'followingId'] },
  ],
});

// ----- Reels/Shorts System -----
const ReelMusic = sequelize.define('ReelMusic', {
  title: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  artist: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  audioUrl: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  duration: {
    type: DataTypes.INTEGER, // in seconds
    allowNull: true,
  },
  thumbnailUrl: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  usageCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
});

const Reel = sequelize.define('Reel', {
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'Users', key: 'id' },
  },
  videoUrl: {
    type: DataTypes.TEXT,
    allowNull: true, // null for text-only posts
  },
  mediaType: {
    type: DataTypes.STRING,
    defaultValue: 'video', // 'video' | 'image' | 'text'
  },
  thumbnailUrl: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  caption: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  musicId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: 'ReelMusics', key: 'id' },
  },
  duration: {
    type: DataTypes.INTEGER, // in seconds
    allowNull: true,
  },
  width: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  height: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  viewsCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  likesCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  commentsCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  sharesCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  isPublic: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  hashtags: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    defaultValue: [],
  },
  isDeleted: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
});

const ReelLike = sequelize.define('ReelLike', {
  reelId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'Reels', key: 'id' },
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'Users', key: 'id' },
  },
}, {
  indexes: [
    { unique: true, fields: ['reelId', 'userId'] },
  ],
});

const ReelComment = sequelize.define('ReelComment', {
  reelId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'Reels', key: 'id' },
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'Users', key: 'id' },
  },
  text: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  parentCommentId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: 'ReelComments', key: 'id' },
  },
  likesCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  isDeleted: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
});

const ReelView = sequelize.define('ReelView', {
  reelId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'Reels', key: 'id' },
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: true, // Can be null for anonymous views
    references: { model: 'Users', key: 'id' },
  },
  watchDuration: {
    type: DataTypes.INTEGER, // in seconds
    allowNull: true,
  },
  completedWatch: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
});

const ReelHashtag = sequelize.define('ReelHashtag', {
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  usageCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
});

// ----- Stickers System -----
const StickerPack = sequelize.define('StickerPack', {
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  thumbnailUrl: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  authorId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: 'Users', key: 'id' },
  },
  isAnimated: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  isOfficial: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  installCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
});

const Sticker = sequelize.define('Sticker', {
  packId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'StickerPacks', key: 'id' },
  },
  imageUrl: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  emoji: {
    type: DataTypes.STRING,
    allowNull: true, // Associated emoji for search
  },
  orderIndex: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
});

const UserStickerPack = sequelize.define('UserStickerPack', {
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'Users', key: 'id' },
  },
  packId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'StickerPacks', key: 'id' },
  },
  orderIndex: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
}, {
  indexes: [
    { unique: true, fields: ['userId', 'packId'] },
  ],
});

// ----- Polls System -----
const Poll = sequelize.define('Poll', {
  messageId: {
    type: DataTypes.INTEGER,
    allowNull: true, // Can be in message, group message, or channel message
  },
  groupMessageId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  channelMessageId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  creatorId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'Users', key: 'id' },
  },
  question: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  chatId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  groupId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  channelId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  isMultipleChoice: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  allowMultipleAnswers: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  isAnonymous: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  isQuiz: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  correctOptionIndex: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  explanation: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  isClosed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  totalVotes: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
});

const PollOption = sequelize.define('PollOption', {
  pollId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'Polls', key: 'id' },
  },
  order: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  text: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  orderIndex: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  votesCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
});

const PollVote = sequelize.define('PollVote', {
  pollId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'Polls', key: 'id' },
  },
  optionId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'PollOptions', key: 'id' },
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'Users', key: 'id' },
  },
}, {
  indexes: [
    { unique: true, fields: ['pollId', 'optionId', 'userId'] },
  ],
});

// ----- Chat Folders System -----
const ChatFolder = sequelize.define('ChatFolder', {
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'Users', key: 'id' },
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  iconName: {
    type: DataTypes.STRING,
    defaultValue: 'folder',
  },
  iconColor: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  filterType: {
    type: DataTypes.STRING,
    defaultValue: 'manual', // 'manual', 'unread', 'groups', 'channels', 'bots'
  },
  orderIndex: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
});

const ChatFolderMember = sequelize.define('ChatFolderMember', {
  folderId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'ChatFolders', key: 'id' },
  },
  chatId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  groupId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  channelId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  chatType: {
    type: DataTypes.STRING, // 'direct', 'group', 'channel'
    allowNull: false,
  },
});

// ----- AI Conversations -----
const AIConversation = sequelize.define('AIConversation', {
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'Users', key: 'id' },
  },
  title: {
    type: DataTypes.STRING,
    defaultValue: 'New Conversation',
  },
  model: {
    type: DataTypes.STRING,
    defaultValue: 'gpt-4', // 'gpt-4', 'claude-3', etc.
  },
  systemPrompt: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  totalTokens: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  isArchived: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
});

const AIMessage = sequelize.define('AIMessage', {
  conversationId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'AIConversations', key: 'id' },
  },
  role: {
    type: DataTypes.STRING, // 'user', 'assistant', 'system'
    allowNull: false,
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  tokensUsed: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  metadata: {
    type: DataTypes.JSONB,
    allowNull: true, // For storing additional info like image URLs, etc.
  },
});

// ----- Scheduled Messages -----
const ScheduledMessage = sequelize.define('ScheduledMessage', {
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'Users', key: 'id' },
  },
  chatId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  groupId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  channelId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  text: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  type: {
    type: DataTypes.STRING,
    defaultValue: 'text',
  },
  fileUrl: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  scheduledAt: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  isSent: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  sentAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
});

// ==========================================
// ===== ASSOCIATIONS FOR NEW MODELS =====
// ==========================================

// UserFollow associations
UserFollow.belongsTo(User, { foreignKey: 'followerId', as: 'follower' });
UserFollow.belongsTo(User, { foreignKey: 'followingId', as: 'following' });
User.hasMany(UserFollow, { foreignKey: 'followerId', as: 'followings' });
User.hasMany(UserFollow, { foreignKey: 'followingId', as: 'followers' });

// Reel associations
Reel.belongsTo(User, { foreignKey: 'userId', as: 'creator' });
Reel.belongsTo(ReelMusic, { foreignKey: 'musicId', as: 'music' });
User.hasMany(Reel, { foreignKey: 'userId', as: 'reels' });
ReelMusic.hasMany(Reel, { foreignKey: 'musicId', as: 'reels' });

ReelLike.belongsTo(Reel, { foreignKey: 'reelId', as: 'reel' });
ReelLike.belongsTo(User, { foreignKey: 'userId', as: 'user' });
Reel.hasMany(ReelLike, { foreignKey: 'reelId', as: 'likes' });

ReelComment.belongsTo(Reel, { foreignKey: 'reelId', as: 'reel' });
ReelComment.belongsTo(User, { foreignKey: 'userId', as: 'author' });
ReelComment.belongsTo(ReelComment, { foreignKey: 'parentCommentId', as: 'parentComment' });
ReelComment.hasMany(ReelComment, { foreignKey: 'parentCommentId', as: 'replies' });
Reel.hasMany(ReelComment, { foreignKey: 'reelId', as: 'comments' });

ReelView.belongsTo(Reel, { foreignKey: 'reelId', as: 'reel' });
ReelView.belongsTo(User, { foreignKey: 'userId', as: 'viewer' });
Reel.hasMany(ReelView, { foreignKey: 'reelId', as: 'views' });

// Sticker associations
Sticker.belongsTo(StickerPack, { foreignKey: 'packId', as: 'pack' });
StickerPack.hasMany(Sticker, { foreignKey: 'packId', as: 'stickers' });
StickerPack.belongsTo(User, { foreignKey: 'authorId', as: 'author' });

UserStickerPack.belongsTo(User, { foreignKey: 'userId', as: 'user' });
UserStickerPack.belongsTo(StickerPack, { foreignKey: 'packId', as: 'pack' });
User.hasMany(UserStickerPack, { foreignKey: 'userId', as: 'installedPacks' });
StickerPack.hasMany(UserStickerPack, { foreignKey: 'packId', as: 'installations' });

// Poll associations
Poll.belongsTo(User, { foreignKey: 'creatorId', as: 'creator' });
Poll.hasMany(PollOption, { foreignKey: 'pollId', as: 'options' });
Poll.belongsTo(GroupMessage, { foreignKey: 'groupMessageId', as: 'groupMessage' });
PollOption.belongsTo(Poll, { foreignKey: 'pollId', as: 'poll' });
PollOption.hasMany(PollVote, { foreignKey: 'optionId', as: 'votes' });
PollVote.belongsTo(Poll, { foreignKey: 'pollId', as: 'poll' });
PollVote.belongsTo(PollOption, { foreignKey: 'optionId', as: 'option' });
PollVote.belongsTo(User, { foreignKey: 'userId', as: 'voter' });

// Chat Folder associations
ChatFolder.belongsTo(User, { foreignKey: 'userId', as: 'user' });
ChatFolder.hasMany(ChatFolderMember, { foreignKey: 'folderId', as: 'members' });
ChatFolderMember.belongsTo(ChatFolder, { foreignKey: 'folderId', as: 'folder' });
User.hasMany(ChatFolder, { foreignKey: 'userId', as: 'folders' });

// AI Conversation associations
AIConversation.belongsTo(User, { foreignKey: 'userId', as: 'user' });
AIConversation.hasMany(AIMessage, { foreignKey: 'conversationId', as: 'messages' });
AIMessage.belongsTo(AIConversation, { foreignKey: 'conversationId', as: 'conversation' });
User.hasMany(AIConversation, { foreignKey: 'userId', as: 'aiConversations' });

// Scheduled Message associations
ScheduledMessage.belongsTo(User, { foreignKey: 'userId', as: 'user' });
User.hasMany(ScheduledMessage, { foreignKey: 'userId', as: 'scheduledMessages' });

// ==========================================

ChannelMessage.hasMany(ChannelReaction, { foreignKey: 'messageId', as: 'reactions' });
ChannelReaction.belongsTo(ChannelMessage, { foreignKey: 'messageId', as: 'message' });
ChannelReaction.belongsTo(User, { foreignKey: 'userId', as: 'user' });

GroupMessage.hasMany(GroupMessageReaction, { foreignKey: 'messageId', as: 'reactions' });
GroupMessageReaction.belongsTo(GroupMessage, { foreignKey: 'messageId', as: 'message' });
GroupMessageReaction.belongsTo(User, { foreignKey: 'userId', as: 'user' });




ChannelMessage.hasMany(ChannelMessage, {
  foreignKey: 'parentMessageId',
  as: 'comments',
});
ChannelMessage.belongsTo(ChannelMessage, {
  foreignKey: 'parentMessageId',
  as: 'parentMessage'
});


// Связи
Channel.belongsTo(User, { foreignKey: 'ownerId', as: 'owner' });
User.hasMany(Channel, { foreignKey: 'ownerId', as: 'ownedChannels' });

Channel.belongsToMany(User, {
  through: ChannelUser,
  foreignKey: 'channelId',
  otherKey: 'userId',
});
User.belongsToMany(Channel, {
  through: ChannelUser,
  foreignKey: 'userId',
  otherKey: 'channelId',
});

Channel.hasMany(ChannelUser, { as: "members", foreignKey: 'channelId' });
ChannelUser.belongsTo(Channel, { foreignKey: 'channelId' });
ChannelUser.belongsTo(User, { foreignKey: "userId", as: "user" });
User.hasMany(ChannelUser, { foreignKey: 'userId' });

ChannelMessage.belongsTo(Channel, { foreignKey: 'channelId' });
ChannelMessage.belongsTo(User, { foreignKey: 'userId', as: 'sender' });
Channel.hasMany(ChannelMessage, { foreignKey: 'channelId' });
User.hasMany(ChannelMessage, { foreignKey: 'userId' });

User.hasMany(Message, { foreignKey: 'fromUserId', as: 'sentMessages' });
User.hasMany(Message, { foreignKey: 'toUserId', as: 'receivedMessages' });
Message.belongsTo(User, { foreignKey: 'fromUserId', as: 'sender' });
Message.belongsTo(User, { foreignKey: 'toUserId', as: 'receiver' });

Message.belongsTo(Message, { foreignKey: 'replyToId', as: 'replyTo' });

Message.hasMany(Message, {
  foreignKey: 'replyToId',
  as: 'replies',
});


User.hasMany(Chat, { foreignKey: 'userId', as: 'chats' });
User.hasMany(Chat, { foreignKey: 'partnerId', as: 'partners' });
Chat.belongsTo(User, { foreignKey: 'userId', as: 'user' });
Chat.belongsTo(User, { foreignKey: 'partnerId', as: 'partner' });

Group.belongsTo(User, { foreignKey: 'ownerId', as: 'owner' });
User.hasMany(Group, { foreignKey: 'ownerId', as: 'ownedGroups' });

Group.belongsToMany(User, {
  through: GroupUser,
  foreignKey: 'groupId',
  otherKey: 'userId',
});
User.belongsToMany(Group, {
  through: GroupUser,
  foreignKey: 'userId',
  otherKey: 'groupId',
});

Group.hasMany(GroupUser, {
  as: 'members',
  foreignKey: 'groupId',
});
GroupUser.belongsTo(Group, { foreignKey: 'groupId' });

GroupUser.belongsTo(User, { foreignKey: 'userId', as: 'user' });
User.hasMany(GroupUser, { foreignKey: 'userId' });

GroupMessage.belongsTo(Group, { foreignKey: 'groupId' });
GroupMessage.belongsTo(User, { foreignKey: 'userId', as: 'sender' });
Group.hasMany(GroupMessage, { foreignKey: 'groupId' });
User.hasMany(GroupMessage, { foreignKey: 'userId' });

Message.hasMany(Reaction, { foreignKey: 'messageId', as: 'reactions' });
Reaction.belongsTo(Message, { foreignKey: 'messageId', as: 'message' });
Reaction.belongsTo(User, { foreignKey: 'userId', as: 'user' });



GroupMessage.belongsTo(GroupMessage, { 
  as: 'repliedMessage', 
  foreignKey: 'replyToId' 
});


Story.belongsTo(User, { foreignKey: 'userId', as: 'owner' });
User.hasMany(Story, { foreignKey: 'userId', as: 'stories' });

StoryView.belongsTo(Story, { foreignKey: 'storyId', as: 'story' });
StoryView.belongsTo(User, { foreignKey: 'viewerId', as: 'viewer' });
Story.hasMany(StoryView, { foreignKey: 'storyId', as: 'views' });

if (require.main === module) {
  (async () => {
    try {
      await sequelize.sync({ force: false }); // yoki { alter: true }
      console.log("✅ DB successfully synced.");
    } catch (error) {
      console.error("❌ Sync error:", error);
    }
  })();
}

// ===== ADMIN USERS (super admins with login/password) =====
const AdminUser = sequelize.define('AdminUser', {
  username: {
    type: DataTypes.STRING(64),
    allowNull: false,
    unique: true,
  },
  passwordHash: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  role: {
    type: DataTypes.ENUM('superadmin', 'moderator'),
    defaultValue: 'moderator',
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  lastLoginAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
});

module.exports = {
  // Core
  sequelize,
  AdminUser,
  User,
  Message,
  Chat,

  // Groups
  Group,
  GroupUser,
  GroupMessage,
  GroupMessageReaction,

  // Channels
  Channel,
  ChannelUser,
  ChannelMessage,
  ChannelReaction,

  // Stories
  Story,
  StoryView,

  // Misc
  BlockedUser,
  Reaction,

  // ===== NEW MODELS 2026 =====

  // User Following
  UserFollow,

  // Reels/Shorts
  Reel,
  ReelMusic,
  ReelLike,
  ReelComment,
  ReelView,
  ReelHashtag,

  // Stickers
  StickerPack,
  Sticker,
  UserStickerPack,

  // Polls
  Poll,
  PollOption,
  PollVote,

  // Chat Folders
  ChatFolder,
  ChatFolderMember,

  // AI
  AIConversation,
  AIMessage,

  // Scheduled Messages
  ScheduledMessage,

  // ===== 2026 SECURITY & PRIVACY =====
  DisappearingSetting,
  ScreenshotEvent,
  BiometricLock,
  SecretChat,
  ReadReceiptSetting,
  ReadReceiptOverride,
  SpamLog,
  UserReputationScore,
  SpamPattern,
  ContentReport,
  ModerationLog,

  // ===== 2026 REAL-TIME FEATURES =====
  LiveLocationSession,
  LocationHistory,
  WatchPartySession,
  WatchPartyParticipant,
  ScreenSharingSession,
  ScreenAnnotation,

  // ===== 2026 AI FEATURES =====
  TranslationCache,
  ConversationSummary,
  GeneratedSticker,
};


