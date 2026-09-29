import { createContext, useContext } from 'react';

/**
 * Контекст рендера контента: { categoriesById: Map, dictionary: DictionaryIndex | null, courseId }.
 * Через него листья получают категории и словарь без прокидывания пропсов.
 */
export const ContentContext = createContext({ categoriesById: new Map(), dictionary: null });

export function useContentContext() {
  return useContext(ContentContext);
}
