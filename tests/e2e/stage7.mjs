// Этап 7: все пять типов заданий — создание в редакторе и прохождение в предпросмотре.
import { BASE, assert, launch, newPage, register, uniqueEmail, chooseLanguage } from './lib.mjs';

const browser = await launch();
try {
  const page = await newPage(browser);
  await register(page, { name: 'Задачник', email: uniqueEmail('stage7') });
  await page.goto(`${BASE}/my-courses`);
  await page.getByRole('button', { name: '+ Новый курс' }).click();
  await page.getByLabel('Название курса').fill('Токипона: упражнения');
  await chooseLanguage(page, 'Токипона');
  await page.getByRole('button', { name: 'Создать черновик' }).click();
  await page.waitForURL('**/courses/*/edit');

  const editable = page.getByRole('textbox', { name: 'Текст урока' });
  await editable.click();
  await page.keyboard.type('Упражнения');

  async function insert(label) {
    await page.getByTitle('Вставить блок').click();
    await page.getByRole('button', { name: label, exact: true }).click();
  }

  await insert('Выбор правильного ответа');
  await page.getByText('Не отмечен правильный ответ.').waitFor();
  assert(true, 'незаполненное задание показывает, что нужно заполнить');
  await page.getByRole('textbox', { name: 'Вопрос' }).last().fill('Как сказать «хороший»?');
  await page.getByLabel('Вариант 1', { exact: true }).fill('pona');
  await page.getByLabel('Вариант 2', { exact: true }).fill('ike');

  await insert('Вставить пропущенное слово');
  await page.getByLabel('Текст до пропуска').fill('mi');
  await page.getByLabel('Текст после пропуска').fill('e kili');
  await page.getByLabel('Правильное слово 1').fill('moku');

  await insert('Сопоставление пар');
  await page.getByLabel('Левая часть 1').fill('toki');
  await page.getByLabel('Правая часть 1').fill('язык');
  await page.getByLabel('Левая часть 2').fill('pona');
  await page.getByLabel('Правая часть 2').fill('хороший');

  await insert('Перевод предложения');
  await page.getByRole('textbox', { name: 'Предложение для перевода' }).fill('Я ем фрукты.');
  await page.getByLabel('Эталонный перевод 1').fill('mi moku e kili.');
  await page.getByRole('button', { name: '+ допустимый вариант' }).last().click();
  await page.getByLabel('Эталонный перевод 2').fill('mi moku e kili mute');

  await insert('Введи ответ сам');
  await page.getByRole('textbox', { name: 'Вопрос' }).last().fill('Сколько гласных в токипоне?');
  await page.getByLabel('Правильный ответ 1').fill('5');
  await page.getByRole('button', { name: '+ допустимый вариант' }).last().click();
  await page.getByLabel('Правильный ответ 2').fill('пять');

  await page.getByText('Все изменения сохранены').waitFor({ timeout: 10000 });
  await page.reload();
  await page.getByRole('button', { name: 'Предпросмотр' }).click();
  const tasks = page.locator('form[aria-label^="Задание"]');
  await tasks.first().waitFor();
  assert((await tasks.count()) === 5, 'после перезагрузки все 5 заданий на месте');

  // 1. выбор
  const mc = tasks.nth(0);
  await mc.getByLabel('ike').check();
  await mc.getByRole('button', { name: 'Проверить' }).click();
  await mc.getByText('✗ Пока неверно.').waitFor();
  await mc.getByRole('button', { name: 'Ещё раз' }).click();
  await mc.getByLabel('pona').check();
  await mc.getByRole('button', { name: 'Проверить' }).click();
  await mc.getByText('✓ Верно!').waitFor();
  assert(true, 'выбор ответа: неверно → ещё раз → верно');

  // 2. пропуск
  const fb = tasks.nth(1);
  assert(await fb.getByRole('button', { name: 'Проверить' }).isDisabled(), 'пустой ответ проверить нельзя');
  await fb.getByLabel('Пропущенное слово').fill('  MOKU ');
  await fb.getByRole('button', { name: 'Проверить' }).click();
  await fb.getByText('✓ Верно!').waitFor();
  assert(true, 'пропуск: регистр и пробелы не важны');

  // 3. пары
  const mt = tasks.nth(2);
  await mt.getByLabel('Пара для «toki»').selectOption({ label: 'хороший' });
  await mt.getByLabel('Пара для «pona»').selectOption({ label: 'язык' });
  await mt.getByRole('button', { name: 'Проверить' }).click();
  await mt.getByText('✗ Пока неверно.').waitFor();
  await mt.getByRole('button', { name: 'Ещё раз' }).click();
  await mt.getByLabel('Пара для «toki»').selectOption({ label: 'язык' });
  await mt.getByLabel('Пара для «pona»').selectOption({ label: 'хороший' });
  await mt.getByRole('button', { name: 'Проверить' }).click();
  await mt.getByText('✓ Верно!').waitFor();
  assert(true, 'сопоставление: неверно, затем верно');

  // 4. перевод
  const tr = tasks.nth(3);
  await tr.getByLabel('Ваш перевод').fill('mi moku');
  await tr.getByRole('button', { name: 'Проверить' }).click();
  await tr.getByText('Правильный вариант: «mi moku e kili.»').waitFor();
  await tr.getByRole('button', { name: 'Ещё раз' }).click();
  await tr.getByLabel('Ваш перевод').fill('Mi moku e kili mute!');
  await tr.getByRole('button', { name: 'Проверить' }).click();
  await tr.getByText('✓ Верно!').waitFor();
  assert(true, 'перевод: эталон показан при ошибке, допустимый вариант засчитан');

  // 5. свободный ввод
  const fi = tasks.nth(4);
  await fi.getByLabel('Ваш ответ').fill('Пять');
  await fi.getByLabel('Ваш ответ').press('Enter');
  await fi.getByText('✓ Верно!').waitFor();
  assert(true, 'свободный ввод: альтернативный ответ, отправка по Enter');

  await page.screenshot({ path: `${process.env.SCREENSHOT_DIR ?? '/tmp'}/stage7-tasks.png`, fullPage: true });
  const errors = page.errors.filter((e) => !e.includes('favicon'));
  assert(errors.length === 0, `нет ошибок в консоли (${errors.join(' | ')})`);
} finally {
  await browser.close();
}
