// v2, этап 5: подписка на автора из профиля и лента его новых курсов.
import { BASE, assert, launch, newPage, register, uniqueEmail } from './lib.mjs';
import { FieldValue, adminDb, seedPublishedCourse } from './seed.mjs';

const authorId = `author_${Date.now().toString(36)}`;
await adminDb
  .doc(`users/${authorId}`)
  .set({ displayName: 'Автор ленты', bio: '', photoURL: null, role: 'user', createdAt: FieldValue.serverTimestamp() });
const title = `Курс в ленте ${Date.now().toString(36)}`;
await seedPublishedCourse({ title, authorId, authorName: 'Автор ленты', lessons: [{ id: 'l1', title: 'Урок', blocks: [] }] });

const browser = await launch();
try {
  const page = await newPage(browser);
  await page.goto(`${BASE}/users/${authorId}`);
  await page.getByText('0 подписчиков').waitFor();
  await page.getByRole('link', { name: 'Войдите, чтобы подписаться' }).waitFor();
  assert(true, 'гость видит число подписчиков и приглашение войти');

  await register(page, { name: 'Читатель', email: uniqueEmail('stage28') });
  await page.getByRole('link', { name: 'Лента' }).click();
  await page.getByText(/Вы пока ни на кого не подписаны/).waitFor();
  assert(true, 'пустая лента без подписок');

  await page.goto(`${BASE}/users/${authorId}`);
  await page.getByRole('button', { name: '+ Подписаться' }).click();
  await page.getByRole('button', { name: '✓ Вы подписаны' }).waitFor();
  await page.getByText('1 подписчик', { exact: true }).waitFor();
  assert(true, 'подписка из профиля, счётчик вырос');

  await page.getByRole('link', { name: 'Лента' }).click();
  await page.getByText(title).waitFor();
  await page.getByRole('link', { name: 'Автор ленты' }).first().waitFor();
  assert(true, 'в ленте курс автора');

  await page.goto(`${BASE}/users/${authorId}`);
  await page.getByRole('button', { name: '✓ Вы подписаны' }).click();
  await page.getByRole('button', { name: '+ Подписаться' }).waitFor();
  await page.getByText('0 подписчиков').waitFor();
  await page.getByRole('link', { name: 'Лента' }).click();
  await page.getByText(/Вы пока ни на кого не подписаны/).waitFor();
  assert(true, 'отписка — лента снова пустая');

  const own = await newPage(browser);
  await own.goto(`${BASE}/users/${authorId}`);
  assert((await own.getByRole('button', { name: /Подписаться/ }).count()) === 0, 'гостю кнопка подписки не показывается');
} finally {
  await browser.close();
}
console.log('stage28 OK');
