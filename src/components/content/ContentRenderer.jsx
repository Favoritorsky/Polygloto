import { useCallback, useMemo, useState } from 'react';
import { blockRenderers } from './blockRenderers.js';
import CategoryLegend from './CategoryLegend.jsx';
import { collectUsedCategories } from './categories.js';
import { ContentContext } from './contentContext.js';
import styles from './ContentRenderer.module.css';

/**
 * Рендер структурированного контента (массив блоков) для читателя.
 * Без dangerouslySetInnerHTML: каждый блок — React-компонент из реестра.
 */
export default function ContentRenderer({ blocks, categories = [], dictionary = null, courseId, review = null, onTaskChecked = null }) {
  const categoriesById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const used = useMemo(() => collectUsedCategories(blocks), [blocks]);
  // Скрытые читателем категории: только на время просмотра, нигде не сохраняются.
  const [hiddenCategories, setHidden] = useState(() => new Set());
  const toggleCategory = useCallback(
    (id) =>
      setHidden((prev) => {
        const next = new Set(prev);
        if (!next.delete(id)) next.add(id);
        return next;
      }),
    [],
  );
  const showAll = useCallback(() => setHidden(new Set()), []);
  const context = useMemo(
    () => ({ categoriesById, dictionary, courseId, hiddenCategories, review, onTaskChecked }),
    [categoriesById, dictionary, courseId, hiddenCategories, review, onTaskChecked],
  );

  if (!blocks?.length) return <p className={styles.empty}>Здесь пока пусто.</p>;

  return (
    <ContentContext.Provider value={context}>
      <CategoryLegend categories={categories} used={used} hidden={hiddenCategories} onToggle={toggleCategory} onShowAll={showAll} />
      <div className={styles.content}>
        {blocks.map((block, index) => {
          const Renderer = blockRenderers[block.type];
          return Renderer ? <Renderer key={block.id ?? index} block={block} index={index} /> : null;
        })}
      </div>
    </ContentContext.Provider>
  );
}
