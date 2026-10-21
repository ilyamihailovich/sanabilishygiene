# Сервис PDF и рендера ракурсов: Chromium из официального образа Playwright
FROM mcr.microsoft.com/playwright:v1.56.1-noble
WORKDIR /renderer
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
COPY package.json ./
RUN npm install --omit=dev
COPY server.mjs ./
USER pwuser
EXPOSE 3100
CMD ["node", "server.mjs"]
