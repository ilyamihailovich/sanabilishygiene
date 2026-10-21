import { defineConfig } from '@playwright/test';

// Сценарии в браузере против запущенного приложения (E2E_BASE) с демо-сотрудниками
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 180_000,
  workers: 1,
  use: {
    baseURL: process.env.E2E_BASE ?? 'http://localhost:3000',
    locale: 'ru-RU',
    viewport: { width: 1440, height: 900 },
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] },
  },
});
