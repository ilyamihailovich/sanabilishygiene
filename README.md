# SANABILIS Гигиена

Инструмент врача и гигиениста клиники SANABILIS. В нём составляются документы пациенту:
- карта межзубных ёршиков на 3D-модели и на схеме;
- скрининг пародонта PSR;
- схема индивидуальной гигиены;
- памятки после процедур.

Пациент получает онлайн-карту по ссылке или QR-коду и PDF A4.

Стек: Next.js (App Router, TypeScript strict), PostgreSQL, Prisma, three.js и React Three Fiber, Playwright для генерации PDF, Docker Compose.

## Запуск

Требуется Docker с Compose. Команда:

```sh
cp .env.example .env && nano .env && docker compose up -d --build
```

При первом запуске:
- применяются миграции;
- создаётся администратор из `SEED_ADMIN_EMAIL`.

Если `SEED_ADMIN_PASSWORD` не задан, временный пароль выводится в журнал, а при первом входе его нужно сменить:

```sh
docker compose logs app | grep Администратор
```

Приложение слушает `127.0.0.1:3000`. Наружу его отдаёт nginx (см. ниже).

## Переменные окружения

| Переменная | Назначение |
|---|---|
| `APP_URL` | Публичный адрес, например `https://hygiene.sanabilis.ru`. Из него собираются ссылки и QR-коды для пациентов |
| `APP_SECRET` | Секрет не короче 32 символов: подписи внутренних страниц и шифрование ссылок пациентов. Сгенерировать: `openssl rand -base64 48`. При смене секрета перестанут открываться QR-коды уже выданных ссылок |
| `COOKIE_SECURE` | `true` за HTTPS |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | Параметры базы |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | Первый администратор |
| `BACKUP_KEEP` | Сколько копий хранить, по умолчанию 14 |
| `BACKUP_PASSPHRASE` | Пароль шифрования копий. Храните его отдельно от сервера |
| `BACKUP_REMOTE` | Необязательно: адрес для rsync копий вне сервера, например `user@host:/path` |

Внутренние переменные контейнеров (`DATABASE_URL`, `RENDERER_URL`, `INTERNAL_APP_URL`, `DATA_DIR`) задаются в `docker-compose.yml`.

## Состав

| Сервис | Что делает |
|---|---|
| `app` | Next.js: рабочий интерфейс, API `/api/v1`, онлайн-карта пациента `/p/<токен>` |
| `db` | PostgreSQL 16 |
| `renderer` | Chromium (Playwright): PDF A4 и рендер ракурсов 3D-сцены для PDF. Доступен только во внутренней сети |
| `backup` | Ежедневная резервная копия базы и файлов |

Файлы (рендеры, PDF, фото упаковок) хранятся в томе `app-data`.

## nginx и HTTPS

Готовый конфиг: `docs/deploy/nginx.conf`.

```sh
sudo cp docs/deploy/nginx.conf /etc/nginx/sites-available/hygiene.sanabilis.ru
sudo ln -s /etc/nginx/sites-available/hygiene.sanabilis.ru /etc/nginx/sites-enabled/
sudo certbot --nginx -d hygiene.sanabilis.ru
sudo nginx -t && sudo systemctl reload nginx
```

Что делает конфиг:
- скрывает токены пациентов в журнале nginx;
- закрывает снаружи внутренние страницы `/print/` и `/render/`;
- включает HSTS.

## Резервное копирование

Сервис `backup` раз в сутки:
- делает `pg_dump` в формате custom и архив файлов;
- шифрует их AES-256, если задан `BACKUP_PASSPHRASE`;
- хранит последние `BACKUP_KEEP` копий в `./backups`;
- копирует их на `BACKUP_REMOTE`, если он задан.

Ручная копия:

```sh
docker compose exec backup sh /backup.sh
```

Восстановление базы:

```sh
docker compose stop app
BACKUP_PASSPHRASE=... sh scripts/restore.sh backups/sanabilis-db-YYYYmmdd-HHMM.dump.enc
docker compose start app
```

Копии на том же диске не защищают от потери сервера. Задайте `BACKUP_REMOTE` или забирайте `./backups` отдельно.

## Материалы клиники

Всё подменяется без правок кода.

| Что | Куда | Примечание |
|---|---|---|
| Шрифт Relative Pro | `public/fonts/*.woff2` | Начертание определяется по имени файла (`RelativePro-Book.woff2`, `RelativePro-Medium.woff2`…). Подключение: `/fonts.css`. Сейчас есть только Book: полужирный не синтезируется, иерархия строится размером |
| Логотип | `src/ui/brand/paths.ts`, `public/brand/` | Контуры взяты из присланного SVG |
| 3D-модель | `public/models/jaws.glb` | Требования: `docs/3d-model-spec.md`. Проверка: `npm run model:check путь.glb`. Сжатие: `npm run model:optimize вход.glb public/models/jaws.glb` |
| Цвета | `src/styles/tokens.css` | Все цвета в одном файле |
| Тексты интерфейса | `src/content/ui.ru.ts` | |

Сейчас в `public/models/jaws.glb` лежит **временная модель-заглушка** (TODO). Её собирает скрипт `scripts/build-placeholder-model.mjs`. Структура заглушки повторяет ТЗ: имена объектов, якоря промежутков, пивот нижней челюсти. Модель клиники ставится заменой файла.

## Что заполняет клиника

До заполнения выдача соответствующих документов пациенту заблокирована, приложение показывает причину.

1. **Каталог ёршиков** (Администрирование → Каталог).
   - Сейчас там две заглушки без флага «проверено».
   - Документ с непроверенным размером выдать нельзя.
2. **Тексты PSR и оценок BOIB** (Администрирование → Тексты).
   - Тексты для пациента содержат TODO.
   - Правит администратор, утверждает врач.
3. **Шаблоны** (Шаблоны).
   - Пять стартовых шаблонов содержат только разделы и пункты TODO.
   - Документ с TODO выдать нельзя.
4. **Шаги «Как пользоваться ёршиком»** (Администрирование → Настройки).
   - Пока там TODO, блок пациенту не показывается.

## Роли

| | Администратор | Врач | Гигиенист | Ассистент |
|---|---|---|---|---|
| Пациенты, визиты, карта, скрининг, документы | да | да | да | да |
| Выдача пациенту, ссылки | да | да | да | нет |
| Личные шаблоны | да | да | да | нет |
| Библиотека шаблонов, каталог, правка текстов | да | нет | нет | нет |
| Утверждение текстов | нет | да | нет | нет |
| Сотрудники, журнал, настройки | да | нет | нет | нет |

## Разработка

```sh
npm install
cp .env.example .env   # DATABASE_URL=postgresql://... для локальной базы, APP_URL=http://localhost:3000, COOKIE_SECURE=false
npx prisma migrate dev
SEED_DEMO=true npm run db:seed   # демо-сотрудники с паролем demo-password, только локально
npm run dev
PORT=3100 node renderer/server.mjs   # сервис PDF (нужен Chromium Playwright)
```

Проверки:

```sh
npm run typecheck
npm test            # BOIB, PSR, элементы карты, навигация, правила текстов
API_BASE=http://localhost:3000 npm run test:api    # права по ролям, ссылки пациента и отзыв, неизменность выдачи (нужна тестовая база)
npm run test:e2e    # сценарии в браузере, PDF (нужны запущенные приложение и renderer)
```

Документы:
- `docs/architecture.md`: решения, схема данных, API;
- `docs/3d-model-spec.md`: ТЗ на 3D-модель.
