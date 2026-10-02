// v2, этап 3: аудиовставка в тексте урока и произношение в карточке словаря.
import { sanitizeWord } from '../../shared/content.js';
import { PART_OF_SPEECH_IDS } from '../../shared/schema.js';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BASE, assert, launch, newPage, register, uniqueEmail } from './lib.mjs';
import { adminDb } from './seed.mjs';

const wavFile = join(tmpdir(), `pron-${Date.now()}.wav`);
const wav = Buffer.alloc(44 + 800, 128);
wav.write('RIFF', 0);
wav.writeUInt32LE(36 + 800, 4);
wav.write('WAVEfmt ', 8);
wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20);
wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(8000, 24);
wav.writeUInt32LE(8000, 28);
wav.writeUInt16LE(1, 32);
wav.writeUInt16LE(8, 34);
wav.write('data', 36);
wav.writeUInt32LE(800, 40);
writeFileSync(wavFile, wav);

const LINK = 'https://upload.wikimedia.org/wikipedia/commons/0/00/Es-hola.ogg';

const browser = await launch();
try {
  const page = await newPage(browser);
  await register(page, { name: 'Звукорежиссёр', email: uniqueEmail('stage24') });
  await page.goto(`${BASE}/my-courses`);
  await page.getByRole('button', { name: '+ Новый курс' }).click();
  await page.getByLabel('Название курса').fill('Аудио в тексте');
  await page.getByLabel('Язык').fill('Испанский');
  await page.getByRole('button', { name: 'Создать черновик' }).click();
  await page.waitForURL('**/courses/*/edit');
  const courseId = page.url().split('/courses/')[1].split('/')[0];

  // Слово с произношением (загруженный файл)
  await page.getByRole('tab', { name: 'Словарь' }).click();
  await page.getByLabel('Слово', { exact: true }).fill('hola');
  await page.getByLabel('Перевод').fill('привет');
  await page.getByLabel('Произношение (необязательно)').fill('[ˈo.la]');
  const pron = page.getByRole('group', { name: 'Запись произношения (необязательно)' });
  await pron.getByLabel('Аудиофайл').setInputFiles(wavFile);
  await pron.getByText('файл курса').waitFor();
  await page.getByRole('button', { name: 'Добавить', exact: true }).click();
  const entry = page.locator('li', { hasText: 'привет' }).first();
  await entry.getByRole('button', { name: 'Произношение: hola' }).waitFor();
  assert(true, 'у слова в словаре кнопка произношения');
  await entry.getByRole('button', { name: 'Произношение: hola' }).click();
  await entry.locator('audio').waitFor();
  assert((await entry.locator('audio').getAttribute('src')).startsWith('data:audio/wav'), 'произношение играет из файла курса');
  const words = await adminDb.collection(`courses/${courseId}/dictionary`).get();
  assert(words.docs[0].data().audio?.kind === 'file', 'в базе у слова ссылка на файл');
  assert(words.docs[0].data().pronunciation === '[ˈo.la]', 'в базе у слова произношение текстом');
  assert(await entry.getByText('[ˈo.la]').isVisible(), 'произношение текстом видно в словаре');

  // Аудиоблок в уроке со ссылкой на Викисклад
  await page.getByRole('tab', { name: 'Самоучитель' }).click();
  await page.getByRole('textbox', { name: 'Текст урока' }).click();
  await page.keyboard.type('Послушайте: hola');
  await page.getByTitle('Вставить блок').click();
  await page.getByRole('button', { name: 'Аудио', exact: true }).click();
  await page.getByText('Пока запись не выбрана, читатель этот блок не увидит.').waitFor();
  assert(true, 'пустой аудиоблок предупреждает автора');
  const block = page.getByRole('group', { name: 'Запись' });
  await block.getByLabel('Ссылка на аудио').fill('https://example.com/x.mp3');
  await block.getByRole('button', { name: 'Добавить ссылку' }).click();
  await block.getByText('Ссылки разрешены только на upload.wikimedia.org').waitFor();
  await block.getByLabel('Ссылка на аудио').fill(LINK);
  await block.getByRole('button', { name: 'Добавить ссылку' }).click();
  await block.getByText('upload.wikimedia.org').waitFor();
  await page.getByLabel('Подпись (необязательно)').fill('Приветствие');
  await page.getByText('Все изменения сохранены').waitFor({ timeout: 10000 });

  await page.reload();
  await page.getByRole('button', { name: 'Предпросмотр' }).click();
  await page.getByText('Приветствие').waitFor();
  await page.getByRole('button', { name: 'Слушать: Приветствие' }).click();
  const audio = page.locator('figure audio');
  await audio.waitFor();
  assert((await audio.getAttribute('src')) === LINK, 'аудиоблок играет по ссылке');

  // Подсказка слова в тексте: кнопка произношения не закрывает подсказку
  await page.locator('[role="button"]', { hasText: 'hola' }).click();
  const tip = page.getByRole('tooltip');
  await tip.getByRole('button', { name: 'Произношение: hola' }).click();
  await tip.locator('audio').waitFor();
  assert((await tip.count()) === 1, 'в подсказке слова играет произношение, подсказка остаётся открытой');
  assert(await tip.getByText('[ˈo.la]').isVisible(), 'в подсказке слова видно произношение текстом');

  // После публикации произношение попадает к читателям (снимок курса проходит sanitizeWord).
  const published = sanitizeWord(words.docs[0].data(), PART_OF_SPEECH_IDS);
  assert(published.pronunciation === '[ˈo.la]', 'произношение сохраняется при публикации');
} finally {
  await browser.close();
}
