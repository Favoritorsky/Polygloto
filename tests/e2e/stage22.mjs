// v2, этап 3: статистика ошибок по заданиям. Первая попытка читателя идёт
// в сумму, повторные — нет; автор видит только суммы и проценты.
import { BASE, assert, launch, newPage, register, uidOf, uniqueEmail } from './lib.mjs';
import { Timestamp, adminDb, seedPublishedCourse } from './seed.mjs';

const browser = await launch();
try {
  const author = await newPage(browser);
  const authorEmail = uniqueEmail('stats-author');
  await register(author, { name: 'Статистик', email: authorEmail });
  const authorId = await uidOf(authorEmail);

  const lessons = [
    {
      id: 'l1',
      title: 'Приветствия',
      blocks: [
        { type: 'paragraph', children: [{ text: 'Hola' }] },
        { type: 'task', id: 't_a', taskType: 'free_input', data: { question: 'Как сказать «привет»?', answers: ['hola'] } },
        { type: 'task', id: 't_b', taskType: 'free_input', data: { question: 'Как сказать «пока»?', answers: ['adiós'] } },
      ],
    },
  ];
  const courseId = await seedPublishedCourse({ title: `Статистика ${Date.now().toString(36)}`, authorId, authorName: 'Статистик', lessons });
  await adminDb.doc(`courses/${courseId}`).set({
    authorId,
    title: 'Статистика',
    language: 'Испанский',
    description: '',
    categories: [],
    lessonOrder: ['l1'],
    referenceOrder: [],
    status: 'published',
    rejectionReason: null,
    hasPublishedVersion: true,
    submittedAt: null,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  await adminDb.doc(`courses/${courseId}/lessons/l1`).set({ title: 'Приветствия', blocks: lessons[0].blocks, updatedAt: Timestamp.now() });
  // Второе задание уже решали 10 человек, 7 ошиблись.
  await adminDb.doc(`publicCourses/${courseId}/taskStats/l1_t_b`).set({ lessonId: 'l1', taskId: 't_b', attempts: 10, wrong: 7 });

  async function solve(page, answers) {
    await page.goto(`${BASE}/course/${courseId}`);
    const task = page.locator('form[aria-label^="Задание"]').first();
    for (const [i, value] of answers.entries()) {
      if (i > 0) await task.getByRole('button', { name: 'Ещё раз' }).click();
      await task.getByLabel('Ваш ответ').fill(value);
      await task.getByRole('button', { name: 'Проверить' }).click();
      await task.getByRole('status').waitFor();
    }
  }

  const r1 = await newPage(browser);
  const r1Email = uniqueEmail('stats-r1');
  await register(r1, { name: 'Читатель 1', email: r1Email });
  await solve(r1, ['hello', 'hola']);
  const r2 = await newPage(browser);
  await register(r2, { name: 'Читатель 2', email: uniqueEmail('stats-r2') });
  await solve(r2, ['Hola']);
  // Повторный заход первого читателя не считается.
  await solve(r1, ['hola']);
  const guest = await newPage(browser);
  await solve(guest, ['hola']);

  const waitStat = async (attempts) => {
    for (let i = 0; i < 20; i += 1) {
      const d = (await adminDb.doc(`publicCourses/${courseId}/taskStats/l1_t_a`).get()).data();
      if (d?.attempts === attempts) return d;
      await new Promise((r) => setTimeout(r, 250));
    }
    return (await adminDb.doc(`publicCourses/${courseId}/taskStats/l1_t_a`).get()).data();
  };
  const stat = await waitStat(2);
  assert(stat?.attempts === 2 && stat?.wrong === 1, `в сумме 2 первые попытки и 1 ошибка (${JSON.stringify(stat)})`);
  const marker = (await adminDb.doc(`users/${await uidOf(r1Email)}/taskResults/${courseId}_l1_t_a`).get()).data();
  assert(marker?.correct === false, 'у читателя хранится его первая попытка (неверная)');

  await author.goto(`${BASE}/courses/${courseId}/edit`);
  await author.getByRole('tab', { name: 'Статистика' }).click();
  const rowA = author.locator('tr', { hasText: 'Как сказать «привет»?' });
  await rowA.waitFor();
  assert((await rowA.locator('td').nth(1).innerText()) === '2', 'автор видит число ответивших');
  assert((await rowA.getByText('мало ответов').count()) === 1, 'при 2 ответах процент скрыт');
  const rowB = author.locator('tr', { hasText: 'Как сказать «пока»?' });
  assert((await rowB.getByText('70%').count()) === 1, 'при 10 ответах показан процент ошибок 70%');
  await author.getByRole('region', { name: 'Самые трудные задания' }).getByText('70% ошибок').waitFor();
  assert(true, 'блок «Самые трудные задания»');
  assert((await author.getByText('Читатель 1').count()) === 0, 'имён читателей нет');
} finally {
  await browser.close();
}
