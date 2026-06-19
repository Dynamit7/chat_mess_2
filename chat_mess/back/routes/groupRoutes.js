const express = require("express");
const { Sequelize } = require("sequelize");
const { Group, GroupUser, User, GroupMessage, GroupMessageReaction, sequelize } = require("../models");
const { ENFORCE } = require("../middleware/enforceAuth"); // ownership-проверки (строгий режим)
const { v4: uuidv4 } = require("uuid");
const { Op } = require("sequelize");

const { uploadToMinio, generatePresignedUrl, deleteFromMinio } = require("../utils/minioClient");
const { uploadLarge } = require("../utils/multerConfig");
const { encrypt, decrypt } = require("../utils/encryption");
const {
  getCachedGroupMessages,
  cacheGroupMessages,
  invalidateGroupMessages,
  getCachedGroupsList,
  cacheGroupsList,
  invalidateGroupsList,
  getCachedGroupMembers,
  cacheGroupMembers,
  invalidateGroupMembers,
} = require("../utils/redisClient");

const router = express.Router();
const root = require("../proto/group_message_pb");
const chat = root.chat;

router.post("/", uploadLarge.single("avatar"), async (req, res) => {
  try {
    console.log("Загруженный файл:", req.file);
    const { userId, name, description, isPublic, members } = req.body;

    if (!userId || userId === "null" || isNaN(Number(userId))) {
      return res.status(400).json({ error: "Invalid user ID" });
    }

    const membersArray = JSON.parse(members || "[]");
    let avatar = null;

    if (req.file) {
      const fileName = `${Date.now()}-${req.file.originalname}`;
      await uploadToMinio(req.file.buffer, fileName, req.file.mimetype);
      avatar = generatePresignedUrl(fileName);
    }

    const newGroup = await Group.create({
      name,
      description,
      isPublic,
      inviteLink: uuidv4(),
      ownerId: Number(userId),
      avatar,
      images: avatar ? [avatar] : [],
    });

    await GroupUser.create({
      groupId: newGroup.id,
      userId: Number(userId),
      role: "admin",
    });

    if (Array.isArray(membersArray)) {
      await Promise.all(
        membersArray.map(async (memberId) => {
          if (String(memberId) !== String(userId)) {
            await GroupUser.findOrCreate({
              where: { groupId: newGroup.id, userId: memberId },
              defaults: { role: "member" },
            });
          }
        })
      );
    }

    const allMembers = [Number(userId), ...membersArray.map(Number)];

    const groupPlain = newGroup.get({ plain: true });
    groupPlain.members = allMembers;

    // Инвалидируем кэш ПЕРЕД эмитом: иначе клиент по событию groupCreated успеет
    // перезагрузить список и прочитать ещё не сброшенный кэш (без новой группы).
    await Promise.all(allMembers.map((mId) => invalidateGroupsList(mId)));
    allMembers.forEach((mId) => {
      req.io.to(`user_${mId}`).emit("groupCreated", groupPlain);
    });

    return res.json(newGroup);
  } catch (err) {
    console.error("Ошибка при создании группы:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

router.get("/", async (req, res) => {
  try {
    const { search, userId } = req.query;
    
    const validUserId =
      userId && userId !== "null" && !isNaN(Number(userId))
        ? Number(userId)
        : null;

    // Проверяем кэш
    if (validUserId) {
      const cachedGroups = await getCachedGroupsList(validUserId, search);
      if (cachedGroups) {
        return res.json(cachedGroups);
      }
    }
    
    let whereClause = {};

    if (validUserId) {
      if (!search) {
        whereClause = {
          [Op.or]: [
            { ownerId: validUserId },
            { "$members.userId$": validUserId },
          ],
        };
      } else {
        whereClause = {
          name: { [Op.like]: `%${search}%` },
          [Op.or]: [
            { isPublic: true },
            { ownerId: validUserId },
            { "$members.userId$": validUserId },
          ],
        };
      }
    } else {
      whereClause = { isPublic: true };
      if (search) {
        whereClause.name = { [Op.like]: `%${search}%` };
      }
    }

    const groups = await Group.findAll({
      where: whereClause,
      include: [
        {
          model: GroupUser,
          as: "members",
          required: false,
        },
      ],
    });

    // Последнее сообщение для ВСЕХ групп одним запросом (вместо N запросов
    // GroupMessage.findOne в цикле — классический N+1). Postgres DISTINCT ON
    // берёт по одной самой свежей строке на группу; индекс (groupId, createdAt)
    // делает это быстрым.
    const groupIds = groups.map((g) => g.id);
    const lastMsgByGroup = {};
    if (groupIds.length) {
      const rows = await sequelize.query(
        `SELECT DISTINCT ON (gm."groupId")
                gm."groupId", gm."text", gm."type", gm."createdAt",
                gm."forwardedFromType", u."username" AS "senderUsername"
           FROM "GroupMessages" gm
           LEFT JOIN "Users" u ON u."id" = gm."userId"
          WHERE gm."groupId" IN (:groupIds) AND gm."isDeleted" = false
          ORDER BY gm."groupId", gm."createdAt" DESC`,
        {
          replacements: { groupIds },
          type: Sequelize.QueryTypes.SELECT,
        }
      );
      for (const r of rows) lastMsgByGroup[r.groupId] = r;
    }

    const result = groups.map((g) => {
      const plain = g.get({ plain: true });
      const isMember = validUserId
        ? plain.members.some((m) => m.userId == validUserId)
        : false;

      let lastMessageText = "";
      let lastMessageTime = "";
      let lastMessageType = "text";
      let lastMessageIsForwarded = false;
      let lastMessageSender = "";

      const lastMsg = lastMsgByGroup[g.id];
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
        lastMessageSender = lastMsg.senderUsername || "";
      }

      return {
        ...plain,
        isMember,
        lastMessage: lastMessageText,
        lastMessageTime,
        lastMessageType,
        lastMessageIsForwarded,
        lastMessageSender,
      };
    });

    // Кэшируем результат
    if (validUserId) {
      await cacheGroupsList(validUserId, search, result);
    }

    return res.json(result);
  } catch (err) {
    console.error("Ошибка при поиске групп:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

router.get("/members/:groupId", async (req, res) => {
  try {
    const { groupId } = req.params;
    
    // Проверяем кэш
    const cachedMembers = await getCachedGroupMembers(groupId);
    if (cachedMembers) {
      return res.json(cachedMembers);
    }
    
    const groupUsers = await GroupUser.findAll({
      where: { groupId },
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "username", "nickname", "avatar"],
        },
      ],
    });
    let members = groupUsers.map((item) => item.user).filter(Boolean);

    // Убеждаемся, что владелец есть в списке (на случай старых групп, где
    // создатель не был записан в group_users) — как в каналах.
    const group = await Group.findByPk(groupId);
    if (group) {
      const ownerInList = members.some(
        (m) => String(m.id) === String(group.ownerId)
      );
      if (!ownerInList) {
        const owner = await User.findByPk(group.ownerId, {
          attributes: ["id", "username", "nickname", "avatar"],
        });
        if (owner) members = [owner, ...members];
      }
    }

    // Кэшируем результат
    await cacheGroupMembers(groupId, members);

    return res.json(members);
  } catch (err) {
    console.error("Ошибка при получении участников группы:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

router.get("/id/:groupId", async (req, res) => {
  try {
    const { groupId } = req.params;
    const group = await Group.findByPk(groupId);
    if (!group) {
      return res.status(404).json({ error: "Группа не найдена" });
    }
    return res.json(group);
  } catch (err) {
    console.error("Ошибка при получении группы по ID:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

router.get("/:inviteLink", async (req, res) => {
  try {
    const { inviteLink } = req.params;
    const group = await Group.findOne({
      where: { inviteLink },
      include: [{ model: User, as: "owner", attributes: ["id", "username"] }],
    });

    if (!group) {
      return res.status(404).json({ error: "Группа не найдена" });
    }
    return res.json(group);
  } catch (err) {
    console.error("Ошибка при получении группы по inviteLink:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

router.post("/:id/join", async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, addedBy } = req.body;

    if (!userId || userId === "null" || isNaN(Number(userId))) {
      return res.status(400).json({ error: "Invalid user ID" });
    }

    const userIdNum = Number(userId);
    const group = await Group.findByPk(id);
    if (!group) {
      return res.status(404).json({ error: "Группа не найдена" });
    }
    if (!group.isPublic) {
      if (!addedBy || Number(addedBy) !== Number(group.ownerId)) {
        return res
          .status(403)
          .json({
            error: "Это приватная группа, доступ разрешен только владельцем",
          });
      }
    }
    const [membership, created] = await GroupUser.findOrCreate({
      where: { groupId: id, userId: userIdNum },
      defaults: { role: "member" },
    });
    if (!created) {
      return res.json({ message: "Пользователь уже в группе", membership });
    }
    req.io
      .to(`user_${userIdNum}`)
      .emit("groupAdded", { groupId: id, groupName: group.name });
    
    // Инвалидируем кэш списка групп и участников
    await invalidateGroupsList(userIdNum);
    await invalidateGroupMembers(id);
    
    return res.json({ message: "Пользователь добавлен в группу", membership });
  } catch (err) {
    console.error("Ошибка при join:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

router.post("/:groupId/message", uploadLarge.single("file"), async (req, res) => {
  try {
    const { groupId } = req.params;
    const { userId, text, replyToId, messageType: requestedType } = req.body;

    if (!userId || userId === "null" || isNaN(Number(userId))) {
      return res.status(400).json({ error: "Invalid user ID" });
    }

    const userIdNum = Number(userId);
    let messageType = "text";
    let fileUrl = null;
    let filename = null;

    if (req.file) {
      const fileName = `${Date.now()}-${req.file.originalname}`;
      await uploadToMinio(req.file.buffer, fileName, req.file.mimetype);
      fileUrl = generatePresignedUrl(fileName);
      filename = req.file.originalname;

      // Allow explicit type override (e.g. video_circle)
      if (requestedType === "video_circle") {
        messageType = "video_circle";
      } else if (req.file.mimetype.startsWith("image/")) {
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

    const newMessage = await GroupMessage.create({
      groupId,
      userId: userIdNum,
      text: encryptedText,
      type: messageType,
      fileUrl,
      filename,
      replyToId: replyToId || null,
      readBy: [userIdNum],
    });

    if (replyToId) {
      const repliedMessage = await GroupMessage.findByPk(replyToId, {
        include: [
          { model: User, as: "sender", attributes: ["id", "username"] },
        ],
      });
      newMessage.repliedMessage = repliedMessage;
    }

    const sender = await User.findByPk(userIdNum, {
      attributes: ["id", "username"],
    });

    const protoMessage = new chat.GroupMessage();
    protoMessage.id = newMessage.id;
    protoMessage.groupId = Number(groupId);
    protoMessage.userId = userIdNum;
    protoMessage.text = text || "";
    protoMessage.type = newMessage.type;
    if (newMessage.fileUrl) protoMessage.fileUrl = newMessage.fileUrl;
    if (newMessage.filename) protoMessage.filename = newMessage.filename;
    if (newMessage.replyToId) protoMessage.replyToId = newMessage.replyToId;
    const protoSender = new chat.Sender();
    protoSender.id = sender.id;
    protoSender.username = sender.username;
    protoMessage.sender = protoSender;
    protoMessage.isDeleted = newMessage.isDeleted;
    protoMessage.createdAt = new Date(newMessage.createdAt).getTime();
    protoMessage.updatedAt = new Date(newMessage.updatedAt).getTime();
    protoMessage.readBy = newMessage.readBy || [userIdNum];
    if (newMessage.repliedMessage) {
      const repliedProto = new chat.GroupMessage();
      repliedProto.id = newMessage.repliedMessage.id;
      repliedProto.text = decrypt(newMessage.repliedMessage.text) || "";
      repliedProto.type = newMessage.repliedMessage.type;
      if (newMessage.repliedMessage.fileUrl)
        repliedProto.fileUrl = newMessage.repliedMessage.fileUrl;
      if (newMessage.repliedMessage.filename)
        repliedProto.filename = newMessage.repliedMessage.filename;
      const repliedSender = new chat.Sender();
      repliedSender.id = newMessage.repliedMessage.sender.id;
      repliedSender.username = newMessage.repliedMessage.sender.username;
      repliedProto.sender = repliedSender;
      repliedProto.readBy = newMessage.repliedMessage.readBy || [
        newMessage.repliedMessage.userId,
      ];
      protoMessage.repliedMessage = repliedProto;
    }

    const buffer = chat.GroupMessage.encode(protoMessage).finish();
    req.io.to(`group_${groupId}`).emit("groupMessageReceived", buffer);

    const groupMembers = await GroupUser.findAll({
      where: { groupId, userId: { [Op.ne]: userIdNum } },
      attributes: ["userId"],
    });
    const memberIds = groupMembers.map((member) => member.userId);

    memberIds.forEach((memberId) => {
      req.io.to(`user_${memberId}`).emit("newGroupMessage", {
        groupId,
        senderId: userIdNum,
        messageId: newMessage.id,
        lastMessage: text || "",
        lastMessageType: newMessage.type || "text",
        lastMessageSender: sender?.username || "",
        lastMessageTime: newMessage.createdAt ? new Date(newMessage.createdAt).toISOString() : "",
        lastMessageIsForwarded: !!newMessage.forwardedFromType,
      });
    });

    console.log(
      `Sent newGroupMessage for group ${groupId}, message ${
        newMessage.id
      } to users: ${memberIds.join(", ")}`
    );

    // Инвалидируем кэш сообщений и список групп для всех участников
    await invalidateGroupMessages(groupId);
    const allMemberIds = [userIdNum, ...memberIds];
    await Promise.all(allMemberIds.map((mId) => invalidateGroupsList(mId)));

    return res.json({ id: newMessage.id });
  } catch (error) {
    console.error("Error sending message:", error);
    return res.status(500).json({ error: "Server error" });
  }
});

// Строит protobuf-сообщение группы из строки БД (Sequelize-модель) либо из
// объекта кэша. Текст расшифровывается только для моделей — в кэше он уже plain.
function buildGroupProtoMessage(msg, groupId, userIdNum) {
  const protoMessage = new chat.GroupMessage();
  protoMessage.id = msg.id;
  protoMessage.groupId = Number(groupId);
  protoMessage.userId = msg.userId;
  protoMessage.text = typeof msg.get === "function" ? (decrypt(msg.text) || "") : (msg.text || "");
  protoMessage.type = msg.type;
  if (msg.fileUrl) protoMessage.fileUrl = msg.fileUrl;
  if (msg.filename) protoMessage.filename = msg.filename;
  if (msg.replyToId) protoMessage.replyToId = msg.replyToId;
  const protoSender = new chat.Sender();
  protoSender.id = msg.sender.id;
  protoSender.username = msg.sender.username;
  protoMessage.sender = protoSender;
  protoMessage.isDeleted = msg.isDeleted;
  protoMessage.createdAt = new Date(msg.createdAt).getTime();
  protoMessage.updatedAt = new Date(msg.updatedAt).getTime();
  protoMessage.readBy = (userIdNum && msg.userId === userIdNum) ? (msg.readBy || [msg.userId]) : [];
  if (msg.forwardedFromType) protoMessage.forwardedFromType = msg.forwardedFromType;
  if (msg.forwardedFromId) protoMessage.forwardedFromId = msg.forwardedFromId;
  if (msg.forwardedFromUsername) protoMessage.forwardedFromUsername = msg.forwardedFromUsername;
  if (msg.repliedMessage) {
    const repliedProto = new chat.GroupMessage();
    repliedProto.id = msg.repliedMessage.id;
    repliedProto.text = typeof msg.get === "function" ? (decrypt(msg.repliedMessage.text) || "") : (msg.repliedMessage.text || "");
    repliedProto.type = msg.repliedMessage.type;
    if (msg.repliedMessage.fileUrl) repliedProto.fileUrl = msg.repliedMessage.fileUrl;
    if (msg.repliedMessage.filename) repliedProto.filename = msg.repliedMessage.filename;
    const repliedSender = new chat.Sender();
    repliedSender.id = msg.repliedMessage.sender.id;
    repliedSender.username = msg.repliedMessage.sender.username;
    repliedProto.sender = repliedSender;
    repliedProto.readBy = (userIdNum && msg.repliedMessage.userId === userIdNum) ?
      (msg.repliedMessage.readBy || [msg.repliedMessage.userId]) : [];
    protoMessage.repliedMessage = repliedProto;
  }
  return protoMessage;
}

// Include-набор для загрузки сообщения группы (отправитель, ответ, реакции).
const GROUP_MESSAGE_INCLUDES = [
  { model: User, as: "sender", attributes: ["id", "username"] },
  {
    model: GroupMessage,
    as: "repliedMessage",
    include: [{ model: User, as: "sender", attributes: ["id", "username"] }],
  },
  { model: GroupMessageReaction, as: "reactions", attributes: ["id", "userId", "emoji"] },
];

router.get("/:groupId/messages", async (req, res) => {
  try {
    const { groupId } = req.params;
    const { userId, limit, before } = req.query;

    if (userId && userId !== "null" && !isNaN(Number(userId))) {
      const userIdNum = Number(userId);
      const membership = await GroupUser.findOne({
        where: { groupId, userId: userIdNum },
      });
      if (membership) {
        await GroupUser.update(
          { lastSeen: new Date() },
          { where: { groupId, userId: userIdNum } }
        );
      }
    }

    const userIdNumEarly = userId && !isNaN(Number(userId)) ? Number(userId) : null;

    // --- Пагинация (опционально) ------------------------------------------
    // ?limit=N (&before=<messageId>) — отдаём последние N сообщений старше
    // курсора как страницу. Курсор пагинации (hasMore / nextBefore) едет в
    // заголовках X-Has-More / X-Next-Before, т.к. тело — protobuf-бинарь.
    // Кэш не используется (он хранит всю историю). Без параметров — старое
    // поведение (вся история + кэш), чтобы не сломать существующих клиентов.
    if (limit !== undefined) {
      const pageSize = Math.min(Math.max(parseInt(limit, 10) || 40, 1), 100);
      const where = { groupId, isDeleted: false };
      if (before && !isNaN(before)) where.id = { [Op.lt]: parseInt(before, 10) };
      const rows = await GroupMessage.findAll({
        where,
        order: [["createdAt", "DESC"]],
        limit: pageSize + 1,
        include: GROUP_MESSAGE_INCLUDES,
      });
      const hasMore = rows.length > pageSize;
      const page = (hasMore ? rows.slice(0, pageSize) : rows).reverse();
      const protoPage = page.map((msg) => buildGroupProtoMessage(msg, groupId, userIdNumEarly));
      const wrapper = new chat.GroupMessageList();
      wrapper.messages = protoPage;
      const buffer = chat.GroupMessageList.encode(wrapper).finish();
      res.setHeader("Content-Type", "application/octet-stream");
      res.setHeader("X-Has-More", hasMore ? "1" : "0");
      res.setHeader("X-Next-Before", page.length ? String(page[0].id) : "");
      return res.send(buffer);
    }

    // Проверяем кэш (кэшируем сырые данные, не protobuf)
    const cachedMessages = await getCachedGroupMessages(groupId);
    let messages;
    if (cachedMessages) {
      // Восстанавливаем объекты из кэша
      messages = cachedMessages;
    } else {
      messages = await GroupMessage.findAll({
        where: { groupId, isDeleted: false },
        order: [["createdAt", "ASC"]],
        include: [
          { model: User, as: "sender", attributes: ["id", "username"] },
          {
            model: GroupMessage,
            as: "repliedMessage",
            include: [
              { model: User, as: "sender", attributes: ["id", "username"] },
            ],
          },
          { model: GroupMessageReaction, as: "reactions", attributes: ["id", "userId", "emoji"] },
        ],
      });
      
      // Кэшируем сырые данные (расшифровываем текст для кэша)
      const messagesData = messages.map(msg => {
        const plain = msg.get({ plain: true });
        return {
          ...plain,
          text: decrypt(msg.text) || "", // Расшифровываем для кэша
          sender: plain.sender,
          repliedMessage: plain.repliedMessage ? {
            ...plain.repliedMessage,
            text: plain.repliedMessage.text ? decrypt(plain.repliedMessage.text) || "" : ""
          } : null
        };
      });
      await cacheGroupMessages(groupId, messagesData);
    }

    const userIdNum = userIdNumEarly;

    const protoMessages = messages.map((msg) => buildGroupProtoMessage(msg, groupId, userIdNum));

    const wrapper = new chat.GroupMessageList();
    wrapper.messages = protoMessages;
    const buffer = chat.GroupMessageList.encode(wrapper).finish();

    res.setHeader("Content-Type", "application/octet-stream");
    res.send(buffer);

  } catch (err) {
    console.error("Error loading group messages:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

router.get("/:userId/unread-counts", async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId || userId === "null" || isNaN(Number(userId))) {
      return res.status(400).json({ error: "Invalid user ID" });
    }
    const userIdNum = Number(userId);

    const userGroups = await GroupUser.findAll({
      where: { userId: userIdNum },
      attributes: ["groupId", "lastSeen"],
    });
    const unreadCounts = [];

    for (const group of userGroups) {
      const count = await GroupMessage.count({
        where: {
          groupId: group.groupId,
          createdAt: { [Op.gt]: group.lastSeen || new Date(0) },
          isDeleted: false,
          userId: { [Op.ne]: userIdNum },
        },
      });
      console.log(
        `Unread count for group ${group.groupId}: ${count}, lastSeen: ${group.lastSeen}`
      );
      unreadCounts.push({
        groupId: group.groupId,
        unreadCount: count,
      });
    }

    return res.json(unreadCounts);
  } catch (err) {
    console.error("Ошибка при получении непрочитанных сообщений:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

router.post("/:groupId/update-last-seen", async (req, res) => {
  try {
    const { groupId } = req.params;
    const { userId } = req.body;

    if (!userId || userId === "null" || isNaN(Number(userId))) {
      return res.status(400).json({ error: "Invalid user ID" });
    }

    const userIdNum = Number(userId);

    const user = await User.findByPk(userIdNum, { attributes: ["ghostMode"] });
    if (user && user.ghostMode) {
      return res.json({ success: false });
    }

    await GroupUser.update(
      { lastSeen: new Date() },
      {
        where: {
          groupId,
          userId: userIdNum,
        },
      }
    );

    const messages = await GroupMessage.findAll({
      where: {
        groupId,
        isDeleted: false,
        userId: { [Op.ne]: userIdNum },
        [Op.or]: [
          { readBy: { [Op.eq]: null } },
          { readBy: { [Op.eq]: [] } },
          Sequelize.literal(`NOT (${userIdNum} = ANY("readBy"))`),
        ],
      },
    });

    const updatedMessageIds = [];
    for (const message of messages) {
      const newReadBy = [...(message.readBy || []), userIdNum].filter(
        (id, index, self) => self.indexOf(id) === index
      );
      await message.update({ readBy: newReadBy });
      updatedMessageIds.push(message.id);
    }

    // Always invalidate cache on user entry so next GET fetches fresh readBy from DB
    await invalidateGroupMessages(groupId);

    if (updatedMessageIds.length > 0) {
      // Emit to group room (for senders who have GroupChatScreen open)
      req.io.to(`group_${groupId}`).emit("messagesRead", {
        groupId,
        userId: userIdNum,
        messageIds: updatedMessageIds,
      });

      // Also emit to each sender's personal room (so they receive it even from GroupsListScreen)
      const senderIds = [...new Set(messages.map((m) => m.userId))];
      senderIds.forEach((senderId) => {
        req.io.to(`user_${senderId}`).emit("messagesRead", {
          groupId,
          userId: userIdNum,
          messageIds: updatedMessageIds,
        });
      });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error("Ошибка при обновлении lastSeen:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

router.delete("/:id/leave", async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    if (!userId || userId === "null" || isNaN(Number(userId))) {
      return res.status(400).json({ error: "Invalid user ID" });
    }

    const userIdNum = Number(userId);

    const group = await Group.findByPk(id);
    if (!group) {
      return res.status(404).json({ error: "Группа не найдена" });
    }

    const membership = await GroupUser.findOne({
      where: { groupId: id, userId: userIdNum },
    });
    if (!membership) {
      return res.status(400).json({ error: "Вы не состоите в этой группе" });
    }

    await membership.destroy();

    // Инвалидируем кэш списка групп и участников
    await invalidateGroupsList(userIdNum);
    await invalidateGroupMembers(id);

    return res.json({ message: "Вы вышли из группы" });
  } catch (err) {
    console.error("Ошибка при выходе из группы:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

router.delete("/:groupId", async (req, res) => {
  try {
    const { groupId } = req.params;
    const { userId } = req.body;

    if (!userId || userId === "null" || isNaN(Number(userId))) {
      return res.status(400).json({ error: "Invalid user ID" });
    }

    const userIdNum = Number(userId);

    const group = await Group.findByPk(groupId);
    if (!group) {
      return res.status(404).json({ error: "Группа не найдена" });
    }

    if (group.ownerId != userIdNum) {
      return res
        .status(403)
        .json({ error: "Только владелец может удалять эту группу" });
    }

    if (group.avatar) {
      const fileName = group.avatar.split("/").pop();
      try {
        await deleteFromMinio(fileName);
      } catch (err) {
        console.error(`Failed to delete avatar ${fileName} from MinIO:`, err);
      }
    }

    if (group.images && group.images.length > 0) {
      for (const image of group.images) {
        const fileName = image.split("/").pop();
        try {
          await deleteFromMinio(fileName);
        } catch (err) {
          console.error(`Failed to delete image ${fileName} from MinIO:`, err);
        }
      }
    }

    await GroupUser.destroy({ where: { groupId } });
    await GroupMessage.destroy({ where: { groupId } });
    await group.destroy();

    // Инвалидируем все кэши группы
    await invalidateGroupMessages(groupId);
    await invalidateGroupMembers(groupId);
    await invalidateGroupsList(userIdNum);

    return res.json({ message: "Группа удалена" });
  } catch (err) {
    console.error("Ошибка при удалении группы:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

router.delete("/:groupId/members/:memberId", async (req, res) => {
  try {
    const { groupId, memberId } = req.params;
    const { userId } = req.body;

    if (!userId || userId === "null" || isNaN(Number(userId))) {
      return res.status(400).json({ error: "Invalid user ID" });
    }

    if (!memberId || memberId === "null" || isNaN(Number(memberId))) {
      return res.status(400).json({ error: "Invalid member ID" });
    }

    const userIdNum = Number(userId);
    const memberIdNum = Number(memberId);

    const group = await Group.findByPk(groupId);
    if (!group) {
      return res.status(404).json({ error: "Группа не найдена" });
    }

    if (group.ownerId !== userIdNum) {
      return res
        .status(403)
        .json({ error: "Только владелец может удалять участников" });
    }

    if (userIdNum === memberIdNum) {
      return res
        .status(400)
        .json({ error: "Вы не можете удалить самого себя" });
    }

    const member = await GroupUser.findOne({
      where: { groupId, userId: memberIdNum },
    });

    if (!member) {
      return res.status(404).json({ error: "Участник не найден в группе" });
    }

    await member.destroy();
    req.io.to(`user_${memberIdNum}`).emit("groupRemoved", { groupId });
    
    // Инвалидируем кэш участников и списка групп
    await invalidateGroupMembers(groupId);
    await invalidateGroupsList(memberIdNum);
    
    return res.json({ message: "Участник удален из группы" });
  } catch (err) {
    console.error("Ошибка при удалении участника:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

router.put("/:groupId", uploadLarge.single("avatar"), async (req, res) => {
  try {
    console.log("Запрос body:", req.body);
    console.log("Запрос file:", req.file);

    const { groupId } = req.params;
    const { name, isPublic, existingImages, userId } = req.body;

    if (!userId || userId === "null" || isNaN(Number(userId))) {
      return res.status(400).json({ error: "Invalid user ID" });
    }

    const userIdNum = Number(userId);
    let updatedImages = [];

    if (existingImages) {
      try {
        updatedImages = JSON.parse(existingImages);
      } catch (e) {
        updatedImages = [];
      }
    }

    const group = await Group.findByPk(groupId);
    if (!group) {
      return res.status(404).json({ error: "Группа не найдена" });
    }

    if (group.ownerId !== userIdNum) {
      return res
        .status(403)
        .json({ error: "Только владелец может редактировать группу" });
    }

    if (req.file) {
      const fileName = `${Date.now()}-${req.file.originalname}`;
      await uploadToMinio(req.file.buffer, fileName, req.file.mimetype);
      const newImage = generatePresignedUrl(fileName);
      updatedImages = [newImage, ...updatedImages];
      group.avatar = newImage;
    }

    group.name = name || group.name;
    group.isPublic = isPublic === "true" || isPublic === true;
    group.images = updatedImages;
    await group.save();

    req.io.to(`group_${groupId}`).emit("groupUpdated", {
      groupId,
      updatedFields: {
        name: group.name,
        images: updatedImages,
        avatar: group.avatar,
        isPublic: group.isPublic,
      },
    });

    // Инвалидируем кэш списка групп (нужно инвалидировать для всех участников)
    const members = await GroupUser.findAll({
      where: { groupId },
      attributes: ["userId"],
    });
    for (const member of members) {
      await invalidateGroupsList(member.userId);
    }

    return res.json({
      name: group.name,
      images: updatedImages,
      avatar: group.avatar,
      isPublic: group.isPublic,
    });
  } catch (error) {
    console.error("Ошибка при обновлении группы:", error);
    return res.status(500).json({ error: "Server error" });
  }
});

router.delete("/:groupId/messages", async (req, res) => {
  try {
    const { groupId } = req.params;
    const { userId } = req.body;

    if (!userId || userId === "null" || isNaN(Number(userId))) {
      return res.status(400).json({ error: "Invalid user ID" });
    }

    // В строгом режиме доверяем id из токена, а не из тела (его можно подделать).
    const userIdNum = ENFORCE && req.authUserId ? Number(req.authUserId) : Number(userId);

    const group = await Group.findByPk(groupId);
    if (!group) {
      return res.status(404).json({ error: "Группа не найдена" });
    }
    if (group.ownerId != userIdNum) {
      return res.status(403).json({ error: "Нет прав для очистки сообщений" });
    }

    const messages = await GroupMessage.findAll({ where: { groupId } });
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

    await GroupMessage.update({ isDeleted: true }, { where: { groupId } });

    req.io.to(`group_${groupId}`).emit("groupMessagesCleared", {
      groupId: String(groupId),
      clearedBy: userIdNum,
    });

    // Инвалидируем кэш сообщений группы
    await invalidateGroupMessages(groupId);

    // Notify all members to clear last message in Groups list
    const groupMembers = await GroupUser.findAll({ where: { groupId }, attributes: ["userId"] });
    const memberIds = groupMembers.map((m) => m.userId);
    await Promise.all(memberIds.map(async (memberId) => {
      req.io.to(`user_${memberId}`).emit("newGroupMessage", {
        groupId: String(groupId),
        senderId: null,
        messageId: null,
        lastMessage: null,
        lastMessageType: null,
        lastMessageSender: null,
        lastMessageTime: null,
        lastMessageIsForwarded: false,
        unreadCount: 0, // все удалены → 0 непрочитанных
      });
      await invalidateGroupsList(memberId);
    }));

    return res.json({ message: "Все сообщения очищены (soft delete)" });
  } catch (err) {
    console.error("Ошибка при очистке сообщений:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

router.post("/:groupId/report", async (req, res) => {
  try {
    const { groupId } = req.params;
    const { userId } = req.body;

    if (!userId || userId === "null" || isNaN(Number(userId))) {
      return res.status(400).json({ error: "Invalid user ID" });
    }

    const userIdNum = Number(userId);

    console.log(`Пользователь ${userIdNum} пожаловался на группу ${groupId}`);
    return res.json({ message: "Жалоба принята" });
  } catch (err) {
    console.error("Ошибка при отправке жалобы:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

router.delete("/:groupId/message/:messageId", async (req, res) => {
  try {
    const { groupId, messageId } = req.params;
    const { userId } = req.body;

    if (!userId || userId === "null" || isNaN(Number(userId))) {
      return res.status(400).json({ error: "Invalid user ID" });
    }

    // В строгом режиме доверяем id из токена, а не из тела (его можно подделать).
    const userIdNum = ENFORCE && req.authUserId ? Number(req.authUserId) : Number(userId);

    const group = await Group.findByPk(groupId);
    if (!group) {
      return res.status(404).json({ error: "Группа не найдена" });
    }

    const message = await GroupMessage.findByPk(messageId);
    if (!message) {
      return res.status(404).json({ error: "Сообщение не найдено" });
    }

    if (group.ownerId != userIdNum && message.userId != userIdNum) {
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
      .to(`group_${groupId}`)
      .emit("groupMessageDeleted", { messageId: String(messageId) });

    // Инвалидируем кэш сообщений группы
    await invalidateGroupMessages(groupId);

    // Обновляем lastMessage в списке групп
    const newLastMsg = await GroupMessage.findOne({
      where: { groupId, isDeleted: false },
      order: [["createdAt", "DESC"]],
      include: [{ model: User, as: "sender", attributes: ["username"] }],
    });

    const groupMembers = await GroupUser.findAll({
      where: { groupId },
      attributes: ["userId", "lastSeen"],
    });
    const memberIds = groupMembers.map((m) => m.userId);

    let lastMessageText = "";
    let lastMessageType = "text";
    let lastMessageSender = "";
    let lastMessageTime = "";
    let lastMessageIsForwarded = false;

    if (newLastMsg) {
      try { lastMessageText = decrypt(newLastMsg.text) || ""; } catch (e) { lastMessageText = ""; }
      lastMessageType = newLastMsg.type || "text";
      lastMessageSender = newLastMsg.sender?.username || "";
      lastMessageTime = newLastMsg.createdAt ? new Date(newLastMsg.createdAt).toISOString() : "";
      lastMessageIsForwarded = !!newLastMsg.forwardedFromType;
    }

    // Для каждого участника пересчитываем unread и отправляем обновление
    await Promise.all(groupMembers.map(async (member) => {
      const memberId = member.userId;
      // Пересчёт: сообщения после lastSeen, не удалённые, не от самого участника
      const unreadCount = await GroupMessage.count({
        where: {
          groupId,
          createdAt: { [Op.gt]: member.lastSeen || new Date(0) },
          isDeleted: false,
          userId: { [Op.ne]: memberId },
        },
      });

      req.io.to(`user_${memberId}`).emit("newGroupMessage", {
        groupId,
        senderId: null,
        messageId: newLastMsg ? newLastMsg.id : null,
        lastMessage: lastMessageText,
        lastMessageType,
        lastMessageSender,
        lastMessageTime,
        lastMessageIsForwarded,
        unreadCount, // новый правильный счётчик
      });
      await invalidateGroupsList(memberId);
    }));

    return res.json({ message: "Сообщение удалено (soft delete)" });
  } catch (err) {
    console.error("Ошибка при удалении сообщения:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

router.put(
  "/:groupId/message/:messageId",
  uploadLarge.single("file"),
  async (req, res) => {
    try {
      const { groupId, messageId } = req.params;
      const { userId, text } = req.body;

      if (!userId || userId === "null" || isNaN(Number(userId))) {
        return res.status(400).json({ error: "Invalid user ID" });
      }

      // В строгом режиме доверяем id из токена, а не из тела (его можно подделать).
      const userIdNum = ENFORCE && req.authUserId ? Number(req.authUserId) : Number(userId);
      const group = await Group.findByPk(groupId);
      if (!group) {
        return res.status(404).json({ error: "Группа не найдена" });
      }
      const message = await GroupMessage.findByPk(messageId);
      if (!message) {
        return res.status(404).json({ error: "Сообщение не найдено" });
      }
      if (message.userId != userIdNum) {
        return res
          .status(403)
          .json({ error: "Нет прав для редактирования этого сообщения" });
      }
      if (req.file) {
        if (message.fileUrl) {
          const oldFileName = message.fileUrl.split("/").pop();
          try {
            await deleteFromMinio(oldFileName);
          } catch (err) {
            console.error(
              `Failed to delete old message file ${oldFileName} from MinIO:`,
              err
            );
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
        message.text = encrypt(text);
        message.type = "text";
      }
      message.isEdited = true;
      await message.save();

      const sender = await User.findByPk(userIdNum, {
        attributes: ["id", "username"],
      });

      const protoMessage = new chat.GroupMessage();
      protoMessage.id = message.id;
      protoMessage.groupId = Number(groupId);
      protoMessage.userId = userIdNum;
      protoMessage.text = text || "";
      protoMessage.type = message.type;
      if (message.fileUrl) protoMessage.fileUrl = message.fileUrl;
      if (message.filename) protoMessage.filename = message.filename;
      if (message.replyToId) protoMessage.replyToId = message.replyToId;
      const protoSender = new chat.Sender();
      protoSender.id = sender.id;
      protoSender.username = sender.username;
      protoMessage.sender = protoSender;
      protoMessage.isDeleted = message.isDeleted;
      protoMessage.createdAt = new Date(message.createdAt).getTime();
      protoMessage.updatedAt = new Date(message.updatedAt).getTime();
      protoMessage.readBy = message.readBy || [userIdNum];

      const buffer = chat.GroupMessage.encode(protoMessage).finish();
      req.io.to(`group_${groupId}`).emit("groupMessageUpdated", buffer);

      const updatedMessage = message.get({ plain: true });
      updatedMessage.text = decrypt(updatedMessage.text);
      updatedMessage.sender = sender;
      return res.json(updatedMessage);
    } catch (error) {
      console.error("Ошибка при обновлении сообщения:", error);
      return res.status(500).json({ error: "Server error" });
    }
  }
);

// GET /:groupId/reactions — все реакции группы (messageId → [{id,userId,emoji}])
router.get("/:groupId/reactions", async (req, res) => {
  const { groupId } = req.params;
  try {
    const messageIds = await GroupMessage.findAll({
      where: { groupId, isDeleted: false },
      attributes: ["id"],
    }).then((rows) => rows.map((r) => r.id));
    if (!messageIds.length) return res.json({});
    const { Op } = require("sequelize");
    const reactions = await GroupMessageReaction.findAll({
      where: { messageId: { [Op.in]: messageIds } },
      attributes: ["id", "messageId", "userId", "emoji"],
    });
    const map = {};
    for (const r of reactions) {
      if (!map[r.messageId]) map[r.messageId] = [];
      map[r.messageId].push({ id: r.id, userId: r.userId, emoji: r.emoji });
    }
    res.json(map);
  } catch (err) {
    console.error("group reactions error:", err);
    res.status(500).json({ error: err.message });
  }
});

// POST /:groupId/messages/:messageId/react — добавить/убрать реакцию
router.post("/:groupId/messages/:messageId/react", async (req, res) => {
  const { groupId, messageId } = req.params;
  const { userId, emoji } = req.body;
  if (!userId || !emoji) return res.status(400).json({ error: "userId and emoji required" });
  try {
    const existing = await GroupMessageReaction.findOne({ where: { messageId, userId, emoji } });
    if (existing) {
      await existing.destroy();
      req.io?.to(`group_${groupId}`).emit("groupReactionRemoved", { messageId: Number(messageId), userId: Number(userId), emoji, groupId: Number(groupId) });
      return res.json({ removed: true });
    }
    const reaction = await GroupMessageReaction.create({ messageId, userId, emoji });
    req.io?.to(`group_${groupId}`).emit("groupReactionAdded", { messageId: Number(messageId), userId: Number(userId), emoji, groupId: Number(groupId), id: reaction.id });
    return res.json({ added: true, reaction });
  } catch (err) {
    console.error("group react error:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

// const express = require("express");
// const { Sequelize } = require("sequelize");
// const { Group, GroupUser, User, GroupMessage } = require("../models");
// const { v4: uuidv4 } = require("uuid");
// const { Op } = require("sequelize");
// const multer = require("multer");
// const crypto = require("crypto");
// const router = express.Router();
// const root = require("../proto/group_message_pb");
// const chat = root.chat;
// const AWS = require("aws-sdk");

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
//     Expires: 600 * 600, // 1 hour
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
//     fileSize: 1024 * 1024 * 1024,
//     fieldSize: 1024 * 1024 * 1024,
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

// router.post("/", upload.single("avatar"), async (req, res) => {
//   try {
//     console.log("Загруженный файл:", req.file);
//     const { userId, name, description, isPublic, members } = req.body;

//     if (!userId || userId === "null" || isNaN(Number(userId))) {
//       return res.status(400).json({ error: "Invalid user ID" });
//     }

//     const membersArray = JSON.parse(members || "[]");
//     let avatar = null;

//     if (req.file) {
//       const fileName = `${Date.now()}-${req.file.originalname}`;
//       await uploadToMinio(req.file.buffer, fileName, req.file.mimetype);
//       avatar = generatePresignedUrl(fileName);
//     }

//     const newGroup = await Group.create({
//       name,
//       description,
//       isPublic,
//       inviteLink: uuidv4(),
//       ownerId: Number(userId),
//       avatar,
//       images: avatar ? [avatar] : [],
//     });

//     await GroupUser.create({
//       groupId: newGroup.id,
//       userId: Number(userId),
//       role: "admin",
//     });

//     if (Array.isArray(membersArray)) {
//       await Promise.all(
//         membersArray.map(async (memberId) => {
//           if (String(memberId) !== String(userId)) {
//             await GroupUser.findOrCreate({
//               where: { groupId: newGroup.id, userId: memberId },
//               defaults: { role: "member" },
//             });
//           }
//         })
//       );
//     }

//     const allMembers = [Number(userId), ...membersArray.map(Number)];

//     const groupPlain = newGroup.get({ plain: true });
//     groupPlain.members = allMembers;

//     allMembers.forEach((mId) => {
//       req.io.to(`user_${mId}`).emit("groupCreated", groupPlain);
//     });

//     return res.json(newGroup);
//   } catch (err) {
//     console.error("Ошибка при создании группы:", err);
//     return res.status(500).json({ error: "Server error" });
//   }
// });

// router.get("/", async (req, res) => {
//   try {
//     const { search, userId } = req.query;
//     let whereClause = {};

//     const validUserId =
//       userId && userId !== "null" && !isNaN(Number(userId))
//         ? Number(userId)
//         : null;

//     if (validUserId) {
//       if (!search) {
//         whereClause = {
//           [Op.or]: [
//             { ownerId: validUserId },
//             { "$members.userId$": validUserId },
//           ],
//         };
//       } else {
//         whereClause = {
//           name: { [Op.like]: `%${search}%` },
//           [Op.or]: [
//             { isPublic: true },
//             { ownerId: validUserId },
//             { "$members.userId$": validUserId },
//           ],
//         };
//       }
//     } else {
//       whereClause = { isPublic: true };
//       if (search) {
//         whereClause.name = { [Op.like]: `%${search}%` };
//       }
//     }

//     const groups = await Group.findAll({
//       where: whereClause,
//       include: [
//         {
//           model: GroupUser,
//           as: "members",
//           required: false,
//         },
//       ],
//     });

//     const result = groups.map((g) => {
//       const plain = g.get({ plain: true });
//       const isMember = validUserId
//         ? plain.members.some((m) => m.userId == validUserId)
//         : false;
//       return { ...plain, isMember };
//     });

//     return res.json(result);
//   } catch (err) {
//     console.error("Ошибка при поиске групп:", err);
//     return res.status(500).json({ error: "Server error" });
//   }
// });

// router.get("/members/:groupId", async (req, res) => {
//   try {
//     const { groupId } = req.params;
//     const groupUsers = await GroupUser.findAll({
//       where: { groupId },
//       include: [
//         {
//           model: User,
//           as: "user",
//           attributes: ["id", "username"],
//         },
//       ],
//     });
//     const members = groupUsers.map((item) => item.user);
//     return res.json(members);
//   } catch (err) {
//     console.error("Ошибка при получении участников группы:", err);
//     return res.status(500).json({ error: "Server error" });
//   }
// });

// router.get("/id/:groupId", async (req, res) => {
//   try {
//     const { groupId } = req.params;
//     const group = await Group.findByPk(groupId);
//     if (!group) {
//       return res.status(404).json({ error: "Группа не найдена" });
//     }
//     return res.json(group);
//   } catch (err) {
//     console.error("Ошибка при получении группы по ID:", err);
//     return res.status(500).json({ error: "Server error" });
//   }
// });

// router.get("/:inviteLink", async (req, res) => {
//   try {
//     const { inviteLink } = req.params;
//     const group = await Group.findOne({
//       where: { inviteLink },
//       include: [{ model: User, as: "owner", attributes: ["id", "username"] }],
//     });

//     if (!group) {
//       return res.status(404).json({ error: "Группа не найдена" });
//     }
//     return res.json(group);
//   } catch (err) {
//     console.error("Ошибка при получении группы по inviteLink:", err);
//     return res.status(500).json({ error: "Server error" });
//   }
// });

// router.post("/:id/join", async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { userId, addedBy } = req.body;

//     if (!userId || userId === "null" || isNaN(Number(userId))) {
//       return res.status(400).json({ error: "Invalid user ID" });
//     }

//     const userIdNum = Number(userId);
//     const group = await Group.findByPk(id);
//     if (!group) {
//       return res.status(404).json({ error: "Группа не найдена" });
//     }
//     if (!group.isPublic) {
//       if (!addedBy || Number(addedBy) !== Number(group.ownerId)) {
//         return res
//           .status(403)
//           .json({
//             error: "Это приватная группа, доступ разрешен только владельцем",
//           });
//       }
//     }
//     const [membership, created] = await GroupUser.findOrCreate({
//       where: { groupId: id, userId: userIdNum },
//       defaults: { role: "member" },
//     });
//     if (!created) {
//       return res.status(400).json({ message: "Пользователь уже в группе" });
//     }
//     req.io
//       .to(`user_${userIdNum}`)
//       .emit("groupAdded", { groupId: id, groupName: group.name });
//     return res.json({ message: "Пользователь добавлен в группу", membership });
//   } catch (err) {
//     console.error("Ошибка при join:", err);
//     return res.status(500).json({ error: "Server error" });
//   }
// });

// router.post("/:groupId/message", upload.single("file"), async (req, res) => {
//   try {
//     const { groupId } = req.params;
//     const { userId, text, replyToId } = req.body;

//     if (!userId || userId === "null" || isNaN(Number(userId))) {
//       return res.status(400).json({ error: "Invalid user ID" });
//     }

//     const userIdNum = Number(userId);
//     let messageType = "text";
//     let fileUrl = null;
//     let filename = null;

//     if (req.file) {
//       const fileName = `${Date.now()}-${req.file.originalname}`;
//       await uploadToMinio(req.file.buffer, fileName, req.file.mimetype);
//       fileUrl = generatePresignedUrl(fileName);
//       filename = req.file.originalname;
//       if (req.file.mimetype.startsWith("image/")) {
//         messageType = "image";
//       } else if (req.file.mimetype.startsWith("video/")) {
//         messageType = "video";
//       } else if (req.file.mimetype.startsWith("audio/")) {
//         messageType = "audio";
//       } else {
//         messageType = "file";
//       }
//     }

//     const encryptedText = encrypt(text || "");

//     // Initialize readBy with the sender's ID
//     const newMessage = await GroupMessage.create({
//       groupId,
//       userId: userIdNum,
//       text: encryptedText,
//       type: messageType,
//       fileUrl,
//       filename,
//       replyToId: replyToId || null,
//       readBy: [userIdNum],
//     });

//     if (replyToId) {
//       const repliedMessage = await GroupMessage.findByPk(replyToId, {
//         include: [
//           { model: User, as: "sender", attributes: ["id", "username"] },
//         ],
//       });
//       newMessage.repliedMessage = repliedMessage;
//     }

//     const sender = await User.findByPk(userIdNum, {
//       attributes: ["id", "username"],
//     });

//     const protoMessage = new chat.GroupMessage();
//     protoMessage.id = newMessage.id;
//     protoMessage.groupId = Number(groupId);
//     protoMessage.userId = userIdNum;
//     protoMessage.text = text || "";
//     protoMessage.type = newMessage.type;
//     if (newMessage.fileUrl) protoMessage.fileUrl = newMessage.fileUrl;
//     if (newMessage.filename) protoMessage.filename = newMessage.filename;
//     if (newMessage.replyToId) protoMessage.replyToId = newMessage.replyToId;
//     const protoSender = new chat.Sender();
//     protoSender.id = sender.id;
//     protoSender.username = sender.username;
//     protoMessage.sender = protoSender;
//     protoMessage.isDeleted = newMessage.isDeleted;
//     protoMessage.createdAt = new Date(newMessage.createdAt).getTime();
//     protoMessage.updatedAt = new Date(newMessage.updatedAt).getTime();
//     protoMessage.readBy = newMessage.readBy || [userIdNum];
//     if (newMessage.repliedMessage) {
//       const repliedProto = new chat.GroupMessage();
//       repliedProto.id = newMessage.repliedMessage.id;
//       repliedProto.text = decrypt(newMessage.repliedMessage.text) || "";
//       repliedProto.type = newMessage.repliedMessage.type;
//       if (newMessage.repliedMessage.fileUrl)
//         repliedProto.fileUrl = newMessage.repliedMessage.fileUrl;
//       if (newMessage.repliedMessage.filename)
//         repliedProto.filename = newMessage.repliedMessage.filename;
//       const repliedSender = new chat.Sender();
//       repliedSender.id = newMessage.repliedMessage.sender.id;
//       repliedSender.username = newMessage.repliedMessage.sender.username;
//       repliedProto.sender = repliedSender;
//       repliedProto.readBy = newMessage.repliedMessage.readBy || [
//         newMessage.repliedMessage.userId,
//       ];
//       protoMessage.repliedMessage = repliedProto;
//     }

//     const buffer = chat.GroupMessage.encode(protoMessage).finish();
//     req.io.to(`group_${groupId}`).emit("groupMessageReceived", buffer);

//     const groupMembers = await GroupUser.findAll({
//       where: { groupId, userId: { [Op.ne]: userIdNum } },
//       attributes: ["userId"],
//     });
//     const memberIds = groupMembers.map((member) => member.userId);

//     memberIds.forEach((memberId) => {
//       req.io.to(`user_${memberId}`).emit("newGroupMessage", {
//         groupId,
//         senderId: userIdNum,
//         messageId: newMessage.id,
//       });
//     });

//     console.log(
//       `Sent newGroupMessage for group ${groupId}, message ${
//         newMessage.id
//       } to users: ${memberIds.join(", ")}`
//     );

//     return res.json({ id: newMessage.id });
//   } catch (error) {
//     console.error("Error sending message:", error);
//     return res.status(500).json({ error: "Server error" });
//   }
// });

// router.get("/:groupId/messages", async (req, res) => {
//   try {
//     const { groupId } = req.params;
//     const { userId } = req.query;

//     if (userId && userId !== "null" && !isNaN(Number(userId))) {
//       const userIdNum = Number(userId);
//       const membership = await GroupUser.findOne({
//         where: { groupId, userId: userIdNum },
//       });
//       if (membership) {
//         await GroupUser.update(
//           { lastSeen: new Date() },
//           { where: { groupId, userId: userIdNum } }
//         );
//       }
//     }

//     const messages = await GroupMessage.findAll({
//       where: { groupId, isDeleted: false },
//       order: [["createdAt", "ASC"]],
//       include: [
//         { model: User, as: "sender", attributes: ["id", "username"] },
//         {
//           model: GroupMessage,
//           as: "repliedMessage",
//           include: [
//             { model: User, as: "sender", attributes: ["id", "username"] },
//           ],
//         },
//       ],
//     });

//     const userIdNum = userId && !isNaN(Number(userId)) ? Number(userId) : null;

//     const protoMessages = messages.map((msg) => {
//       const protoMessage = new chat.GroupMessage();
//       protoMessage.id = msg.id;
//       protoMessage.groupId = Number(groupId);
//       protoMessage.userId = msg.userId;
//       protoMessage.text = decrypt(msg.text) || "";
//       protoMessage.type = msg.type;
//       if (msg.fileUrl) protoMessage.fileUrl = msg.fileUrl;
//       if (msg.filename) protoMessage.filename = msg.filename;
//       if (msg.replyToId) protoMessage.replyToId = msg.replyToId;
//       const protoSender = new chat.Sender();
//       protoSender.id = msg.sender.id;
//       protoSender.username = msg.sender.username;
//       protoMessage.sender = protoSender;
//       protoMessage.isDeleted = msg.isDeleted;
//       protoMessage.createdAt = new Date(msg.createdAt).getTime();
//       protoMessage.updatedAt = new Date(msg.updatedAt).getTime();
//       // Only include readBy for messages sent by the requesting user
//       protoMessage.readBy = (userIdNum && msg.userId === userIdNum) ? (msg.readBy || [msg.userId]) : [];
//       if (msg.repliedMessage) {
//         const repliedProto = new chat.GroupMessage();
//         repliedProto.id = msg.repliedMessage.id;
//         repliedProto.text = decrypt(msg.repliedMessage.text) || "";
//         repliedProto.type = msg.repliedMessage.type;
//         if (msg.repliedMessage.fileUrl)
//           repliedProto.fileUrl = msg.repliedMessage.fileUrl;
//         if (msg.repliedMessage.filename)
//           repliedProto.filename = msg.repliedMessage.filename;
//         const repliedSender = new chat.Sender();
//         repliedSender.id = msg.repliedMessage.sender.id;
//         repliedSender.username = msg.repliedMessage.sender.username;
//         repliedProto.sender = repliedSender;
//         // Only include readBy for replied messages sent by the requesting user
//         repliedProto.readBy = (userIdNum && msg.repliedMessage.userId === userIdNum) ? 
//           (msg.repliedMessage.readBy || [msg.repliedMessage.userId]) : [];
//         protoMessage.repliedMessage = repliedProto;
//       }
//       return protoMessage;
//     });

//     const wrapper = new chat.GroupMessageList();
//     wrapper.messages = protoMessages;
//     const buffer = chat.GroupMessageList.encode(wrapper).finish();

//     res.setHeader("Content-Type", "application/octet-stream");
//     res.send(buffer);

//   } catch (err) {
//     console.error("Error loading group messages:", err);
//     return res.status(500).json({ error: "Server error" });
//   }
// });

// router.get("/:userId/unread-counts", async (req, res) => {
//   try {
//     const { userId } = req.params;

//     if (!userId || userId === "null" || isNaN(Number(userId))) {
//       return res.status(400).json({ error: "Invalid user ID" });
//     }
//     const userIdNum = Number(userId);

//     const userGroups = await GroupUser.findAll({
//       where: { userId: userIdNum },
//       attributes: ["groupId", "lastSeen"],
//     });
//     const unreadCounts = [];

//     for (const group of userGroups) {
//       const count = await GroupMessage.count({
//         where: {
//           groupId: group.groupId,
//           createdAt: { [Op.gt]: group.lastSeen || new Date(0) },
//           isDeleted: false,
//           userId: { [Op.ne]: userIdNum },
//         },
//       });
//       console.log(
//         `Unread count for group ${group.groupId}: ${count}, lastSeen: ${group.lastSeen}`
//       );
//       unreadCounts.push({
//         groupId: group.groupId,
//         unreadCount: count,
//       });
//     }

//     return res.json(unreadCounts);
//   } catch (err) {
//     console.error("Ошибка при получении непрочитанных сообщений:", err);
//     return res.status(500).json({ error: "Server error" });
//   }
// });

// router.post("/:groupId/update-last-seen", async (req, res) => {
//   try {
//     const { groupId } = req.params;
//     const { userId } = req.body;

//     if (!userId || userId === "null" || isNaN(Number(userId))) {
//       return res.status(400).json({ error: "Invalid user ID" });
//     }

//     const userIdNum = Number(userId);

//     // Update lastSeen
//     await GroupUser.update(
//       { lastSeen: new Date() },
//       {
//         where: {
//           groupId,
//           userId: userIdNum,
//         },
//       }
//     );

//     // Mark messages as read
//     const messages = await GroupMessage.findAll({
//       where: {
//         groupId,
//         isDeleted: false,
//         userId: { [Op.ne]: userIdNum },
//         [Op.or]: [
//           { readBy: { [Op.eq]: null } },
//           { readBy: { [Op.eq]: [] } },
//           Sequelize.literal(`NOT (${userIdNum} = ANY("readBy"))`),
//         ],
//       },
//     });

//     const updatedMessageIds = [];
//     for (const message of messages) {
//       const newReadBy = [...(message.readBy || []), userIdNum].filter(
//         (id, index, self) => self.indexOf(id) === index
//       );
//       await message.update({ readBy: newReadBy });
//       updatedMessageIds.push(message.id);
//     }

//     // Emit socket event for read messages
//     if (updatedMessageIds.length > 0) {
//       req.io.to(`group_${groupId}`).emit("messagesRead", {
//         groupId,
//         userId: userIdNum,
//         messageIds: updatedMessageIds,
//       });
//     }

//     return res.json({ success: true });
//   } catch (err) {
//     console.error("Ошибка при обновлении lastSeen:", err);
//     return res.status(500).json({ error: "Server error" });
//   }
// });

// router.delete("/:id/leave", async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { userId } = req.body;

//     if (!userId || userId === "null" || isNaN(Number(userId))) {
//       return res.status(400).json({ error: "Invalid user ID" });
//     }

//     const userIdNum = Number(userId);

//     const group = await Group.findByPk(id);
//     if (!group) {
//       return res.status(404).json({ error: "Группа не найдена" });
//     }

//     const membership = await GroupUser.findOne({
//       where: { groupId: id, userId: userIdNum },
//     });
//     if (!membership) {
//       return res.status(400).json({ error: "Вы не состоите в этой группе" });
//     }

//     await membership.destroy();

//     return res.json({ message: "Вы вышли из группы" });
//   } catch (err) {
//     console.error("Ошибка при выходе из группы:", err);
//     return res.status(500).json({ error: "Server error" });
//   }
// });

// router.delete("/:groupId", async (req, res) => {
//   try {
//     const { groupId } = req.params;
//     const { userId } = req.body;

//     if (!userId || userId === "null" || isNaN(Number(userId))) {
//       return res.status(400).json({ error: "Invalid user ID" });
//     }

//     const userIdNum = Number(userId);

//     const group = await Group.findByPk(groupId);
//     if (!group) {
//       return res.status(404).json({ error: "Группа не найдена" });
//     }

//     if (group.ownerId != userIdNum) {
//       return res
//         .status(403)
//         .json({ error: "Только владелец может удалять эту группу" });
//     }

//     // Удаление аватара группы из MinIO, если он существует
//     if (group.avatar) {
//       const fileName = group.avatar.split("/").pop();
//       try {
//         await s3.deleteObject({ Bucket: "my-bucket", Key: fileName }).promise();
//         console.log(`Deleted avatar ${fileName} from MinIO`);
//       } catch (err) {
//         console.error(`Failed to delete avatar ${fileName} from MinIO:`, err);
//       }
//     }

//     // Удаление всех изображений группы из MinIO
//     if (group.images && group.images.length > 0) {
//       for (const image of group.images) {
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

//     await GroupUser.destroy({ where: { groupId } });
//     await GroupMessage.destroy({ where: { groupId } });
//     await group.destroy();

//     return res.json({ message: "Группа удалена" });
//   } catch (err) {
//     console.error("Ошибка при удалении группы:", err);
//     return res.status(500).json({ error: "Server error" });
//   }
// });

// router.delete("/:groupId/members/:memberId", async (req, res) => {
//   try {
//     const { groupId, memberId } = req.params;
//     const { userId } = req.body;

//     if (!userId || userId === "null" || isNaN(Number(userId))) {
//       return res.status(400).json({ error: "Invalid user ID" });
//     }

//     if (!memberId || memberId === "null" || isNaN(Number(memberId))) {
//       return res.status(400).json({ error: "Invalid member ID" });
//     }

//     const userIdNum = Number(userId);
//     const memberIdNum = Number(memberId);

//     const group = await Group.findByPk(groupId);
//     if (!group) {
//       return res.status(404).json({ error: "Группа не найдена" });
//     }

//     if (group.ownerId !== userIdNum) {
//       return res
//         .status(403)
//         .json({ error: "Только владелец может удалять участников" });
//     }

//     if (userIdNum === memberIdNum) {
//       return res
//         .status(400)
//         .json({ error: "Вы не можете удалить самого себя" });
//     }

//     const member = await GroupUser.findOne({
//       where: { groupId, userId: memberIdNum },
//     });

//     if (!member) {
//       return res.status(404).json({ error: "Участник не найден в группе" });
//     }

//     await member.destroy();
//     req.io.to(`user_${memberIdNum}`).emit("groupRemoved", { groupId });
//     return res.json({ message: "Участник удален из группы" });
//   } catch (err) {
//     console.error("Ошибка при удалении участника:", err);
//     return res.status(500).json({ error: "Server error" });
//   }
// });

// router.put("/:groupId", upload.single("avatar"), async (req, res) => {
//   try {
//     console.log("Запрос body:", req.body);
//     console.log("Запрос file:", req.file);

//     const { groupId } = req.params;
//     const { name, isPublic, existingImages, userId } = req.body;

//     if (!userId || userId === "null" || isNaN(Number(userId))) {
//       return res.status(400).json({ error: "Invalid user ID" });
//     }

//     const userIdNum = Number(userId);
//     let updatedImages = [];

//     if (existingImages) {
//       try {
//         updatedImages = JSON.parse(existingImages);
//       } catch (e) {
//         updatedImages = [];
//       }
//     }

//     const group = await Group.findByPk(groupId);
//     if (!group) {
//       return res.status(404).json({ error: "Группа не найдена" });
//     }

//     if (group.ownerId !== userIdNum) {
//       return res
//         .status(403)
//         .json({ error: "Только владелец может редактировать группу" });
//     }

//     if (req.file) {
//       const fileName = `${Date.now()}-${req.file.originalname}`;
//       await uploadToMinio(req.file.buffer, fileName, req.file.mimetype);
//       const newImage = generatePresignedUrl(fileName);
//       updatedImages = [newImage, ...updatedImages];
//       group.avatar = newImage;
//     }

//     group.name = name || group.name;
//     group.isPublic = isPublic === "true" || isPublic === true;
//     group.images = updatedImages;
//     await group.save();

//     req.io.to(`group_${groupId}`).emit("groupUpdated", {
//       groupId,
//       updatedFields: {
//         name: group.name,
//         images: updatedImages,
//         avatar: group.avatar,
//         isPublic: group.isPublic,
//       },
//     });

//     return res.json({
//       name: group.name,
//       images: updatedImages,
//       avatar: group.avatar,
//       isPublic: group.isPublic,
//     });
//   } catch (error) {
//     console.error("Ошибка при обновлении группы:", error);
//     return res.status(500).json({ error: "Server error" });
//   }
// });

// router.delete("/:groupId/messages", async (req, res) => {
//   try {
//     const { groupId } = req.params;
//     const { userId } = req.body;

//     if (!userId || userId === "null" || isNaN(Number(userId))) {
//       return res.status(400).json({ error: "Invalid user ID" });
//     }

//     const userIdNum = Number(userId);

//     const group = await Group.findByPk(groupId);
//     if (!group) {
//       return res.status(404).json({ error: "Группа не найдена" });
//     }
//     if (group.ownerId != userIdNum) {
//       return res.status(403).json({ error: "Нет прав для очистки сообщений" });
//     }

//     // Удаление файлов сообщений из MinIO
//     const messages = await GroupMessage.findAll({ where: { groupId } });
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

//     await GroupMessage.update({ isDeleted: true }, { where: { groupId } });

//     req.io.to(`group_${groupId}`).emit("groupMessagesCleared", {
//       groupId: String(groupId),
//       clearedBy: userIdNum,
//     });
//     return res.json({ message: "Все сообщения очищены (soft delete)" });
//   } catch (err) {
//     console.error("Ошибка при очистке сообщений:", err);
//     return res.status(500).json({ error: "Server error" });
//   }
// });

// router.post("/:groupId/report", async (req, res) => {
//   try {
//     const { groupId } = req.params;
//     const { userId } = req.body;

//     if (!userId || userId === "null" || isNaN(Number(userId))) {
//       return res.status(400).json({ error: "Invalid user ID" });
//     }

//     const userIdNum = Number(userId);

//     console.log(`Пользователь ${userIdNum} пожаловался на группу ${groupId}`);
//     return res.json({ message: "Жалоба принята" });
//   } catch (err) {
//     console.error("Ошибка при отправке жалобы:", err);
//     return res.status(500).json({ error: "Server error" });
//   }
// });

// router.delete("/:groupId/message/:messageId", async (req, res) => {
//   try {
//     const { groupId, messageId } = req.params;
//     const { userId } = req.body;

//     if (!userId || userId === "null" || isNaN(Number(userId))) {
//       return res.status(400).json({ error: "Invalid user ID" });
//     }

//     const userIdNum = Number(userId);

//     const group = await Group.findByPk(groupId);
//     if (!group) {
//       return res.status(404).json({ error: "Группа не найдена" });
//     }

//     const message = await GroupMessage.findByPk(messageId);
//     if (!message) {
//       return res.status(404).json({ error: "Сообщение не найдено" });
//     }

//     if (group.ownerId != userIdNum && message.userId != userIdNum) {
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
//       .to(`group_${groupId}`)
//       .emit("groupMessageDeleted", { messageId: String(messageId) });
//     return res.json({ message: "Сообщение удалено (soft delete)" });
//   } catch (err) {
//     console.error("Ошибка при удалении сообщения:", err);
//     return res.status(500).json({ error: "Server error" });
//   }
// });

// router.put(
//   "/:groupId/message/:messageId",
//   upload.single("file"),
//   async (req, res) => {
//     try {
//       const { groupId, messageId } = req.params;
//       const { userId, text } = req.body;

//       if (!userId || userId === "null" || isNaN(Number(userId))) {
//         return res.status(400).json({ error: "Invalid user ID" });
//       }

//       const userIdNum = Number(userId);
//       const group = await Group.findByPk(groupId);
//       if (!group) {
//         return res.status(404).json({ error: "Группа не найдена" });
//       }
//       const message = await GroupMessage.findByPk(messageId);
//       if (!message) {
//         return res.status(404).json({ error: "Сообщение не найдено" });
//       }
//       if (message.userId != userIdNum) {
//         return res
//           .status(403)
//           .json({ error: "Нет прав для редактирования этого сообщения" });
//       }
//       if (req.file) {
//         // Удаление старого файла из MinIO, если он существует
//         if (message.fileUrl) {
//           const oldFileName = message.fileUrl.split("/").pop();
//           try {
//             await s3
//               .deleteObject({ Bucket: "my-bucket", Key: oldFileName })
//               .promise();
//             console.log(`Deleted old message file ${oldFileName} from MinIO`);
//           } catch (err) {
//             console.error(
//               `Failed to delete old message file ${oldFileName} from MinIO:`,
//               err
//             );
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
//         message.text = encrypt(text);
//         message.type = "text";
//       }
//       await message.save();

//       const sender = await User.findByPk(userIdNum, {
//         attributes: ["id", "username"],
//       });

//       const protoMessage = new chat.GroupMessage();
//       protoMessage.id = message.id;
//       protoMessage.groupId = Number(groupId);
//       protoMessage.userId = userIdNum;
//       protoMessage.text = text || "";
//       protoMessage.type = message.type;
//       if (message.fileUrl) protoMessage.fileUrl = message.fileUrl;
//       if (message.filename) protoMessage.filename = message.filename;
//       if (message.replyToId) protoMessage.replyToId = message.replyToId;
//       const protoSender = new chat.Sender();
//       protoSender.id = sender.id;
//       protoSender.username = sender.username;
//       protoMessage.sender = protoSender;
//       protoMessage.isDeleted = message.isDeleted;
//       protoMessage.createdAt = new Date(message.createdAt).getTime();
//       protoMessage.updatedAt = new Date(message.updatedAt).getTime();
//       protoMessage.readBy = message.readBy || [userIdNum];

//       const buffer = chat.GroupMessage.encode(protoMessage).finish();
//       req.io.to(`group_${groupId}`).emit("groupMessageUpdated", buffer);

//       const updatedMessage = message.get({ plain: true });
//       updatedMessage.text = decrypt(updatedMessage.text);
//       updatedMessage.sender = sender;
//       return res.json(updatedMessage);
//     } catch (error) {
//       console.error("Ошибка при обновлении сообщения:", error);
//       return res.status(500).json({ error: "Server error" });
//     }
//   }
// );

// module.exports = router;
















// const express = require("express");
// const { Sequelize } = require("sequelize");
// const { Group, GroupUser, User, GroupMessage } = require("../models");
// const { v4: uuidv4 } = require("uuid");
// const { Op } = require("sequelize");
// const multer = require("multer");
// const crypto = require("crypto");
// const router = express.Router();
// const root = require("../proto/group_message_pb");
// const chat = root.chat;
// const AWS = require("aws-sdk");


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
//     Expires: 600 * 600, // 1 hour
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
//     fileSize: 1024 * 1024 * 1024,
//     fieldSize: 1024 * 1024 * 1024,
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

// router.post("/", upload.single("avatar"), async (req, res) => {
//   try {
//     console.log("Загруженный файл:", req.file);
//     const { userId, name, description, isPublic, members } = req.body;

//     if (!userId || userId === "null" || isNaN(Number(userId))) {
//       return res.status(400).json({ error: "Invalid user ID" });
//     }

//     const membersArray = JSON.parse(members || "[]");
//     let avatar = null;

//     if (req.file) {
//       const fileName = `${Date.now()}-${req.file.originalname}`;
//       await uploadToMinio(req.file.buffer, fileName, req.file.mimetype);
//       avatar = generatePresignedUrl(fileName);
//     }

//     const newGroup = await Group.create({
//       name,
//       description,
//       isPublic,
//       inviteLink: uuidv4(),
//       ownerId: Number(userId),
//       avatar,
//       images: avatar ? [avatar] : [],
//     });

//     await GroupUser.create({
//       groupId: newGroup.id,
//       userId: Number(userId),
//       role: "admin",
//     });

//     if (Array.isArray(membersArray)) {
//       await Promise.all(
//         membersArray.map(async (memberId) => {
//           if (String(memberId) !== String(userId)) {
//             await GroupUser.findOrCreate({
//               where: { groupId: newGroup.id, userId: memberId },
//               defaults: { role: "member" },
//             });
//           }
//         })
//       );
//     }

//     const allMembers = [Number(userId), ...membersArray.map(Number)];

//     const groupPlain = newGroup.get({ plain: true });
//     groupPlain.members = allMembers;

//     allMembers.forEach((mId) => {
//       req.io.to(`user_${mId}`).emit("groupCreated", groupPlain);
//     });

//     return res.json(newGroup);
//   } catch (err) {
//     console.error("Ошибка при создании группы:", err);
//     return res.status(500).json({ error: "Server error" });
//   }
// });

// router.get("/", async (req, res) => {
//   try {
//     const { search, userId } = req.query;
//     let whereClause = {};

//     const validUserId =
//       userId && userId !== "null" && !isNaN(Number(userId))
//         ? Number(userId)
//         : null;

//     if (validUserId) {
//       if (!search) {
//         whereClause = {
//           [Op.or]: [
//             { ownerId: validUserId },
//             { "$members.userId$": validUserId },
//           ],
//         };
//       } else {
//         whereClause = {
//           name: { [Op.like]: `%${search}%` },
//           [Op.or]: [
//             { isPublic: true },
//             { ownerId: validUserId },
//             { "$members.userId$": validUserId },
//           ],
//         };
//       }
//     } else {
//       whereClause = { isPublic: true };
//       if (search) {
//         whereClause.name = { [Op.like]: `%${search}%` };
//       }
//     }

//     const groups = await Group.findAll({
//       where: whereClause,
//       include: [
//         {
//           model: GroupUser,
//           as: "members",
//           required: false,
//         },
//       ],
//     });

//     const result = groups.map((g) => {
//       const plain = g.get({ plain: true });
//       const isMember = validUserId
//         ? plain.members.some((m) => m.userId == validUserId)
//         : false;
//       return { ...plain, isMember };
//     });

//     return res.json(result);
//   } catch (err) {
//     console.error("Ошибка при поиске групп:", err);
//     return res.status(500).json({ error: "Server error" });
//   }
// });

// router.get("/members/:groupId", async (req, res) => {
//   try {
//     const { groupId } = req.params;
//     const groupUsers = await GroupUser.findAll({
//       where: { groupId },
//       include: [
//         {
//           model: User,
//           as: "user",
//           attributes: ["id", "username"],
//         },
//       ],
//     });
//     const members = groupUsers.map((item) => item.user);
//     return res.json(members);
//   } catch (err) {
//     console.error("Ошибка при получении участников группы:", err);
//     return res.status(500).json({ error: "Server error" });
//   }
// });

// router.get("/id/:groupId", async (req, res) => {
//   try {
//     const { groupId } = req.params;
//     const group = await Group.findByPk(groupId);
//     if (!group) {
//       return res.status(404).json({ error: "Группа не найдена" });
//     }
//     return res.json(group);
//   } catch (err) {
//     console.error("Ошибка при получении группы по ID:", err);
//     return res.status(500).json({ error: "Server error" });
//   }
// });

// router.get("/:inviteLink", async (req, res) => {
//   try {
//     const { inviteLink } = req.params;
//     const group = await Group.findOne({
//       where: { inviteLink },
//       include: [{ model: User, as: "owner", attributes: ["id", "username"] }],
//     });

//     if (!group) {
//       return res.status(404).json({ error: "Группа не найдена" });
//     }
//     return res.json(group);
//   } catch (err) {
//     console.error("Ошибка при получении группы по inviteLink:", err);
//     return res.status(500).json({ error: "Server error" });
//   }
// });

// router.post("/:id/join", async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { userId, addedBy } = req.body;

//     if (!userId || userId === "null" || isNaN(Number(userId))) {
//       return res.status(400).json({ error: "Invalid user ID" });
//     }

//     const userIdNum = Number(userId);
//     const group = await Group.findByPk(id);
//     if (!group) {
//       return res.status(404).json({ error: "Группа не найдена" });
//     }
//     if (!group.isPublic) {
//       if (!addedBy || Number(addedBy) !== Number(group.ownerId)) {
//         return res
//           .status(403)
//           .json({
//             error: "Это приватная группа, доступ разрешен только владельцем",
//           });
//       }
//     }
//     const [membership, created] = await GroupUser.findOrCreate({
//       where: { groupId: id, userId: userIdNum },
//       defaults: { role: "member" },
//     });
//     if (!created) {
//       return res.status(400).json({ message: "Пользователь уже в группе" });
//     }
//     req.io
//       .to(`user_${userIdNum}`)
//       .emit("groupAdded", { groupId: id, groupName: group.name });
//     return res.json({ message: "Пользователь добавлен в группу", membership });
//   } catch (err) {
//     console.error("Ошибка при join:", err);
//     return res.status(500).json({ error: "Server error" });
//   }
// });

// router.post("/:groupId/message", upload.single("file"), async (req, res) => {
//   try {
//     const { groupId } = req.params;
//     const { userId, text, replyToId } = req.body;

//     if (!userId || userId === "null" || isNaN(Number(userId))) {
//       return res.status(400).json({ error: "Invalid user ID" });
//     }

//     const userIdNum = Number(userId);
//     let messageType = "text";
//     let fileUrl = null;
//     let filename = null;

//     if (req.file) {
//       const fileName = `${Date.now()}-${req.file.originalname}`;
//       await uploadToMinio(req.file.buffer, fileName, req.file.mimetype);
//       fileUrl = generatePresignedUrl(fileName);
//       filename = req.file.originalname;
//       if (req.file.mimetype.startsWith("image/")) {
//         messageType = "image";
//       } else if (req.file.mimetype.startsWith("video/")) {
//         messageType = "video";
//       } else if (req.file.mimetype.startsWith("audio/")) {
//         messageType = "audio";
//       } else {
//         messageType = "file";
//       }
//     }

//     const encryptedText = encrypt(text || "");

//     // Initialize readBy with the sender's ID
//     const newMessage = await GroupMessage.create({
//       groupId,
//       userId: userIdNum,
//       text: encryptedText,
//       type: messageType,
//       fileUrl,
//       filename,
//       replyToId: replyToId || null,
//       readBy: [userIdNum],
//     });

//     if (replyToId) {
//       const repliedMessage = await GroupMessage.findByPk(replyToId, {
//         include: [
//           { model: User, as: "sender", attributes: ["id", "username"] },
//         ],
//       });
//       newMessage.repliedMessage = repliedMessage;
//     }

//     const sender = await User.findByPk(userIdNum, {
//       attributes: ["id", "username"],
//     });

//     const protoMessage = new chat.GroupMessage();
//     protoMessage.id = newMessage.id;
//     protoMessage.groupId = Number(groupId);
//     protoMessage.userId = userIdNum;
//     protoMessage.text = text || "";
//     protoMessage.type = newMessage.type;
//     if (newMessage.fileUrl) protoMessage.fileUrl = newMessage.fileUrl;
//     if (newMessage.filename) protoMessage.filename = newMessage.filename;
//     if (newMessage.replyToId) protoMessage.replyToId = newMessage.replyToId;
//     const protoSender = new chat.Sender();
//     protoSender.id = sender.id;
//     protoSender.username = sender.username;
//     protoMessage.sender = protoSender;
//     protoMessage.isDeleted = newMessage.isDeleted;
//     protoMessage.createdAt = new Date(newMessage.createdAt).getTime();
//     protoMessage.updatedAt = new Date(newMessage.updatedAt).getTime();
//     protoMessage.readBy = newMessage.readBy || [userIdNum];
//     if (newMessage.repliedMessage) {
//       const repliedProto = new chat.GroupMessage();
//       repliedProto.id = newMessage.repliedMessage.id;
//       repliedProto.text = decrypt(newMessage.repliedMessage.text) || "";
//       repliedProto.type = newMessage.repliedMessage.type;
//       if (newMessage.repliedMessage.fileUrl)
//         repliedProto.fileUrl = newMessage.repliedMessage.fileUrl;
//       if (newMessage.repliedMessage.filename)
//         repliedProto.filename = newMessage.repliedMessage.filename;
//       const repliedSender = new chat.Sender();
//       repliedSender.id = newMessage.repliedMessage.sender.id;
//       repliedSender.username = newMessage.repliedMessage.sender.username;
//       repliedProto.sender = repliedSender;
//       repliedProto.readBy = newMessage.repliedMessage.readBy || [
//         newMessage.repliedMessage.userId,
//       ];
//       protoMessage.repliedMessage = repliedProto;
//     }

//     const buffer = chat.GroupMessage.encode(protoMessage).finish();
//     req.io.to(`group_${groupId}`).emit("groupMessageReceived", buffer);

//     const groupMembers = await GroupUser.findAll({
//       where: { groupId, userId: { [Op.ne]: userIdNum } },
//       attributes: ["userId"],
//     });
//     const memberIds = groupMembers.map((member) => member.userId);

//     memberIds.forEach((memberId) => {
//       req.io.to(`user_${memberId}`).emit("newGroupMessage", {
//         groupId,
//         senderId: userIdNum,
//         messageId: newMessage.id,
//       });
//     });

//     console.log(
//       `Sent newGroupMessage for group ${groupId}, message ${
//         newMessage.id
//       } to users: ${memberIds.join(", ")}`
//     );

//     return res.json({ id: newMessage.id });
//   } catch (error) {
//     console.error("Error sending message:", error);
//     return res.status(500).json({ error: "Server error" });
//   }
// });

// router.get("/:groupId/messages", async (req, res) => {
//   try {
//     const { groupId } = req.params;
//     const { userId } = req.query;

//     if (userId && userId !== "null" && !isNaN(Number(userId))) {
//       const userIdNum = Number(userId);
//       const membership = await GroupUser.findOne({
//         where: { groupId, userId: userIdNum },
//       });
//       if (membership) {
//         await GroupUser.update(
//           { lastSeen: new Date() },
//           { where: { groupId, userId: userIdNum } }
//         );
//       }
//     }

//     const messages = await GroupMessage.findAll({
//       where: { groupId, isDeleted: false },
//       order: [["createdAt", "ASC"]],
//       include: [
//         { model: User, as: "sender", attributes: ["id", "username"] },
//         {
//           model: GroupMessage,
//           as: "repliedMessage",
//           include: [
//             { model: User, as: "sender", attributes: ["id", "username"] },
//           ],
//         },
//       ],
//     });

//     const protoMessages = messages.map((msg) => {
//       const protoMessage = new chat.GroupMessage();
//       protoMessage.id = msg.id;
//       protoMessage.groupId = Number(groupId);
//       protoMessage.userId = msg.userId;
//       protoMessage.text = decrypt(msg.text) || "";
//       protoMessage.type = msg.type;
//       if (msg.fileUrl) protoMessage.fileUrl = msg.fileUrl;
//       if (msg.filename) protoMessage.filename = msg.filename;
//       if (msg.replyToId) protoMessage.replyToId = msg.replyToId;
//       const protoSender = new chat.Sender();
//       protoSender.id = msg.sender.id;
//       protoSender.username = msg.sender.username;
//       protoMessage.sender = protoSender;
//       protoMessage.isDeleted = msg.isDeleted;
//       protoMessage.createdAt = new Date(msg.createdAt).getTime();
//       protoMessage.updatedAt = new Date(msg.updatedAt).getTime();
//       protoMessage.readBy = msg.readBy || [msg.userId];
//       if (msg.repliedMessage) {
//         const repliedProto = new chat.GroupMessage();
//         repliedProto.id = msg.repliedMessage.id;
//         repliedProto.text = decrypt(msg.repliedMessage.text) || "";
//         repliedProto.type = msg.repliedMessage.type;
//         if (msg.repliedMessage.fileUrl)
//           repliedProto.fileUrl = msg.repliedMessage.fileUrl;
//         if (msg.repliedMessage.filename)
//           repliedProto.filename = msg.repliedMessage.filename;
//         const repliedSender = new chat.Sender();
//         repliedSender.id = msg.repliedMessage.sender.id;
//         repliedSender.username = msg.repliedMessage.sender.username;
//         repliedProto.sender = repliedSender;
//         repliedProto.readBy = msg.repliedMessage.readBy || [
//           msg.repliedMessage.userId,
//         ];
//         protoMessage.repliedMessage = repliedProto;
//       }
//       return protoMessage;
//     });

//     const wrapper = new chat.GroupMessageList();
//     wrapper.messages = protoMessages;
//     const buffer = chat.GroupMessageList.encode(wrapper).finish();

//     res.setHeader("Content-Type", "application/octet-stream");
//     res.send(buffer);

//   } catch (err) {
//     console.error("Error loading group messages:", err);
//     return res.status(500).json({ error: "Server error" });
//   }
// });

// router.get("/:userId/unread-counts", async (req, res) => {
//   try {
//     const { userId } = req.params;

//     if (!userId || userId === "null" || isNaN(Number(userId))) {
//       return res.status(400).json({ error: "Invalid user ID" });
//     }
//     const userIdNum = Number(userId);

//     const userGroups = await GroupUser.findAll({
//       where: { userId: userIdNum },
//       attributes: ["groupId", "lastSeen"],
//     });
//     const unreadCounts = [];

//     for (const group of userGroups) {
//       const count = await GroupMessage.count({
//         where: {
//           groupId: group.groupId,
//           createdAt: { [Op.gt]: group.lastSeen || new Date(0) },
//           isDeleted: false,
//           userId: { [Op.ne]: userIdNum },
//         },
//       });
//       console.log(
//         `Unread count for group ${group.groupId}: ${count}, lastSeen: ${group.lastSeen}`
//       );
//       unreadCounts.push({
//         groupId: group.groupId,
//         unreadCount: count,
//       });
//     }

//     return res.json(unreadCounts);
//   } catch (err) {
//     console.error("Ошибка при получении непрочитанных сообщений:", err);
//     return res.status(500).json({ error: "Server error" });
//   }
// });

// router.post("/:groupId/update-last-seen", async (req, res) => {
//   try {
//     const { groupId } = req.params;
//     const { userId } = req.body;

//     if (!userId || userId === "null" || isNaN(Number(userId))) {
//       return res.status(400).json({ error: "Invalid user ID" });
//     }

//     const userIdNum = Number(userId);

//     // Update lastSeen
//     await GroupUser.update(
//       { lastSeen: new Date() },
//       {
//         where: {
//           groupId,
//           userId: userIdNum,
//         },
//       }
//     );

//     // Mark messages as read
//     const messages = await GroupMessage.findAll({
//       where: {
//         groupId,
//         isDeleted: false,
//         userId: { [Op.ne]: userIdNum },
//         [Op.or]: [
//           { readBy: { [Op.eq]: null } },
//           { readBy: { [Op.eq]: [] } },
//           Sequelize.literal(`NOT (${userIdNum} = ANY("readBy"))`),
//         ],
//       },
//     });

//     const updatedMessageIds = [];
//     for (const message of messages) {
//       const newReadBy = [...(message.readBy || []), userIdNum].filter(
//         (id, index, self) => self.indexOf(id) === index
//       );
//       await message.update({ readBy: newReadBy });
//       updatedMessageIds.push(message.id);
//     }

//     // Emit socket event for read messages
//     if (updatedMessageIds.length > 0) {
//       req.io.to(`group_${groupId}`).emit("messagesRead", {
//         groupId,
//         userId: userIdNum,
//         messageIds: updatedMessageIds,
//       });
//     }

//     return res.json({ success: true });
//   } catch (err) {
//     console.error("Ошибка при обновлении lastSeen:", err);
//     return res.status(500).json({ error: "Server error" });
//   }
// });

// router.delete("/:id/leave", async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { userId } = req.body;

//     if (!userId || userId === "null" || isNaN(Number(userId))) {
//       return res.status(400).json({ error: "Invalid user ID" });
//     }

//     const userIdNum = Number(userId);

//     const group = await Group.findByPk(id);
//     if (!group) {
//       return res.status(404).json({ error: "Группа не найдена" });
//     }

//     const membership = await GroupUser.findOne({
//       where: { groupId: id, userId: userIdNum },
//     });
//     if (!membership) {
//       return res.status(400).json({ error: "Вы не состоите в этой группе" });
//     }

//     await membership.destroy();

//     return res.json({ message: "Вы вышли из группы" });
//   } catch (err) {
//     console.error("Ошибка при выходе из группы:", err);
//     return res.status(500).json({ error: "Server error" });
//   }
// });

// router.delete("/:groupId", async (req, res) => {
//   try {
//     const { groupId } = req.params;
//     const { userId } = req.body;

//     if (!userId || userId === "null" || isNaN(Number(userId))) {
//       return res.status(400).json({ error: "Invalid user ID" });
//     }

//     const userIdNum = Number(userId);

//     const group = await Group.findByPk(groupId);
//     if (!group) {
//       return res.status(404).json({ error: "Группа не найдена" });
//     }

//     if (group.ownerId != userIdNum) {
//       return res
//         .status(403)
//         .json({ error: "Только владелец может удалять эту группу" });
//     }

//     // Удаление аватара группы из MinIO, если он существует
//     if (group.avatar) {
//       const fileName = group.avatar.split("/").pop();
//       try {
//         await s3.deleteObject({ Bucket: "my-bucket", Key: fileName }).promise();
//         console.log(`Deleted avatar ${fileName} from MinIO`);
//       } catch (err) {
//         console.error(`Failed to delete avatar ${fileName} from MinIO:`, err);
//       }
//     }

//     // Удаление всех изображений группы из MinIO
//     if (group.images && group.images.length > 0) {
//       for (const image of group.images) {
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

//     await GroupUser.destroy({ where: { groupId } });
//     await GroupMessage.destroy({ where: { groupId } });
//     await group.destroy();

//     return res.json({ message: "Группа удалена" });
//   } catch (err) {
//     console.error("Ошибка при удалении группы:", err);
//     return res.status(500).json({ error: "Server error" });
//   }
// });

// router.delete("/:groupId/members/:memberId", async (req, res) => {
//   try {
//     const { groupId, memberId } = req.params;
//     const { userId } = req.body;

//     if (!userId || userId === "null" || isNaN(Number(userId))) {
//       return res.status(400).json({ error: "Invalid user ID" });
//     }

//     if (!memberId || memberId === "null" || isNaN(Number(memberId))) {
//       return res.status(400).json({ error: "Invalid member ID" });
//     }

//     const userIdNum = Number(userId);
//     const memberIdNum = Number(memberId);

//     const group = await Group.findByPk(groupId);
//     if (!group) {
//       return res.status(404).json({ error: "Группа не найдена" });
//     }

//     if (group.ownerId !== userIdNum) {
//       return res
//         .status(403)
//         .json({ error: "Только владелец может удалять участников" });
//     }

//     if (userIdNum === memberIdNum) {
//       return res
//         .status(400)
//         .json({ error: "Вы не можете удалить самого себя" });
//     }

//     const member = await GroupUser.findOne({
//       where: { groupId, userId: memberIdNum },
//     });

//     if (!member) {
//       return res.status(404).json({ error: "Участник не найден в группе" });
//     }

//     await member.destroy();
//     req.io.to(`user_${memberIdNum}`).emit("groupRemoved", { groupId });
//     return res.json({ message: "Участник удален из группы" });
//   } catch (err) {
//     console.error("Ошибка при удалении участника:", err);
//     return res.status(500).json({ error: "Server error" });
//   }
// });

// router.put("/:groupId", upload.single("avatar"), async (req, res) => {
//   try {
//     console.log("Запрос body:", req.body);
//     console.log("Запрос file:", req.file);

//     const { groupId } = req.params;
//     const { name, isPublic, existingImages, userId } = req.body;

//     if (!userId || userId === "null" || isNaN(Number(userId))) {
//       return res.status(400).json({ error: "Invalid user ID" });
//     }

//     const userIdNum = Number(userId);
//     let updatedImages = [];

//     if (existingImages) {
//       try {
//         updatedImages = JSON.parse(existingImages);
//       } catch (e) {
//         updatedImages = [];
//       }
//     }

//     const group = await Group.findByPk(groupId);
//     if (!group) {
//       return res.status(404).json({ error: "Группа не найдена" });
//     }

//     if (group.ownerId !== userIdNum) {
//       return res
//         .status(403)
//         .json({ error: "Только владелец может редактировать группу" });
//     }

//     if (req.file) {
//       const fileName = `${Date.now()}-${req.file.originalname}`;
//       await uploadToMinio(req.file.buffer, fileName, req.file.mimetype);
//       const newImage = generatePresignedUrl(fileName);
//       updatedImages = [newImage, ...updatedImages];
//       group.avatar = newImage;
//     }

//     group.name = name || group.name;
//     group.isPublic = isPublic === "true" || isPublic === true;
//     group.images = updatedImages;
//     await group.save();

//     req.io.to(`group_${groupId}`).emit("groupUpdated", {
//       groupId,
//       updatedFields: {
//         name: group.name,
//         images: updatedImages,
//         avatar: group.avatar,
//         isPublic: group.isPublic,
//       },
//     });

//     return res.json({
//       name: group.name,
//       images: updatedImages,
//       avatar: group.avatar,
//       isPublic: group.isPublic,
//     });
//   } catch (error) {
//     console.error("Ошибка при обновлении группы:", error);
//     return res.status(500).json({ error: "Server error" });
//   }
// });

// router.delete("/:groupId/messages", async (req, res) => {
//   try {
//     const { groupId } = req.params;
//     const { userId } = req.body;

//     if (!userId || userId === "null" || isNaN(Number(userId))) {
//       return res.status(400).json({ error: "Invalid user ID" });
//     }

//     const userIdNum = Number(userId);

//     const group = await Group.findByPk(groupId);
//     if (!group) {
//       return res.status(404).json({ error: "Группа не найдена" });
//     }
//     if (group.ownerId != userIdNum) {
//       return res.status(403).json({ error: "Нет прав для очистки сообщений" });
//     }

//     // Удаление файлов сообщений из MinIO
//     const messages = await GroupMessage.findAll({ where: { groupId } });
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

//     await GroupMessage.update({ isDeleted: true }, { where: { groupId } });

//     req.io.to(`group_${groupId}`).emit("groupMessagesCleared", {
//       groupId: String(groupId),
//       clearedBy: userIdNum,
//     });
//     return res.json({ message: "Все сообщения очищены (soft delete)" });
//   } catch (err) {
//     console.error("Ошибка при очистке сообщений:", err);
//     return res.status(500).json({ error: "Server error" });
//   }
// });

// router.post("/:groupId/report", async (req, res) => {
//   try {
//     const { groupId } = req.params;
//     const { userId } = req.body;

//     if (!userId || userId === "null" || isNaN(Number(userId))) {
//       return res.status(400).json({ error: "Invalid user ID" });
//     }

//     const userIdNum = Number(userId);

//     console.log(`Пользователь ${userIdNum} пожаловался на группу ${groupId}`);
//     return res.json({ message: "Жалоба принята" });
//   } catch (err) {
//     console.error("Ошибка при отправке жалобы:", err);
//     return res.status(500).json({ error: "Server error" });
//   }
// });

// router.delete("/:groupId/message/:messageId", async (req, res) => {
//   try {
//     const { groupId, messageId } = req.params;
//     const { userId } = req.body;

//     if (!userId || userId === "null" || isNaN(Number(userId))) {
//       return res.status(400).json({ error: "Invalid user ID" });
//     }

//     const userIdNum = Number(userId);

//     const group = await Group.findByPk(groupId);
//     if (!group) {
//       return res.status(404).json({ error: "Группа не найдена" });
//     }

//     const message = await GroupMessage.findByPk(messageId);
//     if (!message) {
//       return res.status(404).json({ error: "Сообщение не найдено" });
//     }

//     if (group.ownerId != userIdNum && message.userId != userIdNum) {
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
//       .to(`group_${groupId}`)
//       .emit("groupMessageDeleted", { messageId: String(messageId) });
//     return res.json({ message: "Сообщение удалено (soft delete)" });
//   } catch (err) {
//     console.error("Ошибка при удалении сообщения:", err);
//     return res.status(500).json({ error: "Server error" });
//   }
// });

// router.put(
//   "/:groupId/message/:messageId",
//   upload.single("file"),
//   async (req, res) => {
//     try {
//       const { groupId, messageId } = req.params;
//       const { userId, text } = req.body;

//       if (!userId || userId === "null" || isNaN(Number(userId))) {
//         return res.status(400).json({ error: "Invalid user ID" });
//       }

//       const userIdNum = Number(userId);
//       const group = await Group.findByPk(groupId);
//       if (!group) {
//         return res.status(404).json({ error: "Группа не найдена" });
//       }
//       const message = await GroupMessage.findByPk(messageId);
//       if (!message) {
//         return res.status(404).json({ error: "Сообщение не найдено" });
//       }
//       if (message.userId != userIdNum) {
//         return res
//           .status(403)
//           .json({ error: "Нет прав для редактирования этого сообщения" });
//       }
//       if (req.file) {
//         // Удаление старого файла из MinIO, если он существует
//         if (message.fileUrl) {
//           const oldFileName = message.fileUrl.split("/").pop();
//           try {
//             await s3
//               .deleteObject({ Bucket: "my-bucket", Key: oldFileName })
//               .promise();
//             console.log(`Deleted old message file ${oldFileName} from MinIO`);
//           } catch (err) {
//             console.error(
//               `Failed to delete old message file ${oldFileName} from MinIO:`,
//               err
//             );
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
//         message.text = encrypt(text);
//         message.type = "text";
//       }
//       await message.save();

//       const sender = await User.findByPk(userIdNum, {
//         attributes: ["id", "username"],
//       });

//       const protoMessage = new chat.GroupMessage();
//       protoMessage.id = message.id;
//       protoMessage.groupId = Number(groupId);
//       protoMessage.userId = userIdNum;
//       protoMessage.text = text || "";
//       protoMessage.type = message.type;
//       if (message.fileUrl) protoMessage.fileUrl = message.fileUrl;
//       if (message.filename) protoMessage.filename = message.filename;
//       if (message.replyToId) protoMessage.replyToId = message.replyToId;
//       const protoSender = new chat.Sender();
//       protoSender.id = sender.id;
//       protoSender.username = sender.username;
//       protoMessage.sender = protoSender;
//       protoMessage.isDeleted = message.isDeleted;
//       protoMessage.createdAt = new Date(message.createdAt).getTime();
//       protoMessage.updatedAt = new Date(message.updatedAt).getTime();
//       protoMessage.readBy = message.readBy || [userIdNum];

//       const buffer = chat.GroupMessage.encode(protoMessage).finish();
//       req.io.to(`group_${groupId}`).emit("groupMessageUpdated", buffer);

//       const updatedMessage = message.get({ plain: true });
//       updatedMessage.text = decrypt(updatedMessage.text);
//       updatedMessage.sender = sender;
//       return res.json(updatedMessage);
//     } catch (error) {
//       console.error("Ошибка при обновлении сообщения:", error);
//       return res.status(500).json({ error: "Server error" });
//     }
//   }
// );

// module.exports = router;
