const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { AdminUser } = require("../models");

const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET;
const ADMIN_KEY = process.env.ADMIN_KEY;

// POST /api/admin/auth/login — вход super admin по логину+паролю
// Возвращает JWT токен (8 часов) вместо постоянного ключа
router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "username and password required" });
  }
  try {
    const admin = await AdminUser.findOne({ where: { username, isActive: true } });
    if (!admin) return res.status(401).json({ error: "Invalid credentials" });

    const ok = await bcrypt.compare(password, admin.passwordHash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    await admin.update({ lastLoginAt: new Date() });

    const token = jwt.sign(
      { adminId: admin.id, username: admin.username, role: admin.role },
      ADMIN_JWT_SECRET,
      { expiresIn: "8h" }
    );
    return res.json({ token, role: admin.role, username: admin.username });
  } catch (err) {
    console.error("Admin login error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// POST /api/admin/auth/create — создать admin пользователя
// Защищён статическим ADMIN_KEY (только для первичной настройки)
router.post("/create", async (req, res) => {
  const key = req.headers["x-admin-key"] || req.body.adminKey;
  if (key !== ADMIN_KEY) {
    return res.status(401).json({ error: "Invalid admin key" });
  }
  const { username, password, role } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "username and password required" });
  }
  if (password.length < 12) {
    return res.status(400).json({ error: "Password must be at least 12 characters" });
  }
  try {
    const exists = await AdminUser.findOne({ where: { username } });
    if (exists) return res.status(409).json({ error: "Username already exists" });

    const passwordHash = await bcrypt.hash(password, 12);
    const admin = await AdminUser.create({
      username,
      passwordHash,
      role: role === "superadmin" ? "superadmin" : "moderator",
    });
    return res.status(201).json({
      success: true,
      admin: { id: admin.id, username: admin.username, role: admin.role },
    });
  } catch (err) {
    console.error("Admin create error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// GET /api/admin/auth/me — проверить JWT токен
router.get("/me", (req, res) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return res.status(401).json({ error: "No token" });
  try {
    const payload = jwt.verify(auth.slice(7), ADMIN_JWT_SECRET);
    return res.json({ adminId: payload.adminId, username: payload.username, role: payload.role });
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
});

// Middleware: проверка JWT для защищённых admin роутов
function requireAdminJWT(req, res, next) {
  const auth = req.headers.authorization;
  const key = req.headers["x-admin-key"] || req.query.adminKey;

  // Поддерживаем оба метода: JWT токен и старый x-admin-key (для обратной совместимости)
  if (key && key === ADMIN_KEY) {
    req.adminRole = "superadmin";
    return next();
  }
  if (auth?.startsWith("Bearer ")) {
    try {
      const payload = jwt.verify(auth.slice(7), ADMIN_JWT_SECRET);
      req.adminRole = payload.role;
      req.adminId = payload.adminId;
      return next();
    } catch {
      return res.status(401).json({ error: "Invalid or expired admin token" });
    }
  }
  return res.status(401).json({ error: "Admin authentication required" });
}

module.exports = { router, requireAdminJWT };
