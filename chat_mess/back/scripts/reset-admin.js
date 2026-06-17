// One-off: reset (or create) the superadmin login.
// Usage: node scripts/reset-admin.js [username] [password]
const bcrypt = require("bcrypt");
const { sequelize, AdminUser } = require("../models");

(async () => {
  const username = process.argv[2] || "superadmin";
  const password = process.argv[3] || "admin123456";
  try {
    await sequelize.authenticate();
    await AdminUser.sync();
    const passwordHash = await bcrypt.hash(password, 12);
    const [admin, created] = await AdminUser.findOrCreate({
      where: { username },
      defaults: { username, passwordHash, role: "superadmin", isActive: true },
    });
    if (!created) {
      await admin.update({ passwordHash, role: "superadmin", isActive: true });
    }
    console.log(`✅ ${created ? "Created" : "Reset"} admin`);
    console.log(`   Login:    ${username}`);
    console.log(`   Password: ${password}`);
  } catch (e) {
    console.error("❌ Failed:", e.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
})();
