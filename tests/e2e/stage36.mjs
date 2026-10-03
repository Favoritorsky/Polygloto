// Метка у «Модерации»: админ сразу видит, что появились курсы на проверке.
import { BASE, assert, launch, newPage, register, setRole, uidOf, uniqueEmail } from './lib.mjs';
import { Timestamp, adminDb } from './seed.mjs';

const pendingCount = async () => (await adminDb.collection('courses').where('status', '==', 'pending_review').get()).size;
const browser = await launch();
try {
  const page = await newPage(browser);
  const email = uniqueEmail('stage36');
  await register(page, { name: 'Модератор', email });
  await setRole(await uidOf(email), 'admin');
  await page.goto(`${BASE}/catalog`);
  const link = page.getByRole('navigation', { name: 'Основная навигация' }).getByRole('link', { name: /Модерация/ });
  await link.waitFor();

  const before = await pendingCount();
  const ref = adminDb.collection('courses').doc();
  await ref.set({
    authorId: 'seed', title: `На проверку ${Date.now()}`, language: 'Эльфийский', languageCategory: 'custom', languageId: null,
    description: '', categories: [], lessonOrder: [], referenceOrder: [], status: 'pending_review', rejectionReason: null,
    hasPublishedVersion: false, submittedAt: Timestamp.now(), createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
  });
  const n = before + 1;
  await link.getByLabel(`на проверке: ${n}`).waitFor();
  assert(true, 'новая заявка появляется у «Модерации» без перезагрузки');
  await page.waitForFunction((t) => document.title.startsWith(t), `(${n}) `);
  assert(true, 'число заявок видно в заголовке вкладки');

  await page.goto(`${BASE}/admin`);
  await page.getByRole('tab', { name: `Очередь модерации (${n})` }).waitFor();
  assert(true, 'число заявок на вкладке очереди');

  await ref.update({ status: 'draft' });
  if (before === 0) {
    await link.locator('span').waitFor({ state: 'detached' });
    await page.waitForFunction(() => !/^\(\d+\+?\) /.test(document.title));
  } else await link.getByLabel(`на проверке: ${before}`).waitFor();
  assert(true, 'после проверки метка уменьшается или исчезает');

  const user = await newPage(browser);
  await register(user, { name: 'Обычный', email: uniqueEmail('stage36u') });
  assert((await user.getByRole('link', { name: /Модерация/ }).count()) === 0, 'обычный пользователь метку не видит');
} finally {
  await browser.close();
}
