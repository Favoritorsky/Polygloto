// Этап 11: профили — правка имени и «о себе», загрузка/смена/удаление аватара,
// статистика, бейджи, опубликованные курсы, просмотр чужого профиля.
import { getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { buildSearchKeywords, normalizeText } from '../../shared/schema.js';
import { BASE, assert, launch, newPage, register, uidOf, uniqueEmail } from './lib.mjs';

process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
const db = getFirestore(getApps()[0] ?? initializeApp({ projectId: 'demo-polygloto' }));
const fixtures = new URL('./fixtures/', import.meta.url).pathname;

async function avatarFiles(uid) {
  const res = await fetch(`http://127.0.0.1:9199/v0/b/demo-polygloto.appspot.com/o?prefix=${encodeURIComponent(`avatars/${uid}/`)}`, {
    headers: { Authorization: 'Bearer owner' },
  });
  return (await res.json()).items ?? [];
}

async function publish(authorId, title, likes, dislikes) {
  await db.collection('publicCourses').add({
    authorId, authorName: 'Профилист', title, language: 'Квенья', description: '', categories: [],
    lessonOrder: [], referenceOrder: [], toc: { lessons: [], reference: [] },
    titleLower: normalizeText(title), languageLower: 'квенья', searchKeywords: buildSearchKeywords(title, 'Квенья'),
    likesCount: likes, dislikesCount: dislikes, score: likes - dislikes, commentsCount: 0, lessonsCount: 1, wordsCount: 0,
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

  // Аватар
  await page.getByRole('button', { name: 'Редактировать профиль' }).click();
  await page.getByLabel('Файл фотографии').setInputFiles(`${fixtures}not-image.txt`);
  await page.getByText('Подходят только картинки').waitFor();
  assert(true, 'не картинка — понятная ошибка');
  await page.getByLabel('Файл фотографии').setInputFiles(`${fixtures}avatar-wide.png`);
  const img = page.locator('main img').first();
  await img.waitFor();
  await page.waitForFunction(() => document.querySelector('main img')?.naturalWidth > 0);
  const size = await img.evaluate((el) => [el.naturalWidth, el.naturalHeight]);
  assert(size[0] === 256 && size[1] === 256, `картинка 600×300 обрезана до квадрата 256×256 (${size.join('×')})`);
  assert((await img.getAttribute('src')).includes(`avatars%2F${uid}%2F`), 'файл лежит в папке пользователя');
  const first = await avatarFiles(uid);
  assert(first.length === 1 && first[0].name.endsWith('.jpg'), 'в хранилище один JPEG');

  await page.getByLabel('Файл фотографии').setInputFiles(`${fixtures}avatar-wide.png`);
  await page.waitForFunction((old) => document.querySelector('main img')?.src !== old, await img.getAttribute('src'));
  let files = [];
  for (let i = 0; i < 20; i += 1) {
    files = await avatarFiles(uid);
    if (files.length === 1 && files[0].name !== first[0].name) break;
    await page.waitForTimeout(250);
  }
  assert(files.length === 1 && files[0].name !== first[0].name, 'смена фото удаляет старый файл');

  await page.getByRole('button', { name: 'Удалить фото' }).click();
  await page.locator('main img').waitFor({ state: 'detached' });
  // Профиль обновляется раньше, чем удаляется файл: ждём и файл.
  for (let i = 0; i < 20 && (await avatarFiles(uid)).length > 0; i += 1) await page.waitForTimeout(250);
  assert((await avatarFiles(uid)).length === 0, 'удаление фото убирает файл из хранилища');
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
  await db.doc(`users/${uid}`).update({ commentsCount: 10 });
  await page.locator('li', { hasText: 'Собеседник' }).getByText('Получен').waitFor();
  assert(true, 'бейдж «Собеседник» появился сразу после 10-го комментария');
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
