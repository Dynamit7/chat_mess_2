/**
 * Reels/Shorts Routes - TikTok-style short video feature
 * Super-App Messenger 2026
 */

const express = require('express');
const router = express.Router();
const { Op, Sequelize } = require('sequelize');
const multer = require('multer');
const {
  Reel,
  ReelMusic,
  ReelLike,
  ReelComment,
  ReelView,
  ReelHashtag,
  User,
  UserFollow,
} = require('../models');
const { uploadToMinio, generatePresignedUrl } = require('../utils/minioClient');

// Multer config for video uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('video/') || file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only video and image files are allowed'));
    }
  },
});

// ==========================================
// ===== REEL CRUD OPERATIONS =====
// ==========================================

/**
 * POST /api/reels - Create a new reel
 */
router.post('/', upload.fields([
  { name: 'media', maxCount: 1 },
  { name: 'video', maxCount: 1 },
  { name: 'thumbnail', maxCount: 1 },
]), async (req, res) => {
  try {
    const { userId, caption, musicId, duration, width, height, hashtags } = req.body;

    // Universal post: an image, a video, or text-only.
    const mediaFile = req.files?.media?.[0] || req.files?.video?.[0] || null;
    let mediaType = req.body.mediaType;
    if (!mediaType) {
      mediaType = mediaFile
        ? (mediaFile.mimetype.startsWith('image/') ? 'image' : 'video')
        : 'text';
    }

    if (mediaType === 'text') {
      if (!caption || !caption.trim()) {
        return res.status(400).json({ error: 'Text post requires a caption' });
      }
    } else if (!mediaFile) {
      return res.status(400).json({ error: 'Media file is required' });
    }

    // Upload the media file (image or video) to MinIO if present.
    let videoUrl = null;
    if (mediaFile) {
      const mediaFileName = `reels/${Date.now()}-${mediaFile.originalname}`;
      await uploadToMinio(mediaFile.buffer, mediaFileName, mediaFile.mimetype);
      videoUrl = generatePresignedUrl(mediaFileName);
    }

    // Upload thumbnail if provided
    let thumbnailUrl = null;
    if (req.files?.thumbnail?.[0]) {
      const thumbFile = req.files.thumbnail[0];
      const thumbFileName = `reels/thumbs/${Date.now()}-${thumbFile.originalname}`;
      await uploadToMinio(thumbFile.buffer, thumbFileName, thumbFile.mimetype);
      thumbnailUrl = generatePresignedUrl(thumbFileName);
    }

    // Parse hashtags
    let parsedHashtags = [];
    if (hashtags) {
      parsedHashtags = typeof hashtags === 'string' ? JSON.parse(hashtags) : hashtags;

      // Update hashtag counts
      for (const tag of parsedHashtags) {
        await ReelHashtag.upsert({
          name: tag.toLowerCase(),
          usageCount: Sequelize.literal('COALESCE("usageCount", 0) + 1'),
        });
      }
    }

    // Create reel/post
    const reel = await Reel.create({
      userId: parseInt(userId),
      videoUrl,
      mediaType,
      thumbnailUrl,
      caption,
      musicId: musicId ? parseInt(musicId) : null,
      duration: duration ? parseInt(duration) : null,
      width: width ? parseInt(width) : null,
      height: height ? parseInt(height) : null,
      hashtags: parsedHashtags,
    });

    // Update music usage count if music is used
    if (musicId) {
      await ReelMusic.increment('usageCount', { where: { id: musicId } });
    }

    // Fetch complete reel with associations
    const completeReel = await Reel.findByPk(reel.id, {
      include: [
        { model: User, as: 'creator', attributes: ['id', 'username', 'nickname', 'avatar'] },
        { model: ReelMusic, as: 'music' },
      ],
    });

    res.status(201).json(completeReel);
  } catch (error) {
    console.error('Error creating reel:', error);
    res.status(500).json({ error: 'Failed to create reel' });
  }
});

/**
 * GET /api/reels/feed - Get personalized feed
 */
router.get('/feed', async (req, res) => {
  try {
    const { userId, page = 1, limit = 10 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Get users the current user follows
    let followingIds = [];
    if (userId) {
      const following = await UserFollow.findAll({
        where: { followerId: parseInt(userId) },
        attributes: ['followingId'],
      });
      followingIds = following.map(f => f.followingId);
    }

    // Build query with scoring algorithm
    const reels = await Reel.findAll({
      where: {
        isPublic: true,
        isDeleted: false,
      },
      include: [
        { model: User, as: 'creator', attributes: ['id', 'username', 'nickname', 'avatar'] },
        { model: ReelMusic, as: 'music' },
      ],
      order: [
        // Prioritize followed users
        [Sequelize.literal(`CASE WHEN "userId" IN (${followingIds.length ? followingIds.join(',') : '0'}) THEN 0 ELSE 1 END`), 'ASC'],
        // Then by engagement score
        [Sequelize.literal('"likesCount" + "commentsCount" * 2 + "sharesCount" * 3'), 'DESC'],
        // Then by recency
        ['createdAt', 'DESC'],
      ],
      limit: parseInt(limit),
      offset,
    });

    // Add user-specific data (liked status). Batch the liked lookup into ONE
    // query instead of one ReelLike.findOne per reel (was N+1 — 10 extra
    // round-trips per feed page).
    let likedSet = new Set();
    if (userId && reels.length) {
      const likes = await ReelLike.findAll({
        where: { userId: parseInt(userId), reelId: { [Op.in]: reels.map((r) => r.id) } },
        attributes: ['reelId'],
      });
      likedSet = new Set(likes.map((l) => l.reelId));
    }
    const followingSet = new Set(followingIds);
    const reelsWithUserData = reels.map((reel) => {
      const reelData = reel.toJSON();
      if (userId) {
        reelData.isLiked = likedSet.has(reel.id);
        reelData.isFollowing = followingSet.has(reel.userId);
      }
      return reelData;
    });

    res.json(reelsWithUserData);
  } catch (error) {
    console.error('Error fetching feed:', error);
    res.status(500).json({ error: 'Failed to fetch feed' });
  }
});

/**
 * GET /api/reels/discover - Get trending/discover content
 */
router.get('/discover', async (req, res) => {
  try {
    const { page = 1, limit = 20, userId } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Get trending reels (high engagement in last 24 hours)
    const reels = await Reel.findAll({
      where: {
        isPublic: true,
        isDeleted: false,
        createdAt: {
          [Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        },
      },
      include: [
        { model: User, as: 'creator', attributes: ['id', 'username', 'nickname', 'avatar'] },
        { model: ReelMusic, as: 'music' },
      ],
      order: [
        [Sequelize.literal('"viewsCount" + "likesCount" * 5 + "commentsCount" * 10'), 'DESC'],
      ],
      limit: parseInt(limit),
      offset,
    });

    // Attach per-user liked status so the heart renders correctly in the feed.
    // One batched query instead of one ReelLike.findOne per reel (was N+1).
    let likedSet = new Set();
    if (userId && reels.length) {
      const likes = await ReelLike.findAll({
        where: { userId: parseInt(userId), reelId: { [Op.in]: reels.map((r) => r.id) } },
        attributes: ['reelId'],
      });
      likedSet = new Set(likes.map((l) => l.reelId));
    }
    const reelsWithUserData = reels.map((reel) => {
      const reelData = reel.toJSON();
      if (userId) reelData.isLiked = likedSet.has(reel.id);
      return reelData;
    });

    res.json(reelsWithUserData);
  } catch (error) {
    console.error('Error fetching discover:', error);
    res.status(500).json({ error: 'Failed to fetch discover' });
  }
});

/**
 * GET /api/reels/user/:userId - Get user's reels
 */
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20, currentUserId } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const whereClause = {
      userId: parseInt(userId),
      isDeleted: false,
    };

    // Only show public reels if not the owner
    if (currentUserId !== userId) {
      whereClause.isPublic = true;
    }

    const reels = await Reel.findAndCountAll({
      where: whereClause,
      include: [
        { model: User, as: 'creator', attributes: ['id', 'username', 'nickname', 'avatar'] },
        { model: ReelMusic, as: 'music' },
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset,
    });

    res.json({
      reels: reels.rows,
      total: reels.count,
      page: parseInt(page),
      totalPages: Math.ceil(reels.count / parseInt(limit)),
    });
  } catch (error) {
    console.error('Error fetching user reels:', error);
    res.status(500).json({ error: 'Failed to fetch user reels' });
  }
});

/**
 * GET /api/reels/:reelId - Get single reel
 */
router.get('/:reelId', async (req, res) => {
  try {
    const { reelId } = req.params;
    const { userId } = req.query;

    const reel = await Reel.findByPk(reelId, {
      include: [
        { model: User, as: 'creator', attributes: ['id', 'username', 'nickname', 'avatar'] },
        { model: ReelMusic, as: 'music' },
      ],
    });

    if (!reel || reel.isDeleted) {
      return res.status(404).json({ error: 'Reel not found' });
    }

    const reelData = reel.toJSON();

    if (userId) {
      const liked = await ReelLike.findOne({
        where: { reelId: reel.id, userId: parseInt(userId) },
      });
      reelData.isLiked = !!liked;

      const following = await UserFollow.findOne({
        where: { followerId: parseInt(userId), followingId: reel.userId },
      });
      reelData.isFollowing = !!following;
    }

    res.json(reelData);
  } catch (error) {
    console.error('Error fetching reel:', error);
    res.status(500).json({ error: 'Failed to fetch reel' });
  }
});

/**
 * DELETE /api/reels/:reelId - Delete reel
 */
router.delete('/:reelId', async (req, res) => {
  try {
    const { reelId } = req.params;
    const { userId } = req.body;

    const reel = await Reel.findByPk(reelId);

    if (!reel) {
      return res.status(404).json({ error: 'Reel not found' });
    }

    if (reel.userId !== parseInt(userId)) {
      return res.status(403).json({ error: 'Not authorized to delete this reel' });
    }

    // Soft delete
    await reel.update({ isDeleted: true });

    res.json({ message: 'Reel deleted successfully' });
  } catch (error) {
    console.error('Error deleting reel:', error);
    res.status(500).json({ error: 'Failed to delete reel' });
  }
});

// ==========================================
// ===== INTERACTIONS =====
// ==========================================

/**
 * POST /api/reels/:reelId/like - Like/unlike reel
 */
router.post('/:reelId/like', async (req, res) => {
  try {
    const { reelId } = req.params;
    const { userId } = req.body;

    const existingLike = await ReelLike.findOne({
      where: { reelId: parseInt(reelId), userId: parseInt(userId) },
    });

    if (existingLike) {
      // Unlike
      await existingLike.destroy();
      await Reel.decrement('likesCount', { where: { id: reelId } });
      res.json({ liked: false });
    } else {
      // Like
      await ReelLike.create({
        reelId: parseInt(reelId),
        userId: parseInt(userId),
      });
      await Reel.increment('likesCount', { where: { id: reelId } });
      res.json({ liked: true });
    }
  } catch (error) {
    console.error('Error toggling like:', error);
    res.status(500).json({ error: 'Failed to toggle like' });
  }
});

/**
 * POST /api/reels/:reelId/view - Record view
 */
router.post('/:reelId/view', async (req, res) => {
  try {
    const { reelId } = req.params;
    const { userId, watchDuration, completedWatch } = req.body;

    await ReelView.create({
      reelId: parseInt(reelId),
      userId: userId ? parseInt(userId) : null,
      watchDuration: watchDuration ? parseInt(watchDuration) : null,
      completedWatch: completedWatch || false,
    });

    await Reel.increment('viewsCount', { where: { id: reelId } });

    res.json({ success: true });
  } catch (error) {
    console.error('Error recording view:', error);
    res.status(500).json({ error: 'Failed to record view' });
  }
});

/**
 * POST /api/reels/:reelId/share - Record share
 */
router.post('/:reelId/share', async (req, res) => {
  try {
    const { reelId } = req.params;

    await Reel.increment('sharesCount', { where: { id: reelId } });

    res.json({ success: true });
  } catch (error) {
    console.error('Error recording share:', error);
    res.status(500).json({ error: 'Failed to record share' });
  }
});

// ==========================================
// ===== COMMENTS =====
// ==========================================

/**
 * GET /api/reels/:reelId/comments - Get comments
 */
router.get('/:reelId/comments', async (req, res) => {
  try {
    const { reelId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const comments = await ReelComment.findAndCountAll({
      where: {
        reelId: parseInt(reelId),
        parentCommentId: null, // Top-level comments only
        isDeleted: false,
      },
      include: [
        { model: User, as: 'author', attributes: ['id', 'username', 'nickname', 'avatar'] },
        {
          model: ReelComment,
          as: 'replies',
          where: { isDeleted: false },
          required: false,
          include: [
            { model: User, as: 'author', attributes: ['id', 'username', 'nickname', 'avatar'] },
          ],
          limit: 3, // Show first 3 replies
        },
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset,
    });

    res.json({
      comments: comments.rows,
      total: comments.count,
      page: parseInt(page),
      totalPages: Math.ceil(comments.count / parseInt(limit)),
    });
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

/**
 * POST /api/reels/:reelId/comment - Add comment
 */
router.post('/:reelId/comment', async (req, res) => {
  try {
    const { reelId } = req.params;
    const { userId, text, parentCommentId } = req.body;

    if (!text?.trim()) {
      return res.status(400).json({ error: 'Comment text is required' });
    }

    const comment = await ReelComment.create({
      reelId: parseInt(reelId),
      userId: parseInt(userId),
      text: text.trim(),
      parentCommentId: parentCommentId ? parseInt(parentCommentId) : null,
    });

    await Reel.increment('commentsCount', { where: { id: reelId } });

    const completeComment = await ReelComment.findByPk(comment.id, {
      include: [
        { model: User, as: 'author', attributes: ['id', 'username', 'nickname', 'avatar'] },
      ],
    });

    res.status(201).json(completeComment);
  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

/**
 * DELETE /api/reels/comment/:commentId - Delete comment
 */
router.delete('/comment/:commentId', async (req, res) => {
  try {
    const { commentId } = req.params;
    const { userId } = req.body;

    const comment = await ReelComment.findByPk(commentId);

    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    // Allow either the comment author or the owner of the post (reel) to delete.
    const reel = await Reel.findByPk(comment.reelId);
    const isAuthor = comment.userId === parseInt(userId);
    const isReelOwner = reel && reel.userId === parseInt(userId);
    if (!isAuthor && !isReelOwner) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await comment.update({ isDeleted: true });
    await Reel.decrement('commentsCount', { where: { id: comment.reelId } });

    res.json({ message: 'Comment deleted' });
  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

// ==========================================
// ===== MUSIC =====
// ==========================================

/**
 * GET /api/reels/music - Get available music
 */
router.get('/music/list', async (req, res) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const whereClause = {};
    if (search) {
      whereClause[Op.or] = [
        { title: { [Op.iLike]: `%${search}%` } },
        { artist: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const music = await ReelMusic.findAndCountAll({
      where: whereClause,
      order: [['usageCount', 'DESC']],
      limit: parseInt(limit),
      offset,
    });

    res.json({
      music: music.rows,
      total: music.count,
      page: parseInt(page),
      totalPages: Math.ceil(music.count / parseInt(limit)),
    });
  } catch (error) {
    console.error('Error fetching music:', error);
    res.status(500).json({ error: 'Failed to fetch music' });
  }
});

/**
 * POST /api/reels/music - Add music track
 */
router.post('/music', upload.single('audio'), async (req, res) => {
  try {
    const { title, artist, duration } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'Audio file is required' });
    }

    const audioFileName = `reels/music/${Date.now()}-${req.file.originalname}`;
    await uploadToMinio(req.file.buffer, audioFileName, req.file.mimetype);
    const audioUrl = generatePresignedUrl(audioFileName);

    const music = await ReelMusic.create({
      title,
      artist,
      audioUrl,
      duration: duration ? parseInt(duration) : null,
    });

    res.status(201).json(music);
  } catch (error) {
    console.error('Error adding music:', error);
    res.status(500).json({ error: 'Failed to add music' });
  }
});

// ==========================================
// ===== HASHTAGS =====
// ==========================================

/**
 * GET /api/reels/hashtags/trending - Get trending hashtags
 */
router.get('/hashtags/trending', async (req, res) => {
  try {
    const { limit = 20 } = req.query;

    const hashtags = await ReelHashtag.findAll({
      order: [['usageCount', 'DESC']],
      limit: parseInt(limit),
    });

    res.json(hashtags);
  } catch (error) {
    console.error('Error fetching trending hashtags:', error);
    res.status(500).json({ error: 'Failed to fetch trending hashtags' });
  }
});

/**
 * GET /api/reels/hashtags/:tag - Get reels by hashtag
 */
router.get('/hashtags/:tag', async (req, res) => {
  try {
    const { tag } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const reels = await Reel.findAndCountAll({
      where: {
        hashtags: { [Op.contains]: [tag.toLowerCase()] },
        isPublic: true,
        isDeleted: false,
      },
      include: [
        { model: User, as: 'creator', attributes: ['id', 'username', 'nickname', 'avatar'] },
        { model: ReelMusic, as: 'music' },
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset,
    });

    // Get hashtag info
    const hashtagInfo = await ReelHashtag.findOne({
      where: { name: tag.toLowerCase() },
    });

    res.json({
      hashtag: hashtagInfo,
      reels: reels.rows,
      total: reels.count,
      page: parseInt(page),
      totalPages: Math.ceil(reels.count / parseInt(limit)),
    });
  } catch (error) {
    console.error('Error fetching hashtag reels:', error);
    res.status(500).json({ error: 'Failed to fetch hashtag reels' });
  }
});

// ==========================================
// ===== USER FOLLOW =====
// ==========================================

/**
 * POST /api/reels/follow - Follow/unfollow user
 */
router.post('/follow', async (req, res) => {
  try {
    const { followerId, followingId } = req.body;

    if (followerId === followingId) {
      return res.status(400).json({ error: 'Cannot follow yourself' });
    }

    const existingFollow = await UserFollow.findOne({
      where: {
        followerId: parseInt(followerId),
        followingId: parseInt(followingId),
      },
    });

    if (existingFollow) {
      // Unfollow
      await existingFollow.destroy();
      res.json({ following: false });
    } else {
      // Follow
      await UserFollow.create({
        followerId: parseInt(followerId),
        followingId: parseInt(followingId),
      });
      res.json({ following: true });
    }
  } catch (error) {
    console.error('Error toggling follow:', error);
    res.status(500).json({ error: 'Failed to toggle follow' });
  }
});

/**
 * GET /api/reels/followers/:userId - Get user's followers
 */
router.get('/followers/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const followers = await UserFollow.findAndCountAll({
      where: { followingId: parseInt(userId) },
      include: [
        { model: User, as: 'follower', attributes: ['id', 'username', 'nickname', 'avatar'] },
      ],
      limit: parseInt(limit),
      offset,
    });

    res.json({
      followers: followers.rows.map(f => f.follower),
      total: followers.count,
      page: parseInt(page),
      totalPages: Math.ceil(followers.count / parseInt(limit)),
    });
  } catch (error) {
    console.error('Error fetching followers:', error);
    res.status(500).json({ error: 'Failed to fetch followers' });
  }
});

/**
 * GET /api/reels/following/:userId - Get users following
 */
router.get('/following/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const following = await UserFollow.findAndCountAll({
      where: { followerId: parseInt(userId) },
      include: [
        { model: User, as: 'following', attributes: ['id', 'username', 'nickname', 'avatar'] },
      ],
      limit: parseInt(limit),
      offset,
    });

    res.json({
      following: following.rows.map(f => f.following),
      total: following.count,
      page: parseInt(page),
      totalPages: Math.ceil(following.count / parseInt(limit)),
    });
  } catch (error) {
    console.error('Error fetching following:', error);
    res.status(500).json({ error: 'Failed to fetch following' });
  }
});

module.exports = router;
