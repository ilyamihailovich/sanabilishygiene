#!/bin/sh
set -e
# Миграции и начальные данные (повторный запуск безопасен)
npx prisma migrate deploy
npx prisma db seed
exec npx next start -p "${PORT:-3000}"
