// Этап 5: редактор контента — форматирование, категории, таблица, сохранение в JSON.
import { BASE, assert, launch, newPage, register, uniqueEmail, chooseLanguage } from './lib.mjs';

const browser = await launch();
try {
  const page = await newPage(browser);
  await register(page, { name: 'Редактор Тест', email: uniqueEmail('stage5') });
  await page.goto(`${BASE}/my-courses`);
  await page.getByRole('button', { name: '+ Новый курс' }).click();
  await page.getByLabel('Название курса').fill('Токипона: оформление');
  await chooseLanguage(page, 'Токипона');
  await page.getByRole('button', { name: 'Создать черновик' }).click();
  await page.waitForURL('**/courses/*/edit');
  const courseUrl = page.url();

  // Категория в настройках
  await page.getByRole('tab', { name: 'Настройки курса' }).click();
  await page.getByRole('button', { name: '+ Категория' }).click();
  await page.getByLabel('Название категории').last().fill('Гласные');
  await page.getByText('Все изменения сохранены').waitFor({ timeout: 10000 });
  await page.getByRole('tab', { name: 'Самоучитель' }).click();

  const editable = page.getByRole('textbox', { name: 'Текст урока' });
  await editable.click();
  await page.keyboard.type('toki pona li pona');
  // Выделяем первое слово «toki» (DOM-выделение, Slate синхронизируется по selectionchange)
  await page.evaluate(() => {
    const node = document.querySelector('[data-slate-string]').firstChild;
    const range = document.createRange();
    range.setStart(node, 0);
    range.setEnd(node, 4);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  });
  await page.waitForTimeout(200);
  await page.getByRole('button', { name: 'Жирный (Ctrl+B)' }).click();
  await editable.locator('span[class*="bold"]', { hasText: 'toki' }).waitFor();
  assert((await editable.locator('span[class*="bold"]').count()) > 0, 'жирный применён к выделению');

  // Цвет
  await page.getByTitle('Цвет текста').click();
  await page.getByRole('button', { name: 'Цвет #e63946' }).click();
  assert((await editable.locator('span[style*="color: rgb(230, 57, 70)"]').count()) > 0, 'цвет применён');

  // Категория
  await page.getByTitle('Разметить выделенный текст категорией').click();
  await page.getByRole('button', { name: 'Гласные' }).click();
  assert((await editable.locator('span[class*="category"]').count()) > 0, 'категория применена');
  await page.getByLabel('Легенда разметки').getByText('Гласные').waitFor();
  assert(true, 'легенда категорий показана');

  // Таблица
  await page.keyboard.press('End');
  await page.getByTitle('Вставить блок').click();
  await page.getByRole('button', { name: 'Таблица' }).click();
  await page.getByLabel('Ячейка 2:1').fill('ihura');
  await page.getByLabel('Ячейка 2:2').fill('язык');
  await page.getByRole('button', { name: '+ строка' }).click();
  assert((await page.getByLabel('Ячейка 3:1').count()) === 1, 'строка таблицы добавлена');
  await page.getByText('Все изменения сохранены').waitFor({ timeout: 10000 });

  // Перезагрузка и предпросмотр
  await page.goto(courseUrl);
  await page.getByRole('button', { name: 'Предпросмотр' }).click();
  const preview = page.locator('table');
  await preview.getByText('ihura').waitFor();
  assert(true, 'таблица сохранилась и отображается в предпросмотре');
  assert((await page.locator('p span[style*="color"]').filter({ hasText: 'toki' }).count()) === 1, 'оформление сохранилось (цвет на «toki»)');
  await page.screenshot({ path: process.env.SCREENSHOT_DIR ? `${process.env.SCREENSHOT_DIR}/stage5-preview.png` : '/tmp/stage5-preview.png', fullPage: true });

  const errors = page.errors.filter((e) => !e.includes('favicon'));
  assert(errors.length === 0, `нет ошибок в консоли (${errors.join(' | ')})`);
} finally {
  await browser.close();
}
