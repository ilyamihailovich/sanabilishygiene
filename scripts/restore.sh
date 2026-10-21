#!/bin/sh
# Восстановление базы из копии: scripts/restore.sh backups/sanabilis-db-YYYYmmdd-HHMM.dump[.enc]
# Запускать при остановленном приложении: docker compose stop app
set -eu
FILE="$1"
if [ "${FILE%.enc}" != "$FILE" ]; then
  : "${BACKUP_PASSPHRASE:?Укажите BACKUP_PASSPHRASE}"
  openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass env:BACKUP_PASSPHRASE -in "$FILE" -out /tmp/restore.dump
  FILE=/tmp/restore.dump
fi
docker compose exec -T db sh -c 'pg_restore --clean --if-exists --no-owner -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < "$FILE"
echo "База восстановлена из $1"
