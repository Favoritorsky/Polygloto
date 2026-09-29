/**
 * Чистая (без React) часть типов заданий: создание, очистка данных и проверка
 * ответов. Используется клиентом (редактор и прохождение) и Cloud Functions
 * (очистка при публикации). React-часть (формы редактора и «плееры») —
 * src/tasks/taskTypeRegistry.js.
 *
 * Чтобы добавить новый тип: запись здесь (create/sanitize/check) + запись с
 * компонентами в src/tasks/taskTypeRegistry.js. Существующий код не меняется.
 */
import { normalizeText } from './schema.js';

export const TASK_LIMITS = Object.freeze({
  TEXT_MAX: 1000,
  OPTION_MAX: 300,
  OPTIONS_MIN: 2,
  OPTIONS_MAX: 8,
  PAIRS_MIN: 2,
  PAIRS_MAX: 12,
  ANSWERS_MAX: 20,
  ANSWER_MAX: 500,
});

const ID_RE = /^[A-Za-z0-9_-]{1,40}$/;

export function newItemId() {
  return Math.random().toString(36).slice(2, 10);
}

/** Сравнение ответов: регистр, лишние пробелы и финальная пунктуация не важны. */
export function normalizeAnswer(value) {
  return normalizeText(value)
    .replace(/[.!?…。]+$/u, '')
    .trim();
}

function str(value, max) {
  return typeof value === 'string' ? value.slice(0, max) : '';
}

function answersList(value) {
  const list = (Array.isArray(value) ? value : [])
    .map((a) => str(a, TASK_LIMITS.ANSWER_MAX).trim())
    .filter(Boolean)
    .slice(0, TASK_LIMITS.ANSWERS_MAX);
  return list;
}

function idOr(value, fallback) {
  return typeof value === 'string' && ID_RE.test(value) ? value : fallback;
}

function matchesAny(answer, answers) {
  const given = normalizeAnswer(answer);
  return given !== '' && answers.some((a) => normalizeAnswer(a) === given);
}

export const TASK_DEFINITIONS = Object.freeze({
  multiple_choice: {
    id: 'multiple_choice',
    create: () => {
      const a = newItemId();
      return { question: '', options: [{ id: a, text: '' }, { id: newItemId(), text: '' }], correctOptionId: a };
    },
    sanitize(data) {
      const seen = new Set();
      const options = (Array.isArray(data.options) ? data.options : [])
        .slice(0, TASK_LIMITS.OPTIONS_MAX)
        .map((o, i) => ({ id: idOr(o?.id, `o${i}`), text: str(o?.text, TASK_LIMITS.OPTION_MAX) }))
        .filter((o) => (seen.has(o.id) ? false : seen.add(o.id)));
      const correct = options.some((o) => o.id === data.correctOptionId) ? data.correctOptionId : options[0]?.id ?? null;
      return { question: str(data.question, TASK_LIMITS.TEXT_MAX), options, correctOptionId: correct };
    },
    /** answer: id выбранного варианта. */
    check: (data, answer) => ({ correct: Boolean(answer) && answer === data.correctOptionId }),
    /** Готово ли задание к прохождению (для предупреждений автору). */
    problems(data) {
      const p = [];
      if (!data.question.trim()) p.push('Нет вопроса.');
      if (data.options.filter((o) => o.text.trim()).length < TASK_LIMITS.OPTIONS_MIN) p.push('Нужно минимум два варианта.');
      if (!data.options.find((o) => o.id === data.correctOptionId)?.text.trim()) p.push('Не отмечен правильный ответ.');
      return p;
    },
  },

  fill_blank: {
    id: 'fill_blank',
    create: () => ({ before: '', after: '', answers: [''] }),
    sanitize: (data) => ({
      before: str(data.before, TASK_LIMITS.TEXT_MAX),
      after: str(data.after, TASK_LIMITS.TEXT_MAX),
      answers: answersList(data.answers),
    }),
    check: (data, answer) => ({ correct: matchesAny(answer, data.answers) }),
    problems(data) {
      const p = [];
      if (!data.before.trim() && !data.after.trim()) p.push('Нет текста вокруг пропуска.');
      if (!data.answers.length) p.push('Нет правильного ответа.');
      return p;
    },
  },

  matching: {
    id: 'matching',
    create: () => ({
      instruction: 'Соедините пары',
      pairs: [
        { id: newItemId(), left: '', right: '' },
        { id: newItemId(), left: '', right: '' },
      ],
    }),
    sanitize(data) {
      const seen = new Set();
      const pairs = (Array.isArray(data.pairs) ? data.pairs : [])
        .slice(0, TASK_LIMITS.PAIRS_MAX)
        .map((p, i) => ({
          id: idOr(p?.id, `p${i}`),
          left: str(p?.left, TASK_LIMITS.OPTION_MAX),
          right: str(p?.right, TASK_LIMITS.OPTION_MAX),
        }))
        .filter((p) => (seen.has(p.id) ? false : seen.add(p.id)));
      return { instruction: str(data.instruction, TASK_LIMITS.TEXT_MAX), pairs };
    },
    /**
     * answer: { [idЛевого]: idПарыСправа }. Верно, если каждый левый элемент
     * сопоставлен со своей парой. Совпадающие по тексту правые части
     * считаются взаимозаменяемыми.
     */
    check(data, answer) {
      const rightText = new Map(data.pairs.map((p) => [p.id, normalizeAnswer(p.right)]));
      const results = {};
      for (const pair of data.pairs) {
        const chosen = answer?.[pair.id];
        results[pair.id] = Boolean(chosen) && rightText.get(chosen) === normalizeAnswer(pair.right);
      }
      return { correct: data.pairs.length > 0 && Object.values(results).every(Boolean), results };
    },
    problems(data) {
      const filled = data.pairs.filter((p) => p.left.trim() && p.right.trim());
      return filled.length < TASK_LIMITS.PAIRS_MIN ? ['Нужно минимум две заполненные пары.'] : [];
    },
  },

  translation: {
    id: 'translation',
    create: () => ({ source: '', answers: [''] }),
    sanitize: (data) => ({ source: str(data.source, TASK_LIMITS.TEXT_MAX), answers: answersList(data.answers) }),
    check: (data, answer) => ({ correct: matchesAny(answer, data.answers), expected: data.answers[0] ?? '' }),
    problems(data) {
      const p = [];
      if (!data.source.trim()) p.push('Нет предложения для перевода.');
      if (!data.answers.length) p.push('Нет эталонного перевода.');
      return p;
    },
  },

  free_input: {
    id: 'free_input',
    create: () => ({ question: '', answers: [''] }),
    sanitize: (data) => ({ question: str(data.question, TASK_LIMITS.TEXT_MAX), answers: answersList(data.answers) }),
    check: (data, answer) => ({ correct: matchesAny(answer, data.answers) }),
    problems(data) {
      const p = [];
      if (!data.question.trim()) p.push('Нет вопроса.');
      if (!data.answers.length) p.push('Нет правильного ответа.');
      return p;
    },
  },
});

export const TASK_TYPE_IDS = Object.freeze(Object.keys(TASK_DEFINITIONS));

export function sanitizeTaskData(taskType, data) {
  const definition = TASK_DEFINITIONS[taskType];
  return definition ? definition.sanitize(data && typeof data === 'object' ? data : {}) : {};
}

export function checkTaskAnswer(taskType, data, answer) {
  const definition = TASK_DEFINITIONS[taskType];
  if (!definition) return { correct: false };
  return definition.check(data, answer);
}

export function taskProblems(taskType, data) {
  const definition = TASK_DEFINITIONS[taskType];
  return definition ? definition.problems(data) : ['Неизвестный тип задания.'];
}
