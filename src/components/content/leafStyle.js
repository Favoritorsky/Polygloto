import styles from './Leaf.module.css';

/** Подпись категории: «Существительное (сущ.)». */
export function categoryTitle(category) {
  if (!category) return undefined;
  return category.abbr ? `${category.name} (${category.abbr})` : category.name;
}

/**
 * Общая логика оформления текстового фрагмента для редактора и для читателя:
 * возвращает { className, style, category } по атрибутам листа.
 * hiddenCategories — Set id категорий, скрытых читателем в легенде:
 * такой фрагмент рисуется без подсветки (category тогда null).
 */
export function leafPresentation(leaf, categoriesById, hiddenCategories) {
  const classes = [];
  const style = {};
  if (leaf.bold) classes.push(styles.bold);
  if (leaf.italic) classes.push(styles.italic);
  if (leaf.underline) classes.push(styles.underline);
  if (leaf.color) style.color = leaf.color;
  const found = leaf.category ? categoriesById?.get(leaf.category) : null;
  const category = found && !hiddenCategories?.has(found.id) ? found : null;
  if (category) {
    classes.push(styles.category);
    style['--category-color'] = category.color;
  }
  return { className: classes.join(' ') || undefined, style, category };
}
