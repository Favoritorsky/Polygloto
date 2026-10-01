// Этап 12 (+ правки 3, задача 9): главная — объяснение, урок-превью по французской фонетике с оценкой и реакциями, путь автора, витрина курсов.
import { BASE, assert, launch, newPage, register, uniqueEmail } from './lib.mjs';

const shots = process.env.E2E_SCREENSHOTS;

const browser = await launch();
try {
  const page = await newPage(browser);
  await page.goto(BASE);
  await page.getByRole('heading', { level: 1 }).waitFor();
  for (const title of [
    'Попробуйте прямо здесь',
    'Для кого Polygloto',
    'Чем это лучше самоучителя в PDF',
    'Как стать автором',
    'Курсы в каталоге',
  ]) {
    assert(await page.getByRole('heading', { name: title }).isVisible(), `раздел «${title}»`);
  }

  // Урок-превью по французской фонетике работает без входа на тех же компонентах, что и настоящие курсы.
  await page.getByRole('link', { name: 'Пройти урок-превью' }).click();
  await page.waitForURL('**/#preview');
  const lesson = page.getByRole('article', { name: /Как читать по-французски/ });
  await lesson.locator('[role="button"]', { hasText: 'chocolat' }).first().hover();
  await page.getByRole('tooltip').getByText('шоколад').waitFor();
  assert(true, 'превью: перевод слова по наведению');
  await lesson.getByLabel('[ша]').check();
  await lesson.getByRole('button', { name: 'Проверить' }).first().click();
  await lesson.getByText('✓ Верно!').first().waitFor();
  assert(true, 'превью: задание проверяется');
  await lesson.getByRole('button', { name: 'Нравится: 0', exact: true }).click();
  await lesson.getByRole('button', { name: 'Нравится: 1', exact: true }).waitFor();
  await lesson.getByRole('button', { name: 'Не нравится: 0', exact: true }).click();
  await lesson.getByRole('button', { name: 'Не нравится: 1', exact: true }).waitFor();
  assert(await lesson.getByRole('button', { name: 'Нравится: 0', exact: true }).isVisible(), 'превью: оценка переключается без регистрации');
  await lesson.getByRole('button', { name: '🔥 0', exact: true }).click();
  await lesson.getByRole('button', { name: '🔥 1', exact: true }).waitFor();
  await page.reload();
  await lesson.getByRole('button', { name: '🔥 1', exact: true }).waitFor();
  assert(await lesson.getByRole('button', { name: 'Не нравится: 1', exact: true }).isVisible(), 'превью: оценка и реакция запоминаются в браузере');
  await lesson.getByRole('button', { name: '🔥 1', exact: true }).click();
  await lesson.getByRole('button', { name: '🔥 0', exact: true }).waitFor();
  assert(true, 'превью: реакция снимается повторным нажатием');
  await page.getByRole('link', { name: 'Открыть демо-курс испанского' }).click();
  await page.waitForURL('**/demo');
  assert(true, 'испанский демо-курс остаётся доступен');
  await page.goto(BASE);
  await page.getByRole('heading', { level: 1 }).waitFor();

  await page
    .locator('section', { has: page.getByRole('heading', { name: 'Курсы в каталоге' }) })
    .locator('article')
    .first()
    .waitFor();
  const cards = await page
    .locator('section', { has: page.getByRole('heading', { name: 'Курсы в каталоге' }) })
    .locator('article')
    .count();
  assert(cards > 0 && cards <= 6, `витрина показывает до 6 курсов (${cards})`);
  if (shots) await page.screenshot({ path: `${shots}/home-desktop.png`, fullPage: true });

  await page.getByRole('link', { name: 'Стать автором' }).first().click();
  await page.waitForURL('**/register');
  assert(true, 'гостя «Стать автором» ведёт на регистрацию');

  // Вошедшему пользователю — «Создать курс».
  await register(page, { name: 'Гость главной', email: uniqueEmail('home12') });
  await page.goto(BASE);
  await page.getByRole('link', { name: 'Создать курс' }).first().click();
  await page.waitForURL('**/my-courses');
  assert(true, 'вошедшего «Создать курс» ведёт к его курсам');

  // Телефон: без горизонтальной прокрутки.
  const mobile = await browser.newPage({ viewport: { width: 375, height: 800 } });
  await mobile.goto(BASE);
  await mobile.getByRole('heading', { name: 'Курсы в каталоге' }).waitFor();
  const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert(overflow <= 0, `на ширине 375px нет горизонтальной прокрутки (${overflow}px)`);
  if (shots) await mobile.screenshot({ path: `${shots}/home-mobile.png`, fullPage: true });

  const errors = page.errors.filter((e) => !e.includes('favicon'));
  assert(errors.length === 0, `нет ошибок в консоли (${errors.join(' | ')})`);
} finally {
  await browser.close();
}
