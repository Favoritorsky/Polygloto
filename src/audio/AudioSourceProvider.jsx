import { useMemo } from 'react';
import { COLLECTIONS } from '../../shared/schema.js';
import { loadCourseAudio, uploadCourseAudio } from '../services/audioService.js';
import { AudioSourceContext } from './audioSourceContext.js';

/**
 * Подключает аудиофайлы курса. published — читатель (снимок publicCourses);
 * иначе рабочая версия (автор, модератор). uid — для загрузки (только автор).
 */
export default function AudioSourceProvider({ courseId, published = false, uid = null, children }) {
  const value = useMemo(() => {
    const root = published ? COLLECTIONS.PUBLIC_COURSES : COLLECTIONS.COURSES;
    return {
      load: (audioId) => loadCourseAudio(root, courseId, audioId),
      upload: !published && uid ? (file) => uploadCourseAudio(uid, courseId, file) : undefined,
    };
  }, [courseId, published, uid]);
  return <AudioSourceContext.Provider value={value}>{children}</AudioSourceContext.Provider>;
}
