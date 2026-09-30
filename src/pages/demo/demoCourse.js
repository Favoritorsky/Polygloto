/**
 * Демо-курс испанского: открыт всем без регистрации (/demo), отрывок из него —
 * на главной. Тот же формат блоков, что и в настоящих курсах, и те же
 * компоненты рендера, поэтому посетитель видит продукт, а не описание:
 * форматирование, таблицы с заголовками, разметку частей речи, все пять типов
 * заданий, словарь с активными ссылками и раздел справочника.
 */
import { defaultCategories } from '../../../shared/categories.js';

/** Фрагмент текста: t('hablo', { category: 'g_verb', bold: true }). */
const t = (text, attrs = {}) => ({ text, ...attrs });
const p = (...children) => ({ type: 'paragraph', children });
const h2 = (text) => ({ type: 'heading', level: 2, children: [t(text)] });
const h3 = (text) => ({ type: 'heading', level: 3, children: [t(text)] });
const table = (rows, { headerRow = true, headerColumn = false } = {}) => ({
  type: 'table',
  headerRow,
  headerColumn,
  rows: rows.map((cells) => ({ cells })),
});
const task = (id, taskType, data) => ({ type: 'task', id, taskType, data });

const RED = '#e63946';
const TEAL = '#2a9d8f';

export const DEMO_COURSE = {
  title: 'Испанский с нуля',
  language: 'Испанский',
  description:
    'Демонстрационный курс Polygloto: первый урок «Приветствия и знакомство» и раздел справочника о спряжении глагола hablar. Открыт всем без регистрации.',
  authorName: 'Команда Polygloto',
};

/** Все готовые категории: легенда урока покажет только те, что встречаются в тексте. */
export const DEMO_CATEGORIES = defaultCategories();

export const DEMO_DICTIONARY = [
  { id: 'hola', word: 'hola', translation: 'привет', partOfSpeech: 'interjection', examples: ['¡Hola, Ana! — Привет, Анна!'], notes: 'Буква h в испанском не читается: [óла].' },
  { id: 'adios', word: 'adiós', translation: 'до свидания', partOfSpeech: 'interjection', examples: ['Adiós, Pablo. — До свидания, Пабло.'], notes: '' },
  { id: 'gracias', word: 'gracias', translation: 'спасибо', partOfSpeech: 'interjection', examples: ['Muchas gracias. — Большое спасибо.'], notes: '' },
  { id: 'mucho-gusto', word: 'mucho gusto', translation: 'очень приятно', partOfSpeech: 'phrase', examples: ['Me llamo Pablo. Mucho gusto. — Меня зовут Пабло. Очень приятно.'], notes: '' },
  { id: 'me-llamo', word: 'me llamo', translation: 'меня зовут', partOfSpeech: 'phrase', examples: ['Me llamo Ana. — Меня зовут Анна.'], notes: 'Дословно «я называю себя» (llamarse — называться).' },
  { id: 'te-llamas', word: 'te llamas', translation: 'тебя зовут', partOfSpeech: 'phrase', examples: ['¿Cómo te llamas? — Как тебя зовут?'], notes: '' },
  { id: 'como', word: 'cómo', translation: 'как', partOfSpeech: 'adverb', examples: ['¿Cómo estás? — Как дела?'], notes: '' },
  { id: 'yo', word: 'yo', translation: 'я', partOfSpeech: 'pronoun', examples: ['Yo soy Ana. — Я Анна.'], notes: '' },
  { id: 'tu', word: 'tú', translation: 'ты', partOfSpeech: 'pronoun', examples: ['¿Y tú? — А ты?'], notes: 'С ударением tú — «ты», без ударения tu — «твой».' },
  { id: 'ella', word: 'ella', translation: 'она', partOfSpeech: 'pronoun', examples: [], notes: '' },
  { id: 'nosotros', word: 'nosotros', translation: 'мы', partOfSpeech: 'pronoun', examples: [], notes: '' },
  { id: 'soy', word: 'soy', translation: 'я есть (ser — быть)', partOfSpeech: 'verb', examples: ['Soy de México. — Я из Мексики.'], notes: '' },
  { id: 'eres', word: 'eres', translation: 'ты есть (ser — быть)', partOfSpeech: 'verb', examples: ['¿De dónde eres? — Откуда ты?'], notes: '' },
  { id: 'es', word: 'es', translation: 'он/она есть (ser — быть)', partOfSpeech: 'verb', examples: [], notes: '' },
  { id: 'hablar', word: 'hablar', translation: 'говорить', partOfSpeech: 'verb', examples: ['Me gusta hablar español. — Мне нравится говорить по-испански.'], notes: 'Правильный глагол на -ar, см. справочник.' },
  { id: 'hablo', word: 'hablo', translation: 'говорю (hablar)', partOfSpeech: 'verb', examples: ['Hablo un poco. — Я говорю немного.'], notes: '' },
  { id: 'hablamos', word: 'hablamos', translation: 'говорим (hablar)', partOfSpeech: 'verb', examples: [], notes: '' },
  { id: 'espanol', word: 'español', translation: 'испанский язык; испанский', partOfSpeech: 'noun', examples: ['Hablo español. — Я говорю по-испански.'], notes: '' },
  { id: 'amiga', word: 'amiga', translation: 'подруга', partOfSpeech: 'noun', examples: [], notes: 'Мужской род — amigo.' },
  { id: 'amigos', word: 'amigos', translation: 'друзья', partOfSpeech: 'noun', examples: [], notes: '' },
  { id: 'simpatica', word: 'simpática', translation: 'милая, приятная', partOfSpeech: 'adjective', examples: [], notes: 'Мужской род — simpático.' },
  { id: 'bien', word: 'bien', translation: 'хорошо', partOfSpeech: 'adverb', examples: ['Estoy bien. — У меня всё хорошо.'], notes: '' },
  { id: 'y', word: 'y', translation: 'и', partOfSpeech: 'conjunction', examples: [], notes: '' },
  { id: 'con', word: 'con', translation: 'с', partOfSpeech: 'preposition', examples: [], notes: '' },
  { id: 'dos', word: 'dos', translation: 'два', partOfSpeech: 'numeral', examples: [], notes: '' },
];

const LESSON_BLOCKS = [
  h2('Урок 1. Приветствия и знакомство'),
  p(
    t('Главное испанское приветствие, которое подходит почти всегда, — '),
    t('¡Hola!', { bold: true }),
    t(' («привет»). Наведите на слово или нажмите на него: появится перевод из словаря курса. Обратите внимание, что восклицание и вопрос в испанском начинаются '),
    t('перевёрнутым знаком', { italic: true }),
    t(': '),
    t('¡', { bold: true, color: RED }),
    t(' и '),
    t('¿', { bold: true, color: RED }),
    t('.'),
  ),
  h3('Приветствия в течение дня'),
  table([
    ['По-испански', 'Перевод', 'Когда говорят'],
    ['¡Hola!', 'Привет!', 'в любое время'],
    ['Buenos días', 'Доброе утро', 'до обеда'],
    ['Buenas tardes', 'Добрый день', 'после обеда и до темноты'],
    ['Buenas noches', 'Добрый вечер; спокойной ночи', 'вечером и перед сном'],
    ['Adiós / Hasta luego', 'До свидания / До встречи', 'при прощании'],
  ]),
  h3('Знакомство'),
  p(t('Послушайте, как знакомятся Ана и Пабло:', { italic: true })),
  p(t('— ¡Hola! ¿Cómo te llamas?')),
  p(t('— Me llamo Ana. ¿Y tú?')),
  p(t('— Yo me llamo Pablo. Mucho gusto. ¿De dónde eres?')),
  p(t('— Soy de México. Hablo español y un poco de ruso. ¡Adiós!')),
  p(
    t('Запомните: '),
    t('me llamo', { bold: true, color: TEAL }),
    t(' — «меня зовут», '),
    t('¿Cómo te llamas?', { bold: true, color: TEAL }),
    t(' — «как тебя зовут?».'),
  ),
  h3('Разбор предложений'),
  p(
    t('Части речи подчёркнуты цветом, а сокращение видно при наведении. Нажмите на категорию в легенде над уроком, чтобы скрыть её подсветку и посмотреть только на остальные.', { italic: true }),
  ),
  p(
    t('Yo', { category: 'g_pron' }),
    t(' '),
    t('hablo', { category: 'g_verb' }),
    t(' '),
    t('español', { category: 'g_noun' }),
    t(' '),
    t('bien', { category: 'g_adv' }),
    t('.'),
  ),
  p(
    t('Ella', { category: 'g_pron' }),
    t(' '),
    t('es', { category: 'g_verb' }),
    t(' una '),
    t('amiga', { category: 'g_noun' }),
    t(' '),
    t('simpática', { category: 'g_adj' }),
    t('.'),
  ),
  p(
    t('Nosotros', { category: 'g_pron' }),
    t(' '),
    t('hablamos', { category: 'g_verb' }),
    t(' '),
    t('con', { category: 'g_prep' }),
    t(' '),
    t('dos', { category: 'g_num' }),
    t(' '),
    t('amigos', { category: 'g_noun' }),
    t(' '),
    t('y', { category: 'g_conj' }),
    t(' '),
    t('no', { category: 'g_part' }),
    t(' '),
    t('hablamos', { category: 'g_verb' }),
    t(' ruso.'),
  ),
  p(
    t('Ударный слог тоже можно разметить: ha'),
    t('bla', { category: 'ph_stress', bold: true }),
    t('mos, espa'),
    t('ñol', { category: 'ph_stress', bold: true }),
    t(', a'),
    t('diós', { category: 'ph_stress', bold: true }),
    t('.'),
  ),
  h3('Глагол hablar по лицам'),
  p(t('Окончание глагола меняется вместе с местоимением. Строки таблицы — лица, столбцы — число:')),
  table(
    [
      ['Лицо \\ Число', 'Единственное', 'Множественное'],
      ['1-е лицо', 'yo hablo', 'nosotros hablamos'],
      ['2-е лицо', 'tú hablas', 'vosotros habláis'],
      ['3-е лицо', 'él / ella habla', 'ellos / ellas hablan'],
    ],
    { headerRow: true, headerColumn: true },
  ),
  p(t('Подробнее о спряжении — в справочнике курса, раздел «Спряжение глагола hablar».', { italic: true })),
  h3('Упражнения'),
  task('demo-choice', 'multiple_choice', {
    question: 'Как поздороваться с соседом вечером?',
    options: [
      { id: 'a', text: 'Buenos días' },
      { id: 'b', text: 'Buenas noches' },
      { id: 'c', text: 'Adiós' },
    ],
    correctOptionId: 'b',
  }),
  task('demo-blank', 'fill_blank', { before: 'Me ', after: ' Ana. ¿Y tú?', answers: ['llamo'] }),
  task('demo-match', 'matching', {
    instruction: 'Соедините испанские фразы с переводом',
    pairs: [
      { id: 'p1', left: '¡Hola!', right: 'Привет!' },
      { id: 'p2', left: 'Adiós', right: 'До свидания' },
      { id: 'p3', left: 'Gracias', right: 'Спасибо' },
      { id: 'p4', left: 'Mucho gusto', right: 'Очень приятно' },
    ],
  }),
  task('demo-translate', 'translation', { source: 'Я говорю по-испански.', answers: ['Yo hablo español', 'Hablo español'] }),
  task('demo-input', 'free_input', { question: 'Какая форма глагола hablar нужна с местоимением nosotros?', answers: ['hablamos', 'nosotros hablamos'] }),
];

const REFERENCE_BLOCKS = [
  h2('Спряжение глагола hablar'),
  p(
    t('Hablar', { bold: true }),
    t(' («говорить») — правильный глагол на '),
    t('-ar', { bold: true, color: RED }),
    t('. Чтобы получить нужную форму, отбросьте -ar и добавьте окончание настоящего времени. Так же спрягаются '),
    t('estudiar', { italic: true }),
    t(' (учиться), '),
    t('trabajar', { italic: true }),
    t(' (работать) и сотни других глаголов.'),
  ),
  table([
    ['Местоимение', 'Окончание', 'Форма', 'Перевод'],
    ['yo', '-o', 'hablo', 'я говорю'],
    ['tú', '-as', 'hablas', 'ты говоришь'],
    ['él / ella / usted', '-a', 'habla', 'он, она говорит; вы говорите'],
    ['nosotros / nosotras', '-amos', 'hablamos', 'мы говорим'],
    ['vosotros / vosotras', '-áis', 'habláis', 'вы говорите'],
    ['ellos / ellas / ustedes', '-an', 'hablan', 'они говорят; вы говорите'],
  ]),
  p(
    t('Vosotros', { bold: true }),
    t(' говорят в Испании. В Латинской Америке вместо него всегда '),
    t('ustedes', { bold: true }),
    t(' с формой '),
    t('hablan', { bold: true, color: TEAL }),
    t('.'),
  ),
  p(
    t('Местоимение часто опускают: окончание и так показывает лицо. '),
    t('Hablo español', { italic: true }),
    t(' значит то же, что '),
    t('Yo hablo español', { italic: true }),
    t('.'),
  ),
];

export const DEMO_SECTIONS = {
  lessons: [{ id: 'lesson-1', title: 'Урок 1. Приветствия и знакомство', blocks: LESSON_BLOCKS }],
  reference: [{ id: 'hablar', title: 'Спряжение глагола hablar', blocks: REFERENCE_BLOCKS }],
};

/** Отрывок для главной: начало урока, таблица с двумя заголовками, разметка и одно задание. */
export const DEMO_EXCERPT = [
  LESSON_BLOCKS[0],
  LESSON_BLOCKS[1],
  ...LESSON_BLOCKS.filter((b) => b.type === 'table' && b.headerColumn),
  LESSON_BLOCKS.find((b) => b.type === 'paragraph' && b.children[0].category === 'g_pron'),
  LESSON_BLOCKS.find((b) => b.type === 'task'),
];
