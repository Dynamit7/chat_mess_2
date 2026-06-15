const { getNotificationFromQueue, getPushToken } = require("./redisClient");
const { Expo } = require("expo-server-sdk");

const expo = new Expo();

// Воркер для обработки очереди уведомлений
async function processNotificationQueue() {
  while (true) {
    try {
      const notification = await getNotificationFromQueue();
      
      if (notification) {
        await handleNotification(notification);
      } else {
        // Если очередь пуста, ждем немного перед следующей проверкой
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (err) {
      console.error("Error processing notification queue:", err);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

async function handleNotification(notification) {
  try {
    const { userId, type, data } = notification;

    // Получаем push токен из Redis
    const pushToken = await getPushToken(userId);
    
    if (!pushToken || !Expo.isExpoPushToken(pushToken)) {
      console.log(`No valid push token for user ${userId}`);
      return;
    }

    let notificationBody = "";
    let notificationTitle = "";

    switch (type) {
      case "message":
        notificationTitle = "Новое сообщение";
        notificationBody = data.text 
          ? `${data.fromUserId ? `От пользователя ${data.fromUserId}: ` : ""}${data.text}`
          : "Вам пришло новое сообщение";
        break;
      case "friendRequest":
        notificationTitle = "Запрос в друзья";
        notificationBody = `Пользователь ${data.fromUserId} хочет добавить вас в друзья`;
        break;
      case "groupMessage":
        notificationTitle = "Сообщение в группе";
        notificationBody = data.text || "Новое сообщение в группе";
        break;
      case "channelMessage":
        notificationTitle = "Сообщение в канале";
        notificationBody = data.text || "Новое сообщение в канале";
        break;
      default:
        notificationTitle = "Уведомление";
        notificationBody = "У вас новое уведомление";
    }

    const messages = [
      {
        to: pushToken,
        sound: "default",
        title: notificationTitle,
        body: notificationBody,
        data: { type, ...data },
      },
    ];

    const ticketChunk = await expo.sendPushNotificationsAsync(messages);
    console.log("Push notification sent:", ticketChunk);
  } catch (err) {
    console.error("Error handling notification:", err);
  }
}

// Запускаем воркер
if (require.main === module) {
  console.log("Starting notification worker...");
  processNotificationQueue();
}

module.exports = { processNotificationQueue, handleNotification };

