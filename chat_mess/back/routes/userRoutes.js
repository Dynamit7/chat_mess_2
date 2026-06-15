const express = require('express');
const router = express.Router();
const { User, Chat, BlockedUser } = require('../models');
const multer = require('multer');
const Sequelize = require('sequelize');
const { uploadToMinio, generatePresignedUrl } = require('../utils/minioClient');
const { deleteCache, invalidateUserProfile } = require('../utils/redisClient');

const storage = multer.memoryStorage();

const upload = multer({ 
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, 
  }
});

router.get('/search', async (req, res) => {
  try {
    const { nickname, requesterId } = req.query;
    if (!nickname || nickname.length < 1) {
      return res.json([]);
    }
    const users = await User.findAll({
      where: {
        [Sequelize.Op.or]: [
          { nickname: { [Sequelize.Op.iLike]: `%${nickname}%` } },
          { username: { [Sequelize.Op.iLike]: `%${nickname}%` } },
        ],
      },
      attributes: ['id', 'username', 'nickname', 'email', 'avatar', 'profileVisibility', 'photoVisibility'],
    });

    if (!requesterId) {
      // No requester — return basic data without visibility settings
      return res.json(users.map(u => ({
        id: u.id, username: u.username, nickname: u.nickname, email: u.email, avatar: u.avatar,
      })));
    }

    // Get friend IDs for the requester
    const friendChats = await Chat.findAll({
      where: { userId: Number(requesterId), status: 1 },
      attributes: ['partnerId'],
    });
    const friendIds = new Set(friendChats.map(c => c.partnerId));

    const filtered = users
      .filter(user => {
        if (user.id === Number(requesterId)) return true;
        if (user.profileVisibility === 'Никто') return false;
        if (user.profileVisibility === 'Только друзья' && !friendIds.has(user.id)) return false;
        return true;
      })
      .map(user => {
        const isSelf = user.id === Number(requesterId);
        const isFriend = friendIds.has(user.id);
        const showPhoto = isSelf ||
          user.photoVisibility === 'Все' ||
          (user.photoVisibility === 'Только друзья' && isFriend);

        return {
          id: user.id,
          username: user.username,
          nickname: user.nickname,
          email: user.email,
          avatar: showPhoto ? user.avatar : null,
        };
      });

    return res.json(filtered);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Ошибка на сервере' });
  }
});

router.get('/isBlocked', async (req, res) => {
  const { blockerId, blockedId } = req.query;
  if (!blockerId || !blockedId) {
    return res.status(400).json({ error: 'Необходимы оба идентификатора' });
  }
  try {
    const block = await BlockedUser.findOne({ where: { blockerId, blockedId } });
    return res.status(200).json({ isBlocked: !!block });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/blockUser', async (req, res) => {
  const { blockerId, blockedId } = req.body;
  if (!blockerId || !blockedId) {
    return res.status(400).json({ error: 'Необходимы оба идентификатора' });
  }
  try {
    const exists = await BlockedUser.findOne({ where: { blockerId, blockedId } });
    if (exists) {
      return res.status(200).json({ message: 'Пользователь уже заблокирован' });
    }
    const block = await BlockedUser.create({ blockerId, blockedId });
    return res.status(200).json({ message: 'Пользователь заблокирован', block });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/unblockUser', async (req, res) => {
  const { blockerId, blockedId } = req.body;
  if (!blockerId || !blockedId) {
    return res.status(400).json({ error: 'Необходимы оба идентификатора' });
  }
  try {
    const block = await BlockedUser.findOne({ where: { blockerId, blockedId } });
    if (!block) {
      return res.status(404).json({ message: 'Пользователь не заблокирован' });
    }
    await block.destroy();
    return res.status(200).json({ message: 'Пользователь разблокирован' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/blockedUsers', async (req, res) => {
  const { userId } = req.query;
  if (!userId) {
    return res.status(400).json({ error: 'Необходим userId' });
  }
  try {
    const blocks = await BlockedUser.findAll({ where: { blockerId: userId } });
    if (blocks.length === 0) return res.status(200).json([]);
    const blockedIds = blocks.map(b => b.blockedId);
    const users = await User.findAll({
      where: { id: blockedIds },
      attributes: ['id', 'username', 'nickname', 'avatar'],
    });
    return res.status(200).json(users);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.put('/updatePrivacy', async (req, res) => {
  try {
    const { userId, statusVisibility, profileVisibility, photoVisibility } = req.body;
    if (!userId) {
      return res.status(400).json({ error: 'userId обязателен' });
    }
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    if (statusVisibility) user.statusVisibility = statusVisibility;
    if (profileVisibility) user.profileVisibility = profileVisibility;
    if (photoVisibility) user.photoVisibility = photoVisibility;
    await user.save();
    return res.json({ message: 'Настройки обновлены', user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Ошибка на сервере' });
  }
});

router.post('/uploadAvatar', upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Файл не загружен' });
    }
    const fileName = `${Date.now()}-${req.file.originalname}`;
    await uploadToMinio(req.file.buffer, fileName, req.file.mimetype);
    const fileUrl = generatePresignedUrl(fileName);
    return res.json({ url: fileUrl });
  } catch (err) {
    console.error('Ошибка при загрузке аватара:', err);
    return res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.put('/updateProfile', async (req, res) => {
  try {
    const { userId, username, nickname, avatar, bio } = req.body;
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }
    user.username = username;
    user.nickname = nickname;
    if (avatar) {
      user.avatar = avatar;
    }
    if (bio !== undefined) {
      user.bio = bio;
    }
    await user.save();

    // Профиль изменился (username/nickname/avatar) — сбрасываем кэши,
    // чтобы у собеседников сразу обновились имя и аватар в списке чатов,
    // а не через TTL. userbrief используется в горячем пути sendMessage.
    deleteCache(`userbrief:${userId}`).catch(() => {});
    invalidateUserProfile(userId).catch(() => {});

    if (req.io) {
      const chats = await Chat.findAll({
        where: {
          [Sequelize.Op.or]: [{ userId }, { partnerId: userId }]
        }
      });
      chats.forEach(chat => {
        const targetUserId = chat.userId === userId ? chat.partnerId : chat.userId;
        req.io.to(`user_${targetUserId}`).emit('profileUpdated', {
          userId,
          username,
          nickname,
          avatar: user.avatar
        });
      });
      req.io.to(`user_${userId}`).emit('profileUpdated', {
        userId,
        username,
        nickname,
        avatar: user.avatar
      });
    }
    res.json({ message: 'Профиль обновлён', user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// ===== AI Translation (must be before /:userId) =====

// Save OpenAI API key
router.put('/updateApiKey', async (req, res) => {
  const { userId, openaiApiKey } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId обязателен' });
  try {
    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
    user.openaiApiKey = openaiApiKey || null;
    await user.save();
    return res.json({ success: true });
  } catch (err) {
    console.error('Error saving API key:', err);
    return res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Update preferred language & autoTranslate
router.put('/updateTranslationSettings', async (req, res) => {
  const { userId, preferredLanguage, autoTranslate } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId обязателен' });
  try {
    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
    if (preferredLanguage !== undefined) user.preferredLanguage = preferredLanguage;
    if (autoTranslate !== undefined) user.autoTranslate = autoTranslate;
    await user.save();
    return res.json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Translate a message
router.post('/translate', async (req, res) => {
  const { userId, text, targetLang } = req.body;
  if (!userId || !text || !targetLang) {
    return res.status(400).json({ error: 'userId, text и targetLang обязательны' });
  }
  try {
    const user = await User.findByPk(userId, { attributes: ['openaiApiKey'] });
    if (!user || !user.openaiApiKey) {
      return res.status(400).json({ error: 'API ключ не установлен. Добавьте ключ в настройках.' });
    }

    const OpenAI = require('openai');
    const openai = new OpenAI({ apiKey: user.openaiApiKey });

    const LANG_NAMES = {
      en: 'English', es: 'Spanish', fr: 'French', de: 'German', it: 'Italian',
      pt: 'Portuguese', ru: 'Russian', zh: 'Chinese', ja: 'Japanese', ko: 'Korean',
      ar: 'Arabic', hi: 'Hindi', tr: 'Turkish', pl: 'Polish', nl: 'Dutch',
      uk: 'Ukrainian', uz: 'Uzbek',
    };

    const targetName = LANG_NAMES[targetLang] || targetLang;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Translate the following text to ${targetName}. Only output the translation, no explanations.`,
        },
        { role: 'user', content: text },
      ],
      temperature: 0.3,
      max_tokens: Math.min(text.length * 3, 4000),
    });

    const translatedText = response.choices[0]?.message?.content?.trim();
    if (!translatedText) {
      return res.status(500).json({ error: 'Перевод не удался' });
    }

    return res.json({ success: true, translatedText, targetLang });
  } catch (err) {
    console.error('Translation error:', err.message);
    if (err.status === 401 || err.code === 'invalid_api_key') {
      return res.status(401).json({ error: 'Неверный API ключ' });
    }
    return res.status(500).json({ error: err.message || 'Ошибка перевода' });
  }
});

// /:userId routes MUST be last (catch-all param)
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findByPk(userId, {
      attributes: ['id', 'username', 'avatar', 'nickname', 'bio', 'lastSeen'],
    });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    return res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.put("/updateGhostMode", async (req, res) => {
  const { userId, ghostMode } = req.body;
  try {
    const user = await User.findByPk(userId);
    if (user) {
      await user.update({ ghostMode });
      return res.json({ success: true });
    }
    return res.status(404).json({ error: "User not found" });
  } catch (err) {
    console.error("Error updating ghostMode:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// Get API key status
router.get('/:userId/apiKeyStatus', async (req, res) => {
  try {
    const user = await User.findByPk(req.params.userId, {
      attributes: ['openaiApiKey', 'preferredLanguage', 'autoTranslate'],
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.json({
      hasApiKey: !!user.openaiApiKey,
      preferredLanguage: user.preferredLanguage || 'en',
      autoTranslate: user.autoTranslate || false,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

router.get("/:userId/privacy", async (req, res) => {
  try {
    const user = await User.findByPk(req.params.userId, {
      attributes: ["id", "ghostMode", "readReceiptSetting", "statusVisibility", "profileVisibility", "photoVisibility"],
    });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    return res.json({
      ghostMode: user.ghostMode,
      readReceiptSetting: user.readReceiptSetting,
      statusVisibility: user.statusVisibility,
      profileVisibility: user.profileVisibility,
      photoVisibility: user.photoVisibility,
    });
  } catch (err) {
    console.error("Error fetching privacy settings:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

router.put("/updateReadReceipts", async (req, res) => {
  const { userId, readReceiptSetting } = req.body;
  try {
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    await user.update({ readReceiptSetting });
    return res.json({ success: true });
  } catch (err) {
    console.error("Error updating readReceiptSetting:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;