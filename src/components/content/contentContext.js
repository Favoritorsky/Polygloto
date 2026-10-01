import { createContext, useContext } from 'react';

/**
 * Контекст рендера контента: { categoriesById: Map, dictionary: DictionaryIndex | null, courseId,
 * hiddenCategories: Set id категорий, чью подсветку читатель скрыл в легенде,
 * review: { wordIds, adding, add(entry) } | null — кнопка «В повторение» в подсказке словаря,
 * onTaskChecked(block, index, correct) | null — читатель проверил задание (статистика, очки) }.
 * Через него листья получают категории и словарь без прокидывания пропсов.
 */
export const ContentContext = createContext({ categoriesById: new Map(), dictionary: null });

export function useContentContext() {
  return useContext(ContentContext);
}
