import { CATEGORY_GROUPS, categoryGroup, missingPresets } from '../../../shared/categories.js';
import { LIMITS, PALETTE } from '../../../shared/schema.js';
import Button from '../ui/Button.jsx';
import styles from './CategoryEditor.module.css';

function newCategoryId() {
  return `cat_${Math.random().toString(36).slice(2, 8)}`;
}

function CategoryRow({ category, readOnly, onUpdate, onRemove }) {
  return (
    <li className={styles.item}>
      <span className={styles.sample} style={{ textDecorationColor: category.color }}>
        Пример
      </span>
      <input
        value={category.name}
        maxLength={LIMITS.CATEGORY_NAME_MAX}
        onChange={(e) => onUpdate({ name: e.target.value })}
        aria-label="Название категории"
        readOnly={readOnly}
      />
      <input
        className={styles.abbr}
        value={category.abbr ?? ''}
        maxLength={LIMITS.CATEGORY_ABBR_MAX}
        onChange={(e) => onUpdate({ abbr: e.target.value })}
        placeholder="сокр."
        aria-label={`Сокращение для «${category.name}»`}
        title="Короткая подпись, которую читатель увидит при наведении на размеченный текст"
        readOnly={readOnly}
      />
      <div className={styles.palette} role="radiogroup" aria-label="Цвет">
        {PALETTE.map((color) => (
          <button
            key={color}
            type="button"
            role="radio"
            aria-checked={category.color === color}
            aria-label={color}
            className={category.color === color ? `${styles.swatch} ${styles.swatchActive}` : styles.swatch}
            style={{ backgroundColor: color }}
            onClick={() => !readOnly && onUpdate({ color })}
            disabled={readOnly}
          />
        ))}
      </div>
      {!readOnly && (
        <Button variant="ghost" size="sm" onClick={onRemove} aria-label={`Убрать категорию «${category.name}»`} title="Убрать категорию">
          ✕
        </Button>
      )}
    </li>
  );
}

/**
 * Категории разметки текста, сгруппированные по наборам: грамматические и
 * фонетические (готовые, из shared/categories.js) и свои. Готовые можно
 * переименовать, перекрасить, убрать и вернуть; свои — добавить.
 * У каждой категории необязательное сокращение («сущ.»). Управляемый компонент.
 */
export default function CategoryEditor({ categories, onChange, readOnly }) {
  const update = (id, patch) => onChange(categories.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const remove = (id) => onChange(categories.filter((c) => c.id !== id));
  const canAdd = !readOnly && categories.length < LIMITS.COURSE_CATEGORIES_MAX;
  const addCustom = () =>
    onChange([
      ...categories,
      { id: newCategoryId(), name: 'Новая категория', color: PALETTE[categories.length % PALETTE.length], group: 'custom' },
    ]);
  const restore = (presets) => onChange([...categories, ...presets.slice(0, LIMITS.COURSE_CATEGORIES_MAX - categories.length).map((p) => ({ ...p }))]);

  return (
    <div className={styles.groups}>
      <p className={styles.hint}>
        Категориями подчёркивают части текста в уроках: части речи, звуки, корни. Читатель видит цветную легенду и может
        скрыть любую категорию, а при наведении на слово — сокращение. Лишние готовые категории можно убрать, а потом вернуть.
      </p>
      {CATEGORY_GROUPS.map((group) => {
        const items = categories.filter((c) => categoryGroup(c) === group.id);
        const missing = missingPresets(categories, group.id);
        if (group.id !== 'custom' && items.length === 0 && (readOnly || missing.length === 0)) return null;
        return (
          <section key={group.id} className={styles.group} aria-label={group.label}>
            <h3 className={styles.groupTitle}>{group.label}</h3>
            {items.length > 0 && (
              <ul className={styles.list}>
                {items.map((category) => (
                  <CategoryRow
                    key={category.id}
                    category={category}
                    readOnly={readOnly}
                    onUpdate={(patch) => update(category.id, patch)}
                    onRemove={() => remove(category.id)}
                  />
                ))}
              </ul>
            )}
            {group.id === 'custom' && items.length === 0 && (
              <p className={styles.hint}>Своих категорий пока нет. Например: «Корень», «Суффикс», «Падежное окончание».</p>
            )}
            {canAdd && missing.length > 0 && (
              <div className={styles.restore}>
                <span>Вернуть:</span>
                {missing.map((preset) => (
                  <button key={preset.id} type="button" className={styles.chip} onClick={() => restore([preset])}>
                    + {preset.name}
                  </button>
                ))}
                {missing.length > 1 && (
                  <button type="button" className={styles.chip} onClick={() => restore(missing)}>
                    все
                  </button>
                )}
              </div>
            )}
            {group.id === 'custom' && canAdd && (
              <Button variant="secondary" size="sm" onClick={addCustom}>
                + Категория
              </Button>
            )}
          </section>
        );
      })}
      {!readOnly && !canAdd && <p className={styles.hint}>Достигнут предел: {LIMITS.COURSE_CATEGORIES_MAX} категорий в курсе.</p>}
    </div>
  );
}
