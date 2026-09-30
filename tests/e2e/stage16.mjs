// Доработки после запуска, задачи 2–3: таблица с заголовками по строке и по столбцу
// (все сочетания флагов, угловая ячейка, добавление/удаление строк и столбцов),
// новая таблица пустая 2×2 с подсказками-плейсхолдерами.
import { BASE, assert, launch, newPage, register, uniqueEmail } from './lib.mjs';

const browser = await launch();
try {
  const page = await newPage(browser);
  await register(page, { name: 'Табличник', email: uniqueEmail('table') });
  await page.goto(`${BASE}/my-courses`);
  await page.getByRole('button', { name: '+ Новый курс' }).click();
  await page.getByLabel('Название курса').fill('Таблицы с заголовками');
  await page.getByLabel('Язык').fill('Испанский');
  await page.getByRole('button', { name: 'Создать черновик' }).click();
  await page.waitForURL('**/courses/*/edit');
  const courseUrl = page.url();

  await page.getByRole('textbox', { name: 'Текст урока' }).click();
  await page.getByTitle('Вставить блок').click();
  await page.getByRole('button', { name: 'Таблица' }).click();

  const role = (r, c) => page.locator(`td[data-role]:has(input[aria-label^="Ячейка ${r}:${c},"])`).getAttribute('data-role');
  const roles = async (rows, cols) => {
    const out = [];
    for (let r = 1; r <= rows; r += 1) {
      const line = [];
      for (let c = 1; c <= cols; c += 1) line.push(await role(r, c));
      out.push(line.join(' '));
    }
    return out.join(' / ');
  };
  const headerRow = page.getByLabel('Первая строка — заголовок');
  const headerCol = page.getByLabel('Первый столбец — заголовок');

  assert((await roles(2, 2)) === 'column column / cell cell', 'по умолчанию заголовок — первая строка');
  await headerCol.check();
  assert((await roles(2, 2)) === 'corner column / row cell', 'оба флага: угловая ячейка, заголовки строки и столбца');
  await headerRow.uncheck();
  assert((await roles(2, 2)) === 'row cell / row cell', 'только столбец');
  await headerCol.uncheck();
  assert((await roles(2, 2)) === 'cell cell / cell cell', 'без заголовков');
  await headerRow.check();
  await headerCol.check();

  // Таблица личных местоимений: заполняем, добавляем и удаляем строки/столбцы.
  await page.getByLabel('Ячейка 1:1').fill('Лицо \\ Число');
  await page.getByLabel('Ячейка 1:2').fill('ед. ч.');
  await page.getByLabel('Ячейка 2:1').fill('1 л.');
  await page.getByLabel('Ячейка 2:2').fill('yo hablo');
  await page.getByRole('button', { name: '+ столбец' }).click();
  await page.getByRole('button', { name: '+ строка' }).click();
  await page.getByRole('button', { name: '+ строка' }).click();
  assert((await roles(4, 3)) === 'corner column column / row cell cell / row cell cell / row cell cell', 'новые строки и столбцы получают правильные роли');
  await page.getByLabel('Ячейка 1:3').fill('мн. ч.');
  await page.getByLabel('Ячейка 2:3').fill('nosotros hablamos');
  await page.getByLabel('Ячейка 3:1').fill('2 л.');
  await page.getByLabel('Ячейка 3:2').fill('tú hablas');
  await page.getByLabel('Ячейка 3:3').fill('vosotros habláis');
  await page.getByTitle('Удалить строку').nth(3).click();
  assert((await page.getByLabel('Ячейка 4:1').count()) === 0, 'пустая последняя строка удалена');
  assert((await roles(3, 3)) === 'corner column column / row cell cell / row cell cell', 'после удаления заголовки на месте');
  await page.getByText('Все изменения сохранены').waitFor({ timeout: 10000 });

  await page.goto(courseUrl);
  await page.getByRole('button', { name: 'Предпросмотр' }).click();
  const table = page.locator('table');
  await table.getByText('yo hablo').waitFor();
  assert((await table.locator('thead th[scope="col"]').allInnerTexts()).join('|') === 'ед. ч.|мн. ч.', 'заголовки столбцов в <thead>');
  assert((await table.locator('tbody th[scope="row"]').allInnerTexts()).join('|') === '1 л.|2 л.', 'заголовки строк — <th scope="row">');
  const corner = table.locator('thead td');
  assert((await corner.innerText()) === 'Лицо \\ Число', 'угловая ячейка — отдельная служебная ячейка');
  const [cornerStyle, headStyle] = await Promise.all([
    corner.evaluate((el) => getComputedStyle(el).fontStyle),
    table.locator('th').first().evaluate((el) => getComputedStyle(el).fontWeight),
  ]);
  assert(cornerStyle === 'italic' && Number(headStyle) >= 700, 'угловая ячейка оформлена иначе, чем заголовки');
  await page.screenshot({ path: process.env.SCREENSHOT_DIR ? `${process.env.SCREENSHOT_DIR}/stage16-table.png` : '/tmp/stage16-table.png', fullPage: true });

  const errors = page.errors.filter((e) => !e.includes('favicon'));
  assert(errors.length === 0, `нет ошибок в консоли (${errors.join(' | ')})`);
} finally {
  await browser.close();
}
