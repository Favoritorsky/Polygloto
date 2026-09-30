/**
 * Реестр категорий разметки текста: группы, готовые наборы (пресеты) и очистка.
 *
 * Категория курса: { id, name, color, abbr?, group }.
 *  - abbr — короткое сокращение («сущ.»), показывается подписью при наведении
 *    и в легенде, чтобы разметку можно было прочитать не только по цвету;
 *  - group — к какому набору относится (для группировки в редакторе).
 * Фрагмент текста ссылается на категорию по id (leaf.category), сама категория
 * в тексте никак не записывается. Чтобы потом разрешить несколько категорий на
 * одном фрагменте, достаточно поменять leaf.category на массив id в очистке
 * (shared/content.js) и в leafPresentation: реестр и легенда уже работают с id.
 */
import { LIMITS, PALETTE } from './schema.js';

export const CATEGORY_GROUPS = Object.freeze([
  { id: 'grammar', label: 'Грамматические' },
  { id: 'phonetics', label: 'Фонетические' },
  { id: 'custom', label: 'Свои категории' },
]);

const GROUP_IDS = new Set(CATEGORY_GROUPS.map((g) => g.id));

/** Готовые наборы. id стабильны: по ним редактор понимает, какие пресеты автор убрал. */
export const CATEGORY_PRESETS = Object.freeze([
  { id: 'g_noun', group: 'grammar', name: 'Существительное', abbr: 'сущ.', color: '#1d3557' },
  { id: 'g_verb', group: 'grammar', name: 'Глагол', abbr: 'глаг.', color: '#e63946' },
  { id: 'g_adj', group: 'grammar', name: 'Прилагательное', abbr: 'прил.', color: '#f4a261' },
  { id: 'g_adv', group: 'grammar', name: 'Наречие', abbr: 'нар.', color: '#2a9d8f' },
  { id: 'g_pron', group: 'grammar', name: 'Местоимение', abbr: 'мест.', color: '#457b9d' },
  { id: 'g_conj', group: 'grammar', name: 'Союз', abbr: 'союз', color: '#6a4c93' },
  { id: 'g_prep', group: 'grammar', name: 'Предлог', abbr: 'предл.', color: '#ff006e' },
  { id: 'g_num', group: 'grammar', name: 'Числительное', abbr: 'числ.', color: '#8ac926' },
  { id: 'g_part', group: 'grammar', name: 'Частица', abbr: 'част.', color: '#6c757d' },
  { id: 'ph_vowel', group: 'phonetics', name: 'Гласный звук', abbr: 'гласн.', color: '#ff006e' },
  { id: 'ph_cons', group: 'phonetics', name: 'Согласный звук', abbr: 'согл.', color: '#457b9d' },
  { id: 'ph_stress', group: 'phonetics', name: 'Ударный слог', abbr: 'удар.', color: '#f4a261' },
]);

/** Категории нового курса: все пресеты (автор уберёт лишние). */
export function defaultCategories() {
  return CATEGORY_PRESETS.map((c) => ({ ...c }));
}

/** Пресеты группы, которых сейчас нет в курсе (их можно вернуть одной кнопкой). */
export function missingPresets(categories, groupId) {
  const present = new Set((categories ?? []).map((c) => c.id));
  return CATEGORY_PRESETS.filter((p) => p.group === groupId && !present.has(p.id));
}

/** Группа категории; у старых категорий (до пресетов) её нет — это «свои». */
export function categoryGroup(category) {
  return GROUP_IDS.has(category?.group) ? category.group : 'custom';
}

const ID_RE = /^[A-Za-z0-9_-]{1,40}$/;
const COLOR_SET = new Set(PALETTE);

function cleanText(value, max) {
  return typeof value === 'string' ? value.slice(0, max).trim() : '';
}

/** Очищает список категорий курса (при публикации). */
export function sanitizeCategories(categories) {
  if (!Array.isArray(categories)) return [];
  const seen = new Set();
  const result = [];
  for (const c of categories.slice(0, LIMITS.COURSE_CATEGORIES_MAX)) {
    if (!c || typeof c !== 'object' || typeof c.id !== 'string' || !ID_RE.test(c.id) || seen.has(c.id)) continue;
    const name = cleanText(c.name, LIMITS.CATEGORY_NAME_MAX);
    if (!name) continue;
    seen.add(c.id);
    const clean = { id: c.id, name, color: COLOR_SET.has(c.color) ? c.color : PALETTE[0], group: categoryGroup(c) };
    const abbr = cleanText(c.abbr, LIMITS.CATEGORY_ABBR_MAX);
    if (abbr) clean.abbr = abbr;
    result.push(clean);
  }
  return result;
}
