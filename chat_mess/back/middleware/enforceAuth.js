/**
 * enforceAuth — аутентификация API по JWT с безопасной поэтапной выкаткой.
 *
 * ПРОБЛЕМА, которую закрываем: роуты /api/messages, /api/groups, /api/channels
 * раньше доверяли userId из запроса. Любой мог прочитать чужую переписку,
 * подставив чужой userId. Здесь мы требуем валидный JWT (выдаётся при логине).
 *
 * БЕЗОПАСНАЯ ВЫКАТКА (флаг ENFORCE_AUTH):
 *   - ENFORCE_AUTH != "1" (по умолчанию): "мягкий" режим. Токен читается и, если
 *     валиден, кладётся в req.authUserId, НО запрос НИКОГДА не блокируется.
 *     → можно задеплоить бэкенд, не сломав старые версии приложений.
 *   - ENFORCE_AUTH == "1": "строгий" режим. Без валидного токена — 401.
 *     Включать ПОСЛЕ того, как выйдет версия клиента, шлющая токен (см.
 *     глобальный fetch-перехватчик в RN и axios-инстанс в web).
 *
 * req.authUserId — ДОВЕРЕННЫЙ id пользователя (из токена). Используйте его
 * вместо req.body.userId / req.query.userId для проверок прав.
 */
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET;
const ENFORCE = process.env.ENFORCE_AUTH === "1";

function extractToken(req) {
  const header = req.headers.authorization;
  if (!header) return null;
  const parts = header.split(" ");
  if (parts.length === 2 && parts[0] === "Bearer") return parts[1];
  return null;
}

// Аутентификация: проверяет токен, заполняет req.authUserId.
function authenticate(req, res, next) {
  const token = extractToken(req);
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      if (decoded && decoded.userId) req.authUserId = decoded.userId;
    } catch (_) {
      // невалидный/просроченный токен — в строгом режиме отклоним ниже
    }
  }

  if (!ENFORCE) return next(); // мягкий режим: поведение не меняется

  if (!req.authUserId) {
    return res.status(401).json({ error: "Authentication required" });
  }
  next();
}

/**
 * requireSelf(paramName) — авторизация "действуешь от своего имени".
 * Проверяет, что значение поля (из body/query/params) совпадает с id из токена.
 * Применяйте к эндпоинтам, где параметр означает "я" (например userId при
 * отправке/чтении своих данных). НЕ применяйте туда, где параметр — это id
 * ДРУГОГО пользователя (профиль собеседника и т.п.).
 * Работает только в строгом режиме; в мягком — пропускает.
 */
function requireSelf(paramName = "userId") {
  return (req, res, next) => {
    if (!ENFORCE) return next();
    const claimed =
      req.body?.[paramName] ?? req.query?.[paramName] ?? req.params?.[paramName];
    if (claimed !== undefined && Number(claimed) !== Number(req.authUserId)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  };
}

/**
 * socketAuth — handshake-middleware для Socket.IO (io.use(socketAuth)).
 * Читает токен из socket.handshake.auth.token (или query.token), проверяет JWT
 * и кладёт доверенный id в socket.authUserId.
 *   - мягкий режим: если токен есть и валиден — заполняем authUserId, иначе
 *     просто пропускаем (поведение не меняется);
 *   - строгий режим (ENFORCE_AUTH=1): без валидного токена соединение
 *     отклоняется (next(Error)).
 */
function socketAuth(socket, next) {
  const token =
    socket.handshake?.auth?.token || socket.handshake?.query?.token || null;
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      if (decoded && decoded.userId) socket.authUserId = decoded.userId;
    } catch (_) {
      // невалидный user-токен — пробуем admin-токен
    }
    if (!socket.authUserId) {
      try {
        const decoded = jwt.verify(token, ADMIN_JWT_SECRET);
        if (decoded && decoded.adminId) socket.isAdmin = true;
      } catch (_) {}
    }
  }

  if (!ENFORCE) return next(); // мягкий режим: пускаем всех

  if (!socket.authUserId && !socket.isAdmin) return next(new Error("Authentication required"));
  next();
}

/**
 * resolveActor(socket, claimedId) — доверенный id, от имени которого можно
 * выполнять действие в сокет-хендлере.
 *   - мягкий режим: возвращает claimedId как есть (поведение не меняется);
 *   - строгий режим: возвращает socket.authUserId; если claimedId передан и НЕ
 *     совпадает с токеном (попытка действовать от чужого имени) — возвращает
 *     null, и хендлер должен прервать обработку.
 * Используйте для критичных хендлеров: registerUser, sendMessage,
 * sendGroupMessage и т.п.
 */
function resolveActor(socket, claimedId) {
  if (!ENFORCE) return claimedId;
  if (!socket.authUserId) return null;
  if (claimedId !== undefined && claimedId !== null &&
      Number(claimedId) !== Number(socket.authUserId)) {
    return null; // спуфинг: действует от чужого имени
  }
  return socket.authUserId;
}

module.exports = { authenticate, requireSelf, socketAuth, resolveActor, ENFORCE };
