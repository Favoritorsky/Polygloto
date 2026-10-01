// v2, этап 4: мини-игры по словарю курса — «Найди пары» и «На скорость».
import { BASE, assert, launch, newPage } from './lib.mjs';
import { seedPublishedCourse } from './seed.mjs';

const dictionary = [
  ['hola', 'привет'],
  ['adiós', 'пока'],
  ['casa', 'дом'],
  ['perro', 'собака'],
  ['gato', 'кошка'],
  ['agua', 'вода'],
  ['libro', 'книга'],
].map(([word, translation]) => ({ id: word.replace(/[^a-z]/g, ''), word, translation }));
const translationOf = new Map(dictionary.map((d) => [d.word, d.translation]));
const wordOf = new Map(dictionary.map((d) => [d.translation, d.word]));

const courseId = await seedPublishedCourse({
  title: `Игры ${Date.now().toString(36)}`,
  lessons: [{ id: 'l1', title: 'Урок', blocks: [{ type: 'paragraph', children: [{ text: 'Hola' }] }] }],
  dictionary,
});
const small = await seedPublishedCourse({
  title: `Мало слов ${Date.now().toString(36)}`,
  lessons: [{ id: 'l1', title: 'Урок', blocks: [] }],
  dictionary: dictionary.slice(0, 3),
});

const browser = await launch();
try {
  const page = await newPage(browser);
  await page.goto(`${BASE}/course/${courseId}`);
  await page.getByRole('link', { name: '🎮 Мини-игры по словарю' }).click();
  await page.waitForURL(`**/course/${courseId}/games`);
  await page.getByRole('heading', { name: 'Мини-игры' }).waitFor();
  assert(true, 'гость открывает игры со страницы курса');

  // «Найди пары»: решаем, зная словарь (сначала одна ошибка)
  const memory = page.getByRole('region', { name: 'Найди пары' });
  const total = await memory.locator('div[class*="memoryGrid"] button').count();
  assert(total === 12, `12 карточек — 6 пар (${total})`);
  const grid = memory.locator('div[class*="memoryGrid"] button');
  const texts = [];
  for (let i = 0; i < total; i += 2) {
    await grid.nth(i).click();
    await grid.nth(i + 1).click();
    texts[i] = await grid.nth(i).getAttribute('aria-label');
    texts[i + 1] = await grid.nth(i + 1).getAttribute('aria-label');
    await page.waitForTimeout(950);
  }
  assert(
    texts.every((t) => t && !t.startsWith('Карточка')),
    'открытые карточки показывают текст',
  );
  // Теперь все тексты известны — открываем пары
  const partner = (t) => translationOf.get(t) ?? wordOf.get(t);
  for (let i = 0; i < total; i += 1) {
    const button = grid.nth(i);
    if (await button.isDisabled()) continue;
    const j = texts.findIndex((t, k) => k !== i && t === partner(texts[i]));
    await button.click();
    await grid.nth(j).click();
  }
  await memory.getByText(/Все пары найдены за \d+ ход/).waitFor();
  assert(true, 'все пары найдены — итог с числом ходов и временем');
  await memory.getByText(/Рекорд: \d+ ход/).waitFor();
  assert(true, 'рекорд сохранён');

  // «На скорость»
  await page.getByRole('tab', { name: 'На скорость' }).click();
  const speed = page.getByRole('region', { name: 'На скорость' });
  await speed.getByRole('button', { name: 'Начать' }).click();
  for (let i = 0; i < 5; i += 1) {
    const word = await speed.locator('p[class*="speedWord"]').innerText();
    await speed.getByRole('button', { name: new RegExp(`^\\d ${translationOf.get(word)}$`) }).click();
  }
  // одна ошибка
  const word = await speed.locator('p[class*="speedWord"]').innerText();
  const wrong = speed
    .locator('button[class*="speedOption"]')
    .filter({ hasNotText: translationOf.get(word) })
    .first();
  await wrong.click();
  await speed.getByText(`Правильно: ${word} — ${translationOf.get(word)}`).waitFor();
  assert(true, 'после ошибки показан правильный перевод');
  await speed.getByText('Верно: 5').waitFor();
  // с клавиатуры: цифра варианта
  const w2 = await speed.locator('p[class*="speedWord"]').innerText();
  const options = await speed.locator('button[class*="speedOption"]').allInnerTexts();
  const n = options.findIndex((o) => o.endsWith(translationOf.get(w2))) + 1;
  await speed.locator('button[class*="speedOption"]').first().focus();
  await page.keyboard.press(String(n));
  await speed.getByText('Верно: 6').waitFor();
  assert(true, 'ответ цифрой с клавиатуры');
  // Ускоряем время: таймер считает от Date.now
  await page.evaluate(() => {
    const real = Date.now;
    Date.now = () => real() + 61000;
  });
  await speed.getByText('Время вышло! Верно: 6 слов, ошибок: 1.').waitFor({ timeout: 5000 });
  await speed.getByText('Новый рекорд! 🎉').waitFor();
  assert(true, 'через 60 с игра заканчивается, рекорд запомнен');

  await page.goto(`${BASE}/course/${small}`);
  await page.getByRole('heading', { name: /Мало слов/ }).waitFor();
  assert((await page.getByRole('link', { name: '🎮 Мини-игры по словарю' }).count()) === 0, 'при 3 словах ссылки на игры нет');
  await page.goto(`${BASE}/course/${small}/games`);
  await page.getByText('Для игр нужно хотя бы 4 слова').waitFor();
  assert(true, 'при 3 словах игры объясняют, почему недоступны');
} finally {
  await browser.close();
}
