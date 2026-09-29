// Единая инициализация Admin SDK для всех функций.
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';

if (getApps().length === 0) initializeApp();

export const db = getFirestore();
export const adminAuth = getAuth();
export { FieldValue, Timestamp };
