// v2, этап 3: шаблоны уроков — «+ Урок» предлагает пустой урок и три шаблона.
import { BASE, assert, launch, newPage, register, uniqueEmail, chooseLanguage } from './lib.mjs';

const browser = await launch();
try {
  const page = await newPage(browser);
  await register(page, { name: 'Шаблонщик', email: uniqueEmail('stage21') });
  await page.goto(`${BASE}/my-courses`);
  await page.getByRole('button', { name: '+ Новый курс' }).click();
  await page.getByLabel('Название курса').fill('Шаблоны уроков');
  await chooseLanguage(page, 'Испанский');
  await page.getByRole('button', { name: 'Создать черновик' }).click();
  await page.waitForURL('**/courses/*/edit');

  await page.getByRole('button', { name: '+ Урок' }).click();
  const chooser = page.getByRole('group', { name: 'Новый урок' });
  const labels = await chooser.locator('button strong').allInnerTexts();
  assert(labels.join('|') === 'Пустой урок|Новая лексика|Грамматическая тема|Диалог', 'выбор: пустой урок и три шаблона');
  await chooser.getByRole('button', { name: 'Отмена' }).click();
  assert((await chooser.count()) === 0, 'выбор можно закрыть');

  await page.getByRole('button', { name: '+ Урок' }).click();
  await chooser.getByRole('button', { name: /Грамматическая тема/ }).click();
  await page.getByRole('textbox', { name: 'Название' }).first().waitFor();
  await page.waitForFunction(() => document.querySelector('input[aria-label="Название"]')?.value === 'Грамматика: …');
  assert(true, 'урок по шаблону выбран и открыт');
  const editor = page.getByRole('textbox', { name: 'Текст урока' });
  await editor.getByText('Правило', { exact: true }).waitFor();
  for (const label of ['Задание: Вставить пропущенное слово', 'Задание: Несколько правильных ответов', 'Задание: Порядок слов']) {
    await page.getByText(label).first().waitFor();
  }
  assert(true, 'в грамматике три пустых задания с подсказками, что заполнить');
  assert(
    (await page.getByText('1-е лицо').count()) >= 1 || (await page.locator('input[value="1-е лицо"]').count()) >= 1,
    'таблица форм с заголовками строк',
  );

  await page.getByRole('button', { name: '+ Урок' }).click();
  await page
    .getByRole('group', { name: 'Новый урок' })
    .getByRole('button', { name: /Диалог/ })
    .click();
  await page.waitForFunction(() => document.querySelector('input[aria-label="Название"]')?.value === 'Диалог: …');
  await page.getByText('Задание: Аудирование').first().waitFor();
  assert(true, 'урок «Диалог» с заданием на аудирование');

  await page.getByRole('button', { name: '+ Урок' }).click();
  await page.getByRole('group', { name: 'Новый урок' }).getByRole('button', { name: 'Пустой урок' }).click();
  await page.waitForFunction(() => document.querySelector('input[aria-label="Название"]')?.value === 'Новый урок');
  const items = await page.locator('aside ol li').allInnerTexts();
  assert(items.length === 4, `в курсе 4 урока (${items.length})`);
  assert(items[1].includes('Грамматика') && items[2].includes('Диалог'), 'уроки из шаблонов в оглавлении курса');
} finally {
  await browser.close();
}
