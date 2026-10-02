// CI: миграция языков курсов на курируемый список (curatedLanguages).
//
// 1. Один раз (отметка в catalogMeta/migrations) заполняет curatedLanguages
//    языками, которые реально встречаются в курсах и опубликованных снимках.
//    Если одно название написано по-разному («Испанский» / «испанский»), в
//    список идёт самое частое написание.
// 2. Каждый запуск: курсам и снимкам без languageCategory ставит 'official'
//    (и languageId), если language ТОЧНО (с учётом регистра) совпадает с
//    названием из списка, иначе 'custom'. Само поле language не меняется.
//
// Повторный запуск безопасен. Флаг --dry-run только печатает, что будет сделано.
// Нужен сервисный аккаунт (GOOGLE_APPLICATION_CREDENTIALS) или эмулятор
// (FIRESTORE_EMULATOR_HOST).
import { initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { normalizeText } from '../shared/schema.js';

const DRY_RUN = process.argv.includes('--dry-run');
const MARKER = { collection: 'catalogMeta', id: 'migrations', field: 'curatedLanguagesSeededAt' };

initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT });
const db = getFirestore();

const [courses, published, curatedSnap, marker] = await Promise.all([
  db.collection('courses').get(),
  db.collection('publicCourses').get(),
  db.collection('curatedLanguages').get(),
  db.collection(MARKER.collection).doc(MARKER.id).get(),
]);
const allDocs = [...courses.docs, ...published.docs];
console.log(`Курсов: ${courses.size}, опубликованных снимков: ${published.size}, языков в списке: ${curatedSnap.size}.`);

let curated = curatedSnap.docs.map((d) => ({ id: d.id, name: d.data().name }));

if (!marker.exists || !marker.data()[MARKER.field]) {
  // Самое частое написание каждого языка.
  const spellings = new Map();
  for (const d of allDocs) {
    const name = String(d.data().language ?? '').trim();
    if (name.length < 2 || name.length > 60) continue;
    const key = normalizeText(name);
    const counts = spellings.get(key) ?? new Map();
    counts.set(name, (counts.get(name) ?? 0) + 1);
    spellings.set(key, counts);
  }
  const known = new Set(curated.map((l) => normalizeText(l.name)));
  const toAdd = [];
  for (const [key, counts] of spellings) {
    if (known.has(key)) continue;
    const [name] = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
    toAdd.push(name);
    if (counts.size > 1) console.log(`  «${name}»: другие написания (${[...counts.keys()].filter((n) => n !== name).join(', ')}) останутся «Другой язык».`);
  }
  console.log(`Добавляю в список языков: ${toAdd.length ? toAdd.join(', ') : 'ничего'}.`);
  if (!DRY_RUN) {
    for (const name of toAdd) {
      const ref = await db.collection('curatedLanguages').add({ name });
      curated.push({ id: ref.id, name });
    }
    await db.collection(MARKER.collection).doc(MARKER.id).set({ [MARKER.field]: FieldValue.serverTimestamp() }, { merge: true });
  } else {
    curated = [...curated, ...toAdd.map((name) => ({ id: `(новый:${name})`, name }))];
  }
} else {
  console.log('Список языков уже заполнялся раньше — не трогаю его.');
}

const byName = new Map(curated.map((l) => [l.name, l.id]));
let official = 0;
let custom = 0;
let batch = db.batch();
let pending = 0;
for (const d of allDocs) {
  const data = d.data();
  if (data.languageCategory === 'official' || data.languageCategory === 'custom') continue;
  const id = byName.get(data.language);
  // Только новые поля: language остаётся как был.
  const patch = id ? { languageCategory: 'official', languageId: id } : { languageCategory: 'custom', languageId: null };
  if (id) official += 1;
  else custom += 1;
  console.log(`  ${d.ref.path}: «${data.language}» → ${patch.languageCategory}`);
  if (DRY_RUN) continue;
  batch.update(d.ref, patch);
  pending += 1;
  if (pending === 400) {
    await batch.commit();
    batch = db.batch();
    pending = 0;
  }
}
if (pending) await batch.commit();
console.log(`${DRY_RUN ? 'Будет помечено' : 'Помечено'}: official — ${official}, custom — ${custom}.`);
