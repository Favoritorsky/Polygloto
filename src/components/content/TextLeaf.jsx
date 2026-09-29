import { leafPresentation } from './leafStyle.js';
import { useContentContext } from './contentContext.js';

/** Фрагмент текста в режиме чтения. Текст выводится как текст — никакого HTML. */
export default function TextLeaf({ leaf }) {
  const { categoriesById } = useContentContext();
  const { className, style, category } = leafPresentation(leaf, categoriesById);
  if (!className && !leaf.color) return leaf.text;
  return (
    <span className={className} style={style} title={category?.name}>
      {leaf.text}
    </span>
  );
}
