import { createContext, useContext } from 'react';

/**
 * { course (publicCourses), dictionary: { entries, index, loading, error, retry },
 *   review: { wordIds: Set, adding: Set, add(entry) } | null — повторение, только для вошедших }
 */
export const CoursePageContext = createContext(null);

export function useCoursePage() {
  const ctx = useContext(CoursePageContext);
  if (!ctx) throw new Error('useCoursePage must be used inside CoursePageContext');
  return ctx;
}
