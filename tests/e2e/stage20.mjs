// v2, этап 2: новые типы заданий (несколько ответов, порядок слов, аудирование)
// и аудио: загрузка файла, проверка ссылки, прослушивание, копирование при публикации.
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BASE, assert, launch, newPage, register, setRole, uidOf, uniqueEmail, verifyEmail } from './lib.mjs';

/** Короткий WAV (тишина 0,2 с, 8 кГц, 8 бит, моно). */
function wav(seconds = 0.2) {
  const samples = Math.round(8000 * seconds);
  const buf = Buffer.alloc(44 + samples);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + samples, 4);
  buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(8000, 24);
  buf.writeUInt32LE(8000, 28);
  buf.writeUInt16LE(1, 32);
  buf.writeUInt16LE(8, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(samples, 40);
  buf.fill(128, 44);
  return buf;
}
const smallFile = join(tmpdir(), `polygloto-${Date.now()}.wav`);
const bigFile = join(tmpdir(), `polygloto-big-${Date.now()}.wav`);
writeFileSync(smallFile, wav());
writeFileSync(bigFile, wav(50));

const browser = await launch();
try {
  const author = await newPage(browser);
  const authorEmail = uniqueEmail('stage20');
  await register(author, { name: 'Аудиоавтор', email: authorEmail });
  await author.goto(`${BASE}/my-courses`);
  await author.getByRole('button', { name: '+ Новый курс' }).click();
  await author.getByLabel('Название курса').fill('Испанский: новые задания');
  await author.getByLabel('Язык').fill('Испанский');
  await author.getByRole('button', { name: 'Создать черновик' }).click();
  await author.waitForURL('**/courses/*/edit');
  const courseId = author.url().split('/courses/')[1].split('/')[0];

  await author.getByRole('textbox', { name: 'Текст урока' }).click();
  await author.keyboard.type('Новые задания');
  async function insert(label) {
    await author.getByTitle('Вставить блок').click();
    await author.getByRole('button', { name: label, exact: true }).click();
  }

  // Несколько правильных ответов
  await insert('Несколько правильных ответов');
  await author
    .getByText('Не отмечен ни один правильный вариант.')
    .waitFor({ state: 'detached' })
    .catch(() => {});
  await author.getByRole('textbox', { name: 'Вопрос' }).last().fill('Какие слова — глаголы?');
  await author.getByLabel('Вариант 1', { exact: true }).fill('hablar');
  await author.getByLabel('Вариант 2', { exact: true }).fill('casa');
  await author.getByLabel('Вариант 3', { exact: true }).fill('comer');
  await author.getByLabel('Вариант 3 правильный').check();
  assert(await author.getByLabel('Вариант 1 правильный').isChecked(), 'несколько ответов: флажки, первый отмечен по умолчанию');

  // Порядок слов
  await insert('Порядок слов');
  await author.getByText('Нужно предложение минимум из двух слов.').waitFor();
  assert(true, 'порядок слов: пустое задание просит предложение');
  await author.getByLabel('Предложение в правильном порядке 1').fill('Yo me llamo Ana.');
  await author.getByRole('button', { name: '+ допустимый вариант' }).last().click();
  await author.getByLabel('Предложение в правильном порядке 2').fill('Me llamo Ana yo');
  await author.getByLabel('Подсказка-перевод (необязательно)').fill('Меня зовут Аня.');

  // Аудирование: проверки ссылки и размера, затем загрузка файла
  await insert('Аудирование');
  await author.getByText('Нет аудио.').waitFor();
  await author.getByLabel('Ссылка на аудио').fill('https://example.com/hola.mp3');
  await author.getByRole('button', { name: 'Добавить ссылку' }).click();
  await author.getByText('Ссылки разрешены только на upload.wikimedia.org').waitFor();
  assert(true, 'ссылка на чужой хост отклонена');
  await author.getByLabel('Ссылка на аудио').fill('https://upload.wikimedia.org/page.html');
  await author.getByRole('button', { name: 'Добавить ссылку' }).click();
  await author.getByText('Ссылка должна вести на файл').waitFor();
  assert(true, 'ссылка не на аудиофайл отклонена');
  await author.getByLabel('Аудиофайл').setInputFiles(bigFile);
  await author.getByText(/Файл больше 350 КБ/).waitFor();
  assert(true, 'слишком большой файл отклонён с подсказкой');
  await author.getByLabel('Аудиофайл').setInputFiles(smallFile);
  await author.getByText('файл курса').waitFor();
  assert(true, 'файл загружен в курс');
  await author.getByRole('textbox', { name: 'Вопрос' }).last().fill('Что прозвучало?');
  const listenEditor = author.getByRole('group', { name: 'Запись' }).locator('xpath=..');
  await listenEditor.getByLabel('Вариант 1', { exact: true }).fill('hola');
  await listenEditor.getByLabel('Вариант 2', { exact: true }).fill('adiós');
  await author.getByLabel('Расшифровка (покажется после ответа, необязательно)').fill('¡Hola!');

  await author.getByText('Все изменения сохранены').waitFor({ timeout: 10000 });
  await author.reload();
  await author.getByRole('button', { name: 'Предпросмотр' }).click();
  const tasks = author.locator('form[aria-label^="Задание"]');
  await tasks.first().waitFor();
  assert((await tasks.count()) === 3, 'после перезагрузки все 3 задания на месте');

  // Несколько ответов: частично → неверно, точно → верно
  const ms = tasks.nth(0);
  await ms.getByLabel('hablar').check();
  await ms.getByRole('button', { name: 'Проверить' }).click();
  await ms.getByText('✗ Пока неверно.').waitFor();
  await ms.getByText('тоже правильный').waitFor();
  assert(true, 'выбран не весь набор: неверно, пропущенный отмечен');
  await ms.getByRole('button', { name: 'Ещё раз' }).click();
  await ms.getByLabel('hablar').check();
  await ms.getByLabel('casa').check();
  await ms.getByLabel('comer').check();
  await ms.getByRole('button', { name: 'Проверить' }).click();
  await ms
    .getByText('✓ Верно!')
    .waitFor({ state: 'detached', timeout: 1000 })
    .catch(() => {});
  assert((await ms.getByText('✗ Пока неверно.').count()) === 1, 'лишний вариант: неверно');
  await ms.getByRole('button', { name: 'Ещё раз' }).click();
  await ms.getByLabel('hablar').check();
  await ms.getByLabel('comer').check();
  await ms.getByRole('button', { name: 'Проверить' }).click();
  await ms.getByText('✓ Верно!').waitFor();
  assert(true, 'ровно все правильные: верно');

  // Порядок слов
  const so = tasks.nth(1);
  assert(await so.getByRole('button', { name: 'Проверить' }).isDisabled(), 'пока не все слова расставлены, проверить нельзя');
  const bank = so.getByRole('group', { name: 'Слова' });
  for (const w of ['llamo', 'me', 'Yo', 'Ana.']) await bank.getByRole('button', { name: w, exact: true }).click();
  await so.getByRole('button', { name: 'Проверить' }).click();
  await so.getByText('✗ Пока неверно.').waitFor();
  await so.getByText('Правильный вариант: «Yo me llamo Ana.»').waitFor();
  assert(true, 'неверный порядок: показан правильный');
  await so.getByRole('button', { name: 'Ещё раз' }).click();
  for (const w of ['Me', 'llamo', 'Ana.', 'Yo'])
    await bank
      .getByRole('button', { name: w, exact: false })
      .filter({ hasText: new RegExp(`^${w.replace('.', '\\.')}$`, 'i') })
      .first()
      .click();
  // Слово можно вернуть из ответа в банк.
  await so.getByRole('button', { name: 'Убрать «Yo»' }).click();
  assert(await so.getByRole('button', { name: 'Проверить' }).isDisabled(), 'слово вернулось в банк');
  await bank.getByRole('button', { name: 'Yo', exact: true }).click();
  await so.getByRole('button', { name: 'Проверить' }).click();
  await so.getByText('✓ Верно!').waitFor();
  assert(true, 'допустимый второй порядок засчитан (знаки препинания не важны)');

  // Аудирование
  const li = tasks.nth(2);
  await li.getByRole('button', { name: 'Слушать запись' }).click();
  const audio = li.locator('audio');
  await audio.waitFor();
  assert((await audio.getAttribute('src')).startsWith('data:audio/wav;base64,'), 'файл загружается по кнопке и играет как data URL');
  await li.getByLabel('hola').check();
  await li.getByRole('button', { name: 'Проверить' }).click();
  await li.getByText('✓ Верно!').waitFor();
  await li.getByText('¡Hola!').waitFor();
  assert(true, 'аудирование: верно, после ответа видна расшифровка');

  // Публикация: файл копируется в снимок и доступен читателю без входа
  await author.getByRole('button', { name: 'Редактировать' }).click();
  author.on('dialog', (d) => d.accept());
  await author.getByRole('button', { name: 'Отправить на проверку' }).click();
  await author.getByText('Отправить курс на проверку можно только с подтверждённым email').waitFor();
  await verifyEmail(authorEmail);
  await author.getByRole('button', { name: 'Я подтвердил' }).first().click();
  await author.getByText('Email не подтверждён').first().waitFor({ state: 'detached' });
  await author.getByRole('button', { name: 'Отправить на проверку' }).click();
  await author.getByRole('button', { name: 'Отозвать и редактировать' }).waitFor();

  const admin = await newPage(browser);
  const adminEmail = uniqueEmail('admin20');
  await register(admin, { name: 'Модератор', email: adminEmail });
  await setRole(await uidOf(adminEmail), 'admin');
  await admin.goto(`${BASE}/admin/review/${courseId}`);
  await admin.getByRole('button', { name: 'Слушать запись' }).click();
  await admin.locator('audio').waitFor();
  assert(true, 'модератор слушает запись из черновика');
  await admin.getByRole('button', { name: 'Одобрить и опубликовать' }).click();
  await admin.waitForURL(`${BASE}/admin`);

  const reader = await newPage(browser);
  await reader.goto(`${BASE}/course/${courseId}`);
  await reader.getByRole('button', { name: 'Слушать запись' }).click();
  await reader.locator('audio').waitFor();
  assert((await reader.locator('audio').getAttribute('src')).startsWith('data:audio/wav'), 'гость слушает запись из опубликованного курса');
  assert((await reader.locator('form[aria-label^="Задание"]').count()) === 3, 'гость видит все 3 задания');
} finally {
  await browser.close();
}
