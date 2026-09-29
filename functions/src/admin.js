// Единая инициализация Admin SDK для всех функций.
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

if (getApps().length === 0) initializeApp();

export const db = getFirestore();
export const adminAuth = getAuth();
/** Бакет по умолчанию (аватары). */
export const bucket = () => getStorage().bucket();
export { FieldValue, Timestamp };
