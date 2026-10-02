// Доработки после запуска, задача 1: вся карточка курса кликабельна
// (каталог и «Мои курсы»), с клавиатуры тоже (Enter и Space), вложенная ссылка
// «Открыть» не дублирует переход.
import { getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore';
import { buildSearchKeywords, normalizeText } from '../../shared/schema.js';
import { BASE, assert, launch, newPage, register, uniqueEmail, chooseLanguage } from './lib.mjs';

process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
const db = getFirestore(getApps()[0] ?? initializeApp({ projectId: 'demo-polygloto' }));

const tag = `card${Date.now().toString(36)}`;
const title = `Карточка ${tag}`;
const ref = db.collection('publicCourses').doc();
await ref.set({
  authorId: 'seed', authorName: 'Сид', title, language: 'Испанский', description: 'Длинное описание курса для клика мимо заголовка.',
  categories: [], lessonOrder: [], referenceOrder: [], toc: { lessons: [], reference: [] },
  titleLower: normalizeText(title), languageLower: normalizeText('Испанский'),
  searchKeywords: buildSearchKeywords(title, 'Испанский'),
  likesCount: 0, dislikesCount: 0, score: 0, lessonsCount: 1, wordsCount: 0,
  publishedAt: Timestamp.now(), updatedAt: FieldValue.serverTimestamp(),
});

// Клик мышью в центр элемента «как человек»: сверху лежит растянутая ссылка карточки,
// поэтому обычный locator.click() Playwright считает перекрытым (это и нужно проверить).
async function clickOver(locator) {
  const box = await locator.boundingBox();
  await locator.page().mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

const browser = await launch();
try {
  const page = await newPage(browser);

  // Каталог: клик по описанию и по счётчикам ведёт на страницу курса.
  const openCatalogCard = async () => {
    await page.goto(`${BASE}/catalog?q=${encodeURIComponent(tag)}`);
    const card = page.locator('article', { hasText: title });
    await card.waitFor();
    return card;
  };
  let card = await openCatalogCard();
  assert((await card.evaluate((el) => getComputedStyle(el).cursor)) === 'pointer', 'курсор-рука на всей карточке');
  await clickOver(card.getByText('Длинное описание'));
  await page.waitForURL(`**/course/${ref.id}`);
  assert(true, 'каталог: клик по описанию открывает курс');

  card = await openCatalogCard();
  await clickOver(card.getByText('Уроков: 1'));
  await page.waitForURL(`**/course/${ref.id}`);
  assert(true, 'каталог: клик по счётчикам открывает курс');

  card = await openCatalogCard();
  await card.getByRole('link', { name: title }).focus();
  await page.keyboard.press('Space');
  await page.waitForURL(`**/course/${ref.id}`);
  assert(true, 'каталог: Space на карточке открывает курс');

  card = await openCatalogCard();
  await card.getByRole('link', { name: title }).focus();
  await page.keyboard.press('Enter');
  await page.waitForURL(`**/course/${ref.id}`);
  assert(true, 'каталог: Enter на карточке открывает курс');

  // «Мои курсы»: вся плитка ведёт в редактор.
  await register(page, { name: 'Карточкин', email: uniqueEmail('card') });
  await page.goto(`${BASE}/my-courses`);
  await page.getByRole('button', { name: '+ Новый курс' }).click();
  await page.getByLabel('Название курса').fill(`Мой ${tag}`);
  await chooseLanguage(page, 'Испанский');
  await page.getByRole('button', { name: 'Создать черновик' }).click();
  await page.waitForURL('**/courses/*/edit');
  const editUrl = page.url();

  await page.goto(`${BASE}/my-courses`);
  const tile = page.locator('li', { hasText: `Мой ${tag}` });
  await tile.waitFor();
  assert((await tile.evaluate((el) => getComputedStyle(el).cursor)) === 'pointer', 'мои курсы: курсор-рука на плитке');
  await clickOver(tile.getByText('Черновик'));
  await page.waitForURL(editUrl);
  assert(true, 'мои курсы: клик по бейджу статуса открывает редактор');

  await page.goto(`${BASE}/my-courses`);
  await clickOver(page.locator('li', { hasText: `Мой ${tag}` }).getByText('Изменён'));
  await page.waitForURL(editUrl);
  assert(true, 'мои курсы: клик по дате открывает редактор');

  await page.goto(`${BASE}/my-courses`);
  await page.locator('li', { hasText: `Мой ${tag}` }).getByRole('link', { name: `Мой ${tag}` }).focus();
  await page.keyboard.press('Space');
  await page.waitForURL(editUrl);
  assert(true, 'мои курсы: Space открывает редактор');

  const errors = page.errors.filter((e) => !e.includes('favicon'));
  assert(errors.length === 0, `нет ошибок в консоли (${errors.join(' | ')})`);
} finally {
  await browser.close();
}
