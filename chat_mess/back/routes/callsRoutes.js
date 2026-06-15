const express = require("express");
const router = express.Router();

// ICE-серверы строятся при каждом запросе (не кэшируем) — чтобы .env изменения подхватывались без рестарта
function buildIceServers() {
  const servers = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
  ];

  // Свой TURN сервер (coturn) — нужен для звонков через строгий NAT
  if (process.env.TURN_URL) {
    servers.push({
      urls: process.env.TURN_URL,
      username: process.env.TURN_USER || "",
      credential: process.env.TURN_PASS || "",
    });
  }
  // TLS версия TURN (более надёжна, проходит через корпоративные фаерволы)
  if (process.env.TURN_TLS_URL) {
    servers.push({
      urls: process.env.TURN_TLS_URL,
      username: process.env.TURN_USER || "",
      credential: process.env.TURN_PASS || "",
    });
  }

  return servers;
}

// GET /api/calls/ice-servers — клиент запрашивает перед каждым звонком
router.get("/ice-servers", (req, res) => {
  res.json({ iceServers: buildIceServers() });
});

module.exports = router;
