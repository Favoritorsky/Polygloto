import { Editor } from 'slate';
import { useSlate } from 'slate-react';
import { CATEGORY_GROUPS, categoryGroup } from '../../../shared/categories.js';
import { PALETTE } from '../../../shared/schema.js';
import { insertables } from './editorRegistry.js';
import Popover from './Popover.jsx';
import {
  clearFormatting,
  currentBlockType,
  insertVoidBlock,
  isMarkActive,
  setMarkValue,
  setTextBlockType,
  toggleMark,
} from './slateModel.js';
import styles from './Toolbar.module.css';

const MARK_BUTTONS = [
  { mark: 'bold', label: 'Ж', title: 'Жирный (Ctrl+B)', className: 'bold' },
  { mark: 'italic', label: 'К', title: 'Курсив (Ctrl+I)', className: 'italic' },
  { mark: 'underline', label: 'Ч', title: 'Подчёркнутый (Ctrl+U)', className: 'underline' },
];

const BLOCK_KINDS = [
  { id: 'paragraph', label: 'Обычный текст' },
  { id: 'heading2', label: 'Заголовок' },
  { id: 'heading3', label: 'Подзаголовок' },
];

/** Кнопка тулбара, не сбивающая выделение (onMouseDown + preventDefault). */
function ToolButton({ active, title, onAction, className, children, disabled }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      disabled={disabled}
      className={[styles.button, active && styles.active, className && styles[className]].filter(Boolean).join(' ')}
      onMouseDown={(e) => {
        e.preventDefault();
        onAction();
      }}
    >
      {children}
    </button>
  );
}

/**
 * Панель форматирования. extraTools — дополнительные инструменты
 * (например, привязка к словарю на этапе 6), получают editor.
 */
export default function Toolbar({ categories, extraTools }) {
  const editor = useSlate();
  const marks = Editor.marks(editor) ?? {};
  const blockType = currentBlockType(editor);
  const isTextBlock = ['paragraph', 'heading2', 'heading3'].includes(blockType);

  return (
    <div className={styles.toolbar} role="toolbar" aria-label="Форматирование">
      <Popover label={BLOCK_KINDS.find((k) => k.id === blockType)?.label ?? 'Стиль'} title="Стиль абзаца" disabled={!isTextBlock}>
        {(close) =>
          BLOCK_KINDS.map((kind) => (
            <button
              key={kind.id}
              type="button"
              className={styles.menuItem}
              onMouseDown={(e) => {
                e.preventDefault();
                setTextBlockType(editor, kind.id);
                close();
              }}
            >
              {kind.label}
            </button>
          ))
        }
      </Popover>

      <span className={styles.separator} />
      {MARK_BUTTONS.map((b) => (
        <ToolButton
          key={b.mark}
          title={b.title}
          className={b.className}
          active={isMarkActive(editor, b.mark)}
          onAction={() => toggleMark(editor, b.mark)}
        >
          {b.label}
        </ToolButton>
      ))}

      <Popover label={<span className={styles.colorLabel} style={{ color: marks.color }}>А</span>} title="Цвет текста" active={Boolean(marks.color)}>
        {(close) => (
          <div className={styles.palette}>
            {PALETTE.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={`Цвет ${color}`}
                className={styles.swatch}
                style={{ backgroundColor: color }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  setMarkValue(editor, 'color', color);
                  close();
                }}
              />
            ))}
            <button
              type="button"
              className={styles.menuItem}
              onMouseDown={(e) => {
                e.preventDefault();
                setMarkValue(editor, 'color', null);
                close();
              }}
            >
              Без цвета
            </button>
          </div>
        )}
      </Popover>

      <Popover
        label={categories.find((c) => c.id === marks.category)?.name ?? 'Категория'}
        title="Разметить выделенный текст категорией"
        active={Boolean(marks.category)}
      >
        {(close) => (
          <div>
            {categories.length === 0 && (
              <p className={styles.hint}>Категории задаются во вкладке «Настройки курса».</p>
            )}
            {CATEGORY_GROUPS.map((group) => {
              const items = categories.filter((c) => categoryGroup(c) === group.id);
              if (items.length === 0) return null;
              return (
                <div key={group.id} role="group" aria-label={group.label}>
                  <p className={styles.menuGroup}>{group.label}</p>
                  {items.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className={styles.menuItem}
                      aria-pressed={marks.category === c.id}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setMarkValue(editor, 'category', c.id);
                        close();
                      }}
                    >
                      <span className={styles.categorySwatch} style={{ backgroundColor: c.color }} /> {c.name}
                      {c.abbr && <span className={styles.menuAbbr}>{c.abbr}</span>}
                    </button>
                  ))}
                </div>
              );
            })}
            {marks.category && (
              <button
                type="button"
                className={styles.menuItem}
                onMouseDown={(e) => {
                  e.preventDefault();
                  setMarkValue(editor, 'category', null);
                  close();
                }}
              >
                Убрать категорию
              </button>
            )}
          </div>
        )}
      </Popover>

      <ToolButton title="Обычный текст: снять всё оформление" onAction={() => clearFormatting(editor)}>
        ⌫ Оформление
      </ToolButton>

      {extraTools}

      <span className={styles.separator} />
      <Popover label="+ Вставить" title="Вставить блок">
        {(close) => {
          const groups = [...new Set(insertables.map((i) => i.group))];
          return groups.map((group) => (
            <div key={group}>
              <div className={styles.groupLabel}>{group}</div>
              {insertables
                .filter((i) => i.group === group)
                .map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={styles.menuItem}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      insertVoidBlock(editor, item.create());
                      close();
                    }}
                  >
                    {item.label}
                  </button>
                ))}
            </div>
          ));
        }}
      </Popover>
    </div>
  );
}
