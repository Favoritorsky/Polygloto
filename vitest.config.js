import { defineConfig } from 'vitest/config';

// Три набора тестов:
//  unit      — чистая логика (задания, токенизатор, сериализация), без эмуляторов
//  rules     — Firestore/Storage Security Rules, нужен эмулятор (npm run test:rules)
//  functions — Cloud Functions через эмулятор (npm run test:functions)
export default defineConfig({
  test: {
    projects: [
      { test: { name: 'unit', include: ['src/**/*.test.{js,jsx}', 'shared/**/*.test.js'], environment: 'node' } },
      { test: { name: 'rules', include: ['tests/rules/**/*.test.js'], environment: 'node', fileParallelism: false, testTimeout: 20000, hookTimeout: 30000 } },
      { test: { name: 'functions', include: ['tests/functions/**/*.test.js'], environment: 'node', fileParallelism: false, testTimeout: 30000, hookTimeout: 60000 } },
    ],
  },
});
