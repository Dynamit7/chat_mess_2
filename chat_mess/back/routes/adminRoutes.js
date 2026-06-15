// ============================================================================
//  Admin / Moderation routes  —  /api/admin/*
//
//  Read-only oversight of the WHOLE platform (every DM, group and channel) plus
//  a few moderation actions (mute / unmute users, soft-delete messages).
//
//  Auth: every request must carry the header  `x-admin-key: <ADMIN_KEY>`.
//  Set ADMIN_KEY in back/.env  (falls back to a dev default below).
//
//  Real-time monitoring is handled in app.js via the `admin:join` socket event,
//  which subscribes the admin socket to every user_/group_/channel_ room so it
//  receives the exact same broadcasts as ordinary clients.
// ============================================================================
const express = require("express");
const router = express.Router();
const { Op } = require("sequelize");
const {
  sequelize,
  User,
  Message,
  Group,
  GroupUser,
  GroupMessage,
  Channel,
  ChannelUser,
  ChannelMessage,
  Poll,
  PollOption,
  PollVote,
} = require("../models/index");
const { decrypt } = require("../utils/encryption");

let isUserOnline = async () => false;
try {
  ({ isUserOnline } = require("../utils/redisClient"));
} catch (_) {/* redis optional */}

// Auth gate теперь в app.js через requireAdminJWT middleware

// Helper: safely decrypt (decrypt() already passes through plaintext).
const dec = (t) => {
  try { return decrypt(t) || ""; } catch { return t || ""; }
};

// Attach poll data (question + options + vote counts) to messages that carry a
// poll. `linkField` is how a Poll points back to its host message:
//   DM -> 'messageId', group -> 'groupMessageId', channel -> 'channelMessageId'.
// Polls are matched by that link OR by the message's own pollId column.
async function attachPolls(messages, linkField) {
  const msgIds = messages.map((m) => m.id).filter(Boolean);
  const pollIds = messages.map((m) => m.pollId).filter(Boolean);
  if (!msgIds.length && !pollIds.length) return messages;

  const or = [{ [linkField]: { [Op.in]: msgIds.length ? msgIds : [0] } }];
  if (pollIds.length) or.push({ id: { [Op.in]: pollIds } });

  const polls = await Poll.findAll({
    where: { [Op.or]: or },
    include: [{ model: PollOption, as: "options", attributes: ["id", "text", "votesCount", "order", "orderIndex"] }],
  });

  // load all votes with voter info for these polls
  const pollIdList = polls.map((p) => p.id);
  const allVotes = pollIdList.length
    ? await PollVote.findAll({
        where: { pollId: { [Op.in]: pollIdList } },
        include: [{ model: User, as: "voter", attributes: ["id", "username", "avatar"] }],
      })
    : [];
  // group votes by optionId
  const votesByOption = {};
  for (const v of allVotes) {
    const oid = v.optionId;
    if (!votesByOption[oid]) votesByOption[oid] = [];
    votesByOption[oid].push(v.voter ? v.voter.toJSON() : { id: v.userId, username: `#${v.userId}`, avatar: null });
  }

  const byId = {}, byLink = {};
  for (const p of polls) {
    const j = p.toJSON();
    const opts = (j.options || []).sort(
      (a, b) => (a.order ?? a.orderIndex ?? 0) - (b.order ?? b.orderIndex ?? 0)
    );
    const total = j.totalVotes || opts.reduce((s, o) => s + (o.votesCount || 0), 0);
    const data = {
      id: j.id,
      question: j.question,
      isAnonymous: j.isAnonymous,
      isQuiz: j.isQuiz,
      isClosed: j.isClosed,
      correctOptionIndex: j.correctOptionIndex,
      totalVotes: total,
      options: opts.map((o) => ({
        id: o.id,
        text: o.text,
        votesCount: o.votesCount || 0,
        percentage: total > 0 ? Math.round(((o.votesCount || 0) / total) * 100) : 0,
        voters: votesByOption[o.id] || [],
      })),
    };
    byId[j.id] = data;
    if (j[linkField]) byLink[j[linkField]] = data;
  }

  return messages.map((m) => {
    const poll = byLink[m.id] || (m.pollId && byId[m.pollId]) || null;
    return poll ? { ...m, type: "poll", poll } : m;
  });
}

// ---------------------------------------------------------------------------
//  POST /login  — validate an admin key (used by the admin UI login screen)
// ---------------------------------------------------------------------------
router.post("/login", (req, res) => {
  // Reaching here already means the key matched the gate above.
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
//  GET /overview  — platform-wide counters for the dashboard
// ---------------------------------------------------------------------------
router.get("/overview", async (req, res) => {
  try {
    const [
      users, groups, channels, dmMessages, groupMessages, channelMessages,
    ] = await Promise.all([
      User.count(),
      Group.count(),
      Channel.count(),
      Message.count(),
      GroupMessage.count(),
      ChannelMessage.count(),
    ]);

    // best-effort online count
    let online = 0;
    try {
      const ids = (await User.findAll({ attributes: ["id"] })).map((u) => u.id);
      const flags = await Promise.all(ids.map((id) => isUserOnline(id).catch(() => false)));
      online = flags.filter(Boolean).length;
    } catch (_) {}

    res.json({
      users,
      online,
      groups,
      channels,
      messages: { direct: dmMessages, group: groupMessages, channel: channelMessages },
      totalMessages: dmMessages + groupMessages + channelMessages,
    });
  } catch (err) {
    console.error("admin/overview", err);
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
//  GET /users?search=  — every user
// ---------------------------------------------------------------------------
router.get("/users", async (req, res) => {
  try {
    const { search } = req.query;
    const where = search
      ? {
          [Op.or]: [
            { username: { [Op.iLike]: `%${search}%` } },
            { nickname: { [Op.iLike]: `%${search}%` } },
            { email: { [Op.iLike]: `%${search}%` } },
          ],
        }
      : undefined;

    const users = await User.findAll({
      where,
      attributes: [
        "id", "username", "nickname", "email", "avatar", "bio",
        "isMuted", "mutedUntil", "moderationWarnings", "ghostMode",
        "twoFactorEnabled", "lastSeen", "createdAt",
      ],
      order: [["createdAt", "DESC"]],
    });

    const out = await Promise.all(
      users.map(async (u) => ({
        ...u.toJSON(),
        isOnline: await isUserOnline(u.id).catch(() => false),
      }))
    );
    res.json(out);
  } catch (err) {
    console.error("admin/users", err);
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
//  GET /dialogs  — every direct-message conversation (last msg + count)
// ---------------------------------------------------------------------------
router.get("/dialogs", async (req, res) => {
  try {
    // last message id + count per unordered pair
    const [rows] = await sequelize.query(`
      SELECT m.*, x.cnt
      FROM "Messages" m
      INNER JOIN (
        SELECT LEAST("fromUserId","toUserId") AS a,
               GREATEST("fromUserId","toUserId") AS b,
               MAX(id) AS maxid,
               COUNT(*) AS cnt
        FROM "Messages"
        GROUP BY a, b
      ) x ON m.id = x.maxid
      ORDER BY m."createdAt" DESC
    `);

    const userIds = [...new Set(rows.flatMap((r) => [r.fromUserId, r.toUserId]))];
    const users = await User.findAll({
      where: { id: { [Op.in]: userIds.length ? userIds : [0] } },
      attributes: ["id", "username", "avatar"],
    });
    const uMap = Object.fromEntries(users.map((u) => [u.id, u.toJSON()]));

    const dialogs = rows.map((r) => {
      const a = Math.min(r.fromUserId, r.toUserId);
      const b = Math.max(r.fromUserId, r.toUserId);
      return {
        id: `${a}_${b}`,
        user1: uMap[a] || { id: a, username: `#${a}` },
        user2: uMap[b] || { id: b, username: `#${b}` },
        lastMessage: r.isDeleted ? "(удалено)" : dec(r.text),
        lastType: r.type,
        lastTime: r.createdAt,
        lastFromUserId: r.fromUserId,
        count: Number(r.cnt),
      };
    });
    res.json(dialogs);
  } catch (err) {
    console.error("admin/dialogs", err);
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
//  GET /dialogs/messages?user1=&user2=  — full DM thread
// ---------------------------------------------------------------------------
router.get("/dialogs/messages", async (req, res) => {
  try {
    const user1 = Number(req.query.user1);
    const user2 = Number(req.query.user2);
    if (!user1 || !user2) return res.status(400).json({ error: "user1 & user2 required" });

    const messages = await Message.findAll({
      where: {
        [Op.or]: [
          { fromUserId: user1, toUserId: user2 },
          { fromUserId: user2, toUserId: user1 },
        ],
      },
      include: [
        { model: User, as: "sender", attributes: ["id", "username", "avatar"] },
      ],
      order: [["createdAt", "ASC"]],
    });

    const plain = messages.map((m) => {
      const j = m.toJSON();
      return { ...j, text: dec(j.text) };
    });
    res.json(await attachPolls(plain, "messageId"));
  } catch (err) {
    console.error("admin/dialogs/messages", err);
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
//  GET /groups  — every group
// ---------------------------------------------------------------------------
router.get("/groups", async (req, res) => {
  try {
    const groups = await Group.findAll({
      include: [{ model: User, as: "owner", attributes: ["id", "username", "avatar"] }],
      order: [["createdAt", "DESC"]],
    });

    const out = await Promise.all(groups.map(async (g) => {
      const [members, msgCount, last] = await Promise.all([
        GroupUser.count({ where: { groupId: g.id } }),
        GroupMessage.count({ where: { groupId: g.id } }),
        GroupMessage.findOne({
          where: { groupId: g.id },
          order: [["createdAt", "DESC"]],
          include: [{ model: User, as: "sender", attributes: ["username"] }],
        }),
      ]);
      return {
        ...g.toJSON(),
        memberCount: members,
        messageCount: msgCount,
        lastMessage: last ? (last.isDeleted ? "(удалено)" : dec(last.text)) : null,
        lastTime: last ? last.createdAt : null,
        lastSender: last && last.sender ? last.sender.username : null,
      };
    }));
    res.json(out);
  } catch (err) {
    console.error("admin/groups", err);
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
//  GET /groups/:id/messages  &  /groups/:id/members
// ---------------------------------------------------------------------------
router.get("/groups/:id/messages", async (req, res) => {
  try {
    const messages = await GroupMessage.findAll({
      where: { groupId: req.params.id },
      include: [{ model: User, as: "sender", attributes: ["id", "username", "avatar"] }],
      order: [["createdAt", "ASC"]],
    });
    const plain = messages.map((m) => {
      const j = m.toJSON();
      return { ...j, text: dec(j.text) };
    });
    res.json(await attachPolls(plain, "groupMessageId"));
  } catch (err) {
    console.error("admin/groups/messages", err);
    res.status(500).json({ error: err.message });
  }
});

router.get("/groups/:id/members", async (req, res) => {
  try {
    const members = await GroupUser.findAll({
      where: { groupId: req.params.id },
      include: [{ model: User, as: "user", attributes: ["id", "username", "avatar"] }],
    });
    res.json(members.map((m) => m.toJSON()));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
//  GET /channels  — every channel
// ---------------------------------------------------------------------------
router.get("/channels", async (req, res) => {
  try {
    const channels = await Channel.findAll({
      include: [{ model: User, as: "owner", attributes: ["id", "username", "avatar"] }],
      order: [["createdAt", "DESC"]],
    });

    const out = await Promise.all(channels.map(async (c) => {
      const [members, msgCount, last] = await Promise.all([
        ChannelUser.count({ where: { channelId: c.id } }),
        ChannelMessage.count({ where: { channelId: c.id } }),
        ChannelMessage.findOne({
          where: { channelId: c.id, parentMessageId: null },
          order: [["createdAt", "DESC"]],
          include: [{ model: User, as: "sender", attributes: ["username"] }],
        }),
      ]);
      return {
        ...c.toJSON(),
        memberCount: members,
        messageCount: msgCount,
        lastMessage: last ? (last.isDeleted ? "(удалено)" : dec(last.text)) : null,
        lastTime: last ? last.createdAt : null,
        lastSender: last && last.sender ? last.sender.username : null,
      };
    }));
    res.json(out);
  } catch (err) {
    console.error("admin/channels", err);
    res.status(500).json({ error: err.message });
  }
});

router.get("/channels/:id/messages", async (req, res) => {
  try {
    const messages = await ChannelMessage.findAll({
      where: { channelId: req.params.id, parentMessageId: null },
      include: [{ model: User, as: "sender", attributes: ["id", "username", "avatar"] }],
      order: [["createdAt", "ASC"]],
    });
    const plain = messages.map((m) => {
      const j = m.toJSON();
      return { ...j, text: dec(j.text) };
    });
    res.json(await attachPolls(plain, "channelMessageId"));
  } catch (err) {
    console.error("admin/channels/messages", err);
    res.status(500).json({ error: err.message });
  }
});

// ===========================================================================
//  MODERATION ACTIONS
// ===========================================================================

// mute a user for N minutes (default 60)
router.post("/users/:id/mute", async (req, res) => {
  try {
    const minutes = Number(req.body?.minutes) || 60;
    const mutedUntil = new Date(Date.now() + minutes * 60 * 1000);
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: "user not found" });
    user.isMuted = true;
    user.mutedUntil = mutedUntil;
    await user.save();
    req.io?.to(`user_${user.id}`).emit("userMuted", { userId: user.id, mutedUntil });
    res.json({ ok: true, userId: user.id, mutedUntil });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/users/:id/unmute", async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: "user not found" });
    user.isMuted = false;
    user.mutedUntil = null;
    await user.save();
    req.io?.to(`user_${user.id}`).emit("userUnmuted", { userId: user.id });
    res.json({ ok: true, userId: user.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// soft-delete a direct message
router.delete("/messages/:id", async (req, res) => {
  try {
    const m = await Message.findByPk(req.params.id);
    if (!m) return res.status(404).json({ error: "not found" });
    m.isDeleted = true;
    await m.save();
    const [a, b] = [Math.min(m.fromUserId, m.toUserId), Math.max(m.fromUserId, m.toUserId)];
    req.io?.to(`chat_${a}_${b}`).emit("messageDeleted", { messageId: m.id });
    req.io?.to(`user_${m.fromUserId}`).emit("messageDeleted", { messageId: m.id });
    req.io?.to(`user_${m.toUserId}`).emit("messageDeleted", { messageId: m.id });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// soft-delete a group message
router.delete("/group-messages/:id", async (req, res) => {
  try {
    const m = await GroupMessage.findByPk(req.params.id);
    if (!m) return res.status(404).json({ error: "not found" });
    m.isDeleted = true;
    await m.save();
    req.io?.to(`group_${m.groupId}`).emit("groupMessageDeleted", { messageId: m.id, groupId: m.groupId });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// soft-delete a channel message
router.delete("/channel-messages/:id", async (req, res) => {
  try {
    const m = await ChannelMessage.findByPk(req.params.id);
    if (!m) return res.status(404).json({ error: "not found" });
    m.isDeleted = true;
    await m.save();
    req.io?.to(`channel_${m.channelId}`).emit("channelMessageDeleted", { messageId: String(m.id) });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
