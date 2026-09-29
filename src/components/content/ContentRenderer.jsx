import { useMemo } from 'react';
import { blockRenderers } from './blockRenderers.js';
import CategoryLegend from './CategoryLegend.jsx';
import { collectUsedCategories } from './categories.js';
import { ContentContext } from './contentContext.js';
import styles from './ContentRenderer.module.css';

/**
 * Рендер структурированного контента (массив блоков) для читателя.
 * Без dangerouslySetInnerHTML: каждый блок — React-компонент из реестра.
 */
export default function ContentRenderer({ blocks, categories = [], dictionary = null, courseId }) {
  const categoriesById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const used = useMemo(() => collectUsedCategories(blocks), [blocks]);
  const context = useMemo(() => ({ categoriesById, dictionary, courseId }), [categoriesById, dictionary, courseId]);

  if (!blocks?.length) return <p className={styles.empty}>Здесь пока пусто.</p>;

  return (
    <ContentContext.Provider value={context}>
      <CategoryLegend categories={categories} used={used} />
      <div className={styles.content}>
        {blocks.map((block, index) => {
          const Renderer = blockRenderers[block.type];
          return Renderer ? <Renderer key={block.id ?? index} block={block} /> : null;
        })}
      </div>
    </ContentContext.Provider>
  );
}
