// v2, этап 5: комментарии к отдельным урокам — у каждого урока своё обсуждение.
import { BASE, assert, launch, newPage, register, uniqueEmail } from './lib.mjs';
import { seedPublishedCourse } from './seed.mjs';

const courseId = await seedPublishedCourse({
  title: `Обсуждение уроков ${Date.now().toString(36)}`,
  lessons: [
    { id: 'l1', title: 'Первый', blocks: [{ type: 'paragraph', children: [{ text: 'Hola' }] }] },
    { id: 'l2', title: 'Второй', blocks: [{ type: 'paragraph', children: [{ text: 'Adiós' }] }] },
  ],
});

const browser = await launch();
try {
  const page = await newPage(browser);
  await page.goto(`${BASE}/course/${courseId}`);
  await page.getByText('💬 Обсуждение урока').click();
  const discussion = page.getByRole('region', { name: 'Обсуждение урока' });
  await discussion.getByText('Вопросов по уроку пока нет.').waitFor();
  await discussion.getByRole('link', { name: 'Войдите' }).waitFor();
  assert(true, 'гость видит пустое обсуждение урока и приглашение войти');

  await register(page, { name: 'Ученик Вася', email: uniqueEmail('stage30') });
  await page.goto(`${BASE}/course/${courseId}`);
  await page.getByText('💬 Обсуждение урока').click();
  await discussion.getByLabel('Комментарий к уроку').fill('Почему hola без ударения?');
  await discussion.getByRole('button', { name: 'Отправить' }).click();
  await discussion.getByText('Почему hola без ударения?').waitFor();
  await discussion.getByText('Комментариев: 1').waitFor();
  assert(true, 'комментарий к уроку опубликован');

  await discussion.getByRole('button', { name: '👍 0' }).click();
  await discussion.getByRole('button', { name: '👍 1' }).waitFor();
  assert(true, 'реакция на комментарий к уроку');

  await page.getByRole('button', { name: 'Второй →' }).click();
  await page.getByText('Adiós').waitFor();
  await page.getByText('💬 Обсуждение урока').click();
  await discussion.getByText('Вопросов по уроку пока нет.').waitFor();
  assert(true, 'у второго урока своё (пустое) обсуждение');

  await page.getByRole('tab', { name: 'Обсуждение' }).click();
  await page.getByText('Комментариев пока нет — будьте первым.').waitFor();
  assert(true, 'комментарий к уроку не попал в обсуждение курса');

  await page.goto(`${BASE}/course/${courseId}`);
  await page.getByText('💬 Обсуждение урока').click();
  page.once('dialog', (d) => d.accept());
  await discussion.getByRole('button', { name: 'Удалить' }).click();
  await discussion.getByText('Вопросов по уроку пока нет.').waitFor();
  assert(true, 'свой комментарий к уроку можно удалить');
} finally {
  await browser.close();
}
console.log('stage30 OK');
