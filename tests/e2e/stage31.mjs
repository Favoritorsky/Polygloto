// Правки 3, задача 4: длинный текст в заданиях всех типов переносится и не
// выходит за карточку — на компьютере и на узком экране телефона.
import { BASE, assert, launch } from './lib.mjs';
import { seedPublishedCourse } from './seed.mjs';

const LONG =
  'Это очень длинный вариант ответа, который должен переноситься на несколько строк внутри карточки задания и не выходить за её границы';
const WORD = 'Донауфдампфшиффартсгезельшафтскапитенсмютценабзейхенсунтерабтейлунг';
const opts = (n) => Array.from({ length: n }, (_, i) => ({ id: `o${i}`, text: i === 0 ? WORD : `${LONG} (${i})` }));
const task = (id, taskType, data) => ({ type: 'task', id, taskType, data });

const blocks = [
  task('t1', 'multiple_choice', { question: `${LONG}?`, options: opts(3), correctOptionId: 'o1' }),
  task('t2', 'multiple_select', { question: LONG, options: opts(3), correctOptionIds: ['o1'] }),
  task('t3', 'fill_blank', { before: `${LONG} ${WORD}`, after: LONG, answers: ['x'] }),
  task('t4', 'matching', {
    instruction: LONG,
    pairs: [
      { id: 'p1', left: WORD, right: LONG },
      { id: 'p2', left: LONG, right: WORD },
    ],
  }),
  task('t5', 'translation', { source: `${LONG} ${WORD}`, answers: ['x'] }),
  task('t6', 'free_input', { question: `${LONG} ${WORD}`, answers: ['x'] }),
  task('t7', 'sentence_order', {
    instruction: LONG,
    translation: LONG,
    answers: [`${WORD} uno dos tres cuatro cinco seis siete ocho nueve diez once doce`],
  }),
  task('t8', 'listening', {
    audio: { kind: 'url', url: 'https://upload.wikimedia.org/wikipedia/commons/a/a1/test.ogg' },
    question: LONG,
    mode: 'choice',
    options: opts(2),
    correctOptionId: 'o1',
    answers: [],
    transcript: LONG,
  }),
];
const courseId = await seedPublishedCourse({
  title: `Длинные задания ${Date.now().toString(36)}`,
  lessons: [{ id: 'l1', title: 'Урок', blocks }],
});

const browser = await launch();
try {
  for (const [label, width] of [
    ['компьютер', 1280],
    ['телефон', 360],
  ]) {
    const context = await browser.newContext({ viewport: { width, height: 800 }, locale: 'ru-RU' });
    const page = await context.newPage();
    await page.goto(`${BASE}/course/${courseId}`);
    const forms = page.locator('form[aria-label^="Задание"]');
    await forms.first().waitFor();
    const count = await forms.count();
    assert(count === 8, `${label}: все 8 заданий на странице (${count})`);
    const overflow = await page.evaluate(() =>
      [...document.querySelectorAll('form[aria-label^="Задание"]')].flatMap((form) => {
        const box = form.getBoundingClientRect();
        return [...form.querySelectorAll('*')]
          .filter((el) => {
            const r = el.getBoundingClientRect();
            return r.width > 0 && (r.right > box.right + 1 || r.left < box.left - 1);
          })
          .map((el) => `${form.getAttribute('aria-label')}: <${el.tagName.toLowerCase()} class="${el.className}">`);
      }),
    );
    assert(
      overflow.length === 0,
      `${label}: ничего не выходит за карточки заданий${overflow.length ? `: ${overflow.slice(0, 5).join(' | ')}` : ''}`,
    );
    const pageScroll = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert(pageScroll <= 0, `${label}: страница не прокручивается вбок (${pageScroll}px)`);
    await context.close();
  }
} finally {
  await browser.close();
}
console.log('stage31 OK');
