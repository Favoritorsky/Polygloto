// Этап 6: словарь — добавление, поиск, фильтр; активные ссылки в тексте.
import { BASE, assert, launch, newPage, register, uniqueEmail } from './lib.mjs';

const browser = await launch();
try {
  const page = await newPage(browser);
  await register(page, { name: 'Словарник', email: uniqueEmail('stage6') });
  await page.goto(`${BASE}/my-courses`);
  await page.getByRole('button', { name: '+ Новый курс' }).click();
  await page.getByLabel('Название курса').fill('Токипона и словарь');
  await page.getByLabel('Язык').fill('Токипона');
  await page.getByRole('button', { name: 'Создать черновик' }).click();
  await page.waitForURL('**/courses/*/edit');

  await page.getByRole('tab', { name: 'Словарь' }).click();
  async function addWord(word, translation, pos) {
    await page.getByLabel('Слово', { exact: true }).fill(word);
    await page.getByLabel('Перевод').fill(translation);
    await page.getByLabel('Часть речи').first().selectOption(pos);
    await page.getByRole('button', { name: 'Добавить' }).click();
    await page.locator('li', { hasText: translation }).first().waitFor({ timeout: 8000 }).catch(async (e) => {
      await page.screenshot({ path: '/tmp/claude-0/-home-claude/88bf146b-844e-5c6b-95e0-51637bf40d13/scratchpad/fail6.png', fullPage: true });
      throw e;
    });
  }
  await page.getByRole('button', { name: 'Добавить' }).click();
  await page.getByText('Слово: от 1 до 100 символов.').waitFor();
  assert(true, 'пустое слово не отправляется (клиентская валидация)');
  await addWord('toki', 'язык, речь', 'noun');
  await addWord('pona', 'хороший', 'adjective');
  await addWord('toki pona', 'токипона', 'phrase');
  await addWord('mi', 'я', 'pronoun');
  assert((await page.getByText('Слов: 4').count()) === 1, 'в словаре 4 слова');

  await page.getByLabel('Поиск по словарю').fill('ХОР');
  await page.getByText('Найдено: 1 из 4').waitFor();
  assert(true, 'поиск по переводу без учёта регистра');
  await page.getByLabel('Поиск по словарю').fill('');
  await page.getByLabel('Часть речи', { exact: true }).last().selectOption('noun');
  await page.getByText('Найдено: 1 из 4').waitFor();
  assert(true, 'фильтр по части речи');

  await page.getByRole('tab', { name: 'Самоучитель' }).click();
  const editable = page.getByRole('textbox', { name: 'Текст урока' });
  await editable.click();
  await page.keyboard.type('jan li toki pona');
  // Ручная привязка «jan» к слову «mi»
  await page.evaluate(() => {
    const node = document.querySelector('[data-slate-string]').firstChild;
    const range = document.createRange();
    range.setStart(node, 0);
    range.setEnd(node, 3);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
  });
  await page.waitForTimeout(200);
  await page.getByTitle('Привязать выделенный текст к слову из словаря').click();
  await page.getByLabel('Найти слово в словаре').fill('mi');
  await page.getByRole('button', { name: /^mi — я$/ }).click();
  await editable.locator('span[title^="Словарь: mi"]').waitFor();
  assert(true, 'ручная привязка к словарю видна в редакторе');
  await page.getByText('Все изменения сохранены').waitFor({ timeout: 10000 });

  await page.getByRole('button', { name: 'Предпросмотр' }).click();
  const phrase = page.getByRole('button', { name: 'toki pona' });
  await phrase.hover();
  await page.getByRole('tooltip').getByText('токипона').waitFor();
  assert(true, 'словосочетание «toki pona» подсвечено, по наведению — перевод');
  await page.getByRole('button', { name: 'jan' }).click();
  await page.getByRole('tooltip').getByText('я', { exact: true }).waitFor();
  assert(true, 'ручная привязка «jan» → «mi» показывает перевод по клику');
  await page.screenshot({ path: `${process.env.SCREENSHOT_DIR ?? '/tmp'}/stage6-preview.png` });

  const errors = page.errors.filter((e) => !e.includes('favicon'));
  assert(errors.length === 0, `нет ошибок в консоли (${errors.join(' | ')})`);
} finally {
  await browser.close();
}
