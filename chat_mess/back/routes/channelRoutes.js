const express = require("express");
const {
  Channel,
  ChannelUser,
  User,
  ChannelMessage,
  ChannelReaction,
  sequelize,
} = require("../models");
const { v4: uuidv4 } = require("uuid");
const { Op, QueryTypes } = require("sequelize");
const { ENFORCE } = require("../middleware/enforceAuth"); // ownership-проверки (строгий режим)

const { uploadToMinio, generatePresignedUrl, deleteFromMinio } = require("../utils/minioClient");
const { upload } = require("../utils/multerConfig");
const { encrypt, decrypt } = require("../utils/encryption");
const {
  getCachedChannelMessages,
  cacheChannelMessages,
  invalidateChannelMessages,
  getCachedChannelsList,
  cacheChannelsList,
  invalidateChannelsList,
  getCachedChannelMembers,
  cacheChannelMembers,
  invalidateChannelMembers,
} = require("../utils/redisClient");
const { sendPushToUsers, userIdsInRoom, previewBody } = require("../utils/push");

const router = express.Router();

router.get("/:userId/unread-counts", async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId || userId === "null" || isNaN(Number(userId))) {
      return res.status(400).json({ error: "Invalid user ID" });
    }

    const userIdNum = Number(userId);

    const channels = await Channel.findAll({
      include: [
        {
          model: ChannelUser,
          as: "members",
          where: { userId: userIdNum },
          required: false,
        },
      ],
      where: {
        [Op.or]: [{ ownerId: userIdNum }, { "$members.userId$": userIdNum }],
      },
    });
    

    const unreadCounts = await Promise.all(
      channels.map(async (channel) => {
        const lastSeen = await ChannelUser.findOne({
          where: { channelId: channel.id, userId: userIdNum },
          attributes: ["lastSeen"],
        });

        const lastSeenDate = lastSeen ? lastSeen.lastSeen : new Date(0);

        const unreadCount = await ChannelMessage.count({
          where: {
            channelId: channel.id,
            parentMessageId: null,
            createdAt: { [Op.gt]: lastSeenDate },
            isDeleted: false,
            userId: { [Op.ne]: userIdNum },
          },
        });

        return { channelId: channel.id, unreadCount };
      })
    );

    return res.json(unreadCounts);
  } catch (err) {
    console.error("Ошибка при загрузке непрочитанных сообщений:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

router.post("/:channelId/message", upload.single("file"), async (req, res) => {
  try {
    const { channelId } = req.params;
    const { userId, text, replyToId, parentMessageId } = req.body;
    const replyId = replyToId || parentMessageId || null;

    if (!userId || userId === "null" || isNaN(Number(userId))) {
      return res.status(400).json({ error: "Invalid user ID" });
    }

    const userIdNum = Number(userId);
    const channel = await Channel.findByPk(channelId);
    if (!channel) {
      return res.status(404).json({ error: "Канал не найден" });
    }

    const channelUser = await ChannelUser.findOne({
      where: { channelId, userId: userIdNum },
    });
    // В КАНАЛ публикует ТОЛЬКО владелец или администратор. Подписчики
    // (role: 'member') могут лишь читать и комментировать — как в Telegram.
    // Раньше тут пропускался любой участник, поэтому в канал мог писать кто угодно.
    const isOwner = channel.ownerId == userIdNum;
    const isAdmin = channelUser && channelUser.role === "admin";
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: "Публиковать в канал может только владелец или администратор" });
    }

    let fileUrl = null;
    let filename = null;
    let type = "text";

    if (req.file) {
      const fileName = `${Date.now()}-${req.file.originalname}`;
      await uploadToMinio(req.file.buffer, fileName, req.file.mimetype);
      fileUrl = generatePresignedUrl(fileName);
      filename = req.file.originalname;
      if (req.file.mimetype.startsWith("image/")) {
        type = "image";
      } else if (req.file.mimetype.startsWith("video/")) {
        type = "video";
      } else if (req.file.mimetype.startsWith("audio/")) {
        type = "audio";
      } else {
        type = "file";
      }
    }

    const message = await ChannelMessage.create({
      channelId,
      userId: userIdNum,
      text: encrypt(text || ""),
      fileUrl,
      filename,
      type,
      parentMessageId: replyId,
    });

    const sender = await User.findByPk(userIdNum, {
      attributes: ["id", "username"],
    });

    const messageWithDecryptedText = message.get({ plain: true });
    messageWithDecryptedText.text = text ? decrypt(message.text) : null;
    messageWithDecryptedText.sender = sender;

    const members = await ChannelUser.findAll({
      where: { channelId },
      attributes: ["userId"],
    });
    const memberIds = members.map((m) => m.userId);
    memberIds.forEach((mId) => {
      req.io.to(`user_${mId}`).emit("channelMessageReceived", {
        id: message.id,
        channelId,
        userId: userIdNum,
        text: messageWithDecryptedText.text,
        fileUrl,
        filename,
        type,
        parentMessageId: replyId,
        createdAt: message.createdAt,
        sender: { id: sender.id, username: sender.username },
      });
    });

    req.io.to(`channel_${channelId}`).emit("channelMessageReceived", messageWithDecryptedText);

    // Push subscribers who aren't currently viewing this channel (Telegram-style):
    // skip the author and anyone in the `channel_<id>` room.
    try {
      const viewing = await userIdsInRoom(req.io, `channel_${channelId}`);
      const targets = memberIds.filter(
        (id) => Number(id) !== userIdNum && !viewing.has(Number(id))
      );
      if (targets.length) {
        sendPushToUsers(targets, {
          title: channel?.name || "Channel",
          body: previewBody(sender?.username, type, messageWithDecryptedText.text),
          data: { type: "channelMessage", channelId: Number(channelId), channelName: channel?.name || "" },
        }).catch(() => {});
      }
    } catch (pushErr) {
      console.error("Channel push error:", pushErr);
    }

    // Инвалидируем кэш сообщений и список каналов для всех участников
    await invalidateChannelMessages(channelId);
    const allChannelMemberIds = [userIdNum, ...memberIds];
    allChannelMemberIds.forEach((mId) => invalidateChannelsList(mId));

    return res.json(messageWithDecryptedText);
  } catch (err) {
    console.error("Ошибка при отправке сообщения:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

router.post("/:channelId/update-last-seen", async (req, res) => {
  try {
    const { channelId } = req.params;
    const { userId } = req.body;

    if (!userId || userId === "null" || isNaN(Number(userId))) {
      return res.status(400).json({ error: "Invalid user ID" });
    }

    const userIdNum = Number(userId);
    const channel = await Channel.findByPk(channelId);
    if (!channel) {
      return res.status(404).json({ error: "Channel not found" });
    }

    const channelUser = await ChannelUser.findOne({
      where: { channelId, userId: userIdNum },
    });
    if (!channelUser && channel.ownerId != userIdNum) {
      return res.status(403).json({ error: "User is not a member of this channel" });
    }

    if (channelUser) {
      await channelUser.update({ lastSeen: new Date() });
    }
    return res.json({ message: "lastSeen updated" });
  } catch (err) {
    console.error("Error updating lastSeen:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

router.post("/", (req, res) => {
  upload.single("avatar")(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });

    try {
      const { userId, name, description, isPublic, members } = req.body;
      const membersArray = JSON.parse(members || "[]");
      let avatar = null;

      if (req.file) {
        const fileName = `${Date.now()}-${req.file.originalname}`;
        await uploadToMinio(req.file.buffer, fileName, req.file.mimetype);
        avatar = generatePresignedUrl(fileName);
      }

      const newChannel = await Channel.create({
        name,
        description,
        isPublic,
        inviteLink: uuidv4(),
        ownerId: userId,
        avatar,
        images: avatar ? [avatar] : [],
      });

      await ChannelUser.create({
        channelId: newChannel.id,
        userId,
        role: "admin",
      });

      if (Array.isArray(membersArray)) {
        await Promise.all(
          membersArray.map(async (memberId) => {
            if (String(memberId) !== String(userId)) {
              await ChannelUser.findOrCreate({
                where: { channelId: newChannel.id, userId: memberId },
                defaults: { role: "member" },
              });
            }
          })
        );
      }

      const allMembers = [Number(userId), ...membersArray.map(Number)];
      const channelPlain = newChannel.get({ plain: true });
      channelPlain.members = allMembers;

      // Инвалидируем кэш ПЕРЕД эмитом: иначе клиент по событию channelCreated
      // успеет перезагрузить список и прочитать ещё не сброшенный кэш.
      await Promise.all(allMembers.map((mId) => invalidateChannelsList(mId)));
      allMembers.forEach((mId) => {
        req.io.to(`user_${mId}`).emit("channelCreated", channelPlain);
      });

      return res.json(newChannel);
    } catch (err) {
      console.error("Ошибка при создании канала:", err);
      return res.status(500).json({ error: "Server error" });
    }
  });
});

router.get("/", async (req, res) => {
  try {
    const { search, userId } = req.query;
    
    // Проверяем кэш
    if (userId) {
      const cachedChannels = await getCachedChannelsList(userId, search);
      if (cachedChannels) {
        return res.json(cachedChannels);
      }
    }
    
    let whereClause = {};

    if (userId) {
      if (!search) {
        whereClause = {
          [Op.or]: [{ ownerId: userId }, { "$members.userId$": userId }],
        };
      } else {
        whereClause = {
          name: { [Op.like]: `%${search}%` },
          [Op.or]: [
            { isPublic: true },
            { ownerId: userId },
            { "$members.userId$": userId },
          ],
        };
      }
    } else {
      whereClause = { isPublic: true };
      if (search) {
        whereClause.name = { [Op.like]: `%${search}%` };
      }
    }

    const channels = await Channel.findAll({
      where: whereClause,
      include: [
        {
          model: ChannelUser,
          as: "members",
          required: false,
        },
      ],
    });

    // Последнее сообщение для ВСЕХ каналов одним запросом (вместо N запросов
    // ChannelMessage.findOne в цикле — N+1). DISTINCT ON + индекс
    // (channelId, createdAt) делает это быстрым.
    const channelIds = channels.map((c) => c.id);
    const lastMsgByChannel = {};
    if (channelIds.length) {
      const rows = await sequelize.query(
        `SELECT DISTINCT ON (cm."channelId")
                cm."channelId", cm."text", cm."type", cm."createdAt",
                cm."forwardedFromType"
           FROM "ChannelMessages" cm
          WHERE cm."channelId" IN (:channelIds) AND cm."isDeleted" = false
          ORDER BY cm."channelId", cm."createdAt" DESC`,
        {
          replacements: { channelIds },
          type: QueryTypes.SELECT,
        }
      );
      for (const r of rows) lastMsgByChannel[r.channelId] = r;
    }

    const result = channels.map((c) => {
      const plain = c.get({ plain: true });
      const isMember = userId
        ? plain.members.some((m) => m.userId == userId)
        : false;
      const membersCount = plain.members ? plain.members.length : 0;

      let lastMessageText = "";
      let lastMessageTime = "";
      let lastMessageType = "text";
      let lastMessageIsForwarded = false;

      const lastMsg = lastMsgByChannel[c.id];
      if (lastMsg) {
        try {
          lastMessageText = decrypt(lastMsg.text) || "";
        } catch (e) {
          lastMessageText = "";
        }
        lastMessageTime = lastMsg.createdAt
          ? new Date(lastMsg.createdAt).toISOString()
          : "";
        lastMessageType = lastMsg.type || "text";
        lastMessageIsForwarded = !!lastMsg.forwardedFromType;
      }

      return {
        ...plain,
        isMember,
        membersCount,
        lastMessage: lastMessageText,
        lastMessageTime,
        lastMessageType,
        lastMessageIsForwarded,
      };
    });

    // Кэшируем результат
    if (userId) {
      await cacheChannelsList(userId, search, result);
    }

    return res.json(result);
  } catch (err) {
    console.error("Ошибка при поиске каналов:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

router.get("/members/:channelId", async (req, res) => {
  try {
    const { channelId } = req.params;

    const channel = await Channel.findByPk(channelId);
    if (!channel) {
      return res.status(404).json({ error: "Канал не найден" });
    }

    // Проверяем кэш
    const cachedMembers = await getCachedChannelMembers(channelId);
    if (cachedMembers) {
      return res.json(cachedMembers);
    }

    const channelUsers = await ChannelUser.findAll({
      where: { channelId },
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "username", "avatar"],
        },
      ],
    });

    // Фильтруем null (удалённые пользователи)
    let members = channelUsers.map((item) => item.user).filter(Boolean);

    // Убеждаемся, что владелец есть в списке (на случай старых каналов)
    const ownerInList = members.some((m) => String(m.id) === String(channel.ownerId));
    if (!ownerInList) {
      const owner = await User.findByPk(channel.ownerId, {
        attributes: ["id", "username", "avatar"],
      });
      if (owner) members = [owner, ...members];
    }

    // Кэшируем результат
    await cacheChannelMembers(channelId, members);

    return res.json(members);
  } catch (err) {
    console.error("Ошибка при получении подписчиков канала:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

router.get("/id/:channelId", async (req, res) => {
  try {
    const { channelId } = req.params;
    const channel = await Channel.findByPk(channelId);
    if (!channel) {
      return res.status(404).json({ error: "Канал не найден" });
    }
    return res.json(channel);
  } catch (err) {
    console.error("Ошибка при получении канала по ID:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

router.get("/:inviteLink", async (req, res) => {
  try {
    const { inviteLink } = req.params;
    const channel = await Channel.findOne({
      where: { inviteLink },
      include: [{ model: User, as: "owner", attributes: ["id", "username"] }],
    });
    if (!channel) {
      return res.status(404).json({ error: "Канал не найден" });
    }
    return res.json(channel);
  } catch (err) {
    console.error("Ошибка при получении канала по inviteLink:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

router.post("/:id/join", async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, addedBy } = req.body;
    const channel = await Channel.findByPk(id);
    if (!channel) {
      return res.status(404).json({ error: "Канал не найден" });
    }
    if (!channel.isPublic) {
      if (!addedBy || Number(addedBy) !== Number(channel.ownerId)) {
        return res
          .status(403)
          .json({
            error: "Это приватный канал, доступ разрешен только владельцем",
          });
      }
    }
    const [membership, created] = await ChannelUser.findOrCreate({
      where: { channelId: id, userId },
      defaults: { role: "member" },
    });
    if (!created) {
      return res
        .status(400)
        .json({ message: "Пользователь уже подписан на канал" });
    }
    req.io
      .to(`user_${userId}`)
      .emit("channelAdded", { channelId: id, channelName: channel.name });
    
    // Инвалидируем кэш списка каналов и участников
    await invalidateChannelsList(userId);
    await invalidateChannelMembers(id);
    
    return res.json({
      message: "Пользователь подписался на канал",
      membership,
    });
  } catch (err) {
    console.error("Ошибка при подписке на канал:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

router.get("/:channelId/messages", async (req, res) => {
  try {
    const { channelId } = req.params;
    const { limit, before } = req.query;

    // Формирует ответный пост с расшифрованным текстом и числом комментариев.
    const formatPost = async (post) => {
      const postData = post.get({ plain: true });
      postData.text = decrypt(post.text);
      postData.commentsCount = await ChannelMessage.count({
        where: { parentMessageId: post.id, isDeleted: false },
      });
      return postData;
    };

    // --- Пагинация (опционально) ------------------------------------------
    // ?limit=N (&before=<postId>) — отдаём последние N постов старше курсора как
    // страницу: { messages, hasMore, nextBefore }. Без параметров — старое
    // поведение (все посты + кэш), чтобы не сломать существующих клиентов.
    if (limit !== undefined) {
      const pageSize = Math.min(Math.max(parseInt(limit, 10) || 40, 1), 100);
      const where = { channelId, parentMessageId: null, isDeleted: false };
      if (before && !isNaN(before)) where.id = { [Op.lt]: parseInt(before, 10) };
      const rows = await ChannelMessage.findAll({
        where,
        order: [["createdAt", "DESC"]],
        limit: pageSize + 1,
        include: [{ model: User, as: "sender", attributes: ["id", "username"] }],
      });
      const hasMore = rows.length > pageSize;
      const page = (hasMore ? rows.slice(0, pageSize) : rows).reverse();
      const messages = [];
      for (const post of page) messages.push(await formatPost(post));
      return res.json({
        messages,
        hasMore,
        nextBefore: page.length ? page[0].id : null,
      });
    }

    // Проверяем кэш
    const cachedMessages = await getCachedChannelMessages(channelId);
    if (cachedMessages) {
      return res.json(cachedMessages);
    }

    const posts = await ChannelMessage.findAll({
      where: {
        channelId,
        parentMessageId: null,
        isDeleted: false,
      },
      order: [["createdAt", "ASC"]],
      include: [{ model: User, as: "sender", attributes: ["id", "username"] }],
    });

    const formattedPosts = [];
    for (let post of posts) formattedPosts.push(await formatPost(post));

    // Кэшируем результат
    await cacheChannelMessages(channelId, formattedPosts);

    return res.json(formattedPosts);
  } catch (err) {
    console.error("Ошибка при загрузке сообщений канала:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

router.get("/:channelId/message/:messageId/comments", async (req, res) => {
  try {
    const { channelId, messageId } = req.params;

    const channel = await Channel.findByPk(channelId);
    if (!channel) {
      return res.status(404).json({ error: "Канал не найден" });
    }
    const parentMessage = await ChannelMessage.findByPk(messageId);
    if (!parentMessage) {
      return res
        .status(404)
        .json({ error: "Сообщение для комментариев не найдено" });
    }

    const comments = await ChannelMessage.findAll({
      where: {
        channelId,
        parentMessageId: messageId,
        isDeleted: false,
      },
      order: [["createdAt", "ASC"]],
      include: [{ model: User, as: "sender", attributes: ["id", "username"] }],
    });

    for (let comment of comments) {
      comment.dataValues.text = decrypt(comment.text);
    }

    return res.json(comments);
  } catch (err) {
    console.error("Ошибка при получении комментариев:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

router.post("/:channelId/message/:messageId/comment", (req, res) => {
  upload.single("file")(req, res, async (err) => {
    if (err) {
      console.error("Ошибка при загрузке файла:", err);
      return res.status(400).json({ error: err.message });
    }
    try {
      const { channelId, messageId } = req.params;
      const { userId, text } = req.body;

      const channel = await Channel.findByPk(channelId);
      if (!channel) {
        return res.status(404).json({ error: "Канал не найден" });
      }
      const parentMessage = await ChannelMessage.findByPk(messageId);
      if (!parentMessage) {
        return res
          .status(404)
          .json({ error: "Сообщение (которое комментируем) не найдено" });
      }

      let messageType = "text";
      let fileUrl = null;
      let filename = null;

      if (req.file) {
        const fileName = `${Date.now()}-${req.file.originalname}`;
        await uploadToMinio(req.file.buffer, fileName, req.file.mimetype);
        fileUrl = generatePresignedUrl(fileName);
        filename = req.file.originalname;
        if (req.file.mimetype.startsWith("image/")) {
          messageType = "image";
        } else if (req.file.mimetype.startsWith("video/")) {
          messageType = "video";
        } else if (req.file.mimetype.startsWith("audio/")) {
          messageType = "audio";
        } else {
          messageType = "file";
        }
      }

      const encryptedText = encrypt(text || "");

      const newComment = await ChannelMessage.create({
        channelId,
        userId,
        text: encryptedText,
        type: messageType,
        fileUrl,
        filename,
        parentMessageId: messageId,
      });

      const sender = await User.findByPk(userId, {
        attributes: ["id", "username"],
      });
      const commentWithSender = newComment.get({ plain: true });
      commentWithSender.text = text || "";
      commentWithSender.sender = sender;

      req.io
        .to(`channel_${channelId}`)
        .emit("channelMessageReceived", commentWithSender);

      // Инвалидируем кэш сообщений канала
      await invalidateChannelMessages(channelId);

      return res.json(commentWithSender);
    } catch (error) {
      console.error("Ошибка при создании комментария:", error);
      return res.status(500).json({ error: "Server error" });
    }
  });
});

router.delete("/:id/leave", async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;
    const channel = await Channel.findByPk(id);
    if (!channel) {
      return res.status(404).json({ error: "Канал не найден" });
    }
    const membership = await ChannelUser.findOne({
      where: { channelId: id, userId },
    });
    if (!membership) {
      return res.status(400).json({ error: "Вы не подписаны на этот канал" });
    }
    await membership.destroy();
    
    // Инвалидируем кэш списка каналов и участников
    await invalidateChannelsList(userId);
    await invalidateChannelMembers(id);
    
    return res.json({ message: "Вы отписались от канала" });
  } catch (err) {
    console.error("Ошибка при отписке от канала:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

router.delete("/:channelId", async (req, res) => {
  try {
    const { channelId } = req.params;
    const { userId } = req.body;
    const channel = await Channel.findByPk(channelId);
    if (!channel) {
      return res.status(404).json({ error: "Канал не найден" });
    }
    if (channel.ownerId != userId) {
      return res
        .status(403)
        .json({ error: "Только владелец может удалять этот канал" });
    }

    if (channel.avatar) {
      const fileName = channel.avatar.split("/").pop();
      try {
        await deleteFromMinio(fileName);
      } catch (err) {
        console.error(`Failed to delete avatar ${fileName} from MinIO:`, err);
      }
    }
    if (channel.images && channel.images.length > 0) {
      for (const image of channel.images) {
        const fileName = image.split("/").pop();
        try {
          await deleteFromMinio(fileName);
        } catch (err) {
          console.error(`Failed to delete image ${fileName} from MinIO:`, err);
        }
      }
    }
    await ChannelUser.destroy({ where: { channelId } });
    await ChannelMessage.destroy({ where: { channelId } });
    await channel.destroy();

    // Инвалидируем все кэши канала
    await invalidateChannelMessages(channelId);
    await invalidateChannelMembers(channelId);
    await invalidateChannelsList(userId);

    return res.json({ message: "Канал удалён" });
  } catch (err) {
    console.error("Ошибка при удалении канала:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

router.delete("/:channelId/members/:memberId", async (req, res) => {
  try {
    const { channelId, memberId } = req.params;
    const { userId } = req.body;
    const channel = await Channel.findByPk(channelId);
    if (!channel) {
      return res.status(404).json({ error: "Канал не найден" });
    }
    if (channel.ownerId != userId) {
      return res
        .status(403)
        .json({ error: "Только владелец может удалять подписчиков" });
    }
    if (Number(userId) === Number(memberId)) {
      return res
        .status(400)
        .json({ error: "Вы не можете удалить самого себя" });
    }
    const member = await ChannelUser.findOne({
      where: { channelId, userId: memberId },
    });
    if (!member) {
      return res.status(404).json({ error: "Подписчик не найден" });
    }
    await member.destroy();
    req.io.to(`user_${memberId}`).emit("channelRemoved", { channelId });
    
    // Инвалидируем кэш участников и списка каналов
    await invalidateChannelMembers(channelId);
    await invalidateChannelsList(memberId);
    
    return res.json({ message: "Подписчик удалён" });
  } catch (err) {
    console.error("Ошибка при удалении подписчика:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

router.put("/:channelId", (req, res) => {
  upload.single("avatar")(req, res, async (err) => {
    if (err) {
      console.error("Ошибка при загрузке файла:", err);
      return res.status(400).json({ error: err.message });
    }
    try {
      const { channelId } = req.params;
      const { name, isPublic, existingImages } = req.body;
      let updatedImages = [];

      if (existingImages) {
        try {
          updatedImages = JSON.parse(existingImages);
        } catch (e) {
          updatedImages = [];
        }
      }

      const channel = await Channel.findByPk(channelId);
      if (!channel) {
        return res.status(404).json({ error: "Канал не найден" });
      }

      if (req.file) {
        const fileName = `${Date.now()}-${req.file.originalname}`;
        await uploadToMinio(req.file.buffer, fileName, req.file.mimetype);
        const newImage = generatePresignedUrl(fileName);
        updatedImages = [newImage, ...updatedImages];
        channel.avatar = newImage;
      }
      channel.name = name || channel.name;
      channel.isPublic = isPublic === "true" || isPublic === true;
      channel.images = updatedImages;
      await channel.save();

      req.io.to(`channel_${channelId}`).emit("channelUpdated", {
        channelId,
        updatedFields: {
          name: channel.name,
          images: updatedImages,
          avatar: channel.avatar,
          isPublic: channel.isPublic,
        },
      });

      // Инвалидируем кэш списка каналов (нужно инвалидировать для всех участников)
      const members = await ChannelUser.findAll({
        where: { channelId },
        attributes: ["userId"],
      });
      for (const member of members) {
        await invalidateChannelsList(member.userId);
      }

      return res.json({
        name: channel.name,
        images: updatedImages,
        avatar: channel.avatar,
        isPublic: channel.isPublic,
      });
    } catch (error) {
      console.error("Ошибка при обновлении канала:", error);
      return res.status(500).json({ error: "Server error" });
    }
  });
});

router.post("/:channelId/message", (req, res) => {
  upload.single("file")(req, res, async (err) => {
    if (err) {
      console.error("Ошибка загрузки файла:", err);
      return res.status(400).json({ error: err.message });
    }

    try {
      const { channelId } = req.params;
      const { userId, text } = req.body;

      const channel = await Channel.findByPk(channelId);
      if (!channel) {
        return res.status(404).json({ error: "Канал не найден" });
      }

      const membership = await ChannelUser.findOne({
        where: { channelId, userId },
      });
      if (!membership) {
        return res.status(403).json({ error: "Вы не состоите в этом канале" });
      }

      let messageType = "text";
      let fileUrl = null;
      let filename = null;

      if (req.file) {
        const fileName = `${Date.now()}-${req.file.originalname}`;
        await uploadToMinio(req.file.buffer, fileName, req.file.mimetype);
        fileUrl = generatePresignedUrl(fileName);
        filename = req.file.originalname;
        if (req.file.mimetype.startsWith("image/")) {
          messageType = "image";
        } else if (req.file.mimetype.startsWith("video/")) {
          messageType = "video";
        } else if (req.file.mimetype.startsWith("audio/")) {
          messageType = "audio";
        } else {
          messageType = "file";
        }
      }

      const encryptedText = encrypt(text || "");

      const newMessage = await ChannelMessage.create({
        channelId,
        userId,
        text: encryptedText,
        type: messageType,
        fileUrl,
        filename,
        parentMessageId: null,
      });

      const sender = await User.findByPk(userId, {
        attributes: ["id", "username"],
      });
      const messageWithSender = newMessage.get({ plain: true });
      messageWithSender.text = text || "";
      messageWithSender.sender = sender;

      req.io
        .to(`channel_${channelId}`)
        .emit("channelMessageReceived", messageWithSender);

      // Инвалидируем кэш сообщений канала
      await invalidateChannelMessages(channelId);

      return res.json(messageWithSender);
    } catch (error) {
      console.error("Ошибка при отправке сообщения:", error);
      return res.status(500).json({ error: error.message || "Server error" });
    }
  });
});

router.delete("/:channelId/messages", async (req, res) => {
  try {
    const { channelId } = req.params;
    const { userId } = req.body;
    // В строгом режиме доверяем id из токена, а не из тела (его можно подделать).
    const actorId = ENFORCE && req.authUserId ? Number(req.authUserId) : userId;
    const channel = await Channel.findByPk(channelId);
    if (!channel) return res.status(404).json({ error: "Канал не найден" });
    if (channel.ownerId != actorId)
      return res.status(403).json({ error: "Нет прав" });

    const messages = await ChannelMessage.findAll({ where: { channelId } });
    for (const message of messages) {
      if (message.fileUrl) {
        const fileName = message.fileUrl.split("/").pop();
        try {
          await deleteFromMinio(fileName);
        } catch (err) {
          console.error(
            `Failed to delete message file ${fileName} from MinIO:`,
            err
          );
        }
      }
    }

    await ChannelMessage.update({ isDeleted: true }, { where: { channelId } });

    req.io.to(`channel_${channelId}`).emit("channelMessagesCleared", {
      channelId,
      clearedBy: userId,
    });

    // Инвалидируем кэш сообщений канала
    await invalidateChannelMessages(channelId);

    return res.json({ message: "Все сообщения очищены (soft delete)" });
  } catch (err) {
    console.error("Ошибка при очистке сообщений:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

router.post("/:channelId/report", async (req, res) => {
  try {
    const { channelId } = req.params;
    const { userId } = req.body;
    console.log(`Пользователь ${userId} пожаловался на канал ${channelId}`);
    return res.json({ message: "Жалоба принята" });
  } catch (err) {
    console.error("Ошибка при отправке жалобы:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

router.delete("/:channelId/message/:messageId", async (req, res) => {
  try {
    const { channelId, messageId } = req.params;
    const { userId } = req.body;

    const channel = await Channel.findByPk(channelId);
    if (!channel) {
      return res.status(404).json({ error: "Канал не найден" });
    }

    const message = await ChannelMessage.findByPk(messageId);
    if (!message) {
      return res.status(404).json({ error: "Сообщение не найдено" });
    }

    // В строгом режиме доверяем id из токена, а не из тела (его можно подделать).
    const actorId = ENFORCE && req.authUserId ? Number(req.authUserId) : userId;
    if (channel.ownerId != actorId && message.userId != actorId) {
      return res
        .status(403)
        .json({ error: "Нет прав для удаления этого сообщения" });
    }

    if (message.fileUrl) {
      const fileName = message.fileUrl.split("/").pop();
      try {
        await deleteFromMinio(fileName);
      } catch (err) {
        console.error(
          `Failed to delete message file ${fileName} from MinIO:`,
          err
        );
      }
    }

    await message.update({ isDeleted: true });

    req.io
      .to(`channel_${channelId}`)
      .emit("channelMessageDeleted", { messageId: String(messageId) });

    // Инвалидируем кэш сообщений канала
    await invalidateChannelMessages(channelId);

    // Находим новое последнее сообщение и уведомляем участников
    const newLastMsg = await ChannelMessage.findOne({
      where: { channelId, isDeleted: false, parentMessageId: null },
      order: [["createdAt", "DESC"]],
      include: [{ model: User, as: "sender", attributes: ["username"] }],
    });

    const members = await ChannelUser.findAll({
      where: { channelId },
      attributes: ["userId", "lastSeen"],
    });

    let lastMessageText = "";
    let lastMessageType = "text";
    let lastMessageTime = "";

    if (newLastMsg) {
      try { lastMessageText = newLastMsg.text ? decrypt(newLastMsg.text) : ""; } catch (_) { lastMessageText = ""; }
      lastMessageType = newLastMsg.type || "text";
      lastMessageTime = newLastMsg.createdAt ? new Date(newLastMsg.createdAt).toISOString() : "";
    }

    // Для каждого участника пересчитываем unread и отправляем обновление
    await Promise.all(members.map(async (member) => {
      const mId = member.userId;
      const lastSeenDate = member.lastSeen || new Date(0);
      const unreadCount = await ChannelMessage.count({
        where: {
          channelId,
          parentMessageId: null,
          createdAt: { [Op.gt]: lastSeenDate },
          isDeleted: false,
          userId: { [Op.ne]: mId },
        },
      });
      req.io.to(`user_${mId}`).emit("channelLastMessageUpdated", {
        channelId,
        lastMessage: lastMessageText,
        lastMessageType,
        lastMessageTime,
        unreadCount,
      });
      invalidateChannelsList(mId);
    }));

    // owner может не быть в members
    if (!members.some((m) => m.userId === channel.ownerId)) {
      req.io.to(`user_${channel.ownerId}`).emit("channelLastMessageUpdated", {
        channelId,
        lastMessage: lastMessageText,
        lastMessageType,
        lastMessageTime,
        unreadCount: 0,
      });
    }

    return res.json({ message: "Сообщение удалено" });
  } catch (err) {
    console.error("Ошибка при удалении сообщения:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

router.delete("/:channelId/message/:messageId/comment/:commentId", async (req, res) => {
  try {
    const { channelId, messageId, commentId } = req.params;
    const { userId } = req.body;

    const channel = await Channel.findByPk(channelId);
    if (!channel) return res.status(404).json({ error: "Канал не найден" });

    const comment = await ChannelMessage.findOne({
      where: { id: commentId, parentMessageId: messageId, channelId },
    });
    if (!comment) return res.status(404).json({ error: "Комментарий не найден" });

    const actorId = ENFORCE && req.authUserId ? Number(req.authUserId) : Number(userId);
    const isOwner = Number(channel.ownerId) === actorId;
    const isAuthor = Number(comment.userId) === actorId;
    if (!isOwner && !isAuthor) {
      return res.status(403).json({ error: "Нет прав для удаления этого комментария" });
    }

    if (comment.fileUrl) {
      const fileName = comment.fileUrl.split("/").pop();
      try { await deleteFromMinio(fileName); } catch {}
    }

    await comment.update({ isDeleted: true });

    req.io.to(`channel_${channelId}`).emit("channelCommentDeleted", {
      channelId: String(channelId),
      messageId: String(messageId),
      commentId: String(commentId),
    });

    await invalidateChannelMessages(channelId);

    return res.json({ message: "Комментарий удалён" });
  } catch (err) {
    console.error("Ошибка при удалении комментария:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

router.delete("/:channelId/message/:messageId/comments", async (req, res) => {
  try {
    const { channelId, messageId } = req.params;
    const { userId } = req.body;

    const channel = await Channel.findByPk(channelId);
    if (!channel) {
      return res.status(404).json({ error: "Канал не найден" });
    }

    if (channel.ownerId != userId) {
      return res
        .status(403)
        .json({ error: "Только владелец может удалять комментарии" });
    }

    const post = await ChannelMessage.findByPk(messageId);
    if (!post) {
      return res.status(404).json({ error: "Пост не найден" });
    }

    const comments = await ChannelMessage.findAll({
      where: { parentMessageId: messageId },
    });
    for (const comment of comments) {
      if (comment.fileUrl) {
        const fileName = comment.fileUrl.split("/").pop();
        try {
          await deleteFromMinio(fileName);
        } catch (err) {
          console.error(
            `Failed to delete comment file ${fileName} from MinIO:`,
            err
          );
        }
      }
    }

    await ChannelMessage.update(
      { isDeleted: true },
      { where: { channelId, parentMessageId: messageId } }
    );

    req.io.to(`channel_${channelId}`).emit("channelCommentsCleared", {
      channelId,
      messageId,
      clearedBy: userId,
    });

    // Инвалидируем кэш сообщений канала
    await invalidateChannelMessages(channelId);

    return res.json({ message: "Все комментарии к посту удалены" });
  } catch (err) {
    console.error("Ошибка при удалении комментариев:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

router.put("/:channelId/message/:messageId", (req, res) => {
  upload.single("file")(req, res, async (err) => {
    if (err) {
      console.error("Ошибка при загрузке файла:", err);
      return res.status(400).json({ error: err.message });
    }
    try {
      const { channelId, messageId } = req.params;
      const { userId, text } = req.body;
      console.log("PUT /:channelId/message/:messageId called with:", { channelId, messageId, userId, text });

      const channel = await Channel.findByPk(channelId);
      if (!channel) {
        console.log("Channel not found for channelId:", channelId);
        return res.status(404).json({ error: "Канал не найден" });
      }
      const message = await ChannelMessage.findByPk(messageId);
      if (!message) {
        console.log("Message not found for messageId:", messageId);
        return res.status(404).json({ error: "Сообщение не найдено" });
      }
      // В строгом режиме доверяем id из токена, а не из тела (его можно подделать).
      const actorId = ENFORCE && req.authUserId ? Number(req.authUserId) : userId;
      if (channel.ownerId != actorId && message.userId != actorId) {
        console.log("User does not have permission to edit:", { userId, ownerId: channel.ownerId, messageUserId: message.userId });
        return res.status(403).json({ error: "Нет прав для редактирования" });
      }

      if (req.file) {
        if (message.fileUrl) {
          const oldFileName = message.fileUrl.split("/").pop();
          try {
            await deleteFromMinio(oldFileName);
          } catch (err) {
            console.error(`Failed to delete old message file ${oldFileName} from MinIO:`, err);
          }
        }
        const fileName = `${Date.now()}-${req.file.originalname}`;
        await uploadToMinio(req.file.buffer, fileName, req.file.mimetype);
        const newFileUrl = generatePresignedUrl(fileName);
        message.fileUrl = newFileUrl;
        message.filename = req.file.originalname;
        if (req.file.mimetype.startsWith("image/")) {
          message.type = "image";
        } else if (req.file.mimetype.startsWith("video/")) {
          message.type = "video";
        } else if (req.file.mimetype.startsWith("audio/")) {
          message.type = "audio";
        } else {
          message.type = "file";
        }
      }

      if (text !== undefined && !req.file) {
        console.log("Encrypting text:", text);
        message.text = encrypt(text);
        message.type = "text";
      }

      console.log("Saving message:", message.toJSON());
      await message.save();

      const sender = await User.findByPk(userId, {
        attributes: ["id", "username"],
      });
      console.log("Sender:", sender ? sender.toJSON() : null);

      const messageWithDecryptedText = message.get({ plain: true });
      messageWithDecryptedText.text = decrypt(message.text);
      messageWithDecryptedText.sender = sender;

      const members = await ChannelUser.findAll({
        where: { channelId: message.channelId },
        attributes: ["userId"],
      });
      const memberIds = members.map((m) => m.userId);
      console.log("Emitting channelMessageUpdated to members:", memberIds);
      memberIds.forEach((mId) => {
        req.io.to(`user_${mId}`).emit("channelMessageUpdated", {
          id: message.id,
          channelId: message.channelId,
          userId: Number(userId),
          text: messageWithDecryptedText.text,
          fileUrl: message.fileUrl,
          filename: message.filename,
          type: message.type,
          replyToId: message.replyToId,
          createdAt: message.createdAt,
          sender: { id: sender.id, username: sender.username },
        });
      });

      req.io.to(`channel_${message.channelId}`).emit("channelMessageUpdated", messageWithDecryptedText);

      // Инвалидируем кэш сообщений канала
      await invalidateChannelMessages(message.channelId);

      console.log("Message updated successfully:", messageWithDecryptedText);
      return res.json(messageWithDecryptedText);
    } catch (error) {
      console.error("Ошибка при обновлении сообщения:", error.stack);
      return res.status(500).json({ error: "Server error", details: error.message });
    }
  });
});

router.post("/react", async (req, res) => {
  const { messageId, userId, emoji, channelId } = req.body;

  try {
    const existingReaction = await ChannelReaction.findOne({
      where: { messageId, userId, emoji },
    });

    if (existingReaction) {
      await existingReaction.destroy();
      req.io.to(`channel_${channelId}`).emit("reactionRemoved", {
        messageId,
        userId,
        emoji,
        channelId,
      });
      return res.json({ action: "removed" });
    }

    await ChannelReaction.create({
      messageId,
      userId,
      emoji,
      channelId,
    });

    req.io.to(`channel_${channelId}`).emit("reactionAdded", {
      messageId,
      userId,
      emoji,
      channelId,
    });

    res.json({ action: "added" });
  } catch (error) {
    console.error("Error handling reaction:", error);
    res.status(500).json({ error: "Error while handling reaction." });
  }
});

router.get("/reactions/:messageId", async (req, res) => {
  const { messageId } = req.params;

  try {
    const reactions = await ChannelReaction.findAll({
      where: { messageId },
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id"],
        },
      ],
    });

    const reactionData = reactions.reduce((acc, reaction) => {
      if (!acc[reaction.emoji]) {
        acc[reaction.emoji] = {
          count: 0,
          users: [],
        };
      }
      acc[reaction.emoji].count++;
      acc[reaction.emoji].users.push(reaction.user.id);
      return acc;
    }, {});

    res.json(reactionData);
  } catch (error) {
    console.error("Error fetching reactions:", error);
    res.status(500).json({ error: "Error while fetching reactions." });
  }
});

module.exports = router;

// const express = require("express");
// const {
//   Channel,
//   ChannelUser,
//   User,
//   ChannelMessage,
//   ChannelReaction,
// } = require("../models");
// const { v4: uuidv4 } = require("uuid");
// const { Op } = require("sequelize");
// const multer = require("multer");
// const crypto = require("crypto");
// const AWS = require("aws-sdk");

// const router = express.Router();

// const s3 = new AWS.S3({
//   accessKeyId: process.env.MINIO_ACCESS_KEY || "admin",
//   secretAccessKey: process.env.MINIO_SECRET_KEY || "strongpassword123",
//   endpoint: process.env.MINIO_ENDPOINT || "http://localhost:9000",
//   s3ForcePathStyle: true,
//   signatureVersion: "v4",
// });

// async function uploadToMinio(fileBuffer, fileName, mimeType) {
//   const params = {
//     Bucket: "my-bucket",
//     Key: fileName,
//     Body: fileBuffer,
//     ContentType: mimeType,
//   };
//   try {
//     await s3.putObject(params).promise();
//     console.log(`Successfully uploaded ${fileName} to my-bucket`);
//     return fileName;
//   } catch (err) {
//     console.error(`Failed to upload ${fileName}:`, err);
//     throw err;
//   }
// }

// function generatePresignedUrl(fileName) {
//   const params = {
//     Bucket: "my-bucket",
//     Key: fileName,
//     Expires: 600 * 600,
//   };
//   return s3.getSignedUrl("getObject", params);
// }


// const storage = multer.memoryStorage();

// const fileFilter = (req, file, cb) => {
//   const allowedTypes = ["image/", "video/", "audio/", "application/"];
//   if (allowedTypes.some((type) => file.mimetype.startsWith(type))) {
//     cb(null, true);
//   } else {
//     cb(
//       new Error("Разрешены только изображения, видео, аудио и документы!"),
//       false
//     );
//   }
// };

// const upload = multer({
//   storage: storage,
//   limits: {
//     fileSize: 5 * 1024 * 1024,
//     fieldSize: 5 * 1024 * 1024,
//   },
//   fileFilter,
// });


// const algorithm = "aes-256-cbc";
// const ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY, "hex"); 
// const IV_LENGTH = 16; 


// function encrypt(text) {
//   if (!text) return "";
//   const iv = crypto.randomBytes(IV_LENGTH);
//   const cipher = crypto.createCipheriv(algorithm, ENCRYPTION_KEY, iv);
//   let encrypted = cipher.update(text, "utf8", "hex");
//   encrypted += cipher.final("hex");
//   return iv.toString("hex") + ":" + encrypted;
// }


// function decrypt(encryptedText) {
//   if (!encryptedText) return "";
//   const [ivHex, encrypted] = encryptedText.split(":");
//   if (!ivHex || !encrypted) return encryptedText;
//   try {
//     const iv = Buffer.from(ivHex, "hex");
//     const decipher = crypto.createDecipheriv(algorithm, ENCRYPTION_KEY, iv);
//     let decrypted = decipher.update(encrypted, "hex", "utf8");
//     decrypted += decipher.final("utf8");
//     return decrypted;
//   } catch (err) {
//     console.error("Decryption error:", err);
//     return encryptedText; 
//   }
// }



// router.get("/:userId/unread-counts", async (req, res) => {
//   try {
//     const { userId } = req.params;

//     if (!userId || userId === "null" || isNaN(Number(userId))) {
//       return res.status(400).json({ error: "Invalid user ID" });
//     }

//     const userIdNum = Number(userId);

//     const channels = await Channel.findAll({
//       include: [
//         {
//           model: ChannelUser,
//           as: "members",
//           where: { userId: userIdNum },
//           required: false,
//         },
//       ],
//       where: {
//         [Op.or]: [{ ownerId: userIdNum }, { "$members.userId$": userIdNum }],
//       },
//     });

//     const unreadCounts = await Promise.all(
//       channels.map(async (channel) => {
//         const lastSeen = await ChannelUser.findOne({
//           where: { channelId: channel.id, userId: userIdNum },
//           attributes: ["lastSeen"],
//         });

//         const lastSeenDate = lastSeen ? lastSeen.lastSeen : new Date(0);

//         // ИЗМЕНЕНИЕ: считаем ТОЛЬКО сообщения без parentMessageId (не комментарии)
//         const unreadCount = await ChannelMessage.count({
//           where: {
//             channelId: channel.id,
//             parentMessageId: null, // Только основные сообщения, не комментарии
//             createdAt: { [Op.gt]: lastSeenDate },
//             isDeleted: false,
//             userId: { [Op.ne]: userIdNum },
//           },
//         });

//         return { channelId: channel.id, unreadCount };
//       })
//     );

//     return res.json(unreadCounts);
//   } catch (err) {
//     console.error("Ошибка при загрузке непрочитанных сообщений:", err);
//     return res.status(500).json({ error: "Server error" });
//   }
// });
// // router.get("/:userId/unread-counts", async (req, res) => {
// //   try {
// //     const { userId } = req.params;

// //     if (!userId || userId === "null" || isNaN(Number(userId))) {
// //       return res.status(400).json({ error: "Invalid user ID" });
// //     }

// //     const userIdNum = Number(userId);

 
// //     const channels = await Channel.findAll({
// //       include: [
// //         {
// //           model: ChannelUser,
// //           as: "members",
// //           where: { userId: userIdNum },
// //           required: false,
// //         },
// //       ],
// //       where: {
// //         [Op.or]: [{ ownerId: userIdNum }, { "$members.userId$": userIdNum }],
// //       },
// //     });

// //     const unreadCounts = await Promise.all(
// //       channels.map(async (channel) => {
// //         const lastSeen = await ChannelUser.findOne({
// //           where: { channelId: channel.id, userId: userIdNum },
// //           attributes: ["lastSeen"],
// //         });

// //         const lastSeenDate = lastSeen ? lastSeen.lastSeen : new Date(0);

// //         const unreadCount = await ChannelMessage.count({
// //           where: {
// //             channelId: channel.id,
// //             createdAt: { [Op.gt]: lastSeenDate },
// //             isDeleted: false,
// //             userId: { [Op.ne]: userIdNum },
// //           },
// //         });

// //         return { channelId: channel.id, unreadCount };
// //       })
// //     );

// //     return res.json(unreadCounts);
// //   } catch (err) {
// //     console.error("Ошибка при загрузке непрочитанных сообщений:", err);
// //     return res.status(500).json({ error: "Server error" });
// //   }
// // });






// router.post("/:channelId/message", upload.single("file"), async (req, res) => {
//   try {
//     const { channelId } = req.params;
//     const { userId, text, replyToId } = req.body;

//     if (!userId || userId === "null" || isNaN(Number(userId))) {
//       return res.status(400).json({ error: "Invalid user ID" });
//     }

//     const userIdNum = Number(userId);
//     const channel = await Channel.findByPk(channelId);
//     if (!channel) {
//       return res.status(404).json({ error: "Канал не найден" });
//     }

//     const channelUser = await ChannelUser.findOne({
//       where: { channelId, userId: userIdNum },
//     });
//     if (!channelUser && channel.ownerId != userIdNum) {
//       return res.status(403).json({ error: "Вы не являетесь участником канала" });
//     }

//     let fileUrl = null;
//     let filename = null;
//     let type = "text";

//     if (req.file) {
//       const fileName = `${Date.now()}-${req.file.originalname}`;
//       await uploadToMinio(req.file.buffer, fileName, req.file.mimetype);
//       fileUrl = generatePresignedUrl(fileName);
//       filename = req.file.originalname;
//       if (req.file.mimetype.startsWith("image/")) {
//         type = "image";
//       } else if (req.file.mimetype.startsWith("video/")) {
//         type = "video";
//       } else if (req.file.mimetype.startsWith("audio/")) {
//         type = "audio";
//       } else {
//         type = "file";
//       }
//     }

//     const message = await ChannelMessage.create({
//       channelId,
//       userId: userIdNum,
//       text: text ? encrypt(text) : null,
//       fileUrl,
//       filename,
//       type,
//       replyToId: replyToId || null,
//     });

//     const sender = await User.findByPk(userIdNum, {
//       attributes: ["id", "username"],
//     });

//     const messageWithDecryptedText = message.get({ plain: true });
//     messageWithDecryptedText.text = text ? decrypt(message.text) : null;
//     messageWithDecryptedText.sender = sender;

//     const members = await ChannelUser.findAll({
//       where: { channelId },
//       attributes: ["userId"],
//     });
//     const memberIds = members.map((m) => m.userId);
//     memberIds.forEach((mId) => {
//       req.io.to(`user_${mId}`).emit("channelMessageReceived", {
//         id: message.id,
//         channelId,
//         userId: userIdNum,
//         text: messageWithDecryptedText.text,
//         fileUrl,
//         filename,
//         type,
//         replyToId,
//         createdAt: message.createdAt,
//         sender: { id: sender.id, username: sender.username },
//       });
//     });

//     req.io.to(`channel_${channelId}`).emit("channelMessageReceived", messageWithDecryptedText);

//     return res.json(messageWithDecryptedText);
//   } catch (err) {
//     console.error("Ошибка при отправке сообщения:", err);
//     return res.status(500).json({ error: "Server error" });
//   }
// });




// router.post("/:channelId/update-last-seen", async (req, res) => {
//   try {
//     const { channelId } = req.params;
//     const { userId } = req.body;

//     if (!userId || userId === "null" || isNaN(Number(userId))) {
//       return res.status(400).json({ error: "Invalid user ID" });
//     }

//     const userIdNum = Number(userId);
//     const channel = await Channel.findByPk(channelId);
//     if (!channel) {
//       return res.status(404).json({ error: "Channel not found" });
//     }

//     const channelUser = await ChannelUser.findOne({
//       where: { channelId, userId: userIdNum },
//     });
//     if (!channelUser && channel.ownerId != userIdNum) {
//       return res.status(403).json({ error: "User is not a member of this channel" });
//     }

//     await channelUser.update({ lastSeen: new Date() });
//     return res.json({ message: "lastSeen updated" });
//   } catch (err) {
//     console.error("Error updating lastSeen:", err);
//     return res.status(500).json({ error: "Server error" });
//   }
// });










// router.post("/", (req, res) => {
//   upload.single("avatar")(req, res, async (err) => {
//     if (err) return res.status(400).json({ error: err.message });

//     try {
//       const { userId, name, description, isPublic, members } = req.body;
//       const membersArray = JSON.parse(members || "[]");
//       let avatar = null;

//       if (req.file) {
//         const fileName = `${Date.now()}-${req.file.originalname}`;
//         await uploadToMinio(req.file.buffer, fileName, req.file.mimetype);
//         avatar = generatePresignedUrl(fileName);
//       }

//       const newChannel = await Channel.create({
//         name,
//         description,
//         isPublic,
//         inviteLink: uuidv4(),
//         ownerId: userId,
//         avatar,
//         images: avatar ? [avatar] : [],
//       });

//       await ChannelUser.create({
//         channelId: newChannel.id,
//         userId,
//         role: "admin",
//       });

//       if (Array.isArray(membersArray)) {
//         await Promise.all(
//           membersArray.map(async (memberId) => {
//             if (String(memberId) !== String(userId)) {
//               await ChannelUser.findOrCreate({
//                 where: { channelId: newChannel.id, userId: memberId },
//                 defaults: { role: "member" },
//               });
//             }
//           })
//         );
//       }

//       const allMembers = [Number(userId), ...membersArray.map(Number)];
//       const channelPlain = newChannel.get({ plain: true });
//       channelPlain.members = allMembers;

//       allMembers.forEach((mId) => {
//         req.io.to(`user_${mId}`).emit("channelCreated", channelPlain);
//       });

//       return res.json(newChannel);
//     } catch (err) {
//       console.error("Ошибка при создании канала:", err);
//       return res.status(500).json({ error: "Server error" });
//     }
//   });
// });

// router.get("/", async (req, res) => {
//   try {
//     const { search, userId } = req.query;
//     let whereClause = {};

//     if (userId) {
//       if (!search) {
//         whereClause = {
//           [Op.or]: [{ ownerId: userId }, { "$members.userId$": userId }],
//         };
//       } else {
//         whereClause = {
//           name: { [Op.like]: `%${search}%` },
//           [Op.or]: [
//             { isPublic: true },
//             { ownerId: userId },
//             { "$members.userId$": userId },
//           ],
//         };
//       }
//     } else {
//       whereClause = { isPublic: true };
//       if (search) {
//         whereClause.name = { [Op.like]: `%${search}%` };
//       }
//     }

//     const channels = await Channel.findAll({
//       where: whereClause,
//       include: [
//         {
//           model: ChannelUser,
//           as: "members",
//           required: false,
//         },
//       ],
//     });

//     const result = channels.map((c) => {
//       const plain = c.get({ plain: true });
//       const isMember = userId
//         ? plain.members.some((m) => m.userId == userId)
//         : false;
//       const membersCount = plain.members ? plain.members.length : 0;
//       return { ...plain, isMember, membersCount };
//     });

//     return res.json(result);
//   } catch (err) {
//     console.error("Ошибка при поиске каналов:", err);
//     return res.status(500).json({ error: "Server error" });
//   }
// });

// router.get("/members/:channelId", async (req, res) => {
//   try {
//     const { channelId } = req.params;
//     const userId = req.query.userId || req.body.userId;
//     if (!userId) {
//       return res.status(400).json({ error: "Параметр userId обязателен" });
//     }
//     const channel = await Channel.findByPk(channelId);
//     if (!channel) {
//       return res.status(404).json({ error: "Канал не найден" });
//     }
//     if (String(channel.ownerId) !== String(userId)) {
//       return res.json([]);
//     }
//     const channelUsers = await ChannelUser.findAll({
//       where: { channelId },
//       include: [
//         {
//           model: User,
//           as: "user",
//           attributes: ["id", "username"],
//         },
//       ],
//     });
//     const members = channelUsers.map((item) => item.user);
//     return res.json(members);
//   } catch (err) {
//     console.error("Ошибка при получении подписчиков канала:", err);
//     return res.status(500).json({ error: "Server error" });
//   }
// });

// router.get("/id/:channelId", async (req, res) => {
//   try {
//     const { channelId } = req.params;
//     const channel = await Channel.findByPk(channelId);
//     if (!channel) {
//       return res.status(404).json({ error: "Канал не найден" });
//     }
//     return res.json(channel);
//   } catch (err) {
//     console.error("Ошибка при получении канала по ID:", err);
//     return res.status(500).json({ error: "Server error" });
//   }
// });

// router.get("/:inviteLink", async (req, res) => {
//   try {
//     const { inviteLink } = req.params;
//     const channel = await Channel.findOne({
//       where: { inviteLink },
//       include: [{ model: User, as: "owner", attributes: ["id", "username"] }],
//     });
//     if (!channel) {
//       return res.status(404).json({ error: "Канал не найден" });
//     }
//     return res.json(channel);
//   } catch (err) {
//     console.error("Ошибка при получении канала по inviteLink:", err);
//     return res.status(500).json({ error: "Server error" });
//   }
// });

// router.post("/:id/join", async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { userId, addedBy } = req.body;
//     const channel = await Channel.findByPk(id);
//     if (!channel) {
//       return res.status(404).json({ error: "Канал не найден" });
//     }
//     if (!channel.isPublic) {
//       if (!addedBy || Number(addedBy) !== Number(channel.ownerId)) {
//         return res
//           .status(403)
//           .json({
//             error: "Это приватный канал, доступ разрешен только владельцем",
//           });
//       }
//     }
//     const [membership, created] = await ChannelUser.findOrCreate({
//       where: { channelId: id, userId },
//       defaults: { role: "member" },
//     });
//     if (!created) {
//       return res
//         .status(400)
//         .json({ message: "Пользователь уже подписан на канал" });
//     }
//     req.io
//       .to(`user_${userId}`)
//       .emit("channelAdded", { channelId: id, channelName: channel.name });
//     return res.json({
//       message: "Пользователь подписался на канал",
//       membership,
//     });
//   } catch (err) {
//     console.error("Ошибка при подписке на канал:", err);
//     return res.status(500).json({ error: "Server error" });
//   }
// });

// router.get("/:channelId/messages", async (req, res) => {
//   try {
//     const { channelId } = req.params;
//     const posts = await ChannelMessage.findAll({
//       where: {
//         channelId,
//         parentMessageId: null,
//         isDeleted: false,
//       },
//       order: [["createdAt", "ASC"]],
//       include: [{ model: User, as: "sender", attributes: ["id", "username"] }],
//     });

//     for (let post of posts) {
//       post.dataValues.text = decrypt(post.text); 
//       const count = await ChannelMessage.count({
//         where: { parentMessageId: post.id, isDeleted: false },
//       });
//       post.dataValues.commentsCount = count;
//     }

//     return res.json(posts);
//   } catch (err) {
//     console.error("Ошибка при загрузке сообщений канала:", err);
//     return res.status(500).json({ error: "Server error" });
//   }
// });

// router.get("/:channelId/message/:messageId/comments", async (req, res) => {
//   try {
//     const { channelId, messageId } = req.params;

//     const channel = await Channel.findByPk(channelId);
//     if (!channel) {
//       return res.status(404).json({ error: "Канал не найден" });
//     }
//     const parentMessage = await ChannelMessage.findByPk(messageId);
//     if (!parentMessage) {
//       return res
//         .status(404)
//         .json({ error: "Сообщение для комментариев не найдено" });
//     }

//     const comments = await ChannelMessage.findAll({
//       where: {
//         channelId,
//         parentMessageId: messageId,
//         isDeleted: false,
//       },
//       order: [["createdAt", "ASC"]],
//       include: [{ model: User, as: "sender", attributes: ["id", "username"] }],
//     });

//     for (let comment of comments) {
//       comment.dataValues.text = decrypt(comment.text); 
//     }

//     return res.json(comments);
//   } catch (err) {
//     console.error("Ошибка при получении комментариев:", err);
//     return res.status(500).json({ error: "Server error" });
//   }
// });

// router.post("/:channelId/message/:messageId/comment", (req, res) => {
//   upload.single("file")(req, res, async (err) => {
//     if (err) {
//       console.error("Ошибка при загрузке файла:", err);
//       return res.status(400).json({ error: err.message });
//     }
//     try {
//       const { channelId, messageId } = req.params;
//       const { userId, text } = req.body;

//       const channel = await Channel.findByPk(channelId);
//       if (!channel) {
//         return res.status(404).json({ error: "Канал не найден" });
//       }
//       const parentMessage = await ChannelMessage.findByPk(messageId);
//       if (!parentMessage) {
//         return res
//           .status(404)
//           .json({ error: "Сообщение (которое комментируем) не найдено" });
//       }

//       let messageType = "text";
//       let fileUrl = null;
//       let filename = null;

//       if (req.file) {
//         const fileName = `${Date.now()}-${req.file.originalname}`;
//         await uploadToMinio(req.file.buffer, fileName, req.file.mimetype);
//         fileUrl = generatePresignedUrl(fileName);
//         filename = req.file.originalname;
//         if (req.file.mimetype.startsWith("image/")) {
//           messageType = "image";
//         } else if (req.file.mimetype.startsWith("video/")) {
//           messageType = "video";
//         } else if (req.file.mimetype.startsWith("audio/")) {
//           messageType = "audio";
//         } else {
//           messageType = "file";
//         }
//       }

//       const encryptedText = encrypt(text || ""); 

//       const newComment = await ChannelMessage.create({
//         channelId,
//         userId,
//         text: encryptedText,
//         type: messageType,
//         fileUrl,
//         filename,
//         parentMessageId: messageId,
//       });

//       const sender = await User.findByPk(userId, {
//         attributes: ["id", "username"],
//       });
//       const commentWithSender = newComment.get({ plain: true });
//       commentWithSender.text = text || ""; 
//       commentWithSender.sender = sender;

//       req.io
//         .to(`channel_${channelId}`)
//         .emit("channelMessageReceived", commentWithSender);

//       return res.json(commentWithSender);
//     } catch (error) {
//       console.error("Ошибка при создании комментария:", error);
//       return res.status(500).json({ error: "Server error" });
//     }
//   });
// });

// router.delete("/:id/leave", async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { userId } = req.body;
//     const channel = await Channel.findByPk(id);
//     if (!channel) {
//       return res.status(404).json({ error: "Канал не найден" });
//     }
//     const membership = await ChannelUser.findOne({
//       where: { channelId: id, userId },
//     });
//     if (!membership) {
//       return res.status(400).json({ error: "Вы не подписаны на этот канал" });
//     }
//     await membership.destroy();
//     return res.json({ message: "Вы отписались от канала" });
//   } catch (err) {
//     console.error("Ошибка при отписке от канала:", err);
//     return res.status(500).json({ error: "Server error" });
//   }
// });

// router.delete("/:channelId", async (req, res) => {
//   try {
//     const { channelId } = req.params;
//     const { userId } = req.body;
//     const channel = await Channel.findByPk(channelId);
//     if (!channel) {
//       return res.status(404).json({ error: "Канал не найден" });
//     }
//     if (channel.ownerId != userId) {
//       return res
//         .status(403)
//         .json({ error: "Только владелец может удалять этот канал" });
//     }

//     if (channel.avatar) {
//       const fileName = channel.avatar.split("/").pop();
//       try {
//         await s3.deleteObject({ Bucket: "my-bucket", Key: fileName }).promise();
//         console.log(`Deleted avatar ${fileName} from MinIO`);
//       } catch (err) {
//         console.error(`Failed to delete avatar ${fileName} from MinIO:`, err);
//       }
//     }
//     if (channel.images && channel.images.length > 0) {
//       for (const image of channel.images) {
//         const fileName = image.split("/").pop();
//         try {
//           await s3
//             .deleteObject({ Bucket: "my-bucket", Key: fileName })
//             .promise();
//           console.log(`Deleted image ${fileName} from MinIO`);
//         } catch (err) {
//           console.error(`Failed to delete image ${fileName} from MinIO:`, err);
//         }
//       }
//     }
//     await ChannelUser.destroy({ where: { channelId } });
//     await ChannelMessage.destroy({ where: { channelId } });
//     await channel.destroy();

//     return res.json({ message: "Канал удалён" });
//   } catch (err) {
//     console.error("Ошибка при удалении канала:", err);
//     return res.status(500).json({ error: "Server error" });
//   }
// });

// router.delete("/:channelId/members/:memberId", async (req, res) => {
//   try {
//     const { channelId, memberId } = req.params;
//     const { userId } = req.body;
//     const channel = await Channel.findByPk(channelId);
//     if (!channel) {
//       return res.status(404).json({ error: "Канал не найден" });
//     }
//     if (channel.ownerId != userId) {
//       return res
//         .status(403)
//         .json({ error: "Только владелец может удалять подписчиков" });
//     }
//     if (Number(userId) === Number(memberId)) {
//       return res
//         .status(400)
//         .json({ error: "Вы не можете удалить самого себя" });
//     }
//     const member = await ChannelUser.findOne({
//       where: { channelId, userId: memberId },
//     });
//     if (!member) {
//       return res.status(404).json({ error: "Подписчик не найден" });
//     }
//     await member.destroy();
//     req.io.to(`user_${memberId}`).emit("channelRemoved", { channelId });
//     return res.json({ message: "Подписчик удалён" });
//   } catch (err) {
//     console.error("Ошибка при удалении подписчика:", err);
//     return res.status(500).json({ error: "Server error" });
//   }
// });

// router.put("/:channelId", (req, res) => {
//   upload.single("avatar")(req, res, async (err) => {
//     if (err) {
//       console.error("Ошибка при загрузке файла:", err);
//       return res.status(400).json({ error: err.message });
//     }
//     try {
//       const { channelId } = req.params;
//       const { name, isPublic, existingImages } = req.body;
//       let updatedImages = [];

//       if (existingImages) {
//         try {
//           updatedImages = JSON.parse(existingImages);
//         } catch (e) {
//           updatedImages = [];
//         }
//       }

//       const channel = await Channel.findByPk(channelId);
//       if (!channel) {
//         return res.status(404).json({ error: "Канал не найден" });
//       }

//       if (req.file) {
//         const fileName = `${Date.now()}-${req.file.originalname}`;
//         await uploadToMinio(req.file.buffer, fileName, req.file.mimetype);
//         const newImage = generatePresignedUrl(fileName);
//         updatedImages = [newImage, ...updatedImages];
//         channel.avatar = newImage;
//       }
//       channel.name = name || channel.name;
//       channel.isPublic = isPublic === "true" || isPublic === true;
//       channel.images = updatedImages;
//       await channel.save();

//       req.io.to(`channel_${channelId}`).emit("channelUpdated", {
//         channelId,
//         updatedFields: {
//           name: channel.name,
//           images: updatedImages,
//           avatar: channel.avatar,
//           isPublic: channel.isPublic,
//         },
//       });

//       return res.json({
//         name: channel.name,
//         images: updatedImages,
//         avatar: channel.avatar,
//         isPublic: channel.isPublic,
//       });
//     } catch (error) {
//       console.error("Ошибка при обновлении канала:", error);
//       return res.status(500).json({ error: "Server error" });
//     }
//   });
// });

// router.post("/:channelId/message", (req, res) => {
//   upload.single("file")(req, res, async (err) => {
//     if (err) {
//       console.error("Ошибка загрузки файла:", err);
//       return res.status(400).json({ error: err.message });
//     }

//     try {
//       const { channelId } = req.params;
//       const { userId, text } = req.body;

//       const channel = await Channel.findByPk(channelId);
//       if (!channel) {
//         return res.status(404).json({ error: "Канал не найден" });
//       }

//       const membership = await ChannelUser.findOne({
//         where: { channelId, userId },
//       });
//       if (!membership) {
//         return res.status(403).json({ error: "Вы не состоите в этом канале" });
//       }

//       let messageType = "text";
//       let fileUrl = null;
//       let filename = null;

//       if (req.file) {
//         const fileName = `${Date.now()}-${req.file.originalname}`;
//         await uploadToMinio(req.file.buffer, fileName, req.file.mimetype);
//         fileUrl = generatePresignedUrl(fileName);
//         filename = req.file.originalname;
//         if (req.file.mimetype.startsWith("image/")) {
//           messageType = "image";
//         } else if (req.file.mimetype.startsWith("video/")) {
//           messageType = "video";
//         } else if (req.file.mimetype.startsWith("audio/")) {
//           messageType = "audio";
//         } else {
//           messageType = "file";
//         }
//       }

//       const encryptedText = encrypt(text || "");

//       const newMessage = await ChannelMessage.create({
//         channelId,
//         userId,
//         text: encryptedText,
//         type: messageType,
//         fileUrl,
//         filename,
//         parentMessageId: null,
//       });

//       const sender = await User.findByPk(userId, {
//         attributes: ["id", "username"],
//       });
//       const messageWithSender = newMessage.get({ plain: true });
//       messageWithSender.text = text || ""; 
//       messageWithSender.sender = sender;

//       req.io
//         .to(`channel_${channelId}`)
//         .emit("channelMessageReceived", messageWithSender);


//       return res.json(messageWithSender);
//     } catch (error) {
//       console.error("Ошибка при отправке сообщения:", error);
//       return res.status(500).json({ error: error.message || "Server error" });
//     }
//   });
// });

// router.delete("/:channelId/messages", async (req, res) => {
//   try {
//     const { channelId } = req.params;
//     const { userId } = req.body;
//     const channel = await Channel.findByPk(channelId);
//     if (!channel) return res.status(404).json({ error: "Канал не найден" });
//     if (channel.ownerId != userId)
//       return res.status(403).json({ error: "Нет прав" });

//     const messages = await ChannelMessage.findAll({ where: { channelId } });
//     for (const message of messages) {
//       if (message.fileUrl) {
//         const fileName = message.fileUrl.split("/").pop();
//         try {
//           await s3
//             .deleteObject({ Bucket: "my-bucket", Key: fileName })
//             .promise();
//           console.log(`Deleted message file ${fileName} from MinIO`);
//         } catch (err) {
//           console.error(
//             `Failed to delete message file ${fileName} from MinIO:`,
//             err
//           );
//         }
//       }
//     }

//     await ChannelMessage.update({ isDeleted: true }, { where: { channelId } });

//     req.io.to(`channel_${channelId}`).emit("channelMessagesCleared", {
//       channelId,
//       clearedBy: userId,
//     });

//     return res.json({ message: "Все сообщения очищены (soft delete)" });
//   } catch (err) {
//     console.error("Ошибка при очистке сообщений:", err);
//     return res.status(500).json({ error: "Server error" });
//   }
// });

// router.post("/:channelId/report", async (req, res) => {
//   try {
//     const { channelId } = req.params;
//     const { userId } = req.body;
//     console.log(`Пользователь ${userId} пожаловался на канал ${channelId}`);
//     return res.json({ message: "Жалоба принята" });
//   } catch (err) {
//     console.error("Ошибка при отправке жалобы:", err);
//     return res.status(500).json({ error: "Server error" });
//   }
// });

// router.delete("/:channelId/message/:messageId", async (req, res) => {
//   try {
//     const { channelId, messageId } = req.params;
//     const { userId } = req.body;

//     const channel = await Channel.findByPk(channelId);
//     if (!channel) {
//       return res.status(404).json({ error: "Канал не найден" });
//     }

//     const message = await ChannelMessage.findByPk(messageId);
//     if (!message) {
//       return res.status(404).json({ error: "Сообщение не найдено" });
//     }

//     if (channel.ownerId != userId && message.userId != userId) {
//       return res
//         .status(403)
//         .json({ error: "Нет прав для удаления этого сообщения" });
//     }

//     if (message.fileUrl) {
//       const fileName = message.fileUrl.split("/").pop();
//       try {
//         await s3.deleteObject({ Bucket: "my-bucket", Key: fileName }).promise();
//         console.log(`Deleted message file ${fileName} from MinIO`);
//       } catch (err) {
//         console.error(
//           `Failed to delete message file ${fileName} from MinIO:`,
//           err
//         );
//       }
//     }

//     await message.update({ isDeleted: true });

//     req.io
//       .to(`channel_${channelId}`)
//       .emit("channelMessageDeleted", { messageId: String(messageId) });
//     return res.json({ message: "Сообщение удалено" });
//   } catch (err) {
//     console.error("Ошибка при удалении сообщения:", err);
//     return res.status(500).json({ error: "Server error" });
//   }
// });

// router.delete("/:channelId/message/:messageId/comments", async (req, res) => {
//   try {
//     const { channelId, messageId } = req.params;
//     const { userId } = req.body;

//     const channel = await Channel.findByPk(channelId);
//     if (!channel) {
//       return res.status(404).json({ error: "Канал не найден" });
//     }

//     if (channel.ownerId != userId) {
//       return res
//         .status(403)
//         .json({ error: "Только владелец может удалять комментарии" });
//     }

//     const post = await ChannelMessage.findByPk(messageId);
//     if (!post) {
//       return res.status(404).json({ error: "Пост не найден" });
//     }

//     const comments = await ChannelMessage.findAll({
//       where: { parentMessageId: messageId },
//     });
//     for (const comment of comments) {
//       if (comment.fileUrl) {
//         const fileName = comment.fileUrl.split("/").pop();
//         try {
//           await s3
//             .deleteObject({ Bucket: "", Key: fileName })
//             .promise();
//           console.log(`Deleted comment file ${fileName} from MinIO`);
//         } catch (err) {
//           console.error(
//             `Failed to delete comment file ${fileName} from MinIO:`,
//             err
//           );
//         }
//       }
//     }

//     await ChannelMessage.update(
//       { isDeleted: true },
//       { where: { channelId, parentMessageId: messageId } }
//     );

//     req.io.to(`channel_${channelId}`).emit("channelCommentsCleared", {
//       channelId,
//       messageId,
//       clearedBy: userId,
//     });

//     return res.json({ message: "Все комментарии к посту удалены" });
//   } catch (err) {
//     console.error("Ошибка при удалении комментариев:", err);
//     return res.status(500).json({ error: "Server error" });
//   }
// });

// router.put("/:channelId/message/:messageId", (req, res) => {
//   upload.single("file")(req, res, async (err) => {
//     if (err) {
//       console.error("Ошибка при загрузке файла:", err);
//       return res.status(400).json({ error: err.message });
//     }
//     try {
//       const { channelId, messageId } = req.params;
//       const { userId, text } = req.body;
//       console.log("PUT /:channelId/message/:messageId called with:", { channelId, messageId, userId, text });

//       const channel = await Channel.findByPk(channelId);
//       if (!channel) {
//         console.log("Channel not found for channelId:", channelId);
//         return res.status(404).json({ error: "Канал не найден" });
//       }
//       const message = await ChannelMessage.findByPk(messageId);
//       if (!message) {
//         console.log("Message not found for messageId:", messageId);
//         return res.status(404).json({ error: "Сообщение не найдено" });
//       }
//       if (channel.ownerId != userId && message.userId != userId) {
//         console.log("User does not have permission to edit:", { userId, ownerId: channel.ownerId, messageUserId: message.userId });
//         return res.status(403).json({ error: "Нет прав для редактирования" });
//       }

//       if (req.file) {
//         if (message.fileUrl) {
//           const oldFileName = message.fileUrl.split("/").pop();
//           try {
//             await s3.deleteObject({ Bucket: "my-bucket", Key: oldFileName }).promise();
//             console.log(`Deleted old message file ${oldFileName} from MinIO`);
//           } catch (err) {
//             console.error(`Failed to delete old message file ${oldFileName} from MinIO:`, err);
//           }
//         }
//         const fileName = `${Date.now()}-${req.file.originalname}`;
//         await uploadToMinio(req.file.buffer, fileName, req.file.mimetype);
//         const newFileUrl = generatePresignedUrl(fileName);
//         message.fileUrl = newFileUrl;
//         message.filename = req.file.originalname;
//         if (req.file.mimetype.startsWith("image/")) {
//           message.type = "image";
//         } else if (req.file.mimetype.startsWith("video/")) {
//           message.type = "video";
//         } else if (req.file.mimetype.startsWith("audio/")) {
//           message.type = "audio";
//         } else {
//           message.type = "file";
//         }
//       }

//       if (text !== undefined && !req.file) {
//         console.log("Encrypting text:", text);
//         message.text = encrypt(text);
//         message.type = "text";
//       }

//       console.log("Saving message:", message.toJSON());
//       await message.save();

//       const sender = await User.findByPk(userId, {
//         attributes: ["id", "username"],
//       });
//       console.log("Sender:", sender ? sender.toJSON() : null);

//       const messageWithDecryptedText = message.get({ plain: true });
//       messageWithDecryptedText.text = decrypt(message.text);
//       messageWithDecryptedText.sender = sender;

//       const members = await ChannelUser.findAll({
//         where: { channelId: message.channelId },
//         attributes: ["userId"],
//       });
//       const memberIds = members.map((m) => m.userId);
//       console.log("Emitting channelMessageUpdated to members:", memberIds);
//       memberIds.forEach((mId) => {
//         req.io.to(`user_${mId}`).emit("channelMessageUpdated", {
//           id: message.id,
//           channelId: message.channelId,
//           userId: Number(userId),
//           text: messageWithDecryptedText.text,
//           fileUrl: message.fileUrl,
//           filename: message.filename,
//           type: message.type,
//           replyToId: message.replyToId,
//           createdAt: message.createdAt,
//           sender: { id: sender.id, username: sender.username },
//         });
//       });

//       req.io.to(`channel_${message.channelId}`).emit("channelMessageUpdated", messageWithDecryptedText);

//       console.log("Message updated successfully:", messageWithDecryptedText);
//       return res.json(messageWithDecryptedText);
//     } catch (error) {
//       console.error("Ошибка при обновлении сообщения:", error.stack);
//       return res.status(500).json({ error: "Server error", details: error.message });
//     }
//   });
// });

// router.post("/react", async (req, res) => {
//   const { messageId, userId, emoji, channelId } = req.body;

//   try {
//     const existingReaction = await ChannelReaction.findOne({
//       where: { messageId, userId, emoji },
//     });

//     if (existingReaction) {
//       await existingReaction.destroy();
//       req.io.to(`channel_${channelId}`).emit("reactionRemoved", {
//         messageId,
//         userId,
//         emoji,
//         channelId,
//       });
//       return res.json({ action: "removed" });
//     }

//     await ChannelReaction.create({
//       messageId,
//       userId,
//       emoji,
//       channelId,
//     });

//     req.io.to(`channel_${channelId}`).emit("reactionAdded", {
//       messageId,
//       userId,
//       emoji,
//       channelId,
//     });

//     res.json({ action: "added" });
//   } catch (error) {
//     console.error("Error handling reaction:", error);
//     res.status(500).json({ error: "Error while handling reaction." });
//   }
// });

// router.get("/reactions/:messageId", async (req, res) => {
//   const { messageId } = req.params;

//   try {
//     const reactions = await ChannelReaction.findAll({
//       where: { messageId },
//       include: [
//         {
//           model: User,
//           as: "user",
//           attributes: ["id"],
//         },
//       ],
//     });

//     const reactionData = reactions.reduce((acc, reaction) => {
//       if (!acc[reaction.emoji]) {
//         acc[reaction.emoji] = {
//           count: 0,
//           users: [],
//         };
//       }
//       acc[reaction.emoji].count++;
//       acc[reaction.emoji].users.push(reaction.user.id);
//       return acc;
//     }, {});

//     res.json(reactionData);
//   } catch (error) {
//     console.error("Error fetching reactions:", error);
//     res.status(500).json({ error: "Error while fetching reactions." });
//   }
// });

// module.exports = router;
