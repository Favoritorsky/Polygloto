// Правки 3, задача 7: плитки курсов кликабельны целиком. Один сценарий на общий
// компонент (CardLink + CardLink.module.css) во всех местах, где он используется:
// клик по пустому месту плитки (не по заголовку) открывает нужную страницу,
// а ссылки и кнопки поверх плитки ведут туда, куда должны.
import { BASE, assert, launch, register, setRole, uidOf, uniqueEmail } from './lib.mjs';
import { FieldValue, Timestamp, adminDb, seedPublishedCourse } from './seed.mjs';

const tag = Date.now().toString(36);
const authorId = `stage33-author-${tag}`;
await adminDb
  .collection('users')
  .doc(authorId)
  .set({ displayName: `Автор плиток ${tag}`, role: 'user', createdAt: Timestamp.now() });
const publishedTitle = `Плиточный курс ${tag}`;
const publishedId = await seedPublishedCourse({ title: publishedTitle, authorId, authorName: `Автор плиток ${tag}` });

const browser = await launch();
try {
  const email = uniqueEmail('stage33');
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'ru-RU' });
  const page = await context.newPage();
  await register(page, { name: `Модератор ${tag}`, email });
  const uid = await uidOf(email);
  await setRole(uid, 'admin');
  await adminDb.collection('follows').doc(`${uid}_${authorId}`).set({ followerId: uid, authorId, createdAt: FieldValue.serverTimestamp() });
  const draftTitle = `Плитка на проверке ${tag}`;
  const draft = adminDb.collection('courses').doc();
  await draft.set({
    authorId: uid,
    title: draftTitle,
    language: 'Испанский',
    description: '',
    categories: [],
    lessonOrder: [],
    referenceOrder: [],
    status: 'pending_review',
    rejectionReason: null,
    hasPublishedVersion: false,
    submittedAt: Timestamp.now(),
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  /** Кликает мышью в точку внутри плитки с заголовком title, но не на заголовок. */
  async function clickTileBody(tileSelector, title, innerSelector) {
    const tileEl = page.locator(tileSelector).filter({ hasText: title }).first();
    await tileEl.waitFor();
    const inner = tileEl.locator(innerSelector).first();
    await inner.scrollIntoViewIfNeeded();
    const box = await inner.boundingBox();
    await page.mouse.click(box.x + Math.min(4, box.width / 2), box.y + box.height / 2);
  }

  async function check(label, path, tileSelector, title, innerSelector, expected) {
    await page.goto(`${BASE}${path}`);
    await clickTileBody(tileSelector, title, innerSelector);
    await page.waitForURL(`**${expected}`, { timeout: 5000 });
    assert(true, `${label}: клик по плитке открывает ${expected}`);
  }

  // Карточка курса (CourseCard) — каталог, лента, профиль автора.
  await page.goto(`${BASE}/catalog`);
  await page.getByPlaceholder('Поиск по названию или языку').fill(publishedTitle);
  await clickTileBody('article', publishedTitle, 'p >> nth=-1');
  await page.waitForURL(`**/course/${publishedId}`, { timeout: 5000 });
  assert(true, 'каталог: клик по описанию карточки открывает курс');
  await check('лента', '/feed', 'article', publishedTitle, 'ul li >> nth=-1', `/course/${publishedId}`);
  await check('профиль автора', `/users/${authorId}`, 'article', publishedTitle, 'ul li >> nth=-1', `/course/${publishedId}`);

  // Списки-плитки: «Мои курсы» и модерация.
  await check('мои курсы', '/my-courses', 'li', draftTitle, 'span >> nth=-1', `/courses/${draft.id}/edit`);
  await check('модерация: очередь', '/admin', 'li', draftTitle, 'span >> nth=-1', `/admin/review/${draft.id}`);

  await page.goto(`${BASE}/admin`);
  await page.getByRole('tab', { name: 'Все курсы' }).click();
  await clickTileBody('li', draftTitle, 'span');
  await page.waitForURL(`**/courses/${draft.id}/edit`, { timeout: 5000 });
  assert(true, 'модерация, все курсы: клик по плитке открывает редактор');

  // Ссылки поверх плитки ведут по своему адресу, а не в редактор.
  await page.goto(`${BASE}/admin`);
  await page.getByRole('tab', { name: 'Все курсы' }).click();
  await page.locator('li').filter({ hasText: draftTitle }).getByRole('link', { name: 'Автор' }).click();
  await page.waitForURL(`**/users/${uid}`, { timeout: 5000 });
  assert(true, 'модерация, все курсы: ссылка «Автор» поверх плитки ведёт в профиль');

  await page.goto(`${BASE}/admin`);
  await page.getByRole('tab', { name: 'Пользователи' }).click();
  await page.getByLabel('Поиск пользователя').fill(`Модератор ${tag}`);
  await clickTileBody('li', `Модератор ${tag}`, 'span');
  await page.waitForURL(`**/users/${uid}`, { timeout: 5000 });
  assert(true, 'модерация, пользователи: клик по плитке открывает профиль');

  // Клавиатура: Tab до ссылки плитки и Space.
  await page.goto(`${BASE}/admin`);
  const link = page.locator('li').filter({ hasText: draftTitle }).getByRole('link', { name: draftTitle });
  await link.focus();
  await page.keyboard.press('Space');
  await page.waitForURL(`**/admin/review/${draft.id}`, { timeout: 5000 });
  assert(true, 'плитка открывается с клавиатуры (Space)');
} finally {
  await browser.close();
}
console.log('stage33 OK');
