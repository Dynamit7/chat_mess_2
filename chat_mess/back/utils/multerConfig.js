const multer = require('multer');

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedTypes = ["image/", "video/", "audio/", "application/"];
  if (allowedTypes.some((type) => file.mimetype.startsWith(type))) {
    cb(null, true);
  } else {
    cb(new Error("Разрешены только изображения, видео, аудио и документы!"), false);
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
    fieldSize: 5 * 1024 * 1024,
  },
  fileFilter,
});

const uploadLarge = multer({
  storage: storage,
  limits: {
    fileSize: 1024 * 1024 * 1024,
    fieldSize: 1024 * 1024 * 1024,
  },
  fileFilter,
});

module.exports = {
  upload,
  uploadLarge
};