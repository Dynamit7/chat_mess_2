#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Деплой chat_mess на сервер (домен polat.digital).
#
# Что делает:
#   1. git pull (если запущен внутри git-репозитория)
#   2. поднимает инфру (Postgres/Redis/MinIO) через docker-compose.prod.yml
#   3. ставит зависимости и (пере)запускает бэкенд под PM2
#   4. собирает web и admin и кладёт статику в /var/www/chatmess
#   5. проверяет и перезагружает nginx
#
# Первый запуск:
#   cd chat_mess && cp back/.env.production.example back/.env && nano back/.env
#   bash scripts/deploy.sh
#
# Повторный деплой (после изменений): bash scripts/deploy.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# Каталог chat_mess (на уровень выше scripts/)
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

WEB_TARGET=/var/www/chatmess/web
ADMIN_TARGET=/var/www/chatmess/admin
DOMAIN=https://polat.digital

# APK мобильного приложения (Talkify). Большой бинарник — НЕ хранится в git,
# а скачивается с EAS-CDN в web/public перед сборкой и раздаётся как
# https://polat.digital/talkify.apk. После новой сборки в EAS обнови URL:
#   cd mobile && eas build:view <BUILD_ID>  →  поле "Application Archive URL".
APK_URL="https://expo.dev/artifacts/eas/sh0fRX11Vqvzt1-ZmnDYd5c0YrIKNSApJmuks3jQkTw.apk"

echo "==> chat_mess deploy (root: $ROOT)"

if [ ! -f back/.env ]; then
  echo "!! Нет back/.env — скопируй back/.env.production.example в back/.env и заполни." >&2
  exit 1
fi

# 1. Обновить код (если это git-репозиторий)
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "==> git pull"
  git pull --ff-only || echo "   (пропущено: не удалось fast-forward)"
fi

# 2. Инфраструктура
echo "==> Поднимаю Postgres / Redis / MinIO"
docker compose -f docker-compose.prod.yml --env-file back/.env up -d

# 3. Бэкенд под PM2
echo "==> Бэкенд: npm ci + PM2"
( cd back && npm ci --omit=dev )
if pm2 describe chat-api >/dev/null 2>&1; then
  ( cd back && pm2 reload ecosystem.config.js )   # zero-downtime
else
  ( cd back && pm2 start ecosystem.config.js )
fi
pm2 save

# 4. APK мобильного приложения → web/public (для кнопки "Download for Android")
echo "==> Скачиваю APK мобильного приложения"
if curl -fSL --retry 3 -o web/public/talkify.apk "$APK_URL"; then
  echo "   APK: $(du -h web/public/talkify.apk | cut -f1)"
else
  echo "   !! Не удалось скачать APK — кнопка скачивания вернёт 404." >&2
fi

# 5. Фронтенды
build_front() {
  local dir="$1" target="$2"
  echo "==> Сборка $dir"
  ( cd "$dir"
    printf 'VITE_API_URL=%s\nVITE_MINIO_URL=%s\n' "$DOMAIN" "$DOMAIN" > .env.production
    npm ci
    npm run build
  )
  sudo mkdir -p "$target"
  sudo rm -rf "${target:?}/"*
  sudo cp -r "$dir/dist/"* "$target/"
}
build_front web   "$WEB_TARGET"
build_front admin "$ADMIN_TARGET"

# 6. Nginx
echo "==> Проверка и перезагрузка nginx"
sudo nginx -t && sudo systemctl reload nginx

echo "==> Готово. Web: $DOMAIN  Admin: https://admin.polat.digital"
