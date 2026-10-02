// Карточка слова в словаре: по клику на любое место карточки открывается окно
// с полной статьёй (произношение, часть речи, перевод, все примеры, заметки).
// В редакторе в окне есть те же кнопки «Изменить» и «Удалить».
import { BASE, assert, launch, newPage, register, uniqueEmail, chooseLanguage } from './lib.mjs';
import { seedPublishedCourse } from './seed.mjs';

const dictionary = [
  {
    id: 'bonjour',
    word: 'bonjour',
    translation: 'здравствуйте, добрый день',
    partOfSpeech: 'interjection',
    pronunciation: 'бонжур',
    examples: ['Bonjour, madame ! — Здравствуйте, мадам!', 'Bonjour à tous. — Всем добрый день.'],
    notes: 'Вечером говорят bonsoir.',
  },
];
const courseId = await seedPublishedCourse({ title: `Словарь-окно ${Date.now().toString(36)}`, language: 'Французский', dictionary });

const browser = await launch();
try {
  const page = await newPage(browser);
  await page.goto(`${BASE}/course/${courseId}?tab=dictionary`);
  const card = page.locator('li', { hasText: 'здравствуйте, добрый день' }).first();
  await card.waitFor();
  assert(await card.getByText('бонжур').isVisible(), 'в карточке видно произношение');
  assert(!(await card.getByText('Вечером говорят bonsoir.').isVisible()), 'заметки в списке не загромождают карточку');
  const box = await card.locator('p').first().boundingBox();
  await page.mouse.click(box.x + box.width - 4, box.y + box.height / 2);
  const dialog = page.getByRole('dialog', { name: 'bonjour' });
  await dialog.waitFor();
  for (const text of [
    'бонжур',
    'Междометие',
    'здравствуйте, добрый день',
    'Bonjour à tous. — Всем добрый день.',
    'Вечером говорят bonsoir.',
  ]) {
    assert(await dialog.getByText(text).isVisible(), `в окне статьи: ${text}`);
  }
  const size = await dialog.boundingBox();
  assert(size.width >= 700, `окно широкое (${Math.round(size.width)} px)`);
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'hidden' });
  assert(true, 'окно закрывается по Esc');

  // Демо-курс и редактор используют тот же компонент: в редакторе в окне кнопки автора.
  await register(page, { name: 'Автор словаря', email: uniqueEmail('stage34') });
  await page.goto(`${BASE}/my-courses`);
  await page.getByRole('button', { name: '+ Новый курс' }).click();
  await page.getByLabel('Название курса').fill('Окно слова');
  await chooseLanguage(page, 'Французский');
  await page.getByRole('button', { name: 'Создать черновик' }).click();
  await page.waitForURL('**/courses/*/edit');
  await page.getByRole('tab', { name: 'Словарь' }).click();
  await page.getByLabel('Слово', { exact: true }).fill('merci');
  await page.getByLabel('Перевод').fill('спасибо');
  await page.getByLabel('Произношение (необязательно)').fill('мэрси');
  await page.getByRole('button', { name: 'Добавить', exact: true }).click();
  await page.getByRole('button', { name: 'merci', exact: true }).click();
  const editorDialog = page.getByRole('dialog', { name: 'merci' });
  await editorDialog.getByRole('button', { name: 'Изменить' }).click();
  await page.getByRole('dialog', { name: 'Изменить слово' }).getByLabel('Перевод').fill('спасибо (большое)');
  await page.getByRole('dialog', { name: 'Изменить слово' }).getByRole('button', { name: 'Сохранить' }).click();
  await editorDialog.getByText('спасибо (большое)').waitFor();
  assert(true, 'правка из окна статьи сразу видна в окне');
} finally {
  await browser.close();
}
console.log('stage34 OK');
