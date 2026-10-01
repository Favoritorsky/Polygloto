// v2, этап 4: очки, серия, задания дня, рейтинг, значки за пройденный курс.
import { BASE, assert, launch, newPage, register, uidOf, uniqueEmail } from './lib.mjs';
import { Timestamp, adminDb, seedPublishedCourse } from './seed.mjs';

const DAY = 86400000;
// Имена уникальны на каждый запуск: рейтинг в эмуляторе хранит прошлые прогоны.
const tag = Date.now().toString(36).slice(-5);
const CHAMP = `Чемпион ${tag}`;
const SECOND = `Второй ${tag}`;
const courseId = await seedPublishedCourse({
  title: `Очки ${Date.now().toString(36)}`,
  lessons: [
    {
      id: 'l1',
      title: 'Первый',
      blocks: [
        { type: 'paragraph', children: [{ text: 'Hola' }] },
        { type: 'task', id: 't1', taskType: 'free_input', data: { question: 'Привет?', answers: ['hola'] } },
      ],
    },
    { id: 'l2', title: 'Второй', blocks: [{ type: 'paragraph', children: [{ text: 'Adiós' }] }] },
  ],
  dictionary: [{ id: 'hola', word: 'hola', translation: 'привет' }],
});

const browser = await launch();
try {
  const page = await newPage(browser);
  const email = uniqueEmail('stage26');
  await register(page, { name: CHAMP, email });
  const uid = await uidOf(email);
  await page.getByLabel('Мой прогресс, серия: 0 дн.').waitFor();
  assert(true, 'в шапке серия 0 до первых занятий');

  // Задание: верно с первой попытки → +10, серия 1
  await page.goto(`${BASE}/course/${courseId}`);
  const task = page.locator('form[aria-label^="Задание"]');
  await task.getByLabel('Ваш ответ').fill('hola');
  await task.getByRole('button', { name: 'Проверить' }).click();
  await task.getByText('✓ Верно!').waitFor();
  await page.getByLabel('Мой прогресс, серия: 1 дн.').waitFor();
  assert(true, 'после задания серия в шапке стала 1');
  // Повторная попытка очков не даёт
  await task.getByRole('button', { name: 'Ещё раз' }).click();
  await task.getByLabel('Ваш ответ').fill('hola');
  await task.getByRole('button', { name: 'Проверить' }).click();

  // Оба урока пройдены → +40 и отметка «курс пройден»
  await page.getByRole('button', { name: 'Отметить урок пройденным' }).click();
  await page.getByText(/В повторение добавлено|Новых слов/).waitFor();
  await page.getByRole('button', { name: 'Второй →' }).click();
  await page.getByRole('button', { name: 'Отметить урок пройденным' }).click();
  await page.getByText(/В повторение добавлено|Новых слов/).waitFor();
  for (let i = 0; i < 20 && !(await adminDb.doc(`users/${uid}/completedCourses/${courseId}`).get()).exists; i += 1) {
    await new Promise((r) => setTimeout(r, 250));
  }
  assert((await adminDb.doc(`users/${uid}/completedCourses/${courseId}`).get()).exists, 'курс отмечен пройденным');

  // Повторение уже знакомой карточки → +2
  await adminDb.doc(`users/${uid}/srsCards/${courseId}_hola`).update({
    interval: 1,
    repetitions: 1,
    dueAt: Timestamp.fromMillis(Date.now() - 60000),
    lastReviewedAt: Timestamp.fromMillis(Date.now() - DAY),
  });
  await page.goto(`${BASE}/review`);
  await page.getByRole('button', { name: 'Показать ответ' }).click();
  await page.getByRole('button', { name: /^Вспомнил/ }).click();
  await page.getByText(/Готово! Повторено слов: 1/).waitFor();

  const stats = (await adminDb.doc(`userStats/${uid}`).get()).data();
  assert(stats.points === 52, `очки: 10 + 20 + 20 + 2 = 52 (${stats.points})`);
  assert(stats.tasksCount === 1 && stats.lessonsCount === 2 && stats.reviewsCount === 1, 'счётчики: 1 задание, 2 урока, 1 слово');

  // Страница прогресса
  await page.getByRole('link', { name: 'Мой прогресс, серия: 1 дн.' }).click();
  await page.waitForURL('**/progress');
  await page.getByRole('heading', { name: 'Мой прогресс' }).waitFor();
  const totals = page.getByRole('region', { name: 'Итоги' });
  await totals.getByText('Всего: 52').waitFor();
  assert((await totals.getByText('🔥 1').count()) === 1, 'прогресс: серия 1');
  const quests = page.getByRole('region', { name: 'Задания дня' });
  assert((await quests.locator('li').count()) === 3, 'три задания дня');
  const reviewQuest = quests.locator('li', { hasText: 'Повторите' });
  assert((await reviewQuest.innerText()).includes('1/'), 'прогресс задания дня по повторению: 1');

  // Рейтинг: второй участник с меньшими очками ниже
  const other = await newPage(browser);
  await register(other, { name: SECOND, email: uniqueEmail('stage26b') });
  await other.goto(`${BASE}/course/${courseId}`);
  const t2 = other.locator('form[aria-label^="Задание"]');
  await t2.getByLabel('Ваш ответ').fill('nope');
  await t2.getByRole('button', { name: 'Проверить' }).click();
  await t2.getByText('✗ Пока неверно.').waitFor();
  await other.getByLabel('Мой прогресс, серия: 1 дн.').waitFor();
  await other.goto(`${BASE}/leaderboard`);
  const rows = other.locator('ol li');
  await rows.first().waitFor();
  const texts = await rows.allInnerTexts();
  const champ = texts.findIndex((t) => t.includes(CHAMP));
  const second = texts.findIndex((t) => t.includes(SECOND));
  assert(champ >= 0 && second > champ, `в рейтинге недели Чемпион выше Второго (${champ}, ${second})`);
  assert(texts[second].includes('(вы)') && texts[second].trim().endsWith('2'), 'своя строка отмечена, у второго 2 очка');
  await other.getByRole('tab', { name: 'За всё время' }).click();
  await other.locator('ol li', { hasText: CHAMP }).waitFor();
  assert(true, 'рейтинг за всё время');

  // Профиль: значок «Выпускник», серия и очки
  await page.goto(`${BASE}/users/${uid}`);
  const badge = page.locator('li', { hasText: 'Выпускник' });
  await badge.getByText('Получен').waitFor();
  assert(true, 'значок «Выпускник» получен');
  const profileStats = page.getByRole('region', { name: 'Статистика' });
  await profileStats.getByText('52').waitFor();
  assert((await page.locator('li', { hasText: 'Неделя подряд' }).getByText('Получен').count()) === 0, 'значок серии 7 ещё не получен');
} finally {
  await browser.close();
}
