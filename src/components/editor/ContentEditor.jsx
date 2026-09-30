import { useCallback, useMemo, useState } from 'react';
import { createEditor } from 'slate';
import { withHistory } from 'slate-history';
import { Editable, Slate, withReact } from 'slate-react';
import { LIMITS } from '../../../shared/schema.js';
import CategoryLegend from '../content/CategoryLegend.jsx';
import { collectUsedCategories } from '../content/categories.js';
import { categoryTitle, leafPresentation } from '../content/leafStyle.js';
import { elementEditors } from './editorRegistry.js';
import { fromSlate, toSlate, toggleMark, withPolygloto } from './slateModel.js';
import Toolbar from './Toolbar.jsx';
import styles from './ContentEditor.module.css';

const HOTKEYS = { b: 'bold', i: 'italic', u: 'underline' };

/**
 * WYSIWYG-редактор контента урока/раздела на Slate.
 * Вход и выход — массив блоков формата shared/content.js (JSON, не HTML);
 * оформление хранится атрибутами, в тексте нет спецсимволов.
 * Компонент неуправляемый: initialBlocks читается один раз (смена урока = новый key).
 */
export default function ContentEditor({ initialBlocks, onChange, categories = [], readOnly = false, extraTools, renderLeafExtra }) {
  const [editor] = useState(() => withPolygloto(withHistory(withReact(createEditor()))));
  const initialValue = useMemo(() => toSlate(initialBlocks), [initialBlocks]);
  const categoriesById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const [blockCount, setBlockCount] = useState(initialValue.length);
  // Легенда в редакторе — только по категориям, которые уже есть в тексте (готовых наборов много).
  const [used, setUsed] = useState(() => collectUsedCategories(initialValue));

  const handleChange = useCallback(
    (value) => {
      // Slate вызывает onChange и при движении курсора — сохраняем только правки.
      const changed = editor.operations.some((op) => op.type !== 'set_selection');
      if (!changed) return;
      setBlockCount(value.length);
      setUsed(collectUsedCategories(value));
      onChange(fromSlate(value, categories));
    },
    [editor, onChange, categories],
  );

  const renderElement = useCallback(
    (props) => {
      const { element, attributes, children } = props;
      const Custom = elementEditors[element.type];
      if (Custom) return <Custom {...props} readOnly={readOnly} />;
      if (element.type === 'heading') {
        const Tag = element.level === 3 ? 'h3' : 'h2';
        return (
          <Tag {...attributes} className={styles.heading}>
            {children}
          </Tag>
        );
      }
      if (element.type === 'paragraph') {
        return (
          <p {...attributes} className={styles.paragraph}>
            {children}
          </p>
        );
      }
      return (
        <div {...attributes} className={styles.unknown}>
          <span contentEditable={false}>Блок «{element.type}» появится в следующей версии.</span>
          {children}
        </div>
      );
    },
    [readOnly],
  );

  const renderLeaf = useCallback(
    ({ attributes, children, leaf }) => {
      const { className, style, category } = leafPresentation(leaf, categoriesById);
      // В редакторе сокращение — в подсказке, без подписи-наложения внутри contenteditable.
      const extra = renderLeafExtra?.(leaf);
      return (
        <span
          {...attributes}
          className={[className, extra?.className].filter(Boolean).join(' ') || undefined}
          style={style}
          title={[categoryTitle(category), extra?.title].filter(Boolean).join(' · ') || undefined}
        >
          {children}
        </span>
      );
    },
    [categoriesById, renderLeafExtra],
  );

  const handleKeyDown = useCallback(
    (event) => {
      if ((event.ctrlKey || event.metaKey) && HOTKEYS[event.key.toLowerCase()]) {
        event.preventDefault();
        toggleMark(editor, HOTKEYS[event.key.toLowerCase()]);
      }
    },
    [editor],
  );

  return (
    <div className={styles.wrap}>
      <Slate editor={editor} initialValue={initialValue} onChange={handleChange}>
        {!readOnly && <Toolbar categories={categories} extraTools={extraTools} />}
        <div className={styles.page}>
          <CategoryLegend categories={categories} used={used} />
          <Editable
            className={styles.editable}
            readOnly={readOnly}
            renderElement={renderElement}
            renderLeaf={renderLeaf}
            onKeyDown={handleKeyDown}
            placeholder="Начните писать урок…"
            spellCheck
            aria-label="Текст урока"
          />
        </div>
      </Slate>
      {blockCount > LIMITS.LESSON_BLOCKS_MAX && (
        <p className={styles.warning}>
          В уроке больше {LIMITS.LESSON_BLOCKS_MAX} блоков — лишние не сохранятся. Разделите материал на несколько уроков.
        </p>
      )}
    </div>
  );
}
