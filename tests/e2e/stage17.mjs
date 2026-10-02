// Доработки после запуска, задача 4: готовые наборы категорий, сокращения,
// легенда-переключатель (скрыть/показать подсветку отдельной категории).
import { BASE, assert, launch, newPage, register, uniqueEmail, chooseLanguage } from './lib.mjs';

const browser = await launch();
try {
  const page = await newPage(browser);
  await register(page, { name: 'Разметчик', email: uniqueEmail('cats') });
  await page.goto(`${BASE}/my-courses`);
  await page.getByRole('button', { name: '+ Новый курс' }).click();
  await page.getByLabel('Название курса').fill('Разметка частей речи');
  await chooseLanguage(page, 'Испанский');
  await page.getByRole('button', { name: 'Создать черновик' }).click();
  await page.waitForURL('**/courses/*/edit');
  const courseUrl = page.url();

  // Настройки: в новом курсе сразу два готовых набора.
  await page.getByRole('tab', { name: 'Настройки курса' }).click();
  const grammar = page.getByRole('region', { name: 'Грамматические' });
  const phonetics = page.getByRole('region', { name: 'Фонетические' });
  assert((await grammar.getByLabel('Название категории').count()) === 9, 'грамматический набор: 9 категорий');
  assert((await phonetics.getByLabel('Название категории').count()) === 3, 'фонетический набор: 3 категории');
  assert((await grammar.getByLabel('Сокращение для «Существительное»').inputValue()) === 'сущ.', 'у готовых категорий есть сокращения');

  // Убрать лишнюю и вернуть.
  await grammar.getByRole('button', { name: 'Убрать категорию «Союз»' }).click();
  assert((await grammar.getByLabel('Название категории').count()) === 8, 'готовую категорию можно убрать');
  await grammar.getByRole('button', { name: '+ Союз' }).click();
  assert((await grammar.getByLabel('Название категории').count()) === 9, 'и вернуть одной кнопкой');
  // Своя категория с сокращением, переименование готовой.
  await page.getByRole('button', { name: '+ Категория' }).click();
  const custom = page.getByRole('region', { name: 'Свои категории' });
  await custom.getByLabel('Название категории').fill('Корень');
  await custom.getByLabel('Сокращение для «Корень»').fill('кор.');
  await page.getByText('Все изменения сохранены').waitFor({ timeout: 10000 });

  // Урок: размечаем «Yo» местоимением, «hablo» глаголом.
  await page.getByRole('tab', { name: 'Самоучитель' }).click();
  const editable = page.getByRole('textbox', { name: 'Текст урока' });
  await editable.click();
  await page.keyboard.type('Yo hablo');
  const select = (start, end) =>
    page.evaluate(
      ([s, e]) => {
        const node = document.querySelector('[data-slate-string]').firstChild;
        const range = document.createRange();
        range.setStart(node, s);
        range.setEnd(node, e);
        window.getSelection().removeAllRanges();
        window.getSelection().addRange(range);
      },
      [start, end],
    );
  await select(3, 8);
  await page.waitForTimeout(200);
  await page.getByTitle('Разметить выделенный текст категорией').click();
  assert((await page.getByRole('group', { name: 'Фонетические' }).count()) === 1, 'в меню категории сгруппированы');
  await page.getByRole('button', { name: /^Глагол/ }).click();
  await select(0, 2);
  await page.waitForTimeout(200);
  await page.getByTitle('Разметить выделенный текст категорией').click();
  await page.getByRole('button', { name: /^Местоимение/ }).click();
  const editorLegend = page.getByRole('group', { name: 'Легенда разметки' });
  await editorLegend.getByText('Глагол').waitFor();
  assert((await editorLegend.getByText('Существительное').count()) === 0, 'в редакторе легенда только по использованным категориям');
  await page.getByText('Все изменения сохранены').waitFor({ timeout: 10000 });

  // Предпросмотр: легенда-переключатель и сокращения.
  await page.goto(courseUrl);
  await page.getByRole('button', { name: 'Предпросмотр' }).click();
  const legend = page.getByRole('group', { name: 'Легенда разметки' });
  const verbToggle = legend.getByRole('button', { name: /Глагол/ });
  await verbToggle.waitFor();
  const verb = page.locator('span[data-abbr="глаг."]', { hasText: 'hablo' });
  assert((await verb.getAttribute('title')) === 'Глагол (глаг.)', 'подсказка с названием и сокращением');
  await verb.hover();
  const abbrShown = await verb.evaluate((el) => getComputedStyle(el, '::before').content);
  assert(abbrShown === '"глаг."', `сокращение подписью при наведении (${abbrShown})`);

  await verbToggle.click();
  assert((await verbToggle.getAttribute('aria-pressed')) === 'false', 'клик по легенде скрывает категорию');
  assert((await page.locator('span[data-abbr="глаг."]').count()) === 0, 'подсветка глагола в тексте скрыта');
  assert((await page.locator('span[data-abbr="мест."]').count()) === 1, 'остальные категории остались');
  await legend.getByRole('button', { name: 'Показать все' }).click();
  assert((await page.locator('span[data-abbr="глаг."]').count()) === 1, '«Показать все» возвращает подсветку');

  await legend.getByRole('button', { name: /Местоимение/ }).focus();
  await page.keyboard.press('Enter');
  assert((await page.locator('span[data-abbr="мест."]').count()) === 0, 'переключатель работает с клавиатуры');
  await page.keyboard.press('Space');
  assert((await page.locator('span[data-abbr="мест."]').count()) === 1, 'и обратно');
  await page.screenshot({ path: process.env.SCREENSHOT_DIR ? `${process.env.SCREENSHOT_DIR}/stage17-categories.png` : '/tmp/stage17-categories.png' });

  const errors = page.errors.filter((e) => !e.includes('favicon'));
  assert(errors.length === 0, `нет ошибок в консоли (${errors.join(' | ')})`);
} finally {
  await browser.close();
}
