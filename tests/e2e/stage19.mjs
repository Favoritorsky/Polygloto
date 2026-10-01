// v2, этап 1: интервальные повторения. Урок пройден → слова в повторении,
// счётчик в шапке, страница «Повторение» (показать ответ, оценка), пустые состояния,
// «В повторение» из подсказки и из словаря курса.
import { BASE, assert, launch, newPage, register, uniqueEmail, uidOf } from './lib.mjs';
import { Timestamp, adminDb, seedPublishedCourse } from './seed.mjs';

const tag = Date.now().toString(36);
const courseId = await seedPublishedCourse({
  title: `Повторение ${tag}`,
  lessons: [
    { id: 'l1', title: 'Приветствия', blocks: [{ type: 'paragraph', children: [{ text: 'Hola, me llamo Ana. Hola!' }] }] },
    { id: 'l2', title: 'Числа', blocks: [{ type: 'paragraph', children: [{ text: 'Uno, dos.' }] }] },
  ],
  dictionary: [
    { id: 'hola', word: 'hola', translation: 'привет' },
    { id: 'me-llamo', word: 'me llamo', translation: 'меня зовут' },
    { id: 'uno', word: 'uno', translation: 'один' },
    { id: 'dos', word: 'dos', translation: 'два' },
    { id: 'adios', word: 'adiós', translation: 'до свидания' },
  ],
});

const browser = await launch();
try {
  const page = await newPage(browser);
  const email = uniqueEmail('srs');
  await register(page, { name: 'Повторяшка', email });
  const uid = await uidOf(email);

  await page.goto(`${BASE}/review`);
  await page.getByRole('heading', { name: 'Слов для повторения пока нет' }).waitFor();
  assert(true, 'пустое состояние без карточек');
  assert((await page.getByLabel(/к повторению/).count()) === 0, 'без карточек нет бейджа');

  // Урок пройден → слова урока в повторении.
  await page.goto(`${BASE}/course/${courseId}`);
  await page.getByText('В уроке 2 слова из словаря курса').waitFor();
  await page.getByRole('button', { name: 'Отметить урок пройденным' }).click();
  await page.getByText('В повторение добавлено 2 слова').waitFor();
  assert(true, 'урок пройден: 2 слова добавлены');
  await page.getByRole('navigation', { name: 'Уроки' }).getByLabel('пройден').waitFor();
  assert(true, 'в оглавлении отметка пройденного урока');
  await page.getByLabel('к повторению: 2').waitFor();
  assert(true, 'бейдж в шапке: 2 слова к повторению');

  // Повторное нажатие не дублирует карточки.
  await page.reload();
  await page.getByRole('button', { name: 'Добавить слова урока в повторение' }).click();
  await page.getByText('Новых слов для повторения нет').waitFor();
  assert(true, 'повторная отметка не дублирует слова');

  // «В повторение» из подсказки словаря во втором уроке.
  await page.getByRole('button', { name: 'Числа →' }).click();
  await page.locator('[role="button"]', { hasText: 'Uno' }).click();
  await page.getByRole('tooltip').getByRole('button', { name: '+ В повторение' }).click();
  await page.getByRole('tooltip').getByText('✓ В повторении').waitFor();
  assert(true, 'слово добавлено из подсказки');
  // И из вкладки «Словарь».
  await page.getByRole('tab', { name: 'Словарь' }).click();
  const adios = page.locator('li', { hasText: 'до свидания' });
  await adios.getByRole('button', { name: '+ В повторение' }).click();
  await adios.getByText('✓ В повторении').waitFor();
  assert((await page.getByText('✓ В повторении').count()) === 4, 'в словаре отмечены все 4 слова в повторении');
  await page.getByLabel('к повторению: 4').waitFor();

  // Повторение: показать ответ и оценить.
  await page.getByRole('link', { name: /Повторение/ }).click();
  await page.waitForURL('**/review');
  await page.getByText('Осталось: 4').waitFor();
  const word = await page.getByLabel('Карточка').locator('p').first().innerText();
  await page.getByRole('button', { name: 'Показать ответ' }).click();
  await page.getByRole('group', { name: 'Насколько легко вспомнили' }).waitFor();
  assert((await page.getByRole('button', { name: /Забыл\s*10 мин/ }).count()) === 1, 'у «Забыл» подпись «10 мин»');
  await page.getByRole('button', { name: /^Вспомнил/ }).click();
  await page.getByText('Осталось: 3').waitFor();
  assert((await page.getByLabel('Карточка').locator('p').first().innerText()) !== word, 'следующая карточка');

  // С клавиатуры: пробел — ответ, 1 — «Забыл».
  await page.keyboard.press('Space');
  await page.getByRole('group', { name: 'Насколько легко вспомнили' }).waitFor();
  await page.keyboard.press('1');
  await page.getByText('Осталось: 2').waitFor();
  assert(true, 'оценка с клавиатуры');
  for (let i = 0; i < 2; i += 1) {
    await page.getByRole('button', { name: 'Показать ответ' }).click();
    await page.getByRole('button', { name: /^Легко/ }).click();
  }
  await page.getByRole('heading', { name: 'Готово! Повторено слов: 4' }).waitFor();
  assert(true, 'все карточки повторены, итог сессии');
  await page.getByText(/Следующие слова будут готовы/).waitFor();
  assert(true, 'пустое состояние показывает ближайший срок');
  await page.waitForFunction(() => !document.querySelector('[aria-label^="к повторению"]'));
  assert(true, 'бейдж исчез после повторения');

  // Данные в базе: расписание по SM-2.
  const cards = await adminDb.collection(`users/${uid}/srsCards`).get();
  const byWord = Object.fromEntries(cards.docs.map((d) => [d.data().word, d.data()]));
  assert(cards.size === 4, 'в базе 4 карточки');
  const intervals = cards.docs.map((d) => d.data().interval).sort();
  assert(JSON.stringify(intervals) === JSON.stringify([0, 1, 4, 4]), `интервалы 0/1/4/4 (${intervals})`);
  assert(Object.values(byWord).every((c) => c.lastReviewedAt instanceof Timestamp), 'отметка времени повторения');

  // Другой пользователь не видит чужие карточки (проверяется правилами; здесь — что страница своя).
  const errors = page.errors.filter((e) => !e.includes('favicon'));
  assert(errors.length === 0, `нет ошибок в консоли (${errors.join(' | ')})`);
} finally {
  await browser.close();
}
