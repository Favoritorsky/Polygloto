import { createContext, useContext } from 'react';

/** { course (publicCourses), dictionary: { entries, index, loading, error, retry } } */
export const CoursePageContext = createContext(null);

export function useCoursePage() {
  const ctx = useContext(CoursePageContext);
  if (!ctx) throw new Error('useCoursePage must be used inside CoursePageContext');
  return ctx;
}
