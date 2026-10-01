import { createContext, useContext } from 'react';

/**
 * Контекст редактора курса:
 * { course, courseId, readOnly, isAuthor, ensureDraft(): Promise<void>, dictionary,
 *   registerAutosave({ flush, hasPending }) → unregister, flushAll(): Promise<boolean> }
 * ensureDraft() вызывается перед каждой записью: если курс опубликован или
 * отклонён, он сначала переводится в черновик (новая версия), опубликованный
 * снимок при этом остаётся виден читателям.
 */
export const CourseEditorContext = createContext(null);

export function useCourseEditor() {
  const ctx = useContext(CourseEditorContext);
  if (!ctx) throw new Error('useCourseEditor must be used inside CourseEditorContext');
  return ctx;
}
