// Доработки после запуска, задача 5: демо-курс испанского открыт без регистрации
// и показывает все возможности: форматирование, таблицу с двумя заголовками,
// разметку частей речи, пять типов заданий, словарь со ссылками, справочник.
import { BASE, assert, launch, newPage } from './lib.mjs';

const browser = await launch();
try {
  const page = await newPage(browser);
  await page.goto(`${BASE}/demo`);
  await page.getByRole('heading', { level: 1, name: 'Испанский с нуля' }).waitFor();
  assert(true, 'демо-курс открывается без входа');
  await page.getByRole('heading', { name: 'Урок 1. Приветствия и знакомство' }).waitFor();

  // Форматирование: жирный, курсив, цвет.
  const lesson = page.getByRole('region', { name: 'Урок 1. Приветствия и знакомство' });
  assert((await lesson.locator('span[class*="bold"]').count()) > 0, 'есть жирный текст');
  assert((await lesson.locator('span[class*="italic"]').count()) > 0, 'есть курсив');
  assert((await lesson.locator('span[style*="color: rgb(230, 57, 70)"]').count()) > 0, 'есть цветной текст');

  // Таблица с заголовками по строке и по столбцу.
  const conj = lesson.locator('table', { hasText: 'nosotros hablamos' });
  assert((await conj.locator('th[scope="row"]').allInnerTexts()).join('|') === '1-е лицо|2-е лицо|3-е лицо', 'таблица hablar: заголовки строк');
  assert((await conj.locator('th[scope="col"]').count()) === 2, 'таблица hablar: заголовки столбцов');

  // Разметка частей речи и легенда-переключатель.
  const legend = lesson.getByRole('group', { name: 'Легенда разметки' });
  for (const name of ['Существительное', 'Глагол', 'Прилагательное', 'Наречие', 'Местоимение', 'Союз', 'Предлог', 'Числительное', 'Частица', 'Ударный слог']) {
    assert((await legend.getByRole('button', { name: new RegExp(`^${name}`) }).count()) === 1, `в легенде «${name}»`);
  }
  const verbs = () => lesson.locator('span[data-abbr="глаг."]').count();
  const before = await verbs();
  await legend.getByRole('button', { name: /^Глагол/ }).click();
  assert(before > 0 && (await verbs()) === 0, 'глаголы можно скрыть кликом по легенде');
  await legend.getByRole('button', { name: /^Глагол/ }).click();

  // Словарь: активные ссылки в тексте.
  await lesson.getByRole('button', { name: 'Me llamo' }).first().hover();
  await page.getByRole('tooltip').getByText('меня зовут', { exact: true }).waitFor();
  assert(true, 'словосочетание из словаря подсвечено, перевод по наведению');

  // Пять типов заданий на материале урока: каждое решаем и проверяем.
  const solve = async (label, fill) => {
    const form = lesson.getByRole('form', { name: `Задание: ${label}` });
    await fill(form);
    await form.getByRole('button', { name: 'Проверить' }).click();
    await form.getByText('✓ Верно!').waitFor();
    assert(true, `задание «${label}» решается`);
  };
  await solve('Выбор правильного ответа', (f) => f.getByLabel('Buenas noches').check());
  await solve('Вставить пропущенное слово', (f) => f.getByLabel('Пропущенное слово').fill('llamo'));
  await solve('Сопоставление пар', async (f) => {
    for (const [left, right] of [['¡Hola!', 'Привет!'], ['Adiós', 'До свидания'], ['Gracias', 'Спасибо'], ['Mucho gusto', 'Очень приятно']]) {
      await f.getByLabel(`Пара для «${left}»`).selectOption({ label: right });
    }
  });
  await solve('Перевод предложения', (f) => f.getByLabel('Ваш перевод').fill('yo hablo español'));
  await solve('Введи ответ сам', (f) => f.getByLabel('Ваш ответ').fill('Hablamos'));
  if (process.env.SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.SCREENSHOT_DIR}/stage18-demo.png`, fullPage: true });

  // Справочник и словарь.
  await page.getByRole('tab', { name: 'Справочник' }).click();
  await page.getByRole('heading', { name: 'Спряжение глагола hablar' }).waitFor();
  assert((await page.locator('table', { hasText: 'habláis' }).count()) === 1, 'справочник: таблица окончаний');
  await page.getByRole('tab', { name: 'Словарь' }).click();
  await page.getByLabel('Поиск по словарю').fill('hablar');
  await page.getByText('говорить').first().waitFor();
  assert(true, 'словарь курса с поиском');

  // Телефон: без горизонтальной прокрутки.
  const mobile = await browser.newPage({ viewport: { width: 375, height: 800 } });
  await mobile.goto(`${BASE}/demo`);
  await mobile.getByRole('heading', { name: 'Урок 1. Приветствия и знакомство' }).waitFor();
  const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert(overflow <= 0, `на ширине 375px нет горизонтальной прокрутки (${overflow}px)`);

  const errors = page.errors.filter((e) => !e.includes('favicon'));
  assert(errors.length === 0, `нет ошибок в консоли (${errors.join(' | ')})`);
} finally {
  await browser.close();
}
