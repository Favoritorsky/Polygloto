// Этап 8: модерация — отправка (с подтверждением почты), отклонение с причиной,
// повторная отправка, одобрение, правка опубликованного курса.
import { BASE, assert, launch, newPage, register, setRole, uidOf, uniqueEmail, verifyEmail } from './lib.mjs';

const browser = await launch();
try {
  const author = await newPage(browser);
  const authorEmail = uniqueEmail('author8');
  await register(author, { name: 'Автор Модерации', email: authorEmail });
  await author.goto(`${BASE}/my-courses`);
  await author.getByRole('button', { name: '+ Новый курс' }).click();
  await author.getByLabel('Название курса').fill('Лойбан: основы');
  await author.getByLabel('Язык').fill('Лойбан');
  await author.getByRole('button', { name: 'Создать черновик' }).click();
  await author.waitForURL('**/courses/*/edit');
  const editorUrl = author.url();
  const courseId = editorUrl.split('/courses/')[1].split('/')[0];

  await author.getByRole('textbox', { name: 'Текст урока' }).click();
  await author.keyboard.type('coi rodo');
  author.on('dialog', (d) => d.accept());

  await author.getByRole('button', { name: 'Отправить на проверку' }).click();
  await author.getByText('Отправить курс на проверку можно только с подтверждённым email').waitFor();
  assert(true, 'без подтверждения почты — понятное сообщение с кнопкой повторной отправки');
  assert((await author.getByRole('button', { name: 'Отправить письмо повторно' }).count()) >= 1, 'есть кнопка «Отправить письмо повторно»');

  await verifyEmail(authorEmail);
  await author.getByRole('button', { name: 'Я подтвердил' }).first().click();
  await author.getByText('Email не подтверждён').first().waitFor({ state: 'detached' });
  assert(true, 'после перехода по ссылке и «Я подтвердил» предупреждение исчезло');

  await author.getByRole('button', { name: 'Отправить на проверку' }).click();
  await author.getByText('Курс на проверке').first().waitFor();
  assert(true, 'курс отправлен (текст урока досохранён перед отправкой)');
  assert(await author.getByRole('textbox', { name: 'Название', exact: true }).evaluate((el) => el.readOnly), 'на проверке редактирование заблокировано');

  // Админ
  const admin = await newPage(browser);
  const adminEmail = uniqueEmail('admin8');
  await register(admin, { name: 'Модератор', email: adminEmail });
  await setRole(await uidOf(adminEmail), 'admin');
  await admin.goto(`${BASE}/admin`);
  await admin.locator(`a[href="/admin/review/${courseId}"]`).click();
  await admin.getByText('coi rodo').waitFor();
  assert(true, 'админ видит курс в очереди и его содержимое');

  await admin.getByRole('button', { name: 'Отклонить…' }).click();
  await admin.getByRole('button', { name: 'Отклонить', exact: true }).click();
  await admin.getByText('Укажите причину отклонения').waitFor();
  assert(true, 'без причины отклонить нельзя');
  await admin.getByLabel('Причина отклонения').fill('Добавьте хотя бы одно задание.');
  await admin.getByRole('button', { name: 'Отклонить', exact: true }).click();
  await admin.waitForURL(`${BASE}/admin`);

  await author.getByText('Причина: Добавьте хотя бы одно задание.').waitFor();
  assert(true, 'автор видит причину отклонения');

  // Автор исправляет и отправляет снова
  await author.getByRole('textbox', { name: 'Текст урока' }).click();
  await author.keyboard.press('End');
  await author.keyboard.type(' — привет всем');
  await author.getByText('Все изменения сохранены').waitFor({ timeout: 10000 });
  await author.getByRole('button', { name: 'Отправить на проверку' }).click();
  await author.getByText('Курс на проверке').first().waitFor();
  assert(true, 'после правки отклонённый курс снова отправлен');

  await admin.goto(`${BASE}/admin/review/${courseId}`);
  await admin.getByText('coi rodo — привет всем').waitFor();
  await admin.getByRole('button', { name: 'Одобрить и опубликовать' }).click();
  await admin.waitForURL(`${BASE}/admin`);
  await author.getByText('Курс опубликован').waitFor();
  assert(true, 'одобрено — автор видит «Курс опубликован»');

  // Правка опубликованного: новая версия-черновик
  await author.getByRole('textbox', { name: 'Название', exact: true }).fill('Урок 1: приветствия');
  await author.getByText('Есть несогласованные изменения').waitFor({ timeout: 10000 });
  assert(true, 'правка опубликованного курса создала черновик новой версии');

  const res = await fetch(`http://127.0.0.1:8080/v1/projects/demo-polygloto/databases/(default)/documents/publicCourses/${courseId}/lessons`, {
    headers: { Authorization: 'Bearer owner' },
  });
  const lessons = await res.json();
  const title = lessons.documents?.[0]?.fields?.title?.stringValue;
  assert(title === 'Урок 1', `читатели видят прежнюю версию (заголовок урока в снимке: «${title}»)`);

  for (const page of [author, admin]) {
    const errors = page.errors.filter((e) => !e.includes('favicon'));
    assert(errors.length === 0, `нет ошибок в консоли (${errors.join(' | ')})`);
  }
} finally {
  await browser.close();
}
