# Приложение SANABILIS Гигиена
FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci
COPY . .
# сборке не нужна база, но нужны переменные с корректным форматом
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build APP_SECRET=build-time-placeholder-secret-0123456789abc APP_URL=http://localhost:3000 npm run build
RUN npm prune --omit=dev

FROM node:22-bookworm-slim AS run
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/* \
  && useradd --system --uid 1001 app
COPY --from=build /app/package.json /app/prisma.config.ts /app/next.config.ts ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/src ./src
COPY --from=build /app/tsconfig.json ./tsconfig.json
COPY docker/app-entrypoint.sh /usr/local/bin/app-entrypoint
RUN mkdir -p /app/data && chown -R app /app/data /app/.next
USER app
EXPOSE 3000
ENTRYPOINT ["app-entrypoint"]
