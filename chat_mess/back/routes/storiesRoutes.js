const express = require('express');
const router = express.Router();
const { Story, StoryView, User, Chat } = require('../models');
const { Op } = require('sequelize');

const { uploadToMinio, generatePresignedUrl, deleteFromMinio } = require('../utils/minioClient');
// Stories carry phone photos/videos that exceed the small `upload` (5MB) cap,
// so use the large limit like group/channel media uploads.
const { uploadLarge } = require('../utils/multerConfig');

router.post('/', (req, res) => {
  uploadLarge.single('file')(req, res, async (err) => {
    // Surface multer rejections (e.g. file too large) as a clean 400 instead of a 500.
    if (err) {
      console.error('Ошибка при загрузке файла истории:', err);
      return res.status(400).json({ error: err.message || 'Не удалось загрузить файл' });
    }
    try {
      const { userId, caption } = req.body;
      if (!userId) {
        return res.status(400).json({ error: 'userId is required' });
      }

      let fileUrl = null;
      let fileType = 'image';

      if (req.file) {
        const fileName = `${Date.now()}-${req.file.originalname}`;
        await uploadToMinio(req.file.buffer, fileName, req.file.mimetype);
        fileUrl = generatePresignedUrl(fileName);
        if (req.file.mimetype.startsWith('video/')) {
          fileType = 'video';
        } else if (req.file.mimetype.startsWith('image/')) {
          fileType = 'image';
        } else {
          fileType = 'file';
        }
      } else {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      const story = await Story.create({
        userId,
        fileUrl,
        type: fileType,
        caption: caption || '',
        expiresAt,
      });

      req.io.emit('newStoryCreated', { userId });

      return res.json(story);
    } catch (error) {
      console.error('Ошибка при создании сторис:', error);
      return res.status(500).json({ error: 'Server error' });
    }
  });
});

router.get('/personalized', async (req, res) => {
  try {
    const now = new Date();
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const userChats = await Chat.findAll({
      where: { userId },
      attributes: ['partnerId']
    });

    const partnerIds = userChats.map(chat => chat.partnerId);
    
    partnerIds.push(parseInt(userId));

    const stories = await Story.findAll({
      where: {
        userId: partnerIds,
        expiresAt: { [Op.gt]: now }
      },
      include: [
        {
          model: User,
          as: 'owner',
          attributes: ['id', 'username', 'avatar'],
        }
      ],
      order: [['createdAt', 'DESC']],
    });

    return res.json(stories);
  } catch (error) {
    console.error('Ошибка при получении персонализированных сторис:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});

router.get('/', async (req, res) => {
  try {
    const now = new Date();
    const { userId } = req.query;
    const where = {
      expiresAt: { [Op.gt]: now },
    };
    if (userId) {
      where.userId = userId;
    }

    const stories = await Story.findAll({
      where,
      include: [
        {
          model: User,
          as: 'owner',
          attributes: ['id', 'username', 'avatar'],
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    return res.json(stories);
  } catch (error) {
    console.error('Ошибка при получении сторис:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:storyId', async (req, res) => {
  try {
    const { storyId } = req.params;
    const { userId } = req.body;

    const story = await Story.findByPk(storyId);
    if (!story) {
      return res.status(404).json({ error: 'Сторис не найдена' });
    }
    if (Number(story.userId) !== Number(userId)) {
      return res.status(403).json({ error: 'Нет прав на удаление' });
    }

    if (story.fileUrl) {
      const fileName = story.fileUrl.split('/').pop();
      try {
        await deleteFromMinio(fileName);
      } catch (err) {
        console.error(`Failed to delete file ${fileName} from MinIO:`, err);
      }
    }

    await story.destroy();
    req.io.emit('storyDeleted', { userId, storyId });
    return res.json({ message: 'Story deleted' });
  } catch (error) {
    console.error('Ошибка при удалении сторис:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Record a story view (deduplicated per user per story)
router.post('/:storyId/view', async (req, res) => {
  try {
    const { storyId } = req.params;
    const { viewerId } = req.body;

    if (!viewerId) {
      return res.status(400).json({ error: 'viewerId is required' });
    }

    const story = await Story.findByPk(storyId);
    if (!story) {
      return res.status(404).json({ error: 'Story not found' });
    }

    // Don't record view for own story
    if (Number(story.userId) === Number(viewerId)) {
      return res.json({ message: 'Own story, view not recorded' });
    }

    await StoryView.findOrCreate({
      where: { storyId, viewerId },
    });

    return res.json({ message: 'View recorded' });
  } catch (error) {
    console.error('Error recording story view:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Get viewers for a story
router.get('/:storyId/viewers', async (req, res) => {
  try {
    const { storyId } = req.params;

    const views = await StoryView.findAll({
      where: { storyId },
      include: [
        {
          model: User,
          as: 'viewer',
          attributes: ['id', 'username', 'avatar'],
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    return res.json(views);
  } catch (error) {
    console.error('Error fetching story viewers:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;



// const express = require('express');
// const router = express.Router();
// const multer = require('multer');
// const { Story, User, Chat } = require('../models');
// const { Op } = require('sequelize');
// const AWS = require('aws-sdk');

// // MinIO client configuration (должна соответствовать настройкам в app.js)
// const s3 = new AWS.S3({
//   accessKeyId: process.env.MINIO_ACCESS_KEY || "admin",
//   secretAccessKey: process.env.MINIO_SECRET_KEY || "strongpassword123",
//   endpoint: process.env.MINIO_ENDPOINT || "http://localhost:9000",
//   s3ForcePathStyle: true,
//   signatureVersion: "v4",
// });

// // Функция для загрузки в MinIO
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
//     return fileName; // Возвращаем имя файла для создания presigned URL
//   } catch (err) {
//     console.error(`Failed to upload ${fileName}:`, err);
//     throw err;
//   }
// }

// // Функция для генерации presigned URL
// function generatePresignedUrl(fileName) {
//   const params = {
//     Bucket: "my-bucket",
//     Key: fileName,
//     Expires: 600 * 600,
//   };
//   return s3.getSignedUrl("getObject", params);
// }

// // Настройка multer для хранения в памяти
// const storage = multer.memoryStorage();
// const upload = multer({ storage });

// router.post('/', upload.single('file'), async (req, res) => {
//   try {
//     const { userId, caption } = req.body;
//     if (!userId) {
//       return res.status(400).json({ error: 'userId is required' });
//     }

//     let fileUrl = null;
//     let fileType = 'image';

//     if (req.file) {
//       const fileName = `${Date.now()}-${req.file.originalname}`;
//       await uploadToMinio(req.file.buffer, fileName, req.file.mimetype);
//       fileUrl = generatePresignedUrl(fileName);
//       if (req.file.mimetype.startsWith('video/')) {
//         fileType = 'video';
//       } else if (req.file.mimetype.startsWith('image/')) {
//         fileType = 'image';
//       } else {
//         fileType = 'file';
//       }
//     } else {
//       return res.status(400).json({ error: 'No file uploaded' });
//     }

//     const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

//     const story = await Story.create({
//       userId,
//       fileUrl,
//       type: fileType,
//       caption: caption || '',
//       expiresAt,
//     });

//     req.io.emit('newStoryCreated', { userId });

//     return res.json(story);
//   } catch (error) {
//     console.error('Ошибка при создании сторис:', error);
//     return res.status(500).json({ error: 'Server error' });
//   }
// });

// router.get('/personalized', async (req, res) => {
//   try {
//     const now = new Date();
//     const { userId } = req.query;
    
//     if (!userId) {
//       return res.status(400).json({ error: 'userId is required' });
//     }

//     const userChats = await Chat.findAll({
//       where: { userId },
//       attributes: ['partnerId']
//     });

//     const partnerIds = userChats.map(chat => chat.partnerId);
    
//     partnerIds.push(parseInt(userId));

//     const stories = await Story.findAll({
//       where: {
//         userId: partnerIds,
//         expiresAt: { [Op.gt]: now }
//       },
//       include: [
//         {
//           model: User,
//           as: 'owner',
//           attributes: ['id', 'username', 'avatar'],
//         }
//       ],
//       order: [['createdAt', 'DESC']],
//     });

//     return res.json(stories);
//   } catch (error) {
//     console.error('Ошибка при получении персонализированных сторис:', error);
//     return res.status(500).json({ error: 'Server error' });
//   }
// });

// router.get('/', async (req, res) => {
//   try {
//     const now = new Date();
//     const { userId } = req.query;
//     const where = {
//       expiresAt: { [Op.gt]: now },
//     };
//     if (userId) {
//       where.userId = userId;
//     }

//     const stories = await Story.findAll({
//       where,
//       include: [
//         {
//           model: User,
//           as: 'owner',
//           attributes: ['id', 'username', 'avatar'],
//         },
//       ],
//       order: [['createdAt', 'DESC']],
//     });

//     return res.json(stories);
//   } catch (error) {
//     console.error('Ошибка при получении сторис:', error);
//     return res.status(500).json({ error: 'Server error' });
//   }
// });

// router.delete('/:storyId', async (req, res) => {
//   try {
//     const { storyId } = req.params;
//     const { userId } = req.body;

//     const story = await Story.findByPk(storyId);
//     if (!story) {
//       return res.status(404).json({ error: 'Сторис не найдена' });
//     }
//     if (Number(story.userId) !== Number(userId)) {
//       return res.status(403).json({ error: 'Нет прав на удаление' });
//     }

//     // Удаление файла из MinIO
//     if (story.fileUrl) {
//       const fileName = story.fileUrl.split('/').pop(); // Извлекаем имя файла из URL
//       try {
//         await s3.deleteObject({ Bucket: 'my-bucket', Key: fileName }).promise();
//         console.log(`Deleted file ${fileName} from MinIO`);
//       } catch (err) {
//         console.error(`Failed to delete file ${fileName} from MinIO:`, err);
//       }
//     }

//     await story.destroy();
//     req.io.emit('storyDeleted', { userId, storyId });
//     return res.json({ message: 'Story deleted' });
//   } catch (error) {
//     console.error('Ошибка при удалении сторис:', error);
//     return res.status(500).json({ error: 'Server error' });
//   }
// });

// module.exports = router;