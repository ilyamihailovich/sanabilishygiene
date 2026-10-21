#!/bin/sh
# Ежедневная резервная копия: pg_dump (custom) и архив файлов (рендеры, PDF, фото каталога).
# Шифрование AES-256 при заданном BACKUP_PASSPHRASE, ротация BACKUP_KEEP копий, при BACKUP_REMOTE — rsync.
set -eu
BACKUP_DIR="${BACKUP_DIR:-./backups}"
BACKUP_KEEP="${BACKUP_KEEP:-14}"
DATA_DIR="${DATA_DIR:-./data}"
STAMP="$(date +%Y%m%d-%H%M)"
mkdir -p "$BACKUP_DIR"
if [ -n "${BACKUP_PASSPHRASE:-}" ] && ! command -v openssl >/dev/null 2>&1; then
  echo "Нет openssl: копия не создана, чтобы не оставлять незашифрованный файл" >&2
  exit 1
fi

encrypt() {
  if [ -n "${BACKUP_PASSPHRASE:-}" ]; then
    openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -pass env:BACKUP_PASSPHRASE -in "$1" -out "$1.enc" && rm "$1"
  fi
}

DB_FILE="$BACKUP_DIR/sanabilis-db-$STAMP.dump"
pg_dump --format=custom --no-owner --file="$DB_FILE"
encrypt "$DB_FILE"

if [ -d "$DATA_DIR" ]; then
  FILES="$BACKUP_DIR/sanabilis-files-$STAMP.tar.gz"
  tar -czf "$FILES" -C "$DATA_DIR" .
  encrypt "$FILES"
fi

# ротация: оставить последние BACKUP_KEEP копий каждого вида
for kind in db files; do
  ls -1t "$BACKUP_DIR"/sanabilis-"$kind"-* 2>/dev/null | tail -n +"$((BACKUP_KEEP + 1))" | while read -r old; do rm -f "$old"; done
done

if [ -n "${BACKUP_REMOTE:-}" ]; then
  rsync -a --delete -e "ssh -o StrictHostKeyChecking=accept-new" "$BACKUP_DIR"/ "$BACKUP_REMOTE"/
fi
echo "Резервная копия $STAMP готова"
