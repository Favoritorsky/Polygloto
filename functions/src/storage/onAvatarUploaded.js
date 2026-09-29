// Ограничение места под аватары: правила Storage не умеют считать файлы, поэтому
// после каждой загрузки в папке avatars/{uid}/ остаются только AVATARS_KEPT
// самых новых. Обычный клиент сам удаляет прежнее фото; триггер защищает от
// скрипта, который грузил бы файлы в свою папку без конца.
import { onObjectFinalized } from 'firebase-functions/v2/storage';
import { bucket } from '../admin.js';

const AVATARS_KEPT = 3;
const PATH_RE = /^avatars\/([^/]+)\/[^/]+$/;

export const onAvatarUploaded = onObjectFinalized(async (event) => {
  const match = PATH_RE.exec(event.data.name ?? '');
  if (!match) return;
  const [files] = await bucket().getFiles({ prefix: `avatars/${match[1]}/` });
  const stale = files
    .sort((a, b) => new Date(b.metadata.timeCreated) - new Date(a.metadata.timeCreated) || b.name.localeCompare(a.name))
    .slice(AVATARS_KEPT);
  await Promise.all(stale.map((file) => file.delete({ ignoreNotFound: true })));
});
