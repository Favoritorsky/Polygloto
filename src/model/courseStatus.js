import { COURSE_STATUS } from '../../shared/schema.js';

export const STATUS_LABELS = Object.freeze({
  [COURSE_STATUS.DRAFT]: 'Черновик',
  [COURSE_STATUS.PENDING_REVIEW]: 'На проверке',
  [COURSE_STATUS.PUBLISHED]: 'Опубликован',
  [COURSE_STATUS.REJECTED]: 'Отклонён',
});

export const STATUS_TONES = Object.freeze({
  [COURSE_STATUS.DRAFT]: 'neutral',
  [COURSE_STATUS.PENDING_REVIEW]: 'attention',
  [COURSE_STATUS.PUBLISHED]: 'positive',
  [COURSE_STATUS.REJECTED]: 'negative',
});

/** Упорядочивает разделы по массиву порядка; незнакомые — в конец. */
export function sortByOrder(items, order = []) {
  const position = new Map(order.map((id, index) => [id, index]));
  return [...items].sort((a, b) => (position.get(a.id) ?? Infinity) - (position.get(b.id) ?? Infinity));
}
