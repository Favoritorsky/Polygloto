/**
 * Аватары в Storage: avatars/{uid}/{время}.jpg. Картинка уменьшается и
 * обрезается до квадрата в браузере, поэтому в хранилище попадает маленький
 * JPEG без метаданных исходного файла (EXIF с геопозицией и т.п.).
 */
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { LIMITS } from '../../shared/schema.js';
import { UserFacingError } from './errors.js';
import { storage } from './firebase.js';
import { updateOwnProfile } from './userService.js';

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
export const AVATAR_ACCEPT = ACCEPTED_TYPES.join(',');

export function validateAvatarFile(file) {
  if (!file) return 'Выберите файл.';
  if (!ACCEPTED_TYPES.includes(file.type)) return 'Подходят только картинки JPEG, PNG, WebP или GIF.';
  if (file.size > LIMITS.AVATAR_SOURCE_MAX_BYTES) return 'Файл слишком большой: не больше 15 МБ.';
  return null;
}

/** Квадратная обрезка по центру и уменьшение до AVATAR_SIZE_PX. */
async function resizeToSquareJpeg(file) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new UserFacingError('Не удалось прочитать картинку. Попробуйте другой файл.');
  }
  const side = Math.min(bitmap.width, bitmap.height);
  const size = Math.min(LIMITS.AVATAR_SIZE_PX, side);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff'; // прозрачный фон PNG иначе станет чёрным в JPEG
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
  bitmap.close?.();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.88));
  if (!blob) throw new UserFacingError('Не удалось обработать картинку.');
  return blob;
}

async function deleteByUrl(url) {
  if (!url) return;
  try {
    await deleteObject(ref(storage, url));
  } catch {
    // Старый файл уже удалён или ссылка не наша — профиль от этого не страдает.
  }
}

/** Загружает новый аватар, записывает ссылку в профиль и удаляет прежний файл. */
export async function uploadAvatar(uid, file, previousUrl) {
  const problem = validateAvatarFile(file);
  if (problem) throw new UserFacingError(problem);
  const blob = await resizeToSquareJpeg(file);
  const fileRef = ref(storage, `avatars/${uid}/${Date.now()}.jpg`);
  await uploadBytes(fileRef, blob, { contentType: 'image/jpeg', cacheControl: 'public, max-age=31536000' });
  const url = await getDownloadURL(fileRef);
  try {
    await updateOwnProfile(uid, { photoURL: url });
  } catch (error) {
    await deleteObject(fileRef).catch(() => {});
    throw error;
  }
  await deleteByUrl(previousUrl);
  return url;
}

export async function removeAvatar(uid, currentUrl) {
  await updateOwnProfile(uid, { photoURL: null });
  await deleteByUrl(currentUrl);
}
