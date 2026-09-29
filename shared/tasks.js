/**
 * Чистая (без React) часть типов заданий: очистка данных и проверка ответов.
 * Реализация пяти типов v1 — этап 7. Интерфейс по типу:
 *   { id, sanitize(data) → data, check(data, answer) → { correct, ... } }
 */
export const TASK_DEFINITIONS = Object.freeze({});

export const TASK_TYPE_IDS = Object.freeze(Object.keys(TASK_DEFINITIONS));

export function sanitizeTaskData(taskType, data) {
  const definition = TASK_DEFINITIONS[taskType];
  return definition ? definition.sanitize(data ?? {}) : {};
}
