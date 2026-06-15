#!/bin/bash
# ChatMess — автоматический бэкап PostgreSQL
#
# Настройка cron (каждую ночь в 3:00):
#   crontab -e
#   0 3 * * * /path/to/chatmess/scripts/backup-db.sh >> /var/log/chatmess-backup.log 2>&1
#
# Хранит последние 30 дней, старые удаляет автоматически.

set -euo pipefail

# ── Конфиг ──────────────────────────────────────────────────────────────────
DB_NAME="${DB_NAME:-chat}"
DB_USER="${DB_USER:-postgres}"
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-5432}"
DB_PASSWORD="${DB_PASSWORD:-root}"

BACKUP_DIR="${BACKUP_DIR:-/var/backups/chatmess}"
KEEP_DAYS="${KEEP_DAYS:-30}"   # хранить последние N дней

DATE=$(date +%Y%m%d_%H%M%S)
FILENAME="chatmess_${DATE}.sql.gz"
FILEPATH="$BACKUP_DIR/$FILENAME"

# ── Создаём папку если нет ──────────────────────────────────────────────────
mkdir -p "$BACKUP_DIR"

echo "[$(date)] Начинаю бэкап базы $DB_NAME..."

# ── Дамп ────────────────────────────────────────────────────────────────────
PGPASSWORD="$DB_PASSWORD" pg_dump \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -Fc \
    "$DB_NAME" \
    | gzip > "$FILEPATH"

SIZE=$(du -sh "$FILEPATH" | cut -f1)
echo "[$(date)] Бэкап создан: $FILEPATH ($SIZE)"

# ── Удаляем старые бэкапы ───────────────────────────────────────────────────
find "$BACKUP_DIR" -name "chatmess_*.sql.gz" -mtime "+$KEEP_DAYS" -delete
REMAINING=$(find "$BACKUP_DIR" -name "chatmess_*.sql.gz" | wc -l)
echo "[$(date)] Осталось бэкапов: $REMAINING (удалены старше $KEEP_DAYS дней)"

echo "[$(date)] Бэкап завершён успешно"

# ── Проверка целостности ─────────────────────────────────────────────────────
if gzip -t "$FILEPATH" 2>/dev/null; then
    echo "[$(date)] Целостность файла OK"
else
    echo "[$(date)] ОШИБКА: файл бэкапа повреждён!" >&2
    exit 1
fi
