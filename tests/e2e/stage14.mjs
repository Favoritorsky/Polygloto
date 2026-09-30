// Этап 14 (после запуска): тема — тёмная по умолчанию, переключается в шапке и запоминается.
import { BASE, assert, launch, newPage } from './lib.mjs';

const browser = await launch();
try {
  const page = await newPage(browser);
  await page.goto(BASE);
  await page.getByRole('heading', { level: 1 }).waitFor();
  const theme = () => page.evaluate(() => document.documentElement.dataset.theme);
  const bg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  assert((await theme()) === 'dark', 'по умолчанию тёмная тема');
  assert((await bg()) === 'rgb(20, 22, 26)', `тёмный фон страницы (${await bg()})`);

  await page.getByRole('button', { name: 'Включить светлую тему' }).click();
  assert((await theme()) === 'light', 'переключается на светлую');
  await page.reload();
  await page.getByRole('heading', { level: 1 }).waitFor();
  assert((await theme()) === 'light', 'выбор сохраняется после перезагрузки');
  assert((await bg()) === 'rgb(247, 245, 240)', 'светлый фон страницы');

  await page.getByRole('button', { name: 'Включить тёмную тему' }).click();
  assert((await theme()) === 'dark', 'и обратно на тёмную');

  const errors = page.errors.filter((e) => !e.includes('favicon'));
  assert(errors.length === 0, `нет ошибок в консоли (${errors.join(' | ')})`);
} finally {
  await browser.close();
}
