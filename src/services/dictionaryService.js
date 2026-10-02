/**
 * Словарь курса: courses/{id}/dictionary (рабочая версия, автор) и
 * publicCourses/{id}/dictionary (опубликованная, читатели).
 */
import { sanitizeAudioRef } from '../../shared/audio.js';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { COLLECTIONS, LIMITS, PART_OF_SPEECH_IDS, SUBCOLLECTIONS, normalizeText } from '../../shared/schema.js';
import { db } from './firebase.js';

const dictionaryCol = (courseId, published) =>
  collection(db, published ? COLLECTIONS.PUBLIC_COURSES : COLLECTIONS.COURSES, courseId, SUBCOLLECTIONS.DICTIONARY);

export function subscribeToDictionary(courseId, { published = false } = {}, onData, onError) {
  return onSnapshot(
    dictionaryCol(courseId, published),
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    onError,
  );
}

/** Клиентская валидация (дублирует firestore.rules). */
export function validateWord({ word, translation, partOfSpeech, examples, notes, pronunciation = '' }) {
  const errors = {};
  if (!word.trim() || word.trim().length > LIMITS.WORD_MAX) errors.word = `Слово: от 1 до ${LIMITS.WORD_MAX} символов.`;
  if (!translation.trim() || translation.trim().length > LIMITS.TRANSLATION_MAX) {
    errors.translation = `Перевод: от 1 до ${LIMITS.TRANSLATION_MAX} символов.`;
  }
  if (!PART_OF_SPEECH_IDS.includes(partOfSpeech)) errors.partOfSpeech = 'Выберите часть речи.';
  const cleanExamples = examples.map((e) => e.trim()).filter(Boolean);
  if (cleanExamples.length > LIMITS.WORD_EXAMPLES_MAX) errors.examples = `Не больше ${LIMITS.WORD_EXAMPLES_MAX} примеров.`;
  if (cleanExamples.some((e) => e.length > LIMITS.WORD_EXAMPLE_MAX)) {
    errors.examples = `Пример: не больше ${LIMITS.WORD_EXAMPLE_MAX} символов.`;
  }
  if (pronunciation.trim().length > LIMITS.WORD_PRONUNCIATION_MAX) {
    errors.pronunciation = `Произношение: не больше ${LIMITS.WORD_PRONUNCIATION_MAX} символов.`;
  }
  if (notes.length > LIMITS.WORD_NOTES_MAX) errors.notes = `Заметки: не больше ${LIMITS.WORD_NOTES_MAX} символов.`;
  return errors;
}

function toDoc({ word, translation, partOfSpeech, examples, notes, pronunciation = '', audio }) {
  return {
    audio: sanitizeAudioRef(audio),
    word: word.trim(),
    wordLower: normalizeText(word).slice(0, LIMITS.WORD_MAX),
    translation: translation.trim(),
    partOfSpeech,
    examples: examples.map((e) => e.trim()).filter(Boolean),
    notes: notes.trim(),
    pronunciation: pronunciation.trim(),
    updatedAt: serverTimestamp(),
  };
}

export async function addWord(courseId, word) {
  const ref = await addDoc(dictionaryCol(courseId, false), { ...toDoc(word), createdAt: serverTimestamp() });
  return ref.id;
}

export function updateWord(courseId, wordId, word) {
  return updateDoc(doc(dictionaryCol(courseId, false), wordId), toDoc(word));
}

export function deleteWord(courseId, wordId) {
  return deleteDoc(doc(dictionaryCol(courseId, false), wordId));
}
