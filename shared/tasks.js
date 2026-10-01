/**
 * Чистая (без React) часть типов заданий: создание, очистка данных и проверка
 * ответов. Используется клиентом (редактор и прохождение) и при публикации
 * (очистка снимка в браузере админа). React-часть (формы редактора и «плееры») —
 * src/tasks/taskTypeRegistry.js.
 *
 * Чтобы добавить новый тип: запись здесь (create/sanitize/check) + запись с
 * компонентами в src/tasks/taskTypeRegistry.js. Существующий код не меняется.
 */
import { sanitizeAudioRef } from './audio.js';
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
  ORDER_WORDS_MIN: 2,
  ORDER_WORDS_MAX: 30,
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

/** Слова предложения для задания «Порядок слов»: разбиение по пробелам. */
export function orderTokens(sentence) {
  return String(sentence ?? '')
    .trim()
    .split(/\s+/u)
    .filter(Boolean);
}

/**
 * Ключ сравнения порядка слов: регистр и знаки препинания не важны, так что
 * «Ana.» в середине допустимого порядка совпадает с «Ana».
 */
function orderKey(sentence) {
  return orderTokens(sentence)
    .map((t) => normalizeText(t).replace(/[\p{P}]/gu, ''))
    .filter(Boolean)
    .join(' ');
}

function cleanOptions(value) {
  const seen = new Set();
  return (Array.isArray(value) ? value : [])
    .slice(0, TASK_LIMITS.OPTIONS_MAX)
    .map((o, i) => ({
      id: idOr(o?.id, `o${i}`),
      text: str(o?.text, TASK_LIMITS.OPTION_MAX),
    }))
    .filter((o) => (seen.has(o.id) ? false : seen.add(o.id)));
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
      return {
        question: '',
        options: [
          { id: a, text: '' },
          { id: newItemId(), text: '' },
        ],
        correctOptionId: a,
      };
    },
    sanitize(data) {
      const options = cleanOptions(data.options);
      const correct = options.some((o) => o.id === data.correctOptionId) ? data.correctOptionId : (options[0]?.id ?? null);
      return {
        question: str(data.question, TASK_LIMITS.TEXT_MAX),
        options,
        correctOptionId: correct,
      };
    },
    /** answer: id выбранного варианта. */
    check: (data, answer) => ({
      correct: Boolean(answer) && answer === data.correctOptionId,
    }),
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
      return {
        instruction: str(data.instruction, TASK_LIMITS.TEXT_MAX),
        pairs,
      };
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
      return {
        correct: data.pairs.length > 0 && Object.values(results).every(Boolean),
        results,
      };
    },
    problems(data) {
      const filled = data.pairs.filter((p) => p.left.trim() && p.right.trim());
      return filled.length < TASK_LIMITS.PAIRS_MIN ? ['Нужно минимум две заполненные пары.'] : [];
    },
  },

  translation: {
    id: 'translation',
    create: () => ({ source: '', answers: [''] }),
    sanitize: (data) => ({
      source: str(data.source, TASK_LIMITS.TEXT_MAX),
      answers: answersList(data.answers),
    }),
    check: (data, answer) => ({
      correct: matchesAny(answer, data.answers),
      expected: data.answers[0] ?? '',
    }),
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
    sanitize: (data) => ({
      question: str(data.question, TASK_LIMITS.TEXT_MAX),
      answers: answersList(data.answers),
    }),
    check: (data, answer) => ({ correct: matchesAny(answer, data.answers) }),
    problems(data) {
      const p = [];
      if (!data.question.trim()) p.push('Нет вопроса.');
      if (!data.answers.length) p.push('Нет правильного ответа.');
      return p;
    },
  },

  multiple_select: {
    id: 'multiple_select',
    create: () => {
      const a = newItemId();
      return {
        question: '',
        options: [
          { id: a, text: '' },
          { id: newItemId(), text: '' },
          { id: newItemId(), text: '' },
        ],
        correctOptionIds: [a],
      };
    },
    sanitize(data) {
      const options = cleanOptions(data.options);
      const ids = new Set(options.map((o) => o.id));
      const correctOptionIds = [...new Set(Array.isArray(data.correctOptionIds) ? data.correctOptionIds : [])].filter((id) => ids.has(id));
      return {
        question: str(data.question, TASK_LIMITS.TEXT_MAX),
        options,
        correctOptionIds,
      };
    },
    /**
     * answer: массив id выбранных вариантов. Засчитывается, только если выбраны
     * ровно все правильные (среди вариантов с текстом) и ни одного лишнего.
     */
    check(data, answer) {
      const visible = new Set(data.options.filter((o) => o.text.trim()).map((o) => o.id));
      const chosen = new Set((Array.isArray(answer) ? answer : []).filter((id) => visible.has(id)));
      const correctSet = new Set(data.correctOptionIds.filter((id) => visible.has(id)));
      const results = {};
      for (const id of visible) results[id] = chosen.has(id) === correctSet.has(id);
      const correct = correctSet.size > 0 && Object.values(results).every(Boolean);
      return { correct, results, correctIds: [...correctSet] };
    },
    problems(data) {
      const p = [];
      if (!data.question.trim()) p.push('Нет вопроса.');
      const filled = data.options.filter((o) => o.text.trim());
      if (filled.length < TASK_LIMITS.OPTIONS_MIN) p.push('Нужно минимум два варианта.');
      if (!filled.some((o) => data.correctOptionIds.includes(o.id))) p.push('Не отмечен ни один правильный вариант.');
      return p;
    },
  },

  sentence_order: {
    id: 'sentence_order',
    create: () => ({
      instruction: 'Составьте предложение',
      translation: '',
      answers: [''],
    }),
    sanitize: (data) => ({
      instruction: str(data.instruction, TASK_LIMITS.TEXT_MAX),
      translation: str(data.translation, TASK_LIMITS.TEXT_MAX),
      answers: answersList(data.answers).map((a) => orderTokens(a).join(' ')),
    }),
    /**
     * answer: массив слов в выбранном порядке. Слова для перемешивания берутся
     * из первого ответа; остальные ответы — допустимые другие порядки тех же слов.
     */
    check(data, answer) {
      const given = Array.isArray(answer) ? orderKey(answer.join(' ')) : '';
      return { correct: given !== '' && data.answers.some((a) => orderKey(a) === given), expected: data.answers[0] ?? '' };
    },
    problems(data) {
      const p = [];
      const words = orderTokens(data.answers[0]);
      if (words.length < TASK_LIMITS.ORDER_WORDS_MIN) p.push('Нужно предложение минимум из двух слов.');
      if (words.length > TASK_LIMITS.ORDER_WORDS_MAX) p.push(`Не больше ${TASK_LIMITS.ORDER_WORDS_MAX} слов.`);
      const key = (a) => orderKey(a).split(' ').sort().join(' ');
      if (data.answers.slice(1).some((a) => key(a) !== key(data.answers[0]))) {
        p.push('Другие варианты должны состоять из тех же слов, что и первый.');
      }
      return p;
    },
  },

  listening: {
    id: 'listening',
    create: () => {
      const a = newItemId();
      return {
        audio: null,
        question: 'Что вы услышали?',
        mode: 'choice',
        options: [
          { id: a, text: '' },
          { id: newItemId(), text: '' },
        ],
        correctOptionId: a,
        answers: [''],
        transcript: '',
      };
    },
    sanitize(data) {
      const options = cleanOptions(data.options);
      return {
        audio: sanitizeAudioRef(data.audio),
        question: str(data.question, TASK_LIMITS.TEXT_MAX),
        mode: data.mode === 'input' ? 'input' : 'choice',
        options,
        correctOptionId: options.some((o) => o.id === data.correctOptionId) ? data.correctOptionId : (options[0]?.id ?? null),
        answers: answersList(data.answers),
        transcript: str(data.transcript, TASK_LIMITS.TEXT_MAX),
      };
    },
    /** answer: id варианта (mode 'choice') или введённый текст (mode 'input'). */
    check(data, answer) {
      if (data.mode === 'input')
        return {
          correct: matchesAny(answer, data.answers),
          expected: data.answers[0] ?? '',
        };
      return { correct: Boolean(answer) && answer === data.correctOptionId };
    },
    problems(data) {
      const p = [];
      if (!data.audio) p.push('Нет аудио.');
      if (data.mode === 'input') {
        if (!data.answers.length) p.push('Нет правильного ответа.');
      } else {
        if (data.options.filter((o) => o.text.trim()).length < TASK_LIMITS.OPTIONS_MIN) p.push('Нужно минимум два варианта.');
        if (!data.options.find((o) => o.id === data.correctOptionId)?.text.trim()) p.push('Не отмечен правильный ответ.');
      }
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
