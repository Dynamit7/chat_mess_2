const express = require("express");
const router = express.Router();
const { Message, Chat, User, Reaction, BlockedUser, GroupMessage, GroupUser, Group, ChannelMessage, ChannelUser, Channel, Poll, PollOption, sequelize } = require("../models");
const { Op, QueryTypes } = require("sequelize");
const { ENFORCE } = require("../middleware/enforceAuth"); // ownership-проверки (строгий режим)

const { encrypt, decrypt } = require("../utils/encryption");
const {
  getCachedMessages,
  cacheMessages,
  invalidateMessages,
  getCachedUserProfile,
  cacheUserProfile,
  invalidateUserProfile,
  getCachedChat,
  cacheChat,
  invalidateChat,
  addNotificationToQueue,
  refreshUserOnline,
  invalidateGroupMessages,
  invalidateChannelMessages,
} = require("../utils/redisClient");
const root = require("../proto/group_message_pb");
const chat = root.chat;

router.post("/sendMessage", async (req, res) => {
  let {
    fromUserId,
    toUserId,
    text,
    type,
    fileUrl,
    filename,
    replyToId,
    tempId,
    latitude,
    longitude,
  } = req.body;

  fromUserId = Number(fromUserId);
  toUserId = Number(toUserId);

  if (!fromUserId || !toUserId || isNaN(fromUserId) || isNaN(toUserId)) {
    return res.status(400).json({ error: "fromUserId and toUserId are required" });
  }
  if (fromUserId === toUserId) {
    return res.status(400).json({ error: "Cannot send message to yourself" });
  }
  if (text && typeof text !== "string") {
    return res.status(400).json({ error: "text must be a string" });
  }
  if (text && text.length > 10000) {
    return res.status(400).json({ error: "Message text too long (max 10000 chars)" });
  }
  const ALLOWED_TYPES = ["text", "image", "video", "file", "voice", "poll", "sticker", "location"];
  if (type && !ALLOWED_TYPES.includes(type)) {
    return res.status(400).json({ error: "Invalid message type" });
  }

  if (!text) text = "";
  if (!type) type = "text";
  const encryptedText = encrypt(text);

  try {
    const blockFromTo = await BlockedUser.findOne({
      where: { blockerId: fromUserId, blockedId: toUserId },
    });
    const blockToFrom = await BlockedUser.findOne({
      where: { blockerId: toUserId, blockedId: fromUserId },
    });
    if (blockFromTo || blockToFrom) {
      return res
        .status(403)
        .json({ error: "Cannot send message to blocked user" });
    }

    const recipient = await User.findByPk(toUserId, {
      attributes: ["ghostMode"],
    });
    const isGhostMode = recipient ? recipient.ghostMode : false;

   
    const sender = await User.findByPk(fromUserId, {
      attributes: ["id", "ghostMode"],
    });
    if (!sender || !sender.ghostMode) {
      await refreshUserOnline(fromUserId);
    }

    const newMessage = await Message.create({
      fromUserId,
      toUserId,
      text: encryptedText,
      type,
      fileUrl: fileUrl || null,
      filename: filename || null,
      replyToId: replyToId || null,
      isRead: false,
      latitude: latitude ?? null,
      longitude: longitude ?? null,
    });

    const chatExistsForSender = await Chat.findOne({
      where: { userId: fromUserId, partnerId: toUserId },
    });
    if (!chatExistsForSender) {
      await Chat.create({ userId: fromUserId, partnerId: toUserId });
    }

    const chatExistsForReceiver = await Chat.findOne({
      where: { userId: toUserId, partnerId: fromUserId },
    });
    if (!chatExistsForReceiver) {
      await Chat.create({ userId: toUserId, partnerId: fromUserId });
    }

    if (newMessage.replyToId) {
      newMessage.replyTo = await Message.findByPk(newMessage.replyToId);
    }

    const messageData = {
      ...newMessage.toJSON(),
      text: text,
      createdAt: newMessage.createdAt.toISOString(),
      tempId,
      replyTo: newMessage.replyTo
        ? {
            id: newMessage.replyTo.id,
            text:
              decrypt(newMessage.replyTo.text) ||
              newMessage.replyTo.filename ||
              "",
            fromUserId: newMessage.replyTo.fromUserId,
          }
        : null,
      reactions: [],
    };

   
    const chatKey = `${Math.min(fromUserId, toUserId)}_${Math.max(fromUserId, toUserId)}`;
    const roomName = `chat_${chatKey}`;
    
    
    req.io.to(roomName).emit("messageReceived", messageData);

 
    req.io.to(`user_${toUserId}`).emit("messageReceived", messageData);

    
    let senderInfo = await getCachedUserProfile(fromUserId);
    if (!senderInfo) {
      senderInfo = await User.findByPk(fromUserId, {
        attributes: ["id", "username", "nickname", "email", "avatar"],
      });
      if (senderInfo) {
        await cacheUserProfile(fromUserId, senderInfo.toJSON());
        senderInfo = senderInfo.toJSON();
      }
    }

    let recipientInfo = await getCachedUserProfile(toUserId);
    if (!recipientInfo) {
      recipientInfo = await User.findByPk(toUserId, {
        attributes: ["id", "username", "nickname", "email", "avatar"],
      });
      if (recipientInfo) {
        await cacheUserProfile(toUserId, recipientInfo.toJSON());
        recipientInfo = recipientInfo.toJSON();
      }
    }

    const unreadCount = await Message.count({
      where: {
        fromUserId: fromUserId,
        toUserId: toUserId,
        isRead: false,
        isDeleted: false,
      },
    });

    
    const senderChat = await Chat.findOne({
      where: { userId: fromUserId, partnerId: toUserId },
    });
    const recipientChat = await Chat.findOne({
      where: { userId: toUserId, partnerId: fromUserId },
    });

   
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

    console.log("🔄 Updating lastMessage in database:", {
      fromUserId,
      toUserId,
      lastMessageText,
      messageId: newMessage.id
    });

    if (senderChat) {
      await senderChat.update({ lastMessage: lastMessageText });
      await invalidateChat(fromUserId, toUserId);
    }
    if (recipientChat) {
      await recipientChat.update({ lastMessage: lastMessageText });
      await invalidateChat(toUserId, fromUserId);
    }

   
    const lastMessageTime = newMessage.createdAt.toISOString();
    
    console.log(`Sending lastMessageUpdated events:`, {
      toUser: toUserId,
      fromUser: fromUserId,
      lastMessage: lastMessageText,
      time: lastMessageTime
    });

   
    req.io.to(`user_${toUserId}`).emit("lastMessageUpdated", {
      partnerId: fromUserId,
      lastMessage: lastMessageText,
      lastMessageType: type || "text",
      isForwarded: false,
      time: lastMessageTime,
    });

    
    req.io.to(`user_${fromUserId}`).emit("lastMessageUpdated", {
      partnerId: toUserId,
      lastMessage: lastMessageText,
      lastMessageType: type || "text",
      isForwarded: false,
      time: lastMessageTime,
    });

   
    req.io.to(`user_${toUserId}`).emit("chatUpdated", {
      partnerId: fromUserId,
      partnerInfo: senderInfo,
      lastMessage: messageData,
      unreadCount,
    });

    req.io.to(`user_${fromUserId}`).emit("chatUpdated", {
      partnerId: toUserId,
      partnerInfo: recipientInfo,
      lastMessage: messageData,
      unreadCount: 0,
    });

    console.log(`✅ Last message updated for chat between ${fromUserId} and ${toUserId}: "${lastMessageText}"`);


    await invalidateMessages(chatKey);

  
    await addNotificationToQueue({
      userId: toUserId,
      type: "message",
      // Кладём имя/аватар отправителя, чтобы тап по пушу открывал чат сразу с
      // заполненным заголовком (а не "Chat" без аватара).
      data: {
        ...messageData,
        senderUsername: senderInfo?.username || "",
        senderPicture: senderInfo?.avatar || "",
      },
    });

    return res.status(200).json({ success: true, message: messageData });
  } catch (err) {
    console.error("Error in sendMessage:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

router.get("/getMessages", async (req, res) => {
  const { user1, user2, limit, before } = req.query;
  if (!user1 || !user2 || isNaN(user1) || isNaN(user2)) {
    return res.status(400).json({ error: "Invalid user IDs" });
  }
  try {

    const chatKey = `${Math.min(user1, user2)}_${Math.max(user1, user2)}`;

    // --- Пагинация (опционально) ------------------------------------------
    // Если клиент прислал ?limit=N (&before=<messageId>) — отдаём последние N
    // сообщений (старше курсора `before`) как "страницу". Так открытие чата с
    // 50k сообщений грузит только последние 50, а не всю историю (защита от OOM
    // и быстрый ответ). Без параметров — старое поведение (вся история + кэш),
    // чтобы не сломать текущий клиент.
    const paginated = limit !== undefined;
    const baseWhere = {
      [Op.or]: [
        { fromUserId: user1, toUserId: user2 },
        { fromUserId: user2, toUserId: user1 },
      ],
      isDeleted: false,
    };
    const includes = [
      { model: Reaction, as: "reactions" },
      {
        model: Message,
        as: "replyTo",
        where: { isDeleted: false },
        required: false,
      },
    ];

    if (paginated) {
      const pageSize = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);
      const where = { ...baseWhere };
      if (before && !isNaN(before)) {
        where.id = { [Op.lt]: parseInt(before, 10) }; // курсор: старше этого id
      }
      // Берём свежие N (DESC), затем разворачиваем в ASC для клиента.
      const rows = await Message.findAll({
        where,
        order: [["createdAt", "DESC"]],
        limit: pageSize + 1, // +1 чтобы понять, есть ли ещё страницы
        include: includes,
      });
      const hasMore = rows.length > pageSize;
      const page = (hasMore ? rows.slice(0, pageSize) : rows).reverse();
      const formatted = page.map((msg) => ({
        ...msg.toJSON(),
        text: decrypt(msg.text),
        createdAt: msg.createdAt.toISOString(),
        replyTo: msg.replyTo && !msg.replyTo.isDeleted
          ? {
              id: msg.replyTo.id,
              text: decrypt(msg.replyTo.text) || msg.replyTo.filename || "",
              fromUserId: msg.replyTo.fromUserId,
            }
          : null,
        reactions: (msg.reactions || []).map((r) => ({
          messageId: r.messageId,
          userId: r.userId,
          emoji: r.emoji,
        })),
      }));
      return res.status(200).json({
        messages: formatted,
        hasMore,
        nextBefore: page.length ? page[0].id : null, // курсор для подгрузки старых
      });
    }

    const cachedMessages = await getCachedMessages(chatKey);
    if (cachedMessages) {
      return res.status(200).json(cachedMessages);
    }

    const messages = await Message.findAll({
      where: baseWhere,
      order: [["createdAt", "ASC"]],
      include: includes,
    });

    const formattedMessages = messages.map((msg) => ({
      ...msg.toJSON(),
      text: decrypt(msg.text),
      createdAt: msg.createdAt.toISOString(),
      replyTo: msg.replyTo && !msg.replyTo.isDeleted
        ? {
            id: msg.replyTo.id,
            text: decrypt(msg.replyTo.text) || msg.replyTo.filename || "",
            fromUserId: msg.replyTo.fromUserId,
          }
        : null,
      reactions:
        msg.reactions.map((r) => ({
          messageId: r.messageId,
          userId: r.userId,
          emoji: r.emoji,
        })) || [],
    }));

    // Кэшируем сообщения
    await cacheMessages(chatKey, formattedMessages);

    return res.status(200).json(formattedMessages);
  } catch (err) {
    console.error("Error in getMessages:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

router.post("/markAsRead", async (req, res) => {
  const { currentUserId, partnerId } = req.body;
  try {
    const user = await User.findByPk(currentUserId, {
      attributes: ["ghostMode", "readReceiptSetting"],
    });
    // Ghost mode (or "read receipts = nobody") hides the read receipt FROM THE
    // PARTNER — so no second tick. But the reader's own unread badge must still
    // clear, so we always mark as read and only suppress notifying the partner.
    const suppressReceipt = !!(user && (user.ghostMode || user.readReceiptSetting === "nobody"));

    await Message.update(
      { isRead: true },
      {
        where: {
          fromUserId: partnerId,
          toUserId: currentUserId,
          isRead: false,
        },
      }
    );

    const chatKey = `${Math.min(currentUserId, partnerId)}_${Math.max(currentUserId, partnerId)}`;
    await invalidateMessages(chatKey);

    const unreadCount = await Message.count({
      where: {
        fromUserId: partnerId,
        toUserId: currentUserId,
        isRead: false,
      },
    });

    // Always sync the reader's own devices so their unread badge disappears.
    req.io.to(`user_${currentUserId}`).emit("messagesReadByRecipient", {
      readerId: currentUserId,
      partnerId,
      unreadCount,
    });
    // Only reveal the read receipt to the partner when allowed.
    if (!suppressReceipt) {
      req.io.to(`user_${partnerId}`).emit("messagesReadByRecipient", {
        readerId: currentUserId,
        partnerId,
        unreadCount,
      });
    }
    return res.json({ success: true, unreadCount, receiptSuppressed: suppressReceipt });
  } catch (error) {
    console.error("/markAsRead error", error);
    res.status(500).json({ error: "Server error" });
  }
});

router.put("/editMessage", async (req, res) => {
  const { messageId, newText } = req.body;
  const encryptedNewText = encrypt(newText);

  try {
    const message = await Message.findByPk(messageId);
    if (!message) {
      return res.status(404).json({ error: "Сообщение не найдено" });
    }

    // Ownership: редактировать можно только СВОЁ сообщение.
    if (ENFORCE && Number(req.authUserId) !== Number(message.fromUserId)) {
      return res.status(403).json({ error: "Можно редактировать только свои сообщения" });
    }

    await message.update({ text: encryptedNewText, isEdited: true });

    // Проверяем, является ли это сообщение последним в чате
    const fromUserId = message.fromUserId;
    const toUserId = message.toUserId;

    // Ищем последнее не удаленное сообщение в этом чате
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

    // Если редактируемое сообщение является последним, обновляем lastMessage в Chat
    if (lastMessage && Number(lastMessage.id) === Number(messageId)) {
      const senderChat = await Chat.findOne({
        where: { userId: fromUserId, partnerId: toUserId },
      });
      const recipientChat = await Chat.findOne({
        where: { userId: toUserId, partnerId: fromUserId },
      });

      if (senderChat) {
        await senderChat.update({ lastMessage: newText });
        await invalidateChat(fromUserId, toUserId);
      }
      if (recipientChat) {
        await recipientChat.update({ lastMessage: newText });
        await invalidateChat(toUserId, fromUserId);
      }

      // Отправляем событие обновления lastMessage
      req.io.to(`user_${fromUserId}`).emit("lastMessageUpdated", {
        partnerId: toUserId,
        lastMessage: newText,
        lastMessageType: message.type || "text",
        isForwarded: !!message.forwardedFromType,
        time: message.createdAt ? message.createdAt.toISOString() : new Date().toISOString(),
      });

      req.io.to(`user_${toUserId}`).emit("lastMessageUpdated", {
        partnerId: fromUserId,
        lastMessage: newText,
        lastMessageType: message.type || "text",
        isForwarded: !!message.forwardedFromType,
        time: message.createdAt ? message.createdAt.toISOString() : new Date().toISOString(),
      });
    }

    return res
      .status(200)
      .json({
        success: true,
        message: { ...message.toJSON(), text: newText },
      });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

// В маршруте DELETE /deleteMessage ЗАМЕНИТЕ код обновления lastMessage:

router.delete("/deleteMessage", async (req, res) => {
  const rawMessageId = req.body.messageId || req.query.messageId;
  if (!rawMessageId) {
    return res.status(400).json({ error: "messageId is required" });
  }

  const messageId = Number.parseInt(rawMessageId, 10);
  if (isNaN(messageId)) {
    return res
      .status(400)
      .json({ error: "Invalid messageId: must be a number" });
  }

  try {
    const message = await Message.findByPk(messageId);
    if (!message) {
      return res.status(404).json({ error: "Сообщение не найдено" });
    }

    // Ownership: удалять можно только СВОЁ сообщение.
    if (ENFORCE && Number(req.authUserId) !== Number(message.fromUserId)) {
      return res.status(403).json({ error: "Можно удалять только свои сообщения" });
    }

    const fromUserId = message.fromUserId;
    const toUserId = message.toUserId;


    const wasUnread = !message.isRead;
    const recipientId = message.toUserId;

    await message.update({ isDeleted: true });

    
    const chatKey = `${Math.min(fromUserId, toUserId)}_${Math.max(fromUserId, toUserId)}`;
    await invalidateMessages(chatKey);

    const chats = await Chat.findAll({
      where: {
        [Op.or]: [
          { userId: fromUserId, partnerId: toUserId },
          { userId: toUserId, partnerId: fromUserId },
        ],
      },
    });


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


    let newLastMessage = "";
    let newTime = "";
    let newLastMessageType = "text";
    let newIsForwarded = false;

    if (lastMessage) {
      try {
   
        newLastMessage = decrypt(lastMessage.text) || "";
        newTime = lastMessage.createdAt ? lastMessage.createdAt.toISOString() : "";
        newLastMessageType = lastMessage.type || "text";
        newIsForwarded = !!lastMessage.forwardedFromType;
      } catch (err) {
        console.error("Error decrypting last message:", err);
        newLastMessage = lastMessage.filename || "";
      }
    }

    console.log("🔄 API: Updating lastMessage after deletion:", {
      messageId,
      newLastMessage,
      newTime,
      hasLastMessage: !!lastMessage
    });


    for (const chat of chats) {
      await chat.update({ 
        lastMessage: newLastMessage 
      });
      
   
      await invalidateChat(chat.userId, chat.partnerId);
      await invalidateChat(chat.partnerId, chat.userId);
      
   
      req.io.to(`user_${chat.userId}`).emit("lastMessageUpdated", {
        partnerId: chat.partnerId,
        lastMessage: newLastMessage, 
        lastMessageType: newLastMessageType,
        isForwarded: newIsForwarded,
        time: newTime,
      });

      console.log(`✅ API: Sent lastMessageUpdated to user_${chat.userId}:`, {
        partnerId: chat.partnerId,
        lastMessage: newLastMessage,
        time: newTime
      });
    }

    
    if (wasUnread) {
      const unreadCount = await Message.count({
        where: {
          fromUserId: fromUserId,
          toUserId: toUserId,
          isRead: false,
          isDeleted: false,
        },
      });

      
      req.io.to(`user_${toUserId}`).emit("chatUpdated", {
        partnerId: fromUserId,
        unreadCount: unreadCount,
      });

      req.io.to(`user_${fromUserId}`).emit("chatUpdated", {
        partnerId: toUserId,
        unreadCount: 0, 
      });

      console.log(`Updated unread count after message deletion: ${unreadCount} for user ${toUserId}`);
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("Ошибка в маршруте deleteMessage:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

router.post("/react", async (req, res) => {
  const { messageId, userId, emoji } = req.body;

  try {
    const reaction = await Reaction.create({ messageId, userId, emoji });
    req.io.emit("reactionAdded", reaction);
    res.json(reaction);
  } catch (error) {
    res.status(500).json({ error: "Ошибка при добавлении реакции" });
  }
});

router.get("/reactions/:messageId", async (req, res) => {
  const { messageId } = req.params;

  try {
    const reactions = await Reaction.findAll({ where: { messageId } });
    res.json(reactions);
  } catch (error) {
    res.status(500).json({ error: "Ошибка при получении реакций" });
  }
});

router.post("/removeReaction", async (req, res) => {
  const { messageId, userId, emoji } = req.body;

  try {
    const reaction = await Reaction.findOne({
      where: { messageId, userId, emoji },
    });

    if (reaction) {
      await reaction.destroy();
      req.io.emit("reactionRemoved", { messageId, userId, emoji });
      return res.status(200).json({ success: true });
    }

    return res.status(404).json({ error: "Реакция не найдена" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Ошибка при удалении реакции" });
  }
});

router.get("/unreadCounts", async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    const unreadCounts = await Message.count({
      where: {
        toUserId: userId,
        isRead: false,
        isDeleted: false,
      },
      group: ["fromUserId"],
    });

    res.json(unreadCounts);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/getChats", async (req, res) => {
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ error: "userId is required" });
  }

  try {
    // НЕ используем кэш для списка чатов, так как:
    // 1. Ключ кэша неправильный (userId, userId вместо userId, partnerId)
    // 2. Список чатов часто обновляется (новые сообщения, новые чаты)
    // 3. Кэш может показывать устаревшие данные для lastMessage
    // const cachedChats = await getCachedChat(userId, userId);
    // if (cachedChats) {
    //   return res.status(200).json(cachedChats);
    // }

    const chats = await Chat.findAll({
      where: { userId },
      include: [
        {
          model: User,
          as: "partner",
          attributes: ["id", "username", "nickname", "email", "avatar", "ghostMode"],
          required: false,
        },
      ],
    });

    const { isUserOnline } = require("../utils/redisClient");

    const partnerIds = chats.map((c) => c.partnerId);

    // === Вместо N+1 (по 2 запроса на каждый чат) — 2 batch-запроса на ВСЕ ===
    // 1) Последнее сообщение по каждому собеседнику (DISTINCT ON по "партнёру").
    const lastMsgByPartner = {};
    // 2) Кол-во непрочитанных от каждого собеседника (GROUP BY).
    const unreadByPartner = {};

    if (partnerIds.length) {
      const [lastRows, unreadRows] = await Promise.all([
        sequelize.query(
          `SELECT DISTINCT ON (partner)
                  partner, "text", "type", "createdAt", "forwardedFromType"
             FROM (
               SELECT *,
                      CASE WHEN "fromUserId" = :userId
                           THEN "toUserId" ELSE "fromUserId" END AS partner
                 FROM "Messages"
                WHERE ("fromUserId" = :userId OR "toUserId" = :userId)
                  AND "isDeleted" = false
             ) sub
            WHERE partner IN (:partnerIds)
            ORDER BY partner, "createdAt" DESC`,
          { replacements: { userId, partnerIds }, type: QueryTypes.SELECT }
        ),
        sequelize.query(
          `SELECT "fromUserId" AS partner, COUNT(*)::int AS cnt
             FROM "Messages"
            WHERE "toUserId" = :userId
              AND "isRead" = false
              AND "isDeleted" = false
              AND "fromUserId" IN (:partnerIds)
            GROUP BY "fromUserId"`,
          { replacements: { userId, partnerIds }, type: QueryTypes.SELECT }
        ),
      ]);
      for (const r of lastRows) lastMsgByPartner[r.partner] = r;
      for (const r of unreadRows) unreadByPartner[r.partner] = r.cnt;
    }

    const chatsWithDetails = await Promise.all(
      chats.map(async (chat) => {
        const lastMessage = lastMsgByPartner[chat.partnerId];
        const unreadCount = unreadByPartner[chat.partnerId] || 0;

        // isUserOnline — обращение в Redis (быстрое), оставляем параллельным.
        let isOnline = false;
        if (chat.partner && chat.partner.ghostMode) {
          isOnline = false;
        } else {
          isOnline = await isUserOnline(chat.partnerId);
        }

        let lastMessageText = "";
        let lastMessageTime = "";
        let lastMessageType = "text";
        let isForwarded = false;

        if (lastMessage) {
          try {
            lastMessageText = decrypt(lastMessage.text) || "";
            lastMessageTime = lastMessage.createdAt
              ? new Date(lastMessage.createdAt).toISOString()
              : "";
            lastMessageType = lastMessage.type || "text";
            isForwarded = !!lastMessage.forwardedFromType;
          } catch (err) {
            console.error("Error decrypting last message in getChats:", err);
            lastMessageText = "";
          }
        }

        return {
          partnerId: chat.partnerId,
          username: chat.partner
            ? chat.partner.username || chat.partner.nickname || "Unknown User"
            : "Unknown User",
          bio: chat.partner ? `Email: ${chat.partner.email || "N/A"}` : "N/A",
          picture: chat.partner ? chat.partner.avatar || null : null,
          lastMessage: lastMessageText,
          lastMessageType: lastMessageType,
          isForwarded: isForwarded,
          time: lastMessageTime,
          unreadCount: unreadCount || 0,
          isOnline,
        };
      })
    );


    // await cacheChat(userId, userId, chatsWithDetails);

    return res.status(200).json(chatsWithDetails);
  } catch (err) {
    console.error("Error fetching chats:", err);
    return res.status(500).json({ error: "Server error" });
  }
});


router.get("/user/:userId/online", async (req, res) => {
  try {
    const { userId } = req.params;
    const { isUserOnline } = require("../utils/redisClient");
    

    const user = await User.findByPk(userId, {
      attributes: ["id", "ghostMode"],
    });
    
    let online = false;
    
    if (user && user.ghostMode) {
      online = false;
    } else {
      online = await isUserOnline(userId);
    }
    
    return res.status(200).json({ userId, isOnline: online });
  } catch (err) {
    console.error("Error checking user online status:", err);
    return res.status(500).json({ error: "Server error" });
  }
});


router.get("/users/online", async (req, res) => {
  try {
    const { getOnlineUsers } = require("../utils/redisClient");
    const onlineUsers = await getOnlineUsers();
    return res.status(200).json({ onlineUsers });
  } catch (err) {
    console.error("Error getting online users:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// ==================== FORWARD MESSAGE ====================
router.post("/forward", async (req, res) => {
  const { userId, sourceMessage, destinations } = req.body;

  if (!userId || !sourceMessage || !destinations || !Array.isArray(destinations) || destinations.length === 0) {
    return res.status(400).json({ error: "userId, sourceMessage and destinations are required" });
  }

  let { text, type } = sourceMessage;
  const { fileUrl, filename, senderUsername, sourceType, id: sourceId } = sourceMessage;

  // For polls, load the source poll (with options) so destinations can re-host
  // it as a real, votable poll. Direct/channel share the same poll (rendered by
  // pollId); groups get a fresh duplicate linked to the new group message.
  let sourcePoll = null;
  if (type === "poll") {
    const where = sourceMessage.pollId
      ? { id: sourceMessage.pollId }
      : sourceType === "group" ? { groupMessageId: sourceId }
      : sourceType === "channel" ? { channelMessageId: sourceId }
      : { messageId: sourceId };
    sourcePoll = await Poll.findOne({ where, include: [{ model: PollOption, as: "options" }] });
    if (sourcePoll && (!text || !String(text).trim())) text = sourcePoll.question;
  }
  const sourcePollId = sourcePoll?.id || sourceMessage.pollId || null;

  // Create an independent copy of a poll for a group (the group's polls are
  // looked up by groupMessageId, so a shared poll wouldn't appear there).
  const duplicatePollForGroup = async (groupId, groupMessageId) => {
    const np = await Poll.create({
      creatorId: userId,
      groupId,
      groupMessageId,
      question: sourcePoll.question,
      isAnonymous: sourcePoll.isAnonymous,
      allowMultipleAnswers: sourcePoll.allowMultipleAnswers,
      isMultipleChoice: sourcePoll.isMultipleChoice,
      isQuiz: sourcePoll.isQuiz,
      correctOptionIndex: sourcePoll.correctOptionIndex,
      explanation: sourcePoll.explanation,
    });
    const opts = (sourcePoll.options || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));
    const created = await Promise.all(
      opts.map((o, i) => PollOption.create({ pollId: np.id, text: o.text, order: o.order ?? i }))
    );
    return { poll: np, options: created };
  };

  try {
    const senderUser = await User.findByPk(userId, {
      attributes: ["id", "username", "nickname", "avatar"],
    });
    if (!senderUser) {
      return res.status(404).json({ error: "User not found" });
    }

    const results = [];

    for (const dest of destinations) {
      try {
        // ---- DIRECT ----
        if (dest.type === "direct") {
          const toUserId = dest.id;

          const blockFromTo = await BlockedUser.findOne({
            where: { blockerId: userId, blockedId: toUserId },
          });
          const blockToFrom = await BlockedUser.findOne({
            where: { blockerId: toUserId, blockedId: userId },
          });
          if (blockFromTo || blockToFrom) {
            results.push({ dest, error: "blocked" });
            continue;
          }

          const encryptedText = encrypt(text || "");
          const newMessage = await Message.create({
            fromUserId: userId,
            toUserId,
            text: encryptedText,
            type: type || "text",
            pollId: type === "poll" ? sourcePollId : null,
            fileUrl: fileUrl || null,
            filename: filename || null,
            replyToId: null,
            isRead: false,
            forwardedFromType: sourceType || "direct",
            forwardedFromId: sourceId || null,
            forwardedFromUsername: senderUsername || null,
          });


          const chatExistsForSender = await Chat.findOne({ where: { userId, partnerId: toUserId } });
          if (!chatExistsForSender) await Chat.create({ userId, partnerId: toUserId });
          const chatExistsForReceiver = await Chat.findOne({ where: { userId: toUserId, partnerId: userId } });
          if (!chatExistsForReceiver) await Chat.create({ userId: toUserId, partnerId: userId });

          const messageData = {
            ...newMessage.toJSON(),
            text: text || "",
            createdAt: newMessage.createdAt.toISOString(),
            tempId: null,
            replyTo: null,
            reactions: [],
          };

          const chatKey = `${Math.min(userId, toUserId)}_${Math.max(userId, toUserId)}`;
          const roomName = `chat_${chatKey}`;
          req.io.to(roomName).emit("messageReceived", messageData);
          req.io.to(`user_${toUserId}`).emit("messageReceived", messageData);
          req.io.to(`user_${userId}`).emit("messageReceived", messageData);


          let lastMessageText = "";
          if (text && text.trim() !== "") lastMessageText = text;
          else if (filename) lastMessageText = `File: ${filename}`;
          else if (type === "image" && fileUrl) lastMessageText = "📷 Image";
          else lastMessageText = "Empty message";

          const senderChat = await Chat.findOne({ where: { userId, partnerId: toUserId } });
          const recipientChat = await Chat.findOne({ where: { userId: toUserId, partnerId: userId } });
          if (senderChat) {
            await senderChat.update({ lastMessage: lastMessageText });
            await invalidateChat(userId, toUserId);
          }
          if (recipientChat) {
            await recipientChat.update({ lastMessage: lastMessageText });
            await invalidateChat(toUserId, userId);
          }

          const lastMessageTime = newMessage.createdAt.toISOString();
          req.io.to(`user_${toUserId}`).emit("lastMessageUpdated", {
            partnerId: userId,
            lastMessage: lastMessageText,
            lastMessageType: type || "text",
            isForwarded: true,
            time: lastMessageTime,
          });
          req.io.to(`user_${userId}`).emit("lastMessageUpdated", {
            partnerId: toUserId,
            lastMessage: lastMessageText,
            lastMessageType: type || "text",
            isForwarded: true,
            time: lastMessageTime,
          });

          let senderInfo = await getCachedUserProfile(userId);
          if (!senderInfo) {
            senderInfo = senderUser.toJSON();
            await cacheUserProfile(userId, senderInfo);
          }
          let recipientInfo = await getCachedUserProfile(toUserId);
          if (!recipientInfo) {
            const recipientUser = await User.findByPk(toUserId, {
              attributes: ["id", "username", "nickname", "email", "avatar"],
            });
            if (recipientUser) {
              recipientInfo = recipientUser.toJSON();
              await cacheUserProfile(toUserId, recipientInfo);
            }
          }

          const unreadCount = await Message.count({
            where: { fromUserId: userId, toUserId, isRead: false, isDeleted: false },
          });

          req.io.to(`user_${toUserId}`).emit("chatUpdated", {
            partnerId: userId,
            partnerInfo: senderInfo,
            lastMessage: messageData,
            unreadCount,
          });
          req.io.to(`user_${userId}`).emit("chatUpdated", {
            partnerId: toUserId,
            partnerInfo: recipientInfo,
            lastMessage: messageData,
            unreadCount: 0,
          });

          await invalidateMessages(chatKey);
          results.push({ dest, success: true, messageId: newMessage.id });

        // ---- GROUP ----
        } else if (dest.type === "group") {
          const groupId = dest.id;

          const membership = await GroupUser.findOne({
            where: { groupId, userId },
          });
          if (!membership) {
            results.push({ dest, error: "not_member" });
            continue;
          }

          const isGroupPoll = type === "poll" && sourcePoll;
          const gType = isGroupPoll ? "poll" : (type || "text");
          const gText = isGroupPoll ? (text || sourcePoll.question || "") : (text || "");
          const encryptedText = encrypt(gText);
          const newMessage = await GroupMessage.create({
            groupId,
            userId,
            text: encryptedText,
            type: gType,
            fileUrl: fileUrl || null,
            filename: filename || null,
            replyToId: null,
            readBy: [userId],
            forwardedFromType: sourceType || "direct",
            forwardedFromId: sourceId || null,
            forwardedFromUsername: senderUsername || null,
          });

          const sender = await User.findByPk(userId, { attributes: ["id", "username"] });

          // A forwarded poll is re-hosted as an independent poll in this group.
          // Emitted as a plain object (the client's groupMessageReceived handler
          // accepts both protobuf buffers and plain JSON) so it renders live.
          if (isGroupPoll) {
            const dup = await duplicatePollForGroup(Number(groupId), newMessage.id);
            await newMessage.update({ pollId: dup.poll.id });
            req.io.to(`group_${groupId}`).emit("groupMessageReceived", {
              id: newMessage.id,
              groupId: Number(groupId),
              userId,
              text: gText,
              type: "poll",
              pollId: dup.poll.id,
              poll: {
                ...dup.poll.toJSON(),
                options: dup.options.map((o) => ({ ...o.toJSON(), votesCount: 0 })),
                totalVotes: 0,
              },
              sender: { id: sender.id, username: sender.username },
              readBy: newMessage.readBy || [userId],
              createdAt: newMessage.createdAt,
            });
          } else {
            // Build protobuf
            const protoMessage = new chat.GroupMessage();
            protoMessage.id = newMessage.id;
            protoMessage.groupId = Number(groupId);
            protoMessage.userId = userId;
            protoMessage.text = gText;
            protoMessage.type = newMessage.type;
            if (newMessage.fileUrl) protoMessage.fileUrl = newMessage.fileUrl;
            if (newMessage.filename) protoMessage.filename = newMessage.filename;
            const protoSender = new chat.Sender();
            protoSender.id = sender.id;
            protoSender.username = sender.username;
            protoMessage.sender = protoSender;
            protoMessage.isDeleted = false;
            protoMessage.createdAt = new Date(newMessage.createdAt).getTime();
            protoMessage.updatedAt = new Date(newMessage.updatedAt).getTime();
            protoMessage.readBy = newMessage.readBy || [userId];
            protoMessage.forwardedFromType = sourceType || "";
            protoMessage.forwardedFromId = sourceId || 0;
            protoMessage.forwardedFromUsername = senderUsername || "";

            const buffer = chat.GroupMessage.encode(protoMessage).finish();
            req.io.to(`group_${groupId}`).emit("groupMessageReceived", buffer);
          }

          // Notify EVERY member's groups list (including the sender — the client
          // ignores the unread bump for senderId===me but still needs the
          // lastMessage update). Mirror the full payload the normal send path
          // emits, otherwise the row's preview gets wiped to blank/"text".
          const groupMembers = await GroupUser.findAll({
            where: { groupId },
            attributes: ["userId"],
          });
          groupMembers.forEach((member) => {
            req.io.to(`user_${member.userId}`).emit("newGroupMessage", {
              groupId,
              senderId: userId,
              messageId: newMessage.id,
              lastMessage: gText || "",
              lastMessageType: gType || "text",
              lastMessageSender: sender?.username || "",
              lastMessageTime: newMessage.createdAt
                ? new Date(newMessage.createdAt).toISOString()
                : "",
              lastMessageIsForwarded: true,
            });
          });

          await invalidateGroupMessages(groupId);
          results.push({ dest, success: true, messageId: newMessage.id });

        // ---- CHANNEL ----
        } else if (dest.type === "channel") {
          const channelId = dest.id;

          const channel = await Channel.findByPk(channelId);
          if (!channel) {
            results.push({ dest, error: "channel_not_found" });
            continue;
          }

          const channelUser = await ChannelUser.findOne({
            where: { channelId, userId },
          });
          if (!channelUser && channel.ownerId !== userId) {
            results.push({ dest, error: "not_member" });
            continue;
          }

          // Channels use JSON messages with a pollId column, so a forwarded
          // poll can be re-hosted as a real, votable poll (unlike groups).
          const isPoll = type === "poll";
          const chType = type || "text";
          const chText = isPoll ? (text || "") : text;
          const chPollId = isPoll ? sourcePollId : null;
          const encryptedText = chText ? encrypt(chText) : null;
          const newMessage = await ChannelMessage.create({
            channelId,
            userId,
            text: encryptedText,
            fileUrl: fileUrl || null,
            filename: filename || null,
            type: chType,
            pollId: chPollId,
            replyToId: null,
            forwardedFromType: sourceType || "direct",
            forwardedFromId: sourceId || null,
            forwardedFromUsername: senderUsername || null,
          });

          const sender = await User.findByPk(userId, { attributes: ["id", "username"] });

          const members = await ChannelUser.findAll({
            where: { channelId },
            attributes: ["userId"],
          });
          members.map((m) => m.userId).forEach((mId) => {
            req.io.to(`user_${mId}`).emit("channelMessageReceived", {
              id: newMessage.id,
              channelId,
              userId,
              text: chText || null,
              fileUrl: fileUrl || null,
              filename: filename || null,
              type: chType,
              pollId: chPollId,
              replyToId: null,
              createdAt: newMessage.createdAt,
              sender: { id: sender.id, username: sender.username },
              forwardedFromType: sourceType || null,
              forwardedFromId: sourceId || null,
              forwardedFromUsername: senderUsername || null,
            });
          });

          req.io.to(`channel_${channelId}`).emit("channelMessageReceived", {
            ...newMessage.get({ plain: true }),
            text: chText || null,
            sender: { id: sender.id, username: sender.username },
          });

          await invalidateChannelMessages(channelId);
          results.push({ dest, success: true, messageId: newMessage.id });
        }
      } catch (destErr) {
        console.error(`Error forwarding to ${dest.type}:${dest.id}:`, destErr);
        results.push({ dest, error: destErr.message });
      }
    }

    return res.status(200).json({ success: true, results });
  } catch (err) {
    console.error("Error in forward:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

router.delete("/deleteChats", async (req, res) => {
  const { userId, partnerIds } = req.body;

  if (!userId || !partnerIds || !Array.isArray(partnerIds)) {
    return res
      .status(400)
      .json({ error: "userId and partnerIds are required" });
  }

  try {
    const deleted = await Chat.destroy({
      where: {
        userId,
        partnerId: { [Op.in]: partnerIds },
      },
    });

    if (deleted > 0) {
      req.io.to(`user_${userId}`).emit("chatsDeleted", { partnerIds });
      return res.status(200).json({ success: true, deletedCount: deleted });
    } else {
      return res.status(404).json({ error: "Чаты не найдены" });
    }
  } catch (err) {
    console.error("Ошибка в маршруте deleteChats:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;

