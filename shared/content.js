/**
 * Формат контента уроков и справочника (см. docs/data-model.md, «Формат контента»).
 *
 * sanitizeBlocks — единая строгая проверка структуры. Используется:
 *  - на клиенте при сохранении из редактора (выбрасывает всё лишнее);
 *  - в браузере админа при одобрении (approveCourse): публикуется только
 *    очищенный контент, а не то, что автор записал в черновик.
 * Контент никогда не содержит HTML: только текст и атрибуты оформления.
 */
import { LIMITS, PALETTE } from './schema.js';
import { sanitizeAudioRef } from './audio.js';
import { GLOSS_LIMITS } from './gloss.js';
import { sanitizeTaskData, TASK_TYPE_IDS } from './tasks.js';

export const BLOCK_TYPES = Object.freeze({
  PARAGRAPH: 'paragraph',
  HEADING: 'heading',
  TABLE: 'table',
  TASK: 'task',
  // v2: аудиовставки и подстрочный разбор (interlinear gloss).
  AUDIO: 'audio',
  GLOSS: 'gloss',
});

/** Блоки без текстового содержимого (в Slate — void-элементы). */
export const VOID_BLOCK_TYPES = Object.freeze([BLOCK_TYPES.TABLE, BLOCK_TYPES.TASK, BLOCK_TYPES.AUDIO, BLOCK_TYPES.GLOSS]);

export const CONTENT_LIMITS = Object.freeze({
  LEAF_TEXT_MAX: 5000,
  LEAVES_PER_BLOCK_MAX: 500,
  TABLE_ROWS_MAX: 50,
  TABLE_COLS_MAX: 10,
  TABLE_CELL_MAX: 500,
  AUDIO_CAPTION_MAX: 300,
});

export const MARKS = Object.freeze(['bold', 'italic', 'underline']);

const ID_RE = /^[A-Za-z0-9_-]{1,40}$/;
const COLOR_SET = new Set(PALETTE);

function cleanString(value, max) {
  return typeof value === 'string' ? value.slice(0, max) : '';
}

/** Очищает текстовый фрагмент: только известные атрибуты допустимых типов. */
export function sanitizeLeaf(leaf, { categoryIds } = {}) {
  if (!leaf || typeof leaf !== 'object') return null;
  const clean = { text: cleanString(leaf.text, CONTENT_LIMITS.LEAF_TEXT_MAX) };
  for (const mark of MARKS) if (leaf[mark] === true) clean[mark] = true;
  if (COLOR_SET.has(leaf.color)) clean.color = leaf.color;
  if (typeof leaf.category === 'string' && ID_RE.test(leaf.category) && (!categoryIds || categoryIds.has(leaf.category))) {
    clean.category = leaf.category;
  }
  if (typeof leaf.dictRef === 'string' && ID_RE.test(leaf.dictRef)) clean.dictRef = leaf.dictRef;
  return clean;
}

function sanitizeLeaves(children, options) {
  const leaves = (Array.isArray(children) ? children : [])
    .slice(0, CONTENT_LIMITS.LEAVES_PER_BLOCK_MAX)
    .map((leaf) => sanitizeLeaf(leaf, options))
    .filter(Boolean);
  return leaves.length ? leaves : [{ text: '' }];
}

function sanitizeTable(block) {
  const rows = (Array.isArray(block.rows) ? block.rows : []).slice(0, CONTENT_LIMITS.TABLE_ROWS_MAX);
  const width = Math.min(
    CONTENT_LIMITS.TABLE_COLS_MAX,
    Math.max(1, ...rows.map((r) => (Array.isArray(r?.cells) ? r.cells.length : 0))),
  );
  const cleanRows = rows.map((row) => {
    const cells = Array.isArray(row?.cells) ? row.cells : [];
    return { cells: Array.from({ length: width }, (_, i) => cleanString(cells[i], CONTENT_LIMITS.TABLE_CELL_MAX)) };
  });
  return {
    type: BLOCK_TYPES.TABLE,
    // Старые таблицы без флага: первая строка — заголовок (так было в v1).
    headerRow: block.headerRow !== false,
    headerColumn: block.headerColumn === true,
    rows: cleanRows.length ? cleanRows : [{ cells: [''] }],
  };
}

/**
 * Роль ячейки таблицы для оформления (одна логика для редактора и читателя):
 *  - 'corner' — пересечение строки и столбца заголовков (оба флага включены);
 *  - 'column' — заголовок столбца (первая строка при headerRow);
 *  - 'row' — заголовок строки (первый столбец при headerColumn);
 *  - 'cell' — обычная ячейка.
 * Заголовки позиционные: при удалении первой строки заголовком становится следующая.
 */
export function tableCellRole(table, rowIndex, colIndex) {
  const inHeaderRow = table.headerRow !== false && rowIndex === 0;
  const inHeaderColumn = table.headerColumn === true && colIndex === 0;
  if (inHeaderRow && inHeaderColumn) return 'corner';
  if (inHeaderRow) return 'column';
  if (inHeaderColumn) return 'row';
  return 'cell';
}

/** Очищает один блок; неизвестные/зарезервированные типы отбрасываются (null). */
export function sanitizeBlock(block, options = {}) {
  if (!block || typeof block !== 'object') return null;
  switch (block.type) {
    case BLOCK_TYPES.PARAGRAPH:
      return { type: BLOCK_TYPES.PARAGRAPH, children: sanitizeLeaves(block.children, options) };
    case BLOCK_TYPES.HEADING:
      return {
        type: BLOCK_TYPES.HEADING,
        level: block.level === 3 ? 3 : 2,
        children: sanitizeLeaves(block.children, options),
      };
    case BLOCK_TYPES.TABLE:
      return sanitizeTable(block);
    case BLOCK_TYPES.TASK: {
      if (!TASK_TYPE_IDS.includes(block.taskType)) return null;
      const id = typeof block.id === 'string' && ID_RE.test(block.id) ? block.id : null;
      return { type: BLOCK_TYPES.TASK, id, taskType: block.taskType, data: sanitizeTaskData(block.taskType, block.data) };
    }
    case BLOCK_TYPES.AUDIO:
      // Аудиовставка (v2). Пока автор не выбрал запись, audio — null: блок
      // сохраняется, но читателю не показывается.
      return {
        type: BLOCK_TYPES.AUDIO,
        audio: sanitizeAudioRef(block.audio),
        caption: cleanString(block.caption, CONTENT_LIMITS.AUDIO_CAPTION_MAX),
      };
    case BLOCK_TYPES.GLOSS:
      // Подстрочный разбор (v2): исходная строка, разбор по словам, перевод.
      return {
        type: BLOCK_TYPES.GLOSS,
        source: cleanString(block.source, GLOSS_LIMITS.LINE_MAX),
        gloss: cleanString(block.gloss, GLOSS_LIMITS.LINE_MAX),
        translation: cleanString(block.translation, GLOSS_LIMITS.LINE_MAX),
      };
    default:
      return null;
  }
}

/**
 * Очищает массив блоков. categoryIds — Set допустимых id категорий курса
 * (ссылки на удалённые категории отбрасываются).
 */
export function sanitizeBlocks(blocks, options = {}) {
  if (!Array.isArray(blocks)) return [];
  return blocks
    .slice(0, LIMITS.LESSON_BLOCKS_MAX)
    .map((b) => sanitizeBlock(b, options))
    .filter(Boolean);
}

// Категории курса очищает shared/categories.js; реэкспорт для старых импортов.
export { sanitizeCategories } from './categories.js';

/** Собирает простой текст блоков (для поиска, превью и сопоставления со словарём). */
export function blocksToPlainText(blocks) {
  return (blocks ?? [])
    .filter((b) => Array.isArray(b.children))
    .map((b) => b.children.map((l) => l.text ?? '').join(''))
    .join('\n');
}

/** Очищает статью словаря (используется при публикации). */
export function sanitizeWord(word, partOfSpeechIds) {
  if (!word || typeof word !== 'object') return null;
  const clean = {
    word: cleanString(word.word, LIMITS.WORD_MAX).trim(),
    translation: cleanString(word.translation, LIMITS.TRANSLATION_MAX).trim(),
    partOfSpeech: partOfSpeechIds.includes(word.partOfSpeech) ? word.partOfSpeech : 'other',
    examples: (Array.isArray(word.examples) ? word.examples : [])
      .map((e) => cleanString(e, LIMITS.WORD_EXAMPLE_MAX).trim())
      .filter(Boolean)
      .slice(0, LIMITS.WORD_EXAMPLES_MAX),
    notes: cleanString(word.notes, LIMITS.WORD_NOTES_MAX).trim(),
  };
  // Произношение (v2): ссылка на аудио, поле есть только у слов с записью.
  const audio = sanitizeAudioRef(word.audio);
  if (audio) clean.audio = audio;
  if (!clean.word || !clean.translation) return null;
  return clean;
}
