// Список языков каталога (onPublicCourseWritten).
import { describe, expect, it } from 'vitest';
import { adminDb, waitFor } from './helpers.js';

const suffix = Date.now().toString(36);
const langA = { language: `Токипона ${suffix}`, languageLower: `токипона ${suffix}` };
const langB = { language: `Лойбан ${suffix}`, languageLower: `лойбан ${suffix}` };

async function languageItem(key) {
  const snap = await adminDb.doc('catalogMeta/languages').get();
  return (snap.data()?.items ?? []).find((i) => i.key === key) ?? null;
}

describe('onPublicCourseWritten', () => {
  it('считает курсы по языкам, обновляет при смене языка и удалении', async () => {
    const c1 = adminDb.collection('publicCourses').doc();
    const c2 = adminDb.collection('publicCourses').doc();
    await c1.set({ title: 'A', score: 0, ...langA });
    await c2.set({ title: 'B', score: 0, ...langA });
    await waitFor(async () => (await languageItem(langA.languageLower))?.count === 2);
    expect(await languageItem(langA.languageLower)).toEqual({ key: langA.languageLower, name: langA.language, count: 2 });

    // Изменение счётчиков не трогает язык.
    await c1.update({ likesCount: 5 });

    // Новая версия курса на другом языке: курс переходит в другой язык.
    await c2.set({ title: 'B', score: 0, ...langB });
    await waitFor(async () => (await languageItem(langA.languageLower))?.count === 1 && (await languageItem(langB.languageLower))?.count === 1);

    // Снятие с публикации: язык без курсов исчезает из списка.
    await c1.delete();
    await waitFor(async () => (await languageItem(langA.languageLower)) === null);
    await c2.delete();
    await waitFor(async () => (await languageItem(langB.languageLower)) === null);
  });
});
