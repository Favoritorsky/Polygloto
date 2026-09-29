// Этап 10: каталог — поиск по названию и языку, фильтр по языку,
// сортировка по оценкам, постраничная загрузка, состояние в адресе.
import { getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore';
import { buildSearchKeywords, normalizeText } from '../../shared/schema.js';
import { BASE, assert, launch, newPage } from './lib.mjs';

process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
const db = getFirestore(getApps()[0] ?? initializeApp({ projectId: 'demo-polygloto' }));

// Уникальная метка изолирует сценарий от данных прошлых запусков.
const tag = `q${Date.now().toString(36)}`;
const langMain = `Сканийский ${tag}`;
const langOther = `Нэрийский ${tag}`;

async function publish(title, language, { likes = 0, dislikes = 0, daysAgo = 0 } = {}) {
  const ref = db.collection('publicCourses').doc();
  await ref.set({
    authorId: 'seed', authorName: 'Сид', title, language, description: "Короткое описание.",
    categories: [], lessonOrder: [], referenceOrder: [], toc: { lessons: [], reference: [] },
    titleLower: normalizeText(title), languageLower: normalizeText(language),
    searchKeywords: buildSearchKeywords(title, language),
    likesCount: likes, dislikesCount: dislikes, score: likes - dislikes, commentsCount: 0,
    lessonsCount: 1, wordsCount: 0,
    publishedAt: Timestamp.fromMillis(Date.now() - daysAgo * 86400000), updatedAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

await publish(`Грамматика ${tag} для начинающих`, langMain, { likes: 5, dislikes: 1, daysAgo: 3 });
await publish(`Фонетика ${tag}`, langMain, { likes: 9, dislikes: 8, daysAgo: 1 });
await publish(`Разговорник ${tag}`, langOther, { likes: 2, dislikes: 0, daysAgo: 0 });
// Для пагинации: 13 курсов ещё одного языка.
const langMany = `Многоязык ${tag}`;
for (let i = 0; i < 13; i += 1) await publish(`Урок ${tag} номер ${i + 1}`, langMany, { likes: i });

const titles = (page) => page.locator('article h3').allInnerTexts();

const browser = await launch();
try {
  const page = await newPage(browser);
  await page.goto(`${BASE}/catalog`);
  await page.getByRole('heading', { name: 'Каталог курсов' }).waitFor();

  await page.getByPlaceholder('Поиск по названию или языку').fill(`ГРАММ ${tag}`);
  await page.waitForURL(/q=/);
  await page.getByText(`Грамматика ${tag} для начинающих`).waitFor();
  let list = await titles(page);
  assert(list.length === 1, `поиск по префиксам нескольких слов без учёта регистра: ${list.join(', ')}`);

  await page.getByPlaceholder('Поиск по названию или языку').fill(`нэрий ${tag}`);
  await page.getByText(`Разговорник ${tag}`).waitFor();
  assert((await titles(page)).length === 1, 'поиск по названию языка');

  await page.getByPlaceholder('Поиск по названию или языку').fill(`${tag} несуществующее`);
  await page.getByText('По этому запросу ничего не нашлось').waitFor();
  assert(true, 'нет результатов — понятное сообщение');

  await page.getByRole('button', { name: 'Сбросить' }).click();
  await page.waitForURL((u) => !u.search.includes('q='));
  assert((await page.getByPlaceholder('Поиск по названию или языку').inputValue()) === '', 'сброс очищает поиск');

  // Фильтр по языку: список языков строит триггер, ждём появления.
  const langSelect = page.getByLabel('Язык', { exact: true });
  for (let i = 0; i < 30 && !(await langSelect.locator('option', { hasText: langMain }).count()); i += 1) {
    await page.waitForTimeout(500);
    await page.reload();
  }
  await langSelect.selectOption({ label: `${langMain} (2)` });
  await page.getByText(`Фонетика ${tag}`).waitFor();
  list = await titles(page);
  assert(list.length === 2 && list[0].startsWith('Грамматика'), `фильтр по языку, по рейтингу: ${list.join(', ')}`);

  await page.getByLabel('Сортировка').selectOption('likes');
  await page.waitForURL(/sort=likes/);
  await page.waitForFunction((t) => document.querySelector('article h3')?.textContent.startsWith('Фонетика'), tag);
  assert(true, 'сортировка «Больше лайков»');
  await page.getByLabel('Сортировка').selectOption('dislikes');
  await page.waitForFunction(() => document.querySelector('article h3')?.textContent.startsWith('Грамматика'));
  assert(true, 'сортировка «Меньше дизлайков»');
  await page.getByLabel('Сортировка').selectOption('newest');
  await page.waitForFunction(() => document.querySelector('article h3')?.textContent.startsWith('Фонетика'));
  assert(true, 'сортировка «Новые»');

  await page.reload();
  await page.getByText(`Фонетика ${tag}`).waitFor();
  assert((await page.getByLabel('Сортировка').inputValue()) === 'newest' && (await titles(page)).length === 2, 'фильтры сохраняются в адресе после перезагрузки');

  // Пагинация
  await page.goto(`${BASE}/catalog?lang=${encodeURIComponent(normalizeText(langMany))}&sort=likes`);
  await page.getByText(`Урок ${tag} номер 13`).waitFor();
  assert((await titles(page)).length === 12, 'первая страница — 12 курсов');
  await page.getByRole('button', { name: 'Показать ещё' }).click();
  await page.getByText(`Урок ${tag} номер 1`, { exact: true }).waitFor();
  list = await titles(page);
  assert(list.length === 13 && new Set(list).size === 13, '«Показать ещё» догружает остальные без повторов');
  assert((await page.getByRole('button', { name: 'Показать ещё' }).count()) === 0, 'кнопка исчезает, когда курсов больше нет');

  await page.getByText(`Урок ${tag} номер 13`).click();
  await page.waitForURL('**/course/*');
  await page.getByRole('heading', { name: `Урок ${tag} номер 13` }).waitFor();
  assert(true, 'карточка ведёт на страницу курса');

  const errors = page.errors.filter((e) => !e.includes('favicon'));
  assert(errors.length === 0, `нет ошибок в консоли (${errors.join(' | ')})`);
} finally {
  await browser.close();
}
