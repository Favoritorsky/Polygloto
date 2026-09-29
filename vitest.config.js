import { defineConfig } from 'vitest/config';

// Два набора тестов:
//  unit  — чистая логика (задания, токенизатор, сериализация), без эмуляторов
//  rules — Firestore Security Rules и клиентские сценарии записи, нужен эмулятор (npm run test:rules)
export default defineConfig({
  test: {
    projects: [
      { test: { name: 'unit', include: ['src/**/*.test.{js,jsx}', 'shared/**/*.test.js'], environment: 'node' } },
      { test: { name: 'rules', include: ['tests/rules/**/*.test.js'], environment: 'node', fileParallelism: false, testTimeout: 20000, hookTimeout: 30000 } },
    ],
  },
});
