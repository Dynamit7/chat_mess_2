#!/bin/bash
# Восстановление БД из бэкапа
# Использование: ./restore-db.sh /var/backups/chatmess/chatmess_20260604_030000.sql.gz

set -euo pipefail

BACKUP_FILE="${1:-}"
if [ -z "$BACKUP_FILE" ] || [ ! -f "$BACKUP_FILE" ]; then
    echo "Использование: $0 <путь_к_бэкапу.sql.gz>"
    echo "Доступные бэкапы:"
    ls -lh /var/backups/chatmess/*.sql.gz 2>/dev/null || echo "  (нет бэкапов)"
    exit 1
fi

DB_NAME="${DB_NAME:-chat}"
DB_USER="${DB_USER:-postgres}"
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-5432}"
DB_PASSWORD="${DB_PASSWORD:-root}"

echo "ВНИМАНИЕ: Это восстановит базу '$DB_NAME' из $BACKUP_FILE"
echo "Все текущие данные будут УДАЛЕНЫ. Продолжить? (yes/no)"
read -r CONFIRM
if [ "$CONFIRM" != "yes" ]; then
    echo "Отменено."
    exit 0
fi

echo "[$(date)] Начинаю восстановление..."
PGPASSWORD="$DB_PASSWORD" pg_restore \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    --clean \
    --if-exists \
    <(gunzip -c "$BACKUP_FILE")

echo "[$(date)] Восстановление завершено успешно"
