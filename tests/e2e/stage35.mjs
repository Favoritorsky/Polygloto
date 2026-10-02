// Курируемый список языков: миграция старых курсов, раздел «Языки» в админке,
// выбор языка из списка или «Другой язык» при создании курса, фильтры каталога.
import { execFileSync } from 'node:child_process';
import { buildSearchKeywords, normalizeText } from '../../shared/schema.js';
import { BASE, assert, launch, newPage, register, setRole, uidOf, uniqueEmail } from './lib.mjs';
import { FieldValue, Timestamp, adminDb } from './seed.mjs';

const tag = `l${Date.now().toString(36)}`;
const oldLanguage = `Старый ${tag}`;
const newLanguage = `Новый ${tag}`;

// Курсы «до доработки»: без languageCategory.
const legacyPublic = adminDb.collection('publicCourses').doc();
await legacyPublic.set({
  authorId: 'seed', authorName: 'Сид', title: `Старый курс ${tag}`, language: oldLanguage, description: '',
  categories: [], lessonOrder: [], referenceOrder: [], toc: { lessons: [], reference: [] },
  titleLower: normalizeText(`Старый курс ${tag}`), languageLower: normalizeText(oldLanguage),
  searchKeywords: buildSearchKeywords(`Старый курс ${tag}`, oldLanguage),
  likesCount: 0, dislikesCount: 0, score: 0, lessonsCount: 0, wordsCount: 0,
  publishedAt: Timestamp.now(), updatedAt: FieldValue.serverTimestamp(),
});
const legacyDraft = adminDb.collection('courses').doc();
await legacyDraft.set({
  authorId: 'seed', title: `Старый черновик ${tag}`, language: oldLanguage, description: '', categories: [],
  lessonOrder: [], referenceOrder: [], status: 'draft', rejectionReason: null, hasPublishedVersion: false,
  submittedAt: null, createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
});
// Список ещё не заполнялся: миграция должна собрать языки из курсов.
await adminDb.doc('catalogMeta/migrations').delete();

execFileSync('node', ['scripts/migrate-languages.mjs'], {
  env: { ...process.env, FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080', GCLOUD_PROJECT: 'demo-polygloto' },
  stdio: 'inherit',
});

const curated = (await adminDb.collection('curatedLanguages').where('name', '==', oldLanguage).get()).docs;
assert(curated.length === 1, 'язык из существующих курсов попал в список');
const oldId = curated[0].id;
for (const ref of [legacyPublic, legacyDraft]) {
  const data = (await ref.get()).data();
  assert(data.language === oldLanguage, `${ref.path}: поле language не изменилось`);
  assert(data.languageCategory === 'official' && data.languageId === oldId, `${ref.path}: помечен как язык из списка`);
}
// Повторный запуск ничего не ломает и список не дублирует.
execFileSync('node', ['scripts/migrate-languages.mjs'], {
  env: { ...process.env, FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080', GCLOUD_PROJECT: 'demo-polygloto' },
  stdio: 'ignore',
});
assert((await adminDb.collection('curatedLanguages').where('name', '==', oldLanguage).get()).size === 1, 'повторная миграция не дублирует языки');

const browser = await launch();
try {
  // Каталог: старый курс находится по своему языку.
  const page = await newPage(browser);
  await page.goto(`${BASE}/catalog`);
  const langSelect = page.getByLabel('Язык', { exact: true });
  await langSelect.locator('option', { hasText: oldLanguage }).waitFor({ state: 'attached' });
  await langSelect.selectOption({ label: oldLanguage });
  await page.getByText(`Старый курс ${tag}`).waitFor();
  assert(true, 'старый курс виден в фильтре по своему языку после миграции');

  // Админ добавляет язык в список.
  const admin = await newPage(browser);
  const adminEmail = uniqueEmail('admin35');
  await register(admin, { name: 'Куратор', email: adminEmail });
  await setRole(await uidOf(adminEmail), 'admin');
  await admin.goto(`${BASE}/admin`);
  await admin.getByRole('tab', { name: 'Языки' }).click();
  await admin.getByLabel('Новый язык').fill(newLanguage);
  await admin.getByRole('button', { name: 'Добавить' }).click();
  await admin.getByText(newLanguage).waitFor();
  await admin.getByLabel('Новый язык').fill(newLanguage.toUpperCase());
  await admin.getByRole('button', { name: 'Добавить' }).click();
  await admin.getByText('Такой язык уже есть в списке.').waitFor();
  assert(true, 'админ добавляет язык, повтор без учёта регистра не пускает');

  // Автор выбирает язык из списка.
  const author = await newPage(browser);
  await register(author, { name: 'Автор35', email: uniqueEmail('author35') });
  await author.goto(`${BASE}/my-courses`);
  await author.getByRole('button', { name: '+ Новый курс' }).click();
  await author.getByLabel('Название курса').fill(`Курс ${tag}`);
  const select = author.getByLabel('Язык', { exact: true });
  await select.locator('option', { hasText: newLanguage }).waitFor({ state: 'attached' });
  await author.getByRole('button', { name: 'Создать черновик' }).click();
  await author.getByText('Выберите язык из списка или пункт «Другой язык».').waitFor();
  await select.selectOption({ label: newLanguage });
  await author.getByRole('button', { name: 'Создать черновик' }).click();
  await author.waitForURL('**/courses/*/edit');
  const courseId = author.url().split('/courses/')[1].split('/')[0];
  let data = (await adminDb.doc(`courses/${courseId}`).get()).data();
  assert(data.language === newLanguage && data.languageCategory === 'official' && typeof data.languageId === 'string', 'курс с языком из списка — official');

  // В настройках — «Другой язык».
  await author.getByRole('tab', { name: 'Настройки курса' }).click();
  const settingsSelect = author.getByLabel('Язык', { exact: true });
  await settingsSelect.locator('option', { hasText: newLanguage }).waitFor({ state: 'attached' });
  assert((await settingsSelect.inputValue()) === data.languageId, 'в настройках выбран язык курса');
  await settingsSelect.selectOption({ label: 'Другой язык' });
  await author.getByLabel('Название языка').fill(`Квенья ${tag}`);
  await author.getByText('Все изменения сохранены').waitFor({ timeout: 10000 });
  for (let i = 0; i < 20; i += 1) {
    data = (await adminDb.doc(`courses/${courseId}`).get()).data();
    if (data.languageCategory === 'custom') break;
    await author.waitForTimeout(300);
  }
  assert(data.language === `Квенья ${tag}` && data.languageCategory === 'custom' && data.languageId === null, 'свой язык — custom');

  const errors = [...page.errors, ...admin.errors, ...author.errors].filter((e) => !e.includes('favicon'));
  assert(errors.length === 0, `нет ошибок в консоли (${errors.join(' | ')})`);
} finally {
  await browser.close();
}
