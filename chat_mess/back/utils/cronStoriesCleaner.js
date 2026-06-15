const cron = require('node-cron');
const { Story } = require('../models');
const { Op } = require('sequelize');

cron.schedule('0 * * * *', async () => {
  try {
    const now = new Date();
    const deletedCount = await Story.destroy({
      where: {
        expiresAt: {
          [Op.lt]: now
        }
      }
    });
    
    if (deletedCount > 0) {
      console.log(`Удалено ${deletedCount} просроченных сторис`);
    }
  } catch (error) {
    console.error('Ошибка при очистке сторис:', error);
  }
});

console.log('Cron job для очистки сторис запущен');
// // utils/cronStoriesCleaner.js
// const cron = require('node-cron');
// const { Story } = require('../models');
// const { Op } = require('sequelize');
// const fs = require('fs');
// const path = require('path');


// cron.schedule('0 * * * *', async () => {
//   try {
//     const now = new Date();
//     const expiredStories = await Story.findAll({
//       where: { expiresAt: { [Op.lt]: now } },
//     });
//     for (const st of expiredStories) {
 
//       if (st.fileUrl) {
//         const filePath = path.join(__dirname, '..', st.fileUrl);
//         if (fs.existsSync(filePath)) {
//           fs.unlinkSync(filePath);
//         }
//       }
//       await st.destroy();
//     }
//     console.log(`Expired stories cleaned: ${expiredStories.length}`);
//   } catch (err) {
//     console.error('Error cleaning stories:', err);
//   }
// });
