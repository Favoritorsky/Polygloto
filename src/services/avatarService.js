/**
 * Аватары без Firebase Storage (на тарифе Spark новый бакет Storage создать
 * нельзя). Картинка обрезается до квадрата, уменьшается до 160×160 и
 * сохраняется JPEG прямо в профиле (users.photoURL, data URL до 40 000
 * символов — это проверяют правила). Метаданные исходного файла (EXIF с
 * геопозицией и т.п.) при перекодировании теряются.
 */
import { LIMITS } from '../../shared/schema.js';
import { UserFacingError } from './errors.js';
import { updateOwnProfile } from './userService.js';

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
export const AVATAR_ACCEPT = ACCEPTED_TYPES.join(',');
const QUALITIES = [0.85, 0.75, 0.6, 0.45, 0.3];

export function validateAvatarFile(file) {
  if (!file) return 'Выберите файл.';
  if (!ACCEPTED_TYPES.includes(file.type)) return 'Подходят только картинки JPEG, PNG, WebP или GIF.';
  if (file.size > LIMITS.AVATAR_SOURCE_MAX_BYTES) return 'Файл слишком большой: не больше 15 МБ.';
  return null;
}

/** Квадратная обрезка по центру, уменьшение и JPEG, укладывающийся в лимит правил. */
export async function imageToAvatarDataUrl(file) {
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
  for (const quality of QUALITIES) {
    const url = canvas.toDataURL('image/jpeg', quality);
    if (url.startsWith('data:image/jpeg;base64,') && url.length <= LIMITS.AVATAR_DATA_URL_MAX) return url;
  }
  throw new UserFacingError('Не удалось сжать картинку. Попробуйте другой файл.');
}

export async function uploadAvatar(uid, file) {
  const problem = validateAvatarFile(file);
  if (problem) throw new UserFacingError(problem);
  const url = await imageToAvatarDataUrl(file);
  await updateOwnProfile(uid, { photoURL: url });
  return url;
}

export function removeAvatar(uid) {
  return updateOwnProfile(uid, { photoURL: null });
}
