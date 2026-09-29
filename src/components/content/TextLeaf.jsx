import DictWord from '../dictionary/DictWord.jsx';
import { segmentText } from '../../content/dictionaryIndex.js';
import { leafPresentation } from './leafStyle.js';
import { useContentContext } from './contentContext.js';

/**
 * Фрагмент текста в режиме чтения. Текст выводится как текст — никакого HTML.
 * Если есть словарь: ручная привязка (dictRef) превращает весь фрагмент в
 * ссылку на статью, иначе слова сопоставляются со словарём автоматически.
 */
export default function TextLeaf({ leaf }) {
  const { categoriesById, dictionary } = useContentContext();
  const { className, style, category } = leafPresentation(leaf, categoriesById);
  const title = category?.name;

  const manual = leaf.dictRef ? dictionary?.byId.get(leaf.dictRef) : null;
  if (manual) {
    return (
      <DictWord entries={[manual]} className={className} style={style}>
        {leaf.text}
      </DictWord>
    );
  }

  const segments = dictionary ? segmentText(leaf.text, dictionary) : [{ text: leaf.text }];
  const content = segments.map((segment, i) =>
    segment.entries ? (
      <DictWord key={i} entries={segment.entries}>
        {segment.text}
      </DictWord>
    ) : (
      segment.text
    ),
  );

  if (!className && !leaf.color) return <>{content}</>;
  return (
    <span className={className} style={style} title={title}>
      {content}
    </span>
  );
}
