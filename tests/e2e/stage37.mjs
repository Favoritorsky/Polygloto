// Чаты языков и «Отозвать» в модерации: ссылка на чат со страницы курса, сообщение,
// список чатов; админ снимает курс с публикации — у автора он остаётся черновиком.
import { BASE, assert, launch, newPage, register, setRole, uidOf, uniqueEmail } from './lib.mjs';
import { Timestamp, adminDb, seedPublishedCourse } from './seed.mjs';

const language = `Аркавок ${Date.now()}`;
const languageLower = language.toLowerCase();
const browser = await launch();
try {
  // Автор и его опубликованный курс (рабочая версия + снимок, как после одобрения).
  const author = await newPage(browser);
  const authorEmail = uniqueEmail('stage37a');
  await register(author, { name: 'Автор чата', email: authorEmail });
  const authorId = await uidOf(authorEmail);
  const courseId = await seedPublishedCourse({
    title: `Курс для чата ${Date.now()}`,
    language,
    authorId,
    authorName: 'Автор чата',
    lessons: [{ id: 'l1', title: 'Урок 1', blocks: [] }],
    extra: { likesCount: 2, dislikesCount: 1, score: 1 },
  });
  await adminDb.collection('courses').doc(courseId).set({
    authorId, title: 'Курс для чата', language, languageCategory: 'custom', languageId: null, description: '', categories: [],
    lessonOrder: ['l1'], referenceOrder: [], status: 'published', rejectionReason: null, hasPublishedVersion: true,
    submittedAt: Timestamp.now(), createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
  });
  const metaRef = adminDb.collection('catalogMeta').doc('languages');
  const meta = (await metaRef.get()).data()?.items ?? [];
  await metaRef.set({ items: [...meta, { key: languageLower, name: language, count: 1 }] });

  // Читатель: со страницы курса — в чат языка, пишет сообщение.
  const reader = await newPage(browser);
  await register(reader, { name: 'Читатель', email: uniqueEmail('stage37r') });
  await reader.goto(`${BASE}/course/${courseId}`);
  await reader.getByRole('link', { name: `💬 Чат языка «${language}»` }).click();
  await reader.getByRole('heading', { name: `💬 ${language}` }).waitFor();
  assert(reader.url().includes(`course=${courseId}`), 'ссылка со страницы курса ведёт в чат его языка');
  await reader.getByText('Сообщений пока нет').waitFor();
  await reader.getByLabel('Сообщение').fill('Авэ, ди аркана!');
  await reader.getByRole('button', { name: 'Отправить' }).click();
  await reader.getByText('Авэ, ди аркана!').waitFor();
  assert(true, 'сообщение появляется в чате');
  const chatId = `lang-${languageLower}`;
  let stored;
  for (let i = 0; i < 40; i += 1) {
    stored = await adminDb.collection('languageChats').doc(chatId).collection('messages').get();
    if (stored.size > 0) break;
    await new Promise((r) => setTimeout(r, 250));
  }
  if (stored.size === 0) console.log('  ошибки страницы:', reader.errors);
  assert(stored.size === 1 && stored.docs[0].data().courseId === courseId, 'сообщение сохранено в комнате языка');

  // Слишком часто — понятная ошибка.
  await reader.getByLabel('Сообщение').fill('Ещё раз');
  await reader.getByRole('button', { name: 'Отправить' }).click();
  await reader.getByText(/Слишком часто/).waitFor();
  assert(true, 'лимит частоты — понятное сообщение');

  // Список чатов.
  await reader.goto(`${BASE}/chats`);
  await reader.getByRole('link', { name: `💬 ${language}` }).waitFor();
  assert(true, 'язык есть в списке «Чаты языков»');
  await reader.getByRole('navigation', { name: 'Основная навигация' }).getByRole('link', { name: 'Чаты' }).waitFor();
  assert(true, 'пункт «Чаты» в шапке');

  // Админ отзывает курс.
  const admin = await newPage(browser);
  const adminEmail = uniqueEmail('stage37m');
  await register(admin, { name: 'Модератор чата', email: adminEmail });
  await setRole(await uidOf(adminEmail), 'admin');
  await admin.goto(`${BASE}/admin`);
  await admin.getByRole('tab', { name: 'Все курсы' }).click();
  const row = admin.getByRole('listitem').filter({ hasText: 'Курс для чата' }).filter({ hasText: language });
  admin.once('dialog', (d) => d.accept());
  await row.getByRole('button', { name: 'Отозвать' }).click();
  await row.getByRole('button', { name: 'Отозвать' }).waitFor({ state: 'detached', timeout: 15000 });
  assert(!(await adminDb.collection('publicCourses').doc(courseId).get()).exists, 'снимок удалён — курса нет в общем доступе');
  const course = (await adminDb.collection('courses').doc(courseId).get()).data();
  assert(course.status === 'draft' && course.hasPublishedVersion === false, 'курс остался у автора черновиком');
  const items = (await metaRef.get()).data().items;
  assert(!items.some((i) => i.key === languageLower), 'язык убран из фильтра каталога');
  const saved = (await adminDb.collection('catalogMeta').doc(`withdrawn-${courseId}`).get()).data();
  assert(saved.likesCount === 2 && saved.dislikesCount === 1, 'оценки сохранены до повторной публикации');

  await author.goto(`${BASE}/my-courses`);
  await author.getByText('Курс для чата').first().waitFor();
  assert(true, 'автор видит курс в «Моих курсах»');

  await reader.goto(`${BASE}/course/${courseId}`);
  await reader.getByRole('heading', { name: 'Курс не найден' }).waitFor();
  assert(true, 'читатель больше не видит курс');

  await reader.goto(`${BASE}/chats/${encodeURIComponent(languageLower)}`);
  await reader.getByText('писать в чат нельзя').waitFor();
  assert(true, 'без опубликованных курсов чат только для чтения');

  // Повторная публикация: оценки возвращаются, отметка об отзыве удаляется.
  await adminDb.collection('courses').doc(courseId).update({ status: 'pending_review', submittedAt: Timestamp.now() });
  await adminDb.collection('courses').doc(courseId).collection('lessons').doc('l1').set({ title: 'Урок 1', blocks: [], updatedAt: Timestamp.now() });
  await admin.goto(`${BASE}/admin/review/${courseId}`);
  admin.once('dialog', (d) => d.accept());
  await admin.getByRole('button', { name: 'Одобрить и опубликовать' }).click();
  let republished;
  for (let i = 0; i < 60; i += 1) {
    republished = await adminDb.collection('publicCourses').doc(courseId).get();
    if (republished.exists && republished.data().approvedAt) break;
    await new Promise((r) => setTimeout(r, 250));
  }
  const pub = republished.data();
  assert(pub.likesCount === 2 && pub.dislikesCount === 1 && pub.score === 1, 'после повторной публикации оценки на месте');
  assert(!(await adminDb.collection('catalogMeta').doc(`withdrawn-${courseId}`).get()).exists, 'отметка об отзыве убрана');

  for (const p of [author, reader, admin]) {
    const errors = p.errors.filter((e) => !/Слишком часто|permission|Failed to load resource/i.test(e));
    assert(errors.length === 0, `нет ошибок в консоли (${errors.join(' | ') || 'пусто'})`);
  }
} finally {
  await browser.close();
}
