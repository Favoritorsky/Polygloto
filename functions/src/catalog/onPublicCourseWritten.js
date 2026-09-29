// Список языков каталога (catalogMeta/languages) для фильтра «Язык».
// Пересчитывается count()-запросом по затронутым языкам, поэтому идемпотентен
// и не расходится с реальностью при повторных срабатываниях триггера.
// Счётчики оценок/комментариев тоже пишут publicCourses — такие изменения
// язык не меняют и пропускаются без запросов.
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { CATALOG_LANGUAGES_DOC, COLLECTIONS } from '../../shared/schema.js';
import { db } from '../admin.js';

export const onPublicCourseWritten = onDocumentWritten(`${COLLECTIONS.PUBLIC_COURSES}/{courseId}`, async (event) => {
  const before = event.data?.before?.data();
  const after = event.data?.after?.data();
  const keys = new Set([before?.languageLower, after?.languageLower].filter(Boolean));
  if (before && after && before.languageLower === after.languageLower && before.language === after.language) return;
  if (keys.size === 0) return;

  const counts = await Promise.all(
    [...keys].map(async (key) => {
      const snap = await db.collection(COLLECTIONS.PUBLIC_COURSES).where('languageLower', '==', key).count().get();
      return [key, snap.data().count];
    }),
  );

  const ref = db.collection(COLLECTIONS.CATALOG_META).doc(CATALOG_LANGUAGES_DOC);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const items = new Map((snap.exists ? snap.data().items ?? [] : []).map((item) => [item.key, item]));
    for (const [key, count] of counts) {
      if (count === 0) {
        items.delete(key);
      } else {
        // Отображаемое название — из последнего опубликованного курса на этом языке.
        const name = after?.languageLower === key ? after.language : items.get(key)?.name ?? before.language;
        items.set(key, { key, name, count });
      }
    }
    const sorted = [...items.values()].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    tx.set(ref, { items: sorted });
  });
});
