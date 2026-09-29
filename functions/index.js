/**
 * Точка входа Cloud Functions. Каждая функция — в своём файле в src/,
 * здесь только реэкспорт. Схема данных — ../shared/schema.js (копируется
 * в functions/shared скриптом scripts/sync-shared.mjs перед деплоем/эмулятором).
 */
import './src/config.js';

export { onUserCreated, onUserDeleted } from './src/auth/onUserCreated.js';
export { syncRole } from './src/auth/syncRole.js';
export { createCourse } from './src/courses/createCourse.js';
export { onCourseDeleted } from './src/courses/onCourseDeleted.js';
export { moderateCourse } from './src/moderation/moderateCourse.js';
export { setUserBan } from './src/admin/setUserBan.js';
export { addComment } from './src/comments/addComment.js';
export { onCommentDeleted } from './src/comments/onCommentDeleted.js';
export { onRatingWritten } from './src/ratings/onRatingWritten.js';
