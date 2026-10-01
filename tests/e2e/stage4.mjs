// Этап 4: регистрация → создание черновика → автосохранение → перезагрузка.
import { BASE, assert, launch, newPage, register, uniqueEmail } from './lib.mjs';

const browser = await launch();
try {
  const page = await newPage(browser);
  const email = uniqueEmail();
  await register(page, { name: 'Автор Тест', email });
  await page.getByText('Email не подтверждён').first().waitFor();
  assert(true, 'после регистрации показано предупреждение о неподтверждённой почте');

  await page.goto(`${BASE}/my-courses`);
  await page.getByRole('button', { name: '+ Новый курс' }).click();
  await page.getByLabel('Название курса').fill('Квенья для начинающих');
  await page.getByLabel('Язык').fill('Квенья');
  await page.getByRole('button', { name: 'Создать черновик' }).click();
  await page.waitForURL('**/courses/*/edit');
  await page.getByRole('heading', { name: 'Квенья для начинающих' }).waitFor();
  assert(true, 'черновик создан без подтверждения почты, открыт редактор');

  const title = page.getByLabel('Название', { exact: true });
  await title.fill('Приветствия');
  await page.getByText('Все изменения сохранены').waitFor({ timeout: 10000 });
  assert(true, 'название урока автосохранено');

  await page.reload();
  await page.getByRole('button', { name: /1\. Приветствия/ }).waitFor();
  assert(true, 'после перезагрузки название урока на месте');

  await page.getByRole('button', { name: '+ Урок' }).click();
  await page.getByRole('group', { name: 'Новый урок' }).getByRole('button', { name: /Пустой урок/ }).click();
  await page.getByRole('button', { name: /2\. Новый урок/ }).waitFor();
  assert(true, 'добавлен второй урок');

  await page.getByRole('tab', { name: 'Справочник' }).click();
  await page.getByRole('button', { name: '+ Раздел' }).click();
  await page.getByRole('button', { name: /1\. Новый раздел/ }).waitFor();
  assert(true, 'вкладка «Справочник»: раздел добавлен');

  await page.getByRole('tab', { name: 'Настройки курса' }).click();
  await page.getByLabel('Название', { exact: true }).fill('ab');
  await page.getByText('Название: от 3 до 120 символов.').waitFor();
  assert(true, 'клиентская валидация названия');
  await page.getByLabel('Название', { exact: true }).fill('Квенья: первые шаги');
  await page.getByText('Все изменения сохранены').waitFor({ timeout: 10000 });
  await page.getByRole('heading', { name: 'Квенья: первые шаги' }).waitFor();
  assert(true, 'метаданные сохранены, заголовок обновился из подписки');

  const errors = page.errors.filter((e) => !e.includes('favicon'));
  assert(errors.length === 0, `нет ошибок в консоли (${errors.join(' | ')})`);
} finally {
  await browser.close();
}
