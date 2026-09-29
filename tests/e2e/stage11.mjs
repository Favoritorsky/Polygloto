// Этап 11: профили — правка имени и «о себе», загрузка/смена/удаление аватара,
// статистика, бейджи, опубликованные курсы, просмотр чужого профиля.
import { getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { buildSearchKeywords, normalizeText } from '../../shared/schema.js';
import { BASE, assert, launch, newPage, register, uidOf, uniqueEmail } from './lib.mjs';

process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
const db = getFirestore(getApps()[0] ?? initializeApp({ projectId: 'demo-polygloto' }));
const fixtures = new URL('./fixtures/', import.meta.url).pathname;

async function publish(authorId, title, likes, dislikes) {
  await db.collection('publicCourses').add({
    authorId, authorName: 'Профилист', title, language: 'Квенья', description: '', categories: [],
    lessonOrder: [], referenceOrder: [], toc: { lessons: [], reference: [] },
    titleLower: normalizeText(title), languageLower: 'квенья', searchKeywords: buildSearchKeywords(title, 'Квенья'),
    likesCount: likes, dislikesCount: dislikes, score: likes - dislikes, lessonsCount: 1, wordsCount: 0,
    publishedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
  });
}

const browser = await launch();
try {
  const page = await newPage(browser);
  const email = uniqueEmail('profile11');
  await register(page, { name: 'Профилист', email });
  const uid = await uidOf(email);

  await page.getByRole('link', { name: /Профилист/ }).click();
  await page.waitForURL(`**/users/${uid}`);
  await page.getByRole('heading', { name: 'Профилист' }).waitFor();
  assert(await page.getByText('пока без оценок').isVisible(), 'новый профиль: без оценок');
  assert((await page.getByText('Опубликовать первый курс').count()) === 1, 'бейджи не получены, но видно, как их получить');
  await page.getByText('У вас пока нет опубликованных курсов.').waitFor();

  // Имя и «о себе»
  await page.getByRole('button', { name: 'Редактировать профиль' }).click();
  await page.getByLabel('Отображаемое имя').fill('Я');
  await page.getByRole('button', { name: 'Сохранить' }).click();
  await page.getByText('Имя: от 2 до 40 символов.').waitFor();
  assert(true, 'слишком короткое имя — ошибка валидации');
  await page.getByLabel('Отображаемое имя').fill('  Элронд  ');
  await page.getByLabel('О себе').fill('Придумываю языки.\nИзучаю квенья.');
  await page.getByRole('button', { name: 'Сохранить' }).click();
  await page.getByRole('heading', { name: 'Элронд' }).waitFor();
  assert(await page.getByText('Изучаю квенья.').isVisible(), 'имя (без пробелов по краям) и «о себе» сохранены');
  await page.locator('header').getByText('Элронд').waitFor();
  assert(true, 'имя в шапке сайта обновилось');

  // Аватар: хранится в профиле сжатым JPEG (data URL), без Storage.
  await page.getByRole('button', { name: 'Редактировать профиль' }).click();
  await page.getByLabel('Файл фотографии').setInputFiles(`${fixtures}not-image.txt`);
  await page.getByText('Подходят только картинки').waitFor();
  assert(true, 'не картинка — понятная ошибка');
  await page.getByLabel('Файл фотографии').setInputFiles(`${fixtures}avatar-wide.png`);
  const img = page.locator('main img').first();
  await img.waitFor();
  await page.waitForFunction(() => document.querySelector('main img')?.naturalWidth > 0);
  const size = await img.evaluate((el) => [el.naturalWidth, el.naturalHeight]);
  assert(size[0] === 160 && size[1] === 160, `картинка 600×300 обрезана до квадрата 160×160 (${size.join('×')})`);
  const stored = (await db.doc(`users/${uid}`).get()).data().photoURL;
  assert(stored.startsWith('data:image/jpeg;base64,') && stored.length <= 40000, `в профиле JPEG ${stored.length} символов`);

  await page.getByRole('button', { name: 'Удалить фото' }).click();
  await page.locator('main img').waitFor({ state: 'detached' });
  assert((await db.doc(`users/${uid}`).get()).data().photoURL === null, 'удаление фото очищает профиль');
  await page.getByLabel('Файл фотографии').setInputFiles(`${fixtures}avatar-wide.png`);
  await page.locator('main img').first().waitFor();
  await page.getByRole('button', { name: 'Отмена' }).click();

  // Статистика и бейджи из серверных данных
  await publish(uid, 'Квенья для начинающих', 20, 5);
  await publish(uid, 'Синдарин', 10, 0);
  await page.getByText('Синдарин').waitFor();
  const stats = await page.getByLabel('Статистика').innerText();
  assert(/2\s*курса/.test(stats) && /30\s*лайков/.test(stats) && /86%/.test(stats), `статистика: ${stats.replace(/\s+/g, ' ')}`);
  const earned = async () => page.locator('li', { hasText: 'Получен' }).allInnerTexts();
  assert((await earned()).length === 2, 'бейджи «Автор» и «Любимец публики» получены');
  // 10 комментариев в разных курсах (число считается запросом count() по комментариям).
  const courseIds = (await db.collection('publicCourses').where('authorId', '==', uid).get()).docs.map((d) => d.id);
  for (let i = 0; i < 10; i += 1) {
    const courseId = courseIds[i % courseIds.length];
    const ref = await db.collection(`courses/${courseId}/comments`).add({ authorId: uid, authorName: 'Элронд', text: `Комментарий ${i}`, createdAt: FieldValue.serverTimestamp() });
    await db.doc(`commentAuthors/${ref.id}`).set({ authorId: uid, courseId });
  }
  await page.reload();
  await page.locator('li', { hasText: 'Собеседник' }).getByText('Получен').waitFor();
  assert(/10\s*комментариев/.test(await page.getByLabel('Статистика').innerText()), 'бейдж «Собеседник» после 10 комментариев, число в статистике');
  const cards = await page.locator('article h3').allInnerTexts();
  assert(cards[0] === 'Квенья для начинающих', 'курсы автора — лучшие сверху');

  // Чужой профиль
  const guest = await newPage(browser);
  await guest.goto(`${BASE}/users/${uid}`);
  await guest.getByRole('heading', { name: 'Элронд' }).waitFor();
  assert((await guest.getByRole('button', { name: 'Редактировать профиль' }).count()) === 0, 'гость не видит кнопку правки');
  assert(await guest.locator('main img').first().isVisible(), 'гость видит фото');
  await guest.goto(`${BASE}/users/nobody-${Date.now()}`);
  await guest.getByText('Пользователь не найден').waitFor();
  assert(true, 'несуществующий профиль — понятное сообщение');

  for (const p of [page, guest]) {
    const errors = p.errors.filter((e) => !e.includes('favicon'));
    assert(errors.length === 0, `нет ошибок в консоли (${errors.join(' | ')})`);
  }
} finally {
  await browser.close();
}
