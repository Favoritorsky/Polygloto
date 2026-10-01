// Сид опубликованного курса напрямую в эмулятор (как это сделала бы админка при одобрении).
import { getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore';
import { buildSearchKeywords, normalizeText } from '../../shared/schema.js';

process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
export const adminDb = getFirestore(getApps()[0] ?? initializeApp({ projectId: 'demo-polygloto' }));

/**
 * lessons: [{ id, title, blocks }], dictionary: [{ id, word, translation, partOfSpeech }].
 * Возвращает id курса.
 */
export async function seedPublishedCourse({ title, language = 'Испанский', authorId = 'seed', authorName = 'Сид', lessons = [], reference = [], dictionary = [], categories = [], extra = {} }) {
  const ref = adminDb.collection('publicCourses').doc();
  await ref.set({
    authorId, authorName, title, language, description: 'Курс для проверки.',
    categories, lessonOrder: lessons.map((l) => l.id), referenceOrder: reference.map((r) => r.id),
    toc: { lessons: lessons.map(({ id, title: t }) => ({ id, title: t })), reference: reference.map(({ id, title: t }) => ({ id, title: t })) },
    titleLower: normalizeText(title), languageLower: normalizeText(language), searchKeywords: buildSearchKeywords(title, language),
    likesCount: 0, dislikesCount: 0, score: 0, lessonsCount: lessons.length, wordsCount: dictionary.length,
    publishedAt: Timestamp.now(), updatedAt: FieldValue.serverTimestamp(), ...extra,
  });
  for (const { id, ...data } of lessons) await ref.collection('lessons').doc(id).set(data);
  for (const { id, ...data } of reference) await ref.collection('reference').doc(id).set(data);
  for (const { id, ...data } of dictionary) {
    await ref.collection('dictionary').doc(id).set({ examples: [], notes: '', partOfSpeech: 'other', ...data, wordLower: normalizeText(data.word) });
  }
  return ref.id;
}

export { FieldValue, Timestamp };
