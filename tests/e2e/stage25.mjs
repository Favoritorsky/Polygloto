// v2, этап 3: подстрочный разбор (interlinear gloss) в редакторе и у читателя.
import { BASE, assert, launch, newPage, register, uniqueEmail } from './lib.mjs';

const browser = await launch();
try {
  const page = await newPage(browser);
  await register(page, { name: 'Лингвист', email: uniqueEmail('stage25') });
  await page.goto(`${BASE}/my-courses`);
  await page.getByRole('button', { name: '+ Новый курс' }).click();
  await page.getByLabel('Название курса').fill('Глоссы');
  await page.getByLabel('Язык').fill('Испанский');
  await page.getByRole('button', { name: 'Создать черновик' }).click();
  await page.waitForURL('**/courses/*/edit');

  await page.getByRole('textbox', { name: 'Текст урока' }).click();
  await page.keyboard.type('Разбор');
  await page.getByTitle('Вставить блок').click();
  await page.getByRole('button', { name: 'Подстрочный разбор', exact: true }).click();
  await page.getByLabel('Предложение').fill('los gatos duermen');
  await page.getByLabel('Разбор по словам').fill('DEF.PL кот-PL');
  await page.getByText('В предложении 3 сл., в разборе 2: столбцы не совпадут.').waitFor();
  assert(true, 'расхождение числа слов подсвечено');
  await page.getByLabel('Разбор по словам').fill('DEF.PL кот-PL спать.PRS-3PL');
  await page.getByText('столбцы не совпадут').waitFor({ state: 'detached' });
  await page.getByLabel('Перевод', { exact: true }).fill('кошки спят');
  const live = page.getByLabel('Предпросмотр разбора');
  assert((await live.locator('abbr').count()) === 5, 'живой предпросмотр: 5 помет (def, pl, pl, prs, 3pl)');
  await page.getByText('Все изменения сохранены').waitFor({ timeout: 10000 });

  await page.reload();
  await page.getByRole('button', { name: 'Предпросмотр' }).click();
  const fig = page.getByRole('figure', { name: 'Подстрочный разбор' });
  await fig.waitFor();
  const cols = fig.locator('span[class*="column"]');
  assert((await cols.count()) === 3, 'после перезагрузки: 3 столбца');
  assert((await cols.nth(2).innerText()).replace(/\s+/g, ' ') === 'duermen спать.prs-3pl', 'слово и его разбор в одном столбце');
  assert((await fig.getByText('‘кошки спят’').count()) === 1, 'перевод в кавычках-лапках');
  const variant = await fig
    .locator('abbr')
    .first()
    .evaluate((el) => getComputedStyle(el).fontVariantCaps);
  assert(variant === 'small-caps', `пометы капителью (${variant})`);
} finally {
  await browser.close();
}
