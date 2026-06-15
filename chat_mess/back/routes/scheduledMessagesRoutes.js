const express = require("express");
const router = express.Router();
const { ScheduledMessage, Message, Chat, GroupMessage, GroupUser, ChannelMessage, ChannelUser, Channel, User } = require("../models");
const { encrypt } = require("../utils/encryption");
const { ENFORCE } = require("../middleware/enforceAuth");

// Создать запланированное сообщение
router.post("/", async (req, res) => {
  const { userId, chatId, groupId, channelId, text, type, fileUrl, scheduledAt } = req.body;

  const uid = Number(userId);
  if (!uid || isNaN(uid)) return res.status(400).json({ error: "userId is required" });
  if (!text || typeof text !== "string" || !text.trim()) return res.status(400).json({ error: "text is required" });
  if (!scheduledAt) return res.status(400).json({ error: "scheduledAt is required" });

  const sendAt = new Date(scheduledAt);
  if (isNaN(sendAt.getTime()) || sendAt <= new Date()) {
    return res.status(400).json({ error: "scheduledAt must be a future date" });
  }
  if (!chatId && !groupId && !channelId) {
    return res.status(400).json({ error: "One of chatId, groupId, channelId is required" });
  }

  if (ENFORCE && Number(req.authUserId) !== uid) {
    return res.status(403).json({ error: "Forbidden" });
  }

  try {
    const msg = await ScheduledMessage.create({
      userId: uid,
      chatId: chatId ? Number(chatId) : null,
      groupId: groupId ? Number(groupId) : null,
      channelId: channelId ? Number(channelId) : null,
      text: encrypt(text),
      type: type || "text",
      fileUrl: fileUrl || null,
      scheduledAt: sendAt,
      isSent: false,
    });
    return res.status(201).json({ success: true, scheduledMessage: msg });
  } catch (err) {
    console.error("Error creating scheduled message:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// Список запланированных сообщений пользователя
router.get("/", async (req, res) => {
  const uid = Number(req.query.userId);
  if (!uid || isNaN(uid)) return res.status(400).json({ error: "userId is required" });
  if (ENFORCE && Number(req.authUserId) !== uid) return res.status(403).json({ error: "Forbidden" });

  try {
    const messages = await ScheduledMessage.findAll({
      where: { userId: uid, isSent: false },
      order: [["scheduledAt", "ASC"]],
    });
    return res.json(messages);
  } catch (err) {
    console.error("Error fetching scheduled messages:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// Удалить запланированное сообщение
router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!id || isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  try {
    const msg = await ScheduledMessage.findByPk(id);
    if (!msg) return res.status(404).json({ error: "Not found" });
    if (ENFORCE && Number(req.authUserId) !== Number(msg.userId)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    if (msg.isSent) return res.status(400).json({ error: "Already sent" });
    await msg.destroy();
    return res.json({ success: true });
  } catch (err) {
    console.error("Error deleting scheduled message:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
