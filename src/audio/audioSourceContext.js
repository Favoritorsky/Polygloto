import { createContext, useContext } from 'react';

/**
 * Откуда брать загруженные аудиофайлы курса:
 * { load(audioId) → Promise<dataUrl>, upload(file) → Promise<audioId> | undefined }.
 * Читатель — из publicCourses, автор и модератор — из courses (см. AudioSourceProvider).
 * Внешние ссылки (kind 'url') контекст не требуют.
 */
export const AudioSourceContext = createContext({
  load: () => Promise.reject(new Error('Аудиофайл недоступен.')),
  upload: undefined,
});

export function useAudioSource() {
  return useContext(AudioSourceContext);
}
