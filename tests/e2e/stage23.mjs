// v2, этап 3: экспорт курса в JSON и импорт в новый черновик (с аудио и словарём).
import { readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BASE, assert, launch, newPage, register, uidOf, uniqueEmail } from './lib.mjs';
import { Timestamp, adminDb } from './seed.mjs';

const AUDIO = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';

const browser = await launch();
try {
  const page = await newPage(browser);
  const email = uniqueEmail('stage23');
  await register(page, { name: 'Переносчик', email });
  const uid = await uidOf(email);

  // Исходный черновик: 2 урока, раздел справочника, 2 слова, аудио в задании.
  const ref = adminDb.collection('courses').doc();
  const now = Timestamp.now();
  await ref.set({
    authorId: uid,
    title: 'Курс для переноса',
    language: 'Испанский',
    description: 'Проверка экспорта',
    categories: [{ id: 'g_noun', name: 'Существительное', color: '#2a9d8f', group: 'grammar', abbr: 'сущ.' }],
    lessonOrder: ['l2', 'l1'],
    referenceOrder: ['r1'],
    status: 'draft',
    rejectionReason: null,
    hasPublishedVersion: false,
    submittedAt: null,
    createdAt: now,
    updatedAt: now,
  });
  await ref
    .collection('lessons')
    .doc('l1')
    .set({
      title: 'Второй урок',
      blocks: [{ type: 'paragraph', children: [{ text: 'casa', dictRef: 'w2', category: 'g_noun' }] }],
      updatedAt: now,
    });
  await ref
    .collection('lessons')
    .doc('l2')
    .set({
      title: 'Первый урок',
      blocks: [
        { type: 'paragraph', children: [{ text: 'Hola', dictRef: 'w1' }] },
        {
          type: 'task',
          id: 't1',
          taskType: 'listening',
          data: {
            audio: { kind: 'file', id: 'a1' },
            question: 'Что звучит?',
            mode: 'input',
            options: [],
            correctOptionId: null,
            answers: ['hola'],
            transcript: '',
          },
        },
      ],
      updatedAt: now,
    });
  await ref
    .collection('reference')
    .doc('r1')
    .set({ title: 'Фонетика', blocks: [{ type: 'paragraph', children: [{ text: 'Ударение' }] }], updatedAt: now });
  for (const [id, word, translation] of [
    ['w1', 'hola', 'привет'],
    ['w2', 'casa', 'дом'],
  ]) {
    await ref
      .collection('dictionary')
      .doc(id)
      .set({ word, wordLower: word, translation, partOfSpeech: 'other', examples: [], notes: '', createdAt: now, updatedAt: now });
  }
  await ref.collection('audio').doc('a1').set({ dataUrl: AUDIO, name: 'hola.wav', createdAt: now });

  // Экспорт
  await page.goto(`${BASE}/courses/${ref.id}/edit`);
  await page.getByRole('tab', { name: 'Настройки курса' }).click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Скачать курс (JSON)' }).click()]);
  assert(
    /^kurs-dlya-perenosa-\d{4}-\d{2}-\d{2}\.polygloto\.json$/.test(download.suggestedFilename()),
    `имя файла: ${download.suggestedFilename()}`,
  );
  const file = join(tmpdir(), download.suggestedFilename());
  await download.saveAs(file);
  const json = JSON.parse(readFileSync(file, 'utf8'));
  assert(json.format === 'polygloto-course' && json.version === 1, 'формат и версия в файле');
  assert(json.lessons.map((l) => l.title).join('|') === 'Первый урок|Второй урок', 'уроки в порядке курса');
  assert(json.dictionary.length === 2 && json.audio.length === 1 && json.reference.length === 1, 'словарь, справочник и аудио в файле');

  // Импорт плохого файла
  await page.goto(`${BASE}/my-courses`);
  const bad = join(tmpdir(), `bad-${Date.now()}.json`);
  writeFileSync(bad, JSON.stringify({ hello: 'world' }));
  await page.getByLabel('Файл курса').setInputFiles(bad);
  await page.getByText('Это не файл курса Polygloto').waitFor();
  assert(true, 'чужой JSON: понятная ошибка');

  // Импорт экспортированного файла
  await page.getByLabel('Файл курса').setInputFiles(file);
  await page.waitForURL('**/courses/*/edit', { timeout: 30000 });
  const newId = page.url().split('/courses/')[1].split('/')[0];
  assert(newId !== ref.id, 'создан новый черновик');
  await page.getByRole('heading', { name: 'Курс для переноса' }).waitFor();
  const items = await page.locator('aside ol li').allInnerTexts();
  assert(items.length === 2 && items[0].includes('Первый урок') && items[1].includes('Второй урок'), 'уроки на месте и в том же порядке');

  const copy = adminDb.collection('courses').doc(newId);
  const meta = (await copy.get()).data();
  assert(meta.authorId === uid && meta.status === 'draft' && meta.hasPublishedVersion === false, 'импорт — черновик автора');
  assert(meta.categories.length === 1 && meta.categories[0].abbr === 'сущ.', 'категории перенесены');
  const lessonFirst = (await copy.collection('lessons').doc(meta.lessonOrder[0]).get()).data();
  assert(lessonFirst.blocks[0].children[0].dictRef === 'w1', 'ссылки на словарь сохранены');
  assert(lessonFirst.blocks[1].data.audio.id === 'a1', 'ссылка на аудио сохранена');
  assert((await copy.collection('dictionary').get()).size === 2, 'словарь перенесён');
  assert((await copy.collection('audio').doc('a1').get()).data()?.dataUrl === AUDIO, 'аудиофайл перенесён');
  assert((await copy.collection('reference').get()).size === 1, 'справочник перенесён');

  await page.getByRole('button', { name: 'Предпросмотр' }).click();
  await page.getByRole('button', { name: 'Слушать запись' }).click();
  await page.locator('audio').waitFor();
  assert(true, 'в импортированном курсе запись играет');
} finally {
  await browser.close();
}
