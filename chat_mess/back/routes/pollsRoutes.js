/**
 * Polls Routes
 * Create and vote on polls in chats
 * Super-App Messenger 2026
 */

const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const authMiddleware = require('../middleware/authMiddleware');
const { optionalAuth } = authMiddleware;
const { Poll, PollOption, PollVote, User, Chat, GroupUser, GroupMessage, ChannelMessage, sequelize } = require('../models');
const { invalidateGroupMessages, invalidateChannelMessages } = require('../utils/redisClient');

/**
 * Resolve the acting user from JWT (req.user) or, as a fallback, from the
 * userId passed in the body/query. The rest of this app authenticates group
 * actions by userId over sockets, so polls accept the same to stay consistent
 * (and to keep working when the short-lived JWT has expired).
 */
const resolveUserId = (req) =>
  req.user?.id || Number(req.body?.userId) || Number(req.query?.userId) || null;

/**
 * POST /api/polls
 * Create a new poll
 */
router.post('/', optionalAuth, async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const userId = resolveUserId(req);
    if (!userId) {
      await transaction.rollback();
      return res.status(401).json({ error: 'Authentication required' });
    }
    const {
      chatId,
      groupId,
      channelId,
      question,
      options,
      isAnonymous = false,
      allowMultipleAnswers = false,
      expiresAt,
      isQuiz = false,
      correctOptionIndex,
      explanation,
    } = req.body;

    if (!question) {
      return res.status(400).json({ error: 'Question is required' });
    }

    if (!options || options.length < 2) {
      return res.status(400).json({ error: 'At least 2 options are required' });
    }

    if (options.length > 10) {
      return res.status(400).json({ error: 'Maximum 10 options allowed' });
    }

    if (isQuiz && (correctOptionIndex === undefined || correctOptionIndex < 0 || correctOptionIndex >= options.length)) {
      return res.status(400).json({ error: 'Valid correct option index is required for quiz' });
    }

    // Create poll
    const poll = await Poll.create({
      creatorId: userId,
      chatId: chatId || null,
      groupId: groupId || null,
      channelId: channelId || null,
      question,
      isAnonymous,
      allowMultipleAnswers,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      isQuiz,
      correctOptionIndex: isQuiz ? correctOptionIndex : null,
      explanation: isQuiz ? explanation : null,
    }, { transaction });

    // Create options
    const pollOptions = await Promise.all(
      options.map((text, index) =>
        PollOption.create({
          pollId: poll.id,
          text,
          order: index,
        }, { transaction })
      )
    );

    // If this poll is in a group, create a GroupMessage of type "poll"
    let groupMessage = null;
    if (groupId) {
      groupMessage = await GroupMessage.create({
        groupId,
        userId,
        text: question,
        type: 'poll',
        pollId: poll.id,
      }, { transaction });

      // Link the poll back to the group message
      await poll.update({ groupMessageId: groupMessage.id }, { transaction });
    }

    // If this poll is in a channel, create a ChannelMessage of type "poll"
    let channelMessage = null;
    if (channelId) {
      channelMessage = await ChannelMessage.create({
        channelId,
        userId,
        text: question,
        type: 'poll',
        pollId: poll.id,
      }, { transaction });

      await poll.update({ channelMessageId: channelMessage.id }, { transaction });
    }

    await transaction.commit();

    // The poll created a new group/channel message directly, so the cached
    // message list is now stale — drop it or the poll vanishes after re-entering.
    if (groupId) {
      try { await invalidateGroupMessages(groupId); } catch (e) { console.error('invalidateGroupMessages failed:', e?.message); }
    }
    if (channelId) {
      try { await invalidateChannelMessages(channelId); } catch (e) { console.error('invalidateChannelMessages failed:', e?.message); }
    }

    const creator = await User.findByPk(userId, { attributes: ['id', 'username', 'avatar'] });

    // Emit socket event for real-time update
    if (req.io) {
      const room = chatId ? `chat_${chatId}` : groupId ? `group_${groupId}` : `channel_${channelId}`;

      if (groupId && groupMessage) {
        // Emit as a group message so it appears in the chat
        req.io.to(room).emit('groupMessageReceived', {
          id: groupMessage.id,
          groupId: Number(groupId),
          userId,
          text: question,
          type: 'poll',
          pollId: poll.id,
          poll: {
            ...poll.toJSON(),
            options: pollOptions.map(o => ({ ...o.toJSON(), votesCount: 0 })),
            totalVotes: 0,
          },
          sender: creator,
          createdAt: groupMessage.createdAt,
        });
      } else if (channelId && channelMessage) {
        // Emit as a channel message so it appears in the channel feed
        req.io.to(room).emit('channelMessageReceived', {
          id: channelMessage.id,
          channelId: Number(channelId),
          userId,
          text: question,
          type: 'poll',
          pollId: poll.id,
          poll: {
            ...poll.toJSON(),
            options: pollOptions.map(o => ({ ...o.toJSON(), votesCount: 0 })),
            totalVotes: 0,
          },
          sender: creator,
          createdAt: channelMessage.createdAt,
        });
      } else {
        req.io.to(room).emit('poll_created', {
          poll: {
            ...poll.toJSON(),
            options: pollOptions,
            creator,
          },
        });
      }
    }

    res.status(201).json({
      poll: {
        ...poll.toJSON(),
        options: pollOptions,
      },
      groupMessage: groupMessage ? groupMessage.toJSON() : undefined,
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Error creating poll:', error);
    res.status(500).json({ error: 'Failed to create poll' });
  }
});

/**
 * GET /api/polls/group/:groupId
 * Get all polls for a group
 */
router.get('/group/:groupId', async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.query.userId ? Number(req.query.userId) : null;

    const polls = await Poll.findAll({
      where: { groupMessageId: { [Op.ne]: null } },
      include: [
        {
          model: GroupMessage,
          as: 'groupMessage',
          where: { groupId },
          attributes: ['id'],
          required: true,
        },
        {
          model: PollOption,
          as: 'options',
          attributes: ['id', 'text', 'votesCount', 'order'],
        },
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'username', 'avatar'],
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    const pollsData = await Promise.all(polls.map(async (poll) => {
      let userVotes = [];
      if (userId) {
        userVotes = await PollVote.findAll({
          where: { pollId: poll.id, userId },
        });
      }
      return {
        ...poll.toJSON(),
        groupMessageId: poll.groupMessageId,
        hasVoted: userVotes.length > 0,
        userVotedOptions: userVotes.map(v => v.optionId),
        totalVotes: poll.totalVotes || 0,
        options: poll.options.map(opt => ({
          id: opt.id,
          text: opt.text,
          votesCount: opt.votesCount || 0,
          order: opt.order,
        })),
      };
    }));

    res.json({ polls: pollsData });
  } catch (error) {
    console.error('Error fetching group polls:', error);
    res.status(500).json({ error: 'Failed to fetch polls' });
  }
});

/**
 * GET /api/polls/:id
 * Get poll details with results
 */
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const userId = resolveUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const { id } = req.params;

    const poll = await Poll.findByPk(id, {
      include: [
        {
          model: PollOption,
          as: 'options',
          include: [
            {
              model: PollVote,
              as: 'votes',
              // Always join the voter; anonymity is enforced below when
              // formatting (can't reference `poll` here — it's still being assigned).
              include: [
                {
                  model: User,
                  as: 'voter',
                  attributes: ['id', 'username', 'avatar'],
                },
              ],
            },
          ],
          order: [['order', 'ASC']],
        },
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'username', 'avatar'],
        },
      ],
    });

    if (!poll) {
      return res.status(404).json({ error: 'Poll not found' });
    }

    // Check if user has voted
    const userVotes = await PollVote.findAll({
      where: { pollId: id, userId },
    });

    // Calculate total votes
    const totalVotes = poll.options.reduce((sum, opt) => sum + (opt.votes?.length || 0), 0);

    // Format response
    const pollData = {
      ...poll.toJSON(),
      totalVotes,
      userVotedOptions: userVotes.map(v => v.optionId),
      hasVoted: userVotes.length > 0,
      options: poll.options.map(opt => ({
        id: opt.id,
        text: opt.text,
        votesCount: opt.votes?.length || 0,
        percentage: totalVotes > 0 ? Math.round((opt.votes?.length || 0) / totalVotes * 100) : 0,
        voters: poll.isAnonymous ? [] : opt.votes?.map(v => v.voter) || [],
      })),
    };

    // Hide correct answer if user hasn't voted and it's a quiz
    if (poll.isQuiz && !userVotes.length) {
      delete pollData.correctOptionIndex;
      delete pollData.explanation;
    }

    res.json({ poll: pollData });
  } catch (error) {
    console.error('Error fetching poll:', error);
    res.status(500).json({ error: 'Failed to fetch poll' });
  }
});

/**
 * POST /api/polls/:id/vote
 * Vote on a poll
 */
router.post('/:id/vote', optionalAuth, async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const userId = resolveUserId(req);
    if (!userId) {
      await transaction.rollback();
      return res.status(401).json({ error: 'Authentication required' });
    }
    const { id: pollId } = req.params;
    const { optionIds } = req.body;

    if (!optionIds || !Array.isArray(optionIds) || optionIds.length === 0) {
      return res.status(400).json({ error: 'Option IDs are required' });
    }

    const poll = await Poll.findByPk(pollId, {
      include: [{ model: PollOption, as: 'options' }],
    });

    if (!poll) {
      return res.status(404).json({ error: 'Poll not found' });
    }

    // Check if poll is closed
    if (poll.isClosed) {
      return res.status(400).json({ error: 'Poll is closed' });
    }

    // Check if poll has expired
    if (poll.expiresAt && new Date(poll.expiresAt) < new Date()) {
      await poll.update({ isClosed: true }, { transaction });
      return res.status(400).json({ error: 'Poll has expired' });
    }

    // Check multiple answers
    if (!poll.allowMultipleAnswers && optionIds.length > 1) {
      return res.status(400).json({ error: 'Multiple answers not allowed' });
    }

    // Validate option IDs
    const validOptionIds = poll.options.map(o => o.id);
    const invalidOptions = optionIds.filter(id => !validOptionIds.includes(id));
    if (invalidOptions.length > 0) {
      return res.status(400).json({ error: 'Invalid option IDs' });
    }

    // Check if user already voted
    const existingVotes = await PollVote.findAll({
      where: { pollId, userId },
    });

    if (existingVotes.length > 0) {
      // Remove existing votes and add new ones (change vote)
      await PollVote.destroy({
        where: { pollId, userId },
        transaction,
      });
    }

    // Create new votes
    await Promise.all(
      optionIds.map(optionId =>
        PollVote.create({
          pollId,
          optionId,
          userId,
        }, { transaction })
      )
    );

    // Update vote counts
    await poll.increment('totalVotes', { by: optionIds.length, transaction });
    for (const optionId of optionIds) {
      await PollOption.increment('votesCount', {
        where: { id: optionId },
        transaction,
      });
    }

    await transaction.commit();

    // Fetch updated poll
    const updatedPoll = await Poll.findByPk(pollId, {
      include: [
        {
          model: PollOption,
          as: 'options',
          order: [['order', 'ASC']],
        },
      ],
    });

    const totalVotes = updatedPoll.options.reduce((sum, opt) => sum + (opt.votesCount || 0), 0);

    // Prepare response
    const response = {
      success: true,
      poll: {
        id: poll.id,
        totalVotes,
        options: updatedPoll.options.map(opt => ({
          id: opt.id,
          text: opt.text,
          votesCount: opt.votesCount || 0,
          percentage: totalVotes > 0 ? Math.round((opt.votesCount || 0) / totalVotes * 100) : 0,
        })),
        userVotedOptions: optionIds,
      },
    };

    // For quiz, include correct answer
    if (poll.isQuiz) {
      response.poll.correctOptionIndex = poll.correctOptionIndex;
      response.poll.explanation = poll.explanation;
      response.poll.isCorrect = optionIds.includes(poll.options[poll.correctOptionIndex]?.id);
    }

    // Emit socket event for real-time update
    if (req.io) {
      const room = poll.chatId ? `chat_${poll.chatId}` : poll.groupId ? `group_${poll.groupId}` : `channel_${poll.channelId}`;
      req.io.to(room).emit('poll_voted', {
        pollId: poll.id,
        totalVotes,
        options: response.poll.options,
      });
    }

    res.json(response);
  } catch (error) {
    await transaction.rollback();
    console.error('Error voting on poll:', error);
    res.status(500).json({ error: 'Failed to vote on poll' });
  }
});

/**
 * POST /api/polls/:id/retract
 * Retract vote from a poll
 */
router.post('/:id/retract', optionalAuth, async (req, res) => {
  try {
    const userId = resolveUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const { id: pollId } = req.params;

    const poll = await Poll.findByPk(pollId);

    if (!poll) {
      return res.status(404).json({ error: 'Poll not found' });
    }

    if (poll.isClosed) {
      return res.status(400).json({ error: 'Cannot retract vote from closed poll' });
    }

    const votes = await PollVote.findAll({
      where: { pollId, userId },
    });

    if (votes.length === 0) {
      return res.status(400).json({ error: 'You have not voted on this poll' });
    }

    // Delete votes
    await PollVote.destroy({
      where: { pollId, userId },
    });

    // Update counts
    await poll.decrement('totalVotes', { by: votes.length });
    for (const vote of votes) {
      await PollOption.decrement('votesCount', {
        where: { id: vote.optionId },
      });
    }

    res.json({ success: true, message: 'Vote retracted' });
  } catch (error) {
    console.error('Error retracting vote:', error);
    res.status(500).json({ error: 'Failed to retract vote' });
  }
});

/**
 * POST /api/polls/:id/close
 * Close a poll (creator only)
 */
router.post('/:id/close', optionalAuth, async (req, res) => {
  try {
    const userId = resolveUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const { id: pollId } = req.params;

    const poll = await Poll.findByPk(pollId);

    if (!poll) {
      return res.status(404).json({ error: 'Poll not found' });
    }

    if (poll.creatorId !== userId) {
      return res.status(403).json({ error: 'Only the creator can close the poll' });
    }

    if (poll.isClosed) {
      return res.status(400).json({ error: 'Poll is already closed' });
    }

    await poll.update({ isClosed: true });

    // Emit socket event
    if (req.io) {
      const room = poll.chatId ? `chat_${poll.chatId}` : poll.groupId ? `group_${poll.groupId}` : `channel_${poll.channelId}`;
      req.io.to(room).emit('poll_closed', { pollId: poll.id });
    }

    res.json({ success: true, message: 'Poll closed' });
  } catch (error) {
    console.error('Error closing poll:', error);
    res.status(500).json({ error: 'Failed to close poll' });
  }
});

/**
 * DELETE /api/polls/:id
 * Delete a poll (creator only)
 */
router.delete('/:id', optionalAuth, async (req, res) => {
  try {
    const userId = resolveUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const { id: pollId } = req.params;

    const poll = await Poll.findByPk(pollId);

    if (!poll) {
      return res.status(404).json({ error: 'Poll not found' });
    }

    if (poll.creatorId !== userId) {
      return res.status(403).json({ error: 'Only the creator can delete the poll' });
    }

    // Delete votes and options first
    await PollVote.destroy({ where: { pollId } });
    await PollOption.destroy({ where: { pollId } });
    await poll.destroy();

    // Emit socket event
    if (req.io) {
      const room = poll.chatId ? `chat_${poll.chatId}` : poll.groupId ? `group_${poll.groupId}` : `channel_${poll.channelId}`;
      req.io.to(room).emit('poll_deleted', { pollId: poll.id });
    }

    res.json({ success: true, message: 'Poll deleted' });
  } catch (error) {
    console.error('Error deleting poll:', error);
    res.status(500).json({ error: 'Failed to delete poll' });
  }
});

/**
 * GET /api/polls/:id/voters
 * Get list of voters for a poll option (non-anonymous polls only)
 */
router.get('/:id/voters', optionalAuth, async (req, res) => {
  try {
    const { id: pollId } = req.params;
    const { optionId, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    const poll = await Poll.findByPk(pollId);

    if (!poll) {
      return res.status(404).json({ error: 'Poll not found' });
    }

    if (poll.isAnonymous) {
      return res.status(403).json({ error: 'Cannot view voters for anonymous poll' });
    }

    const where = { pollId };
    if (optionId) {
      where.optionId = optionId;
    }

    const votes = await PollVote.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: 'voter',
          attributes: ['id', 'username', 'avatar'],
        },
        {
          model: PollOption,
          as: 'option',
          attributes: ['id', 'text'],
        },
      ],
      limit: parseInt(limit),
      offset,
      order: [['createdAt', 'DESC']],
    });

    res.json({
      voters: votes.rows.map(v => ({
        user: v.voter,
        option: v.option,
        votedAt: v.createdAt,
      })),
      total: votes.count,
      page: parseInt(page),
      totalPages: Math.ceil(votes.count / limit),
    });
  } catch (error) {
    console.error('Error fetching voters:', error);
    res.status(500).json({ error: 'Failed to fetch voters' });
  }
});

module.exports = router;
