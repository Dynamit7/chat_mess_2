const client = require("prom-client");

const register = new client.Registry();
register.setDefaultLabels({ app: "chatmess" });

// Системные метрики: память, CPU, event loop lag, GC
client.collectDefaultMetrics({ register, prefix: "chatmess_" });

// ─── HTTP ────────────────────────────────────────────────────────────────────

const httpRequestsTotal = new client.Counter({
  name: "chatmess_http_requests_total",
  help: "Общее количество HTTP запросов",
  labelNames: ["method", "route", "status"],
  registers: [register],
});

const httpRequestDuration = new client.Histogram({
  name: "chatmess_http_request_duration_seconds",
  help: "Время обработки HTTP запроса",
  labelNames: ["method", "route", "status"],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
  registers: [register],
});

// ─── Socket.IO ───────────────────────────────────────────────────────────────

const socketConnectionsActive = new client.Gauge({
  name: "chatmess_socket_connections_active",
  help: "Текущее число активных Socket.IO соединений",
  registers: [register],
});

const socketEventsTotal = new client.Counter({
  name: "chatmess_socket_events_total",
  help: "Количество Socket.IO событий",
  labelNames: ["event"],
  registers: [register],
});

// ─── Сообщения ───────────────────────────────────────────────────────────────

const messagesTotal = new client.Counter({
  name: "chatmess_messages_total",
  help: "Отправленных сообщений по типу чата",
  labelNames: ["chat_type"],  // direct | group | channel
  registers: [register],
});

const messagesDeletedTotal = new client.Counter({
  name: "chatmess_messages_deleted_total",
  help: "Удалённых сообщений по типу чата",
  labelNames: ["chat_type"],
  registers: [register],
});

// ─── Пользователи ────────────────────────────────────────────────────────────

const usersOnline = new client.Gauge({
  name: "chatmess_users_online",
  help: "Пользователей онлайн прямо сейчас",
  registers: [register],
});

const authAttemptsTotal = new client.Counter({
  name: "chatmess_auth_attempts_total",
  help: "Попыток авторизации",
  labelNames: ["result"],  // success | failure
  registers: [register],
});

// ─── Rate limiting ────────────────────────────────────────────────────────────

const rateLimitHitsTotal = new client.Counter({
  name: "chatmess_rate_limit_hits_total",
  help: "Сработавших rate-limit блокировок",
  labelNames: ["action"],
  registers: [register],
});

// ─── Middleware для HTTP метрик ───────────────────────────────────────────────

function httpMetricsMiddleware(req, res, next) {
  const start = process.hrtime.bigint();

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e9;
    // Нормализуем маршрут: /api/users/123 → /api/users/:id
    const route = normalizeRoute(req.route?.path || req.path);
    const labels = { method: req.method, route, status: res.statusCode };
    httpRequestsTotal.inc(labels);
    httpRequestDuration.observe(labels, durationMs);
  });

  next();
}

function normalizeRoute(path) {
  return path
    .replace(/\/\d+/g, "/:id")
    .replace(/\/[a-f0-9-]{36}/g, "/:uuid") // UUID
    .substring(0, 60); // ограничиваем длину label
}

module.exports = {
  register,
  httpMetricsMiddleware,
  // Экспортируем метрики для инкремента из роутов/сокетов
  messagesTotal,
  messagesDeletedTotal,
  socketConnectionsActive,
  socketEventsTotal,
  usersOnline,
  authAttemptsTotal,
  rateLimitHitsTotal,
};
