/**
 * Мини-урок для главной страницы: тот же формат блоков, что и в настоящих
 * курсах, и те же компоненты рендера — посетитель видит продукт, а не описание.
 */
export const DEMO_CATEGORIES = [
  { id: 'pron', name: 'Местоимения', color: '#457b9d' },
  { id: 'verb', name: 'Глаголы', color: '#e63946' },
];

export const DEMO_DICTIONARY = [
  { id: 'mi', word: 'mi', translation: 'я, мы', partOfSpeech: 'pronoun', examples: ['mi moku. — Я ем.'] },
  { id: 'sina', word: 'sina', translation: 'ты, вы', partOfSpeech: 'pronoun', examples: ['sina pona. — Ты хороший.'] },
  { id: 'ona', word: 'ona', translation: 'он, она, оно, они', partOfSpeech: 'pronoun', examples: [] },
  { id: 'olin', word: 'olin', translation: 'любить', partOfSpeech: 'verb', examples: ['mi olin e sina. — Я люблю тебя.'] },
  { id: 'e', word: 'e', translation: 'частица перед прямым дополнением', partOfSpeech: 'particle', examples: [] },
];

export const DEMO_BLOCKS = [
  { type: 'heading', level: 2, children: [{ text: 'Токипона, урок 1: я люблю тебя' }] },
  {
    type: 'paragraph',
    children: [
      { text: 'mi', category: 'pron', bold: true },
      { text: ' ' },
      { text: 'olin', category: 'verb', bold: true },
      { text: ' e ' },
      { text: 'sina', category: 'pron', bold: true },
      { text: '. Наведите на слово или нажмите на него — появится перевод из словаря курса. Частица ' },
      { text: 'e', italic: true },
      { text: ' отмечает, кого любят.' },
    ],
  },
  {
    type: 'table',
    headerRow: true,
    rows: [{ cells: ['Токипона', 'Перевод'] }, { cells: ['mi', 'я, мы'] }, { cells: ['sina', 'ты, вы'] }, { cells: ['ona', 'он, она, они'] }],
  },
  {
    type: 'task',
    id: 'demo-task',
    taskType: 'multiple_choice',
    data: {
      question: 'Как сказать «я люблю тебя»?',
      options: [
        { id: 'a', text: 'sina olin e mi' },
        { id: 'b', text: 'mi olin e sina' },
        { id: 'c', text: 'mi olin sina e' },
      ],
      correctOptionId: 'b',
    },
  },
];
