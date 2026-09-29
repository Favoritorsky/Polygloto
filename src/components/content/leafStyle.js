import styles from './Leaf.module.css';

/**
 * Общая логика оформления текстового фрагмента для редактора и для читателя:
 * возвращает { className, style } по атрибутам листа.
 */
export function leafPresentation(leaf, categoriesById) {
  const classes = [];
  const style = {};
  if (leaf.bold) classes.push(styles.bold);
  if (leaf.italic) classes.push(styles.italic);
  if (leaf.underline) classes.push(styles.underline);
  if (leaf.color) style.color = leaf.color;
  const category = leaf.category ? categoriesById?.get(leaf.category) : null;
  if (category) {
    classes.push(styles.category);
    style['--category-color'] = category.color;
  }
  return { className: classes.join(' ') || undefined, style, category };
}
