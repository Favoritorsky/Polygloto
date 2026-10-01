/**
 * Шаблоны уроков (v2): заготовка структуры, которую автор заполняет своим
 * языком. Тексты — подсказки автору, их нужно заменить; задания создаются
 * пустыми из реестра (shared/tasks.js) и помечены «что заполнить».
 * Результат проходит через sanitizeBlocks, как любой контент.
 */
import { BLOCK_TYPES, sanitizeBlocks } from './content.js';
import { TASK_DEFINITIONS, newItemId } from './tasks.js';

const p = (text) => ({ type: BLOCK_TYPES.PARAGRAPH, children: [{ text }] });
const h = (text, level = 2) => ({ type: BLOCK_TYPES.HEADING, level, children: [{ text }] });
const table = (rows, { headerRow = true, headerColumn = false } = {}) => ({
  type: BLOCK_TYPES.TABLE,
  headerRow,
  headerColumn,
  rows: rows.map((cells) => ({ cells })),
});
const task = (taskType, patch = {}) => ({
  type: BLOCK_TYPES.TASK,
  id: `t_${newItemId()}`,
  taskType,
  data: { ...TASK_DEFINITIONS[taskType].create(), ...patch },
});

export const LESSON_TEMPLATES = Object.freeze([
  {
    id: 'vocabulary',
    label: 'Новая лексика',
    description: 'Список слов с переводом и примерами, упражнения на запоминание.',
    title: 'Новые слова: …',
    blocks: () => [
      p('Коротко: о чём слова этого урока и где они пригодятся.'),
      h('Слова урока'),
      table([
        ['Слово', 'Перевод', 'Пример'],
        ['', '', ''],
        ['', '', ''],
        ['', '', ''],
      ]),
      p('Совет: добавьте слова в словарь курса и свяжите их с текстом — читатель сможет отправить их в повторение.'),
      h('Упражнения'),
      task('matching', { instruction: 'Соедините слово с переводом' }),
      task('multiple_choice', { question: 'Как переводится «…»?' }),
      task('translation'),
    ],
  },
  {
    id: 'grammar',
    label: 'Грамматическая тема',
    description: 'Правило, таблица форм, примеры и упражнения на применение.',
    title: 'Грамматика: …',
    blocks: () => [
      h('Правило'),
      p('Объясните правило простыми словами: когда оно применяется и как образуется форма.'),
      table(
        [
          ['', 'Ед. число', 'Мн. число'],
          ['1-е лицо', '', ''],
          ['2-е лицо', '', ''],
          ['3-е лицо', '', ''],
        ],
        { headerRow: true, headerColumn: true },
      ),
      h('Примеры'),
      p('Пример 1 — перевод.'),
      p('Пример 2 — перевод.'),
      h('Исключения', 3),
      p('Если исключений нет, удалите этот раздел.'),
      h('Упражнения'),
      task('fill_blank'),
      task('multiple_select', { question: 'Отметьте все правильные формы' }),
      task('sentence_order'),
    ],
  },
  {
    id: 'dialogue',
    label: 'Диалог',
    description: 'Диалог с переводом, разбор выражений, аудирование.',
    title: 'Диалог: …',
    blocks: () => [
      p('Ситуация: где и кто разговаривает.'),
      h('Диалог'),
      p('А: …'),
      p('Б: …'),
      p('А: …'),
      p('Б: …'),
      h('Перевод'),
      p('А: …'),
      p('Б: …'),
      h('Полезные выражения'),
      table([
        ['Выражение', 'Значение'],
        ['', ''],
        ['', ''],
      ]),
      h('Упражнения'),
      task('listening'),
      task('free_input', { question: 'Как ответить на реплику «…»?' }),
    ],
  },
]);

export function getLessonTemplate(id) {
  return LESSON_TEMPLATES.find((t) => t.id === id) ?? null;
}

/** Готовый урок по шаблону: { title, blocks } (блоки очищены). Пустой шаблон — пустой урок. */
export function buildLessonFromTemplate(id) {
  const template = getLessonTemplate(id);
  if (!template) return null;
  return { title: template.title, blocks: sanitizeBlocks(template.blocks()) };
}
