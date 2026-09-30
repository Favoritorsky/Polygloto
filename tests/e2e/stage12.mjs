// Этап 12: главная — объяснение, живой демо-урок, путь автора, витрина курсов.
import { BASE, assert, launch, newPage, register, uniqueEmail } from './lib.mjs';

const shots = process.env.E2E_SCREENSHOTS;

const browser = await launch();
try {
  const page = await newPage(browser);
  await page.goto(BASE);
  await page.getByRole('heading', { level: 1 }).waitFor();
  for (const title of ['Попробуйте прямо здесь', 'Для кого Polygloto', 'Чем это лучше самоучителя в PDF', 'Как стать автором', 'Популярные курсы']) {
    assert(await page.getByRole('heading', { name: title }).isVisible(), `раздел «${title}»`);
  }

  // Демо-урок работает на тех же компонентах, что и настоящие курсы.
  await page.locator('[role="button"]', { hasText: 'hablo' }).first().hover();
  await page.getByRole('tooltip').getByText('говорю (hablar').waitFor();
  assert(true, 'демо: перевод слова по наведению');
  await page.getByLabel('Yo hablo español').check();
  await page.getByRole('button', { name: 'Проверить' }).click();
  await page.getByText('✓ Верно!').waitFor();
  assert(true, 'демо: задание проверяется');

  await page.locator('section', { has: page.getByRole('heading', { name: 'Популярные курсы' }) }).locator('article').first().waitFor();
  const cards = await page.locator('section', { has: page.getByRole('heading', { name: 'Популярные курсы' }) }).locator('article').count();
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
  await mobile.getByRole('heading', { name: 'Популярные курсы' }).waitFor();
  const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert(overflow <= 0, `на ширине 375px нет горизонтальной прокрутки (${overflow}px)`);
  if (shots) await mobile.screenshot({ path: `${shots}/home-mobile.png`, fullPage: true });

  const errors = page.errors.filter((e) => !e.includes('favicon'));
  assert(errors.length === 0, `нет ошибок в консоли (${errors.join(' | ')})`);
} finally {
  await browser.close();
}
