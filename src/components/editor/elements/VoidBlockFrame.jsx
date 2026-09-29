import { Transforms } from 'slate';
import { ReactEditor, useSlateStatic } from 'slate-react';
import styles from './VoidBlockFrame.module.css';

/**
 * Обёртка для void-блоков (таблица, задание): рамка, заголовок, кнопка удаления.
 * Содержимое — обычные React-поля ввода вне contentEditable.
 */
export default function VoidBlockFrame({ element, attributes, children, title, readOnly, content }) {
  const editor = useSlateStatic();
  const remove = () => {
    const path = ReactEditor.findPath(editor, element);
    Transforms.removeNodes(editor, { at: path });
  };
  return (
    <div {...attributes} className={styles.frame}>
      <div contentEditable={false} className={styles.inner}>
        <div className={styles.header}>
          <span className={styles.title}>{title}</span>
          {!readOnly && (
            <button type="button" className={styles.remove} onClick={remove}>
              Удалить блок
            </button>
          )}
        </div>
        {content}
      </div>
      {children}
    </div>
  );
}
