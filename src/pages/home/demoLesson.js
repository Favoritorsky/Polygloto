/**
 * Мини-урок для главной страницы: тот же формат блоков, что и в настоящих
 * курсах, и те же компоненты рендера — посетитель видит продукт, а не описание.
 */
export const DEMO_CATEGORIES = [
  { id: 'pron', name: 'Местоимения', color: '#457b9d' },
  { id: 'verb', name: 'Глаголы', color: '#e63946' },
];

export const DEMO_DICTIONARY = [
  { id: 'yo', word: 'yo', translation: 'я', partOfSpeech: 'pronoun', examples: ['Yo soy Ana. — Я Анна.'] },
  { id: 'tu', word: 'tú', translation: 'ты', partOfSpeech: 'pronoun', examples: ['Tú eres mi amigo. — Ты мой друг.'] },
  { id: 'hablo', word: 'hablo', translation: 'говорю (hablar — говорить)', partOfSpeech: 'verb', examples: ['Hablo un poco. — Я говорю немного.'] },
  { id: 'hablas', word: 'hablas', translation: 'говоришь', partOfSpeech: 'verb', examples: ['¿Hablas ruso? — Ты говоришь по-русски?'] },
  { id: 'espanol', word: 'español', translation: 'испанский язык', partOfSpeech: 'noun', examples: [] },
];

export const DEMO_BLOCKS = [
  { type: 'heading', level: 2, children: [{ text: 'Испанский, урок 1: я говорю по-испански' }] },
  {
    type: 'paragraph',
    children: [
      { text: 'Yo', category: 'pron', bold: true },
      { text: ' ' },
      { text: 'hablo', category: 'verb', bold: true },
      { text: ' ' },
      { text: 'español', bold: true },
      { text: '. Наведите на слово или нажмите на него — появится перевод из словаря курса. Окончание глагола ' },
      { text: '-o', italic: true },
      { text: ' показывает, что говорю именно я.' },
    ],
  },
  {
    type: 'table',
    headerRow: true,
    rows: [{ cells: ['Испанский', 'Перевод'] }, { cells: ['yo hablo', 'я говорю'] }, { cells: ['tú hablas', 'ты говоришь'] }, { cells: ['él habla', 'он говорит'] }],
  },
  {
    type: 'task',
    id: 'demo-task',
    taskType: 'multiple_choice',
    data: {
      question: 'Как сказать «я говорю по-испански»?',
      options: [
        { id: 'a', text: 'Tú hablas español' },
        { id: 'b', text: 'Yo hablo español' },
        { id: 'c', text: 'Yo habla español' },
      ],
      correctOptionId: 'b',
    },
  },
];
