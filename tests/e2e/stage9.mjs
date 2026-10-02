// Этап 9: публичная страница курса — чтение уроков и справочника, словарь,
// задания, оценки, реакции, комментарии. Опубликованный снимок создаётся
// напрямую в эмуляторе (сам процесс публикации проверен в stage8).
import { getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { BASE, assert, launch, newPage, register, uidOf, uniqueEmail } from './lib.mjs';

process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
const db = getFirestore(getApps()[0] ?? initializeApp({ projectId: 'demo-polygloto' }));

const para = (...children) => ({ type: 'paragraph', children });

async function seedPublishedCourse(authorId) {
  const ref = db.collection('publicCourses').doc();
  const now = FieldValue.serverTimestamp();
  await db.collection('courses').doc(ref.id).set({
    authorId, title: 'Эсперанто за неделю', language: 'Эсперанто', languageCategory: 'custom', languageId: null, description: '', categories: [],
    lessonOrder: ['l1', 'l2'], referenceOrder: ['r1'], status: 'published', hasPublishedVersion: true,
    createdAt: now, updatedAt: now,
  });
  await ref.set({
    authorId, authorName: 'Автор Эсперанто', title: 'Эсперанто за неделю', language: 'Эсперанто', languageCategory: 'custom', languageId: null,
    description: 'Короткий курс для начинающих.',
    categories: [{ id: 'verb', name: 'Глаголы', color: '#e76f51' }],
    lessonOrder: ['l1', 'l2'], referenceOrder: ['r1'],
    toc: { lessons: [{ id: 'l1', title: 'Приветствия' }, { id: 'l2', title: 'Числа' }], reference: [{ id: 'r1', title: 'Алфавит' }] },
    lessonsCount: 2, wordsCount: 1, likesCount: 0, dislikesCount: 0, score: 0,
    publishedAt: now, updatedAt: now,
  });
  await ref.collection('lessons').doc('l1').set({
    title: 'Приветствия',
    blocks: [
      para({ text: 'Mi ' }, { text: 'amas', category: 'verb' }, { text: ' vin.' }),
      {
        type: 'task', id: 't1', taskType: 'multiple_choice',
        data: { question: 'Что значит amas?', options: [{ id: 'a', text: 'люблю' }, { id: 'b', text: 'вижу' }], correctOptionId: 'a' },
      },
    ],
    updatedAt: now,
  });
  await ref.collection('lessons').doc('l2').set({ title: 'Числа', blocks: [para({ text: 'unu, du, tri' })], updatedAt: now });
  await ref.collection('reference').doc('r1').set({ title: 'Алфавит', blocks: [para({ text: 'Ĉ ĝ ĥ ĵ ŝ ŭ' })], updatedAt: now });
  await ref.collection('dictionary').doc('w1').set({
    word: 'amas', wordLower: 'amas', translation: 'люблю (наст. время)', partOfSpeech: 'verb',
    examples: ['Mi amas vin.'], notes: '', createdAt: now, updatedAt: now,
  });
  return ref.id;
}

const browser = await launch();
try {
  const author = await newPage(browser);
  const authorEmail = uniqueEmail('author9');
  await register(author, { name: 'Автор Эсперанто', email: authorEmail });
  const courseId = await seedPublishedCourse(await uidOf(authorEmail));
  const url = `${BASE}/course/${courseId}`;

  // Гость
  const guest = await newPage(browser);
  await guest.goto(url);
  await guest.getByRole('heading', { name: 'Эсперанто за неделю' }).waitFor();
  assert(true, 'гость видит опубликованный курс');
  assert(await guest.getByRole('button', { name: /Нравится/ }).isDisabled(), 'гость не может голосовать');
  await guest.getByText('чтобы оценить курс').waitFor();
  assert(await guest.getByRole('button', { name: /🔥/ }).count() === 0, 'гостю реакции не предлагаются');
  await guest.getByRole('tab', { name: 'Обсуждение' }).click();
  await guest.getByText('чтобы оставить комментарий').waitFor();
  assert(true, 'гостю предлагают войти, чтобы комментировать');
  await guest.goto(`${BASE}/course/nope-${Date.now()}`);
  await guest.getByText('Курс не найден или ещё не опубликован.').waitFor();
  assert(true, 'несуществующий курс — понятное сообщение');

  // Читатель
  const reader = await newPage(browser);
  await register(reader, { name: 'Читатель', email: uniqueEmail('reader9') });
  await reader.goto(url);

  const word = reader.locator('[role="button"]', { hasText: 'amas' }).first();
  await word.hover();
  await reader.getByRole('tooltip').getByText('люблю (наст. время)').waitFor();
  assert(true, 'слово из словаря подсвечено, при наведении — перевод');

  await reader.getByLabel('вижу').check();
  await reader.getByRole('button', { name: 'Проверить' }).click();
  await reader.getByText('✗ Пока неверно.').waitFor();
  await reader.getByRole('button', { name: 'Ещё раз' }).click();
  await reader.getByLabel('люблю', { exact: true }).check();
  await reader.getByRole('button', { name: 'Проверить' }).click();
  await reader.getByText('✓ Верно!').waitFor();
  assert(true, 'задание проверяется, можно пройти заново');

  await reader.getByRole('button', { name: '🔥 0' }).click();
  await reader.getByRole('button', { name: '🔥 1' }).waitFor();
  await reader.getByRole('button', { name: '❤️ 0' }).click();
  await reader.getByRole('button', { name: '❤️ 1' }).waitFor();
  assert(await reader.getByRole('button', { name: '🔥 0' }).count() === 1, 'реакция на урок одна: смена эмодзи заменяет прежнюю');

  await reader.getByRole('button', { name: /Нравится: 0/ }).click();
  await reader.getByRole('button', { name: 'Нравится: 1' }).waitFor({ timeout: 15000 });
  assert(true, 'лайк засчитан (счётчик обновлён транзакцией)');
  await reader.getByRole('button', { name: /Не нравится: 0/ }).click();
  await reader.getByRole('button', { name: 'Не нравится: 1' }).waitFor({ timeout: 15000 });
  await reader.getByRole('button', { name: 'Нравится: 0' }).waitFor({ timeout: 15000 });
  assert(true, 'смена голоса: лайк снят, дизлайк засчитан');

  await reader.getByRole('button', { name: /Числа →/ }).click();
  await reader.getByText('unu, du, tri').waitFor();
  assert(reader.url().includes('lesson=l2'), 'навигация «Далее» и ссылка на урок в адресе');
  await reader.getByRole('tab', { name: 'Справочник' }).click();
  await reader.getByText('Ĉ ĝ ĥ ĵ ŝ ŭ').waitFor();
  assert(true, 'справочник открывается');
  await reader.getByRole('tab', { name: 'Словарь' }).click();
  await reader.getByText('люблю (наст. время)').waitFor();
  assert(true, 'вкладка словаря показывает статьи');

  await reader.getByRole('tab', { name: 'Обсуждение' }).click();
  await reader.getByRole('button', { name: 'Отправить' }).click();
  await reader.getByText('Напишите что-нибудь.').waitFor();
  assert(true, 'пустой комментарий не отправляется');
  await reader.getByLabel('Комментарий').fill('Отличный курс, спасибо!');
  await reader.getByRole('button', { name: 'Отправить' }).click();
  await reader.getByText('Отличный курс, спасибо!').waitFor();
  assert(true, 'комментарий опубликован');
  await reader.getByLabel('Комментарий').fill('И ещё один');
  await reader.getByRole('button', { name: 'Отправить' }).click();
  await reader.getByText(/Слишком часто/).waitFor();
  assert(await reader.getByLabel('Комментарий').inputValue() === 'И ещё один', 'rate limit: понятная ошибка, текст не потерян');
  await reader.getByText('Комментариев: 1').waitFor();
  assert(true, 'счётчик комментариев в шапке обновился');

  // Автор курса: не голосует, модерирует обсуждение
  await author.goto(`${url}?tab=comments`);
  await author.getByText('Это ваш курс').waitFor();
  assert(await author.getByRole('button', { name: /Нравится/ }).isDisabled(), 'автор не может оценить свой курс');
  author.on('dialog', (d) => d.accept());
  await author.getByText('Отличный курс, спасибо!').waitFor();
  await author.getByRole('button', { name: 'Удалить' }).click();
  await author.getByText('Комментариев пока нет').waitFor();
  await author.getByText('Комментариев: 0').waitFor({ timeout: 15000 });
  assert(true, 'автор курса удалил комментарий, счётчик уменьшился');

  for (const page of [author, guest, reader]) {
    const errors = page.errors.filter((e) => !e.includes('favicon') && !e.includes('resource-exhausted') && !e.includes('429'));
    assert(errors.length === 0, `нет ошибок в консоли (${errors.join(' | ')})`);
  }
} finally {
  await browser.close();
}
