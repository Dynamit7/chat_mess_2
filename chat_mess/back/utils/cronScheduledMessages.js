const cron = require("node-cron");
const { Op } = require("sequelize");
const { ScheduledMessage, Message, Chat, GroupMessage, GroupUser, ChannelMessage, ChannelUser, Channel, User } = require("../models");
const { encrypt, decrypt } = require("./encryption");

let ioRef = null;

function init(io) {
  ioRef = io;
}

// Каждую минуту проверяем сообщения, которые пора отправить
cron.schedule("* * * * *", async () => {
  try {
    const due = await ScheduledMessage.findAll({
      where: {
        isSent: false,
        scheduledAt: { [Op.lte]: new Date() },
      },
      limit: 100,
    });

    for (const sm of due) {
      try {
        const plainText = decrypt(sm.text) || "";

        if (sm.chatId) {
          // Личное сообщение: chatId = partnerId (toUserId)
          const newMsg = await Message.create({
            fromUserId: sm.userId,
            toUserId: sm.chatId,
            text: encrypt(plainText),
            type: sm.type || "text",
            fileUrl: sm.fileUrl || null,
            isRead: false,
          });
          await Chat.findOrCreate({ where: { userId: sm.userId, partnerId: sm.chatId }, defaults: { userId: sm.userId, partnerId: sm.chatId } });
          await Chat.findOrCreate({ where: { userId: sm.chatId, partnerId: sm.userId }, defaults: { userId: sm.chatId, partnerId: sm.userId } });
          if (ioRef) {
            const payload = { ...newMsg.toJSON(), text: plainText, reactions: [], replyTo: null };
            ioRef.to(`user_${sm.userId}`).emit("messageReceived", payload);
            ioRef.to(`user_${sm.chatId}`).emit("messageReceived", payload);
          }
        } else if (sm.groupId) {
          const member = await GroupUser.findOne({ where: { groupId: sm.groupId, userId: sm.userId } });
          if (member) {
            const newMsg = await GroupMessage.create({
              groupId: sm.groupId,
              userId: sm.userId,
              text: encrypt(plainText),
              type: sm.type || "text",
              fileUrl: sm.fileUrl || null,
              readBy: [sm.userId],
            });
            if (ioRef) {
              ioRef.to(`group_${sm.groupId}`).emit("groupMessageReceived", {
                id: newMsg.id,
                groupId: sm.groupId,
                userId: sm.userId,
                text: plainText,
                createdAt: newMsg.createdAt,
              });
            }
          }
        } else if (sm.channelId) {
          const channel = await Channel.findByPk(sm.channelId);
          if (channel && channel.ownerId === sm.userId) {
            const newMsg = await ChannelMessage.create({
              channelId: sm.channelId,
              userId: sm.userId,
              text: encrypt(plainText),
              type: sm.type || "text",
              fileUrl: sm.fileUrl || null,
            });
            if (ioRef) {
              ioRef.to(`channel_${sm.channelId}`).emit("channelMessageReceived", {
                ...newMsg.get({ plain: true }),
                text: plainText,
              });
            }
          }
        }

        await sm.update({ isSent: true, sentAt: new Date() });
        console.log(`[scheduled] Sent message ${sm.id} for user ${sm.userId}`);
      } catch (itemErr) {
        console.error(`[scheduled] Failed to send message ${sm.id}:`, itemErr);
      }
    }
  } catch (err) {
    console.error("[scheduled] Cron error:", err);
  }
});

module.exports = { init };
