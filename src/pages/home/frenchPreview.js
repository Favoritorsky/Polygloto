/**
 * Урок-превью на главной: основы чтения по-французски. Открыт без регистрации,
 * данные лежат в коде (как демо-курс испанского) и показываются теми же
 * компонентами, что и настоящие курсы: разметка категорий, словарь по наведению,
 * задания с проверкой. Только база, без сложных случаев.
 */

const t = (text, attrs = {}) => ({ text, ...attrs });
const p = (...children) => ({ type: 'paragraph', children });
const h3 = (text) => ({ type: 'heading', level: 3, children: [t(text)] });
const table = (rows) => ({ type: 'table', headerRow: true, headerColumn: false, rows: rows.map((cells) => ({ cells })) });
const task = (id, taskType, data) => ({ type: 'task', id, taskType, data });

/** Строка «Слова для тренировки»: слова целиком, чтобы работал словарь по наведению. */
const practice = (list) => p(t('Слова для тренировки: ', { italic: true }), t(`${list}.`));

const silent = (text) => t(text, { category: 'fr_silent' });
const nasal = (text) => t(text, { category: 'fr_nasal', bold: true });
const combo = (text) => t(text, { category: 'fr_combo', bold: true });

export const FRENCH_PREVIEW = {
  id: 'french-phonetics',
  title: 'Как читать по-французски: пять главных правил',
  language: 'Французский',
};

/** Свои категории урока: легенда над текстом объясняет подсветку. */
export const FRENCH_CATEGORIES = [
  { id: 'fr_combo', group: 'custom', name: 'Буквосочетание, один звук', abbr: 'сочет.', color: '#457b9d' },
  { id: 'fr_nasal', group: 'custom', name: 'Носовой гласный', abbr: 'носов.', color: '#ff006e' },
  { id: 'fr_silent', group: 'custom', name: 'Не читается', abbr: 'немая', color: '#6c757d' },
];

const entry = (word, translation, partOfSpeech, ipa) => ({
  id: word,
  word,
  translation,
  partOfSpeech,
  examples: [],
  notes: `Произношение: [${ipa}]`,
});

export const FRENCH_DICTIONARY = [
  entry('Paris', 'Париж', 'noun', 'paʁi'),
  entry('petit', 'маленький', 'adjective', 'pəti'),
  entry('grand', 'большой', 'adjective', 'ɡʁɑ̃'),
  entry('nez', 'нос', 'noun', 'ne'),
  entry('deux', 'два', 'numeral', 'dø'),
  entry('beaucoup', 'много', 'adverb', 'boku'),
  entry('avec', 'с, вместе с', 'preposition', 'avɛk'),
  entry('neuf', 'девять; новый', 'numeral', 'nœf'),
  entry('parler', 'говорить', 'verb', 'paʁle'),
  entry('vous', 'вы', 'pronoun', 'vu'),
  entry('jour', 'день', 'noun', 'ʒuʁ'),
  entry('rouge', 'красный', 'adjective', 'ʁuʒ'),
  entry('bleu', 'синий, голубой', 'adjective', 'blø'),
  entry('fleur', 'цветок', 'noun', 'flœʁ'),
  entry('sœur', 'сестра', 'noun', 'sœʁ'),
  entry('chat', 'кот, кошка', 'noun', 'ʃa'),
  entry('chocolat', 'шоколад', 'noun', 'ʃɔkɔla'),
  entry('France', 'Франция', 'noun', 'fʁɑ̃s'),
  entry('enfant', 'ребёнок', 'noun', 'ɑ̃fɑ̃'),
  entry('bonjour', 'здравствуйте, добрый день', 'interjection', 'bɔ̃ʒuʁ'),
  entry('vin', 'вино', 'noun', 'vɛ̃'),
  entry('pain', 'хлеб', 'noun', 'pɛ̃'),
  entry('lundi', 'понедельник', 'noun', 'lœ̃di'),
  entry('bonne', 'хорошая', 'adjective', 'bɔn'),
  entry('année', 'год', 'noun', 'ane'),
];

export const FRENCH_BLOCKS = [
  p(
    t(
      'Во французском многие буквы пишутся, но не читаются, а некоторые пары букв читаются как один звук. Зато правила почти без исключений: выучив пять из них, вы прочитаете большинство слов. Под каждым правилом есть слова для тренировки: наведите на подчёркнутое слово, чтобы увидеть перевод и транскрипцию, а в легенде над уроком можно скрыть подсветку.',
    ),
  ),
  h3('1. Конечные согласные обычно молчат'),
  p(
    t('Буквы '),
    t('s, t, d, x, z, p', { bold: true }),
    t(' на конце слова, как правило, не читаются: Pari'),
    silent('s'),
    t(' [пари], peti'),
    silent('t'),
    t(' [пти], ne'),
    silent('z'),
    t(' [нэ], deu'),
    silent('x'),
    t(' [дё], beaucou'),
    silent('p'),
    t(' [боку]. Конечная '),
    t('e', { bold: true }),
    t(' в длинных словах тоже не звучит: roug'),
    silent('e'),
    t(' [руж].'),
  ),
  p(
    t('А вот '),
    t('c, r, f, l', { bold: true }),
    t(' на конце обычно читаются. Их легко запомнить по английскому слову '),
    t('CaReFuL', { bold: true }),
    t(': avec [авэк], jour [жур], neuf [нёф]. Исключение: у глаголов на -er буква r молчит, parle'),
    silent('r'),
    t(' [парле].'),
  ),
  practice('Paris, petit, nez, deux, beaucoup, avec, neuf, parler'),
  h3('2. «ou» читается как [у]'),
  p(
    t('v'),
    combo('ou'),
    silent('s'),
    t(' [ву], j'),
    combo('ou'),
    t('r [жур], r'),
    combo('ou'),
    t('g'),
    silent('e'),
    t(' [руж]. Никакого «оу», как в английском.'),
  ),
  practice('vous, jour, rouge'),
  h3('3. «eu» похоже на русское [ё]'),
  p(
    t('Только без «й» в начале: губы округлены, как для [о], а язык стоит как для [э]. d'),
    combo('eu'),
    silent('x'),
    t(' [дё], bl'),
    combo('eu'),
    t(' [блё], fl'),
    combo('eu'),
    t('r [флёр]. Так же читается «œu»: s'),
    combo('œu'),
    t('r [сёр].'),
  ),
  practice('deux, bleu, fleur, sœur'),
  h3('4. «ch» читается как [ш]'),
  p(combo('ch'), t('a'), silent('t'), t(' [ша], '), combo('ch'), t('ocola'), silent('t'), t(' [шокола]. Звука [ч] во французском нет.')),
  practice('chat, chocolat'),
  h3('5. Носовые гласные'),
  p(
    t('Если после гласной стоит '),
    t('n', { bold: true }),
    t(' или '),
    t('m', { bold: true }),
    t(
      ', а за ними нет гласной, то гласная произносится «в нос», а сама n или m не звучит. В русском таких звуков нет: начните произносить [а] и пустите часть воздуха через нос.',
    ),
  ),
  table([
    ['Буквы', 'Звук', 'Примеры'],
    ['an, am, en, em', 'носовое [а]', 'France, enfant'],
    ['on, om', 'носовое [о]', 'bonjour'],
    ['in, im, ain, ein', 'носовое [э]', 'vin, pain'],
    ['un', 'носовое [э] или [ё]', 'lundi'],
  ]),
  p(
    t('Пример: Fr'),
    nasal('an'),
    t('ce, '),
    nasal('en'),
    t('f'),
    nasal('an'),
    silent('t'),
    t(', b'),
    nasal('on'),
    t('jour, v'),
    nasal('in'),
    t(', p'),
    nasal('ain'),
    t('. Если после n или m идёт гласная или вторая n, носового звука нет: bonne [бон], année [анэ].'),
  ),
  p(
    t('И последнее: ударение во французском всегда падает на последний произносимый слог, chocola', { italic: true }),
    t('t', { italic: true, category: 'fr_silent' }),
    t(' → [шоколА].', { italic: true }),
  ),
  h3('Проверьте себя'),
  task('fr-choice-ch', 'multiple_choice', {
    question: 'Как читается слово «chat» (кот)?',
    options: [
      { id: 'a', text: '[чат]' },
      { id: 'b', text: '[ша]' },
      { id: 'c', text: '[кат]' },
    ],
    correctOptionId: 'b',
  }),
  task('fr-choice-nasal', 'multiple_choice', {
    question: 'В каком слове есть носовой гласный?',
    options: [
      { id: 'a', text: 'bonne' },
      { id: 'b', text: 'année' },
      { id: 'c', text: 'bonjour' },
    ],
    correctOptionId: 'c',
  }),
  task('fr-match', 'matching', {
    instruction: 'Соедините буквы со звуком',
    pairs: [
      { id: 'p1', left: 'ou', right: '[у]' },
      { id: 'p2', left: 'ch', right: '[ш]' },
      { id: 'p3', left: 'eu', right: '[ё] без «й»' },
      { id: 'p4', left: 'on', right: 'носовое [о]' },
    ],
  }),
  task('fr-silent', 'free_input', {
    question: 'Какие буквы в конце слова «grands» (большие) не читаются? Напишите их подряд.',
    answers: ['ds', 'd s', 'd, s', 'd и s'],
  }),
];
