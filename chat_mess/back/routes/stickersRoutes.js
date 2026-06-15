/**
 * Stickers Routes
 * Sticker packs, custom stickers, and GIF integration
 * Super-App Messenger 2026
 */

const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const authMiddleware = require('../middleware/authMiddleware');
const { StickerPack, Sticker, UserStickerPack, User } = require('../models');
const { uploadToMinio } = require('../utils/minioClient');
const { upload } = require('../utils/multerConfig');

// Giphy API configuration
const GIPHY_API_KEY = process.env.GIPHY_API_KEY || 'dc6zaTOxFJmzC'; // Public beta key for testing

/**
 * GET /api/stickers/packs
 * Get all available sticker packs
 */
router.get('/packs', authMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const offset = (page - 1) * limit;

    const where = { isActive: true };
    if (search) {
      where.name = { [Op.iLike]: `%${search}%` };
    }

    const packs = await StickerPack.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'username', 'avatar'],
        },
      ],
      order: [['downloadsCount', 'DESC']],
      limit: parseInt(limit),
      offset,
    });

    res.json({
      packs: packs.rows,
      total: packs.count,
      page: parseInt(page),
      totalPages: Math.ceil(packs.count / limit),
    });
  } catch (error) {
    console.error('Error fetching sticker packs:', error);
    res.status(500).json({ error: 'Failed to fetch sticker packs' });
  }
});

/**
 * GET /api/stickers/packs/:id
 * Get a specific sticker pack with its stickers
 */
router.get('/packs/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const pack = await StickerPack.findByPk(id, {
      include: [
        {
          model: Sticker,
          as: 'stickers',
          where: { isActive: true },
          required: false,
          order: [['order', 'ASC']],
        },
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'username', 'avatar'],
        },
      ],
    });

    if (!pack) {
      return res.status(404).json({ error: 'Sticker pack not found' });
    }

    // Check if user has this pack
    const userId = req.user.id;
    const userPack = await UserStickerPack.findOne({
      where: { userId, stickerPackId: id },
    });

    res.json({
      pack: {
        ...pack.toJSON(),
        isOwned: !!userPack,
      },
    });
  } catch (error) {
    console.error('Error fetching sticker pack:', error);
    res.status(500).json({ error: 'Failed to fetch sticker pack' });
  }
});

/**
 * POST /api/stickers/packs
 * Create a new sticker pack
 */
router.post('/packs', authMiddleware, upload.single('thumbnail'), async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, description, isPremium = false, price = 0 } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Pack name is required' });
    }

    let thumbnailUrl = null;
    if (req.file) {
      thumbnailUrl = await uploadToMinio(req.file, 'stickers');
    }

    const pack = await StickerPack.create({
      name,
      description,
      thumbnailUrl,
      creatorId: userId,
      isPremium,
      price: isPremium ? price : 0,
    });

    res.status(201).json({ pack });
  } catch (error) {
    console.error('Error creating sticker pack:', error);
    res.status(500).json({ error: 'Failed to create sticker pack' });
  }
});

/**
 * POST /api/stickers/packs/:id/stickers
 * Add a sticker to a pack
 */
router.post('/packs/:id/stickers', authMiddleware, upload.single('sticker'), async (req, res) => {
  try {
    const userId = req.user.id;
    const { id: packId } = req.params;
    const { emoji, keywords } = req.body;

    const pack = await StickerPack.findByPk(packId);
    if (!pack) {
      return res.status(404).json({ error: 'Sticker pack not found' });
    }

    if (pack.creatorId !== userId) {
      return res.status(403).json({ error: 'Not authorized to add stickers to this pack' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Sticker image is required' });
    }

    const imageUrl = await uploadToMinio(req.file, 'stickers');

    // Get next order number
    const lastSticker = await Sticker.findOne({
      where: { packId },
      order: [['order', 'DESC']],
    });
    const order = lastSticker ? lastSticker.order + 1 : 0;

    const sticker = await Sticker.create({
      packId,
      imageUrl,
      emoji,
      keywords: keywords ? keywords.split(',').map(k => k.trim()) : [],
      order,
    });

    // Update pack sticker count
    await pack.increment('stickersCount');

    res.status(201).json({ sticker });
  } catch (error) {
    console.error('Error adding sticker:', error);
    res.status(500).json({ error: 'Failed to add sticker' });
  }
});

/**
 * POST /api/stickers/packs/:id/download
 * Add a sticker pack to user's collection
 */
router.post('/packs/:id/download', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id: packId } = req.params;

    const pack = await StickerPack.findByPk(packId);
    if (!pack) {
      return res.status(404).json({ error: 'Sticker pack not found' });
    }

    // Check if already owned
    const existing = await UserStickerPack.findOne({
      where: { userId, stickerPackId: packId },
    });

    if (existing) {
      return res.status(400).json({ error: 'You already have this pack' });
    }

    // TODO: Handle premium packs with payment

    await UserStickerPack.create({
      userId,
      stickerPackId: packId,
    });

    await pack.increment('downloadsCount');

    res.json({ success: true, message: 'Sticker pack added to your collection' });
  } catch (error) {
    console.error('Error downloading sticker pack:', error);
    res.status(500).json({ error: 'Failed to download sticker pack' });
  }
});

/**
 * DELETE /api/stickers/packs/:id/download
 * Remove a sticker pack from user's collection
 */
router.delete('/packs/:id/download', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id: packId } = req.params;

    const userPack = await UserStickerPack.findOne({
      where: { userId, stickerPackId: packId },
    });

    if (!userPack) {
      return res.status(404).json({ error: 'Pack not in your collection' });
    }

    await userPack.destroy();

    res.json({ success: true, message: 'Sticker pack removed from your collection' });
  } catch (error) {
    console.error('Error removing sticker pack:', error);
    res.status(500).json({ error: 'Failed to remove sticker pack' });
  }
});

/**
 * GET /api/stickers/my-packs
 * Get user's sticker pack collection
 */
router.get('/my-packs', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const userPacks = await UserStickerPack.findAll({
      where: { userId },
      include: [
        {
          model: StickerPack,
          as: 'pack',
          include: [
            {
              model: Sticker,
              as: 'stickers',
              where: { isActive: true },
              required: false,
              limit: 5,
              order: [['order', 'ASC']],
            },
          ],
        },
      ],
      order: [['usedAt', 'DESC']],
    });

    res.json({
      packs: userPacks.map(up => ({
        ...up.pack.toJSON(),
        usedAt: up.usedAt,
      })),
    });
  } catch (error) {
    console.error('Error fetching user sticker packs:', error);
    res.status(500).json({ error: 'Failed to fetch your sticker packs' });
  }
});

/**
 * GET /api/stickers/recent
 * Get user's recently used stickers
 */
router.get('/recent', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 20 } = req.query;

    // Get recently used packs and their stickers
    const userPacks = await UserStickerPack.findAll({
      where: { userId },
      include: [
        {
          model: StickerPack,
          as: 'pack',
          include: [
            {
              model: Sticker,
              as: 'stickers',
              where: { isActive: true },
              required: false,
            },
          ],
        },
      ],
      order: [['usedAt', 'DESC']],
      limit: 5,
    });

    // Flatten stickers from all packs
    const stickers = userPacks
      .flatMap(up => up.pack.stickers || [])
      .slice(0, parseInt(limit));

    res.json({ stickers });
  } catch (error) {
    console.error('Error fetching recent stickers:', error);
    res.status(500).json({ error: 'Failed to fetch recent stickers' });
  }
});

/**
 * POST /api/stickers/use/:stickerId
 * Mark a sticker as used (for recent stickers)
 */
router.post('/use/:stickerId', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { stickerId } = req.params;

    const sticker = await Sticker.findByPk(stickerId);
    if (!sticker) {
      return res.status(404).json({ error: 'Sticker not found' });
    }

    // Update usedAt for the pack
    await UserStickerPack.update(
      { usedAt: new Date() },
      { where: { userId, stickerPackId: sticker.packId } }
    );

    // Increment usage count
    await sticker.increment('usageCount');

    res.json({ success: true });
  } catch (error) {
    console.error('Error marking sticker as used:', error);
    res.status(500).json({ error: 'Failed to update sticker usage' });
  }
});

/**
 * GET /api/stickers/giphy
 * Search GIFs via Giphy API
 */
router.get('/giphy', authMiddleware, async (req, res) => {
  try {
    const { q, limit = 25, offset = 0 } = req.query;

    if (!q) {
      // Return trending GIFs
      const response = await fetch(
        `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_API_KEY}&limit=${limit}&offset=${offset}&rating=pg-13`
      );
      const data = await response.json();

      return res.json({
        gifs: data.data.map(gif => ({
          id: gif.id,
          url: gif.images.fixed_height.url,
          webp: gif.images.fixed_height.webp,
          width: gif.images.fixed_height.width,
          height: gif.images.fixed_height.height,
          preview: gif.images.fixed_height_still.url,
          title: gif.title,
        })),
        pagination: data.pagination,
      });
    }

    // Search GIFs
    const response = await fetch(
      `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(q)}&limit=${limit}&offset=${offset}&rating=pg-13&lang=en`
    );
    const data = await response.json();

    res.json({
      gifs: data.data.map(gif => ({
        id: gif.id,
        url: gif.images.fixed_height.url,
        webp: gif.images.fixed_height.webp,
        width: gif.images.fixed_height.width,
        height: gif.images.fixed_height.height,
        preview: gif.images.fixed_height_still.url,
        title: gif.title,
      })),
      pagination: data.pagination,
    });
  } catch (error) {
    console.error('Error fetching GIFs:', error);
    res.status(500).json({ error: 'Failed to fetch GIFs' });
  }
});

/**
 * GET /api/stickers/giphy/categories
 * Get Giphy categories
 */
router.get('/giphy/categories', authMiddleware, async (req, res) => {
  try {
    const response = await fetch(
      `https://api.giphy.com/v1/gifs/categories?api_key=${GIPHY_API_KEY}`
    );
    const data = await response.json();

    res.json({
      categories: data.data.map(cat => ({
        name: cat.name,
        nameEncoded: cat.name_encoded,
        gif: cat.gif ? {
          id: cat.gif.id,
          url: cat.gif.images.fixed_height.url,
          preview: cat.gif.images.fixed_height_still.url,
        } : null,
      })),
    });
  } catch (error) {
    console.error('Error fetching GIF categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

module.exports = router;
