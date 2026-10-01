// v2, этап 5: соавторы — автор добавляет соавтора по ссылке на профиль,
// соавтор правит черновик, но не удаляет курс и не меняет список соавторов.
import { BASE, assert, launch, newPage, register, uidOf, uniqueEmail } from './lib.mjs';

const browser = await launch();
try {
  const author = await newPage(browser);
  const co = await newPage(browser);
  const coEmail = uniqueEmail('stage29co');
  await register(co, { name: 'Соавтор Петя', email: coEmail });
  const coUid = await uidOf(coEmail);

  await register(author, { name: 'Автор Аня', email: uniqueEmail('stage29') });
  await author.goto(`${BASE}/my-courses`);
  await author.getByRole('button', { name: '+ Новый курс' }).click();
  await author.getByLabel('Название курса').fill('Курс вдвоём');
  await author.getByLabel('Язык').fill('Испанский');
  await author.getByRole('button', { name: 'Создать черновик' }).click();
  await author.waitForURL('**/courses/*/edit');
  const editUrl = author.url();

  await author.getByRole('tab', { name: 'Настройки курса' }).click();
  const section = author.getByRole('region', { name: 'Соавторы' });
  await section.getByText('Соавторов пока нет.').waitFor();
  await section.getByLabel('Ссылка на профиль или id пользователя').fill(`${BASE}/users/nobody123`);
  await section.getByRole('button', { name: 'Добавить соавтора' }).click();
  await section.getByText(/Пользователь не найден/).waitFor();
  assert(true, 'неизвестный пользователь — понятная ошибка');
  await section.getByLabel('Ссылка на профиль или id пользователя').fill(`${BASE}/users/${coUid}`);
  await section.getByRole('button', { name: 'Добавить соавтора' }).click();
  await section.getByRole('link', { name: 'Соавтор Петя' }).waitFor();
  assert(true, 'соавтор добавлен по ссылке на профиль');

  // Соавтор
  await co.goto(`${BASE}/my-courses`);
  const item = co.locator('li', { hasText: 'Курс вдвоём' });
  await item.getByText('Вы соавтор').waitFor();
  assert(true, 'курс появился в «Моих курсах» соавтора с пометкой');
  await item.getByRole('link', { name: 'Курс вдвоём' }).click();
  await co.waitForURL('**/courses/*/edit');
  assert(co.url() === editUrl, 'соавтор открывает тот же редактор');
  await co.getByRole('tab', { name: 'Настройки курса' }).click();
  await co.getByLabel('Название', { exact: true }).fill('Курс вдвоём, правка соавтора');
  await co.getByText('Все изменения сохранены').waitFor();
  assert(true, 'соавтор правит название');
  const coSection = co.getByRole('region', { name: 'Соавторы' });
  await coSection.getByRole('link', { name: 'Соавтор Петя' }).waitFor();
  assert((await coSection.getByRole('button', { name: /Убрать|Добавить/ }).count()) === 0, 'соавтор не меняет список соавторов');
  assert((await co.getByRole('button', { name: 'Удалить курс' }).count()) === 0, 'соавтор не видит удаление курса');

  // Автор видит правку и убирает соавтора
  await author.getByRole('heading', { name: 'Курс вдвоём, правка соавтора' }).waitFor();
  assert(true, 'автор видит правку соавтора');
  await section.getByRole('button', { name: 'Убрать соавтора Соавтор Петя' }).click();
  await section.getByText('Соавторов пока нет.').waitFor();
  await co.goto(`${BASE}/my-courses`);
  await co.getByText(/У вас пока нет курсов/).waitFor();
  assert(true, 'после удаления из соавторов курс пропал у бывшего соавтора');
} finally {
  await browser.close();
}
console.log('stage29 OK');
