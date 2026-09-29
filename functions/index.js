/**
 * Точка входа Cloud Functions. Каждая функция — в своём файле в src/,
 * здесь только реэкспорт. Схема данных — ../shared/schema.js (копируется
 * в functions/shared скриптом scripts/sync-shared.mjs перед деплоем/эмулятором).
 */
import './src/config.js';

export { onUserCreated, onUserDeleted } from './src/auth/onUserCreated.js';
export { syncRole } from './src/auth/syncRole.js';
