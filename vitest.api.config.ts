import path from 'node:path';
import { defineConfig } from 'vitest/config';

// Интеграционные тесты API против запущенного приложения (BASE_URL) с демо-сотрудниками (SEED_DEMO=true)
export default defineConfig({
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  test: { include: ['tests/api/**/*.test.ts'], testTimeout: 300_000, hookTimeout: 300_000, fileParallelism: false },
});
