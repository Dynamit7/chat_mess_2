/**
 * Disappearing Messages Cron Job
 * Automatically deletes messages that have expired
 */

const cron = require('node-cron');
const { Op } = require('sequelize');
const { Message, GroupMessage, ChannelMessage } = require('../models');

// Track deletion stats
let deletionStats = {
  directMessages: 0,
  groupMessages: 0,
  channelMessages: 0,
  lastRun: null,
};

/**
 * Delete expired disappearing messages
 */
const deleteExpiredMessages = async () => {
  const now = new Date();

  try {
    // Delete expired direct messages
    const directDeleted = await Message.destroy({
      where: {
        isDisappearing: true,
        expiresAt: { [Op.lt]: now },
      },
    });

    // Delete expired group messages
    const groupDeleted = await GroupMessage.destroy({
      where: {
        isDisappearing: true,
        expiresAt: { [Op.lt]: now },
      },
    });

    // Log results
    if (directDeleted > 0 || groupDeleted > 0) {
      console.log(`[Disappearing Messages] Deleted: ${directDeleted} direct, ${groupDeleted} group messages`);
    }

    // Update stats
    deletionStats = {
      directMessages: deletionStats.directMessages + directDeleted,
      groupMessages: deletionStats.groupMessages + groupDeleted,
      channelMessages: 0,
      lastRun: now,
    };

    return { directDeleted, groupDeleted };
  } catch (error) {
    console.error('[Disappearing Messages] Error:', error.message);
    return { error: error.message };
  }
};

/**
 * Set expiration time for a message when it's read
 */
const setMessageExpiration = async (message, disappearAfter) => {
  if (!disappearAfter || !message) return;

  const expiresAt = new Date(Date.now() + disappearAfter * 1000);

  await message.update({
    isDisappearing: true,
    disappearAfter,
    expiresAt,
    readAt: new Date(),
  });

  return expiresAt;
};

/**
 * Apply disappearing setting to a chat
 */
const applyDisappearingSetting = async (chatType, chatId, disappearAfter, setByUserId) => {
  const { DisappearingSetting } = require('../models');

  const [setting, created] = await DisappearingSetting.findOrCreate({
    where: { chatType, chatId },
    defaults: { disappearAfter, setByUserId },
  });

  if (!created) {
    await setting.update({ disappearAfter, setByUserId });
  }

  return setting;
};

/**
 * Get disappearing setting for a chat
 */
const getDisappearingSetting = async (chatType, chatId) => {
  const { DisappearingSetting } = require('../models');

  const setting = await DisappearingSetting.findOne({
    where: { chatType, chatId },
  });

  return setting?.disappearAfter || null;
};

/**
 * Get deletion statistics
 */
const getStats = () => {
  return { ...deletionStats };
};

/**
 * Initialize the cron job
 * Runs every minute to check for expired messages
 */
const initCronJob = () => {
  // Run every minute
  cron.schedule('* * * * *', async () => {
    await deleteExpiredMessages();
  });

  console.log('[Disappearing Messages] Cron job initialized - running every minute');
};

// Start immediately if run directly
if (require.main === module) {
  initCronJob();
}

module.exports = {
  initCronJob,
  deleteExpiredMessages,
  setMessageExpiration,
  applyDisappearingSetting,
  getDisappearingSetting,
  getStats,
};
