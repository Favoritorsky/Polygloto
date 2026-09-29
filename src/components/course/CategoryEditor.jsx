import { LIMITS, PALETTE } from '../../../shared/schema.js';
import Button from '../ui/Button.jsx';
import styles from './CategoryEditor.module.css';

function newCategoryId() {
  return `cat_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Пользовательские категории разметки текста (фонетика, части речи и т.п.).
 * Каждая — имя и цвет подчёркивания из палитры. Управляемый компонент.
 */
export default function CategoryEditor({ categories, onChange, readOnly }) {
  const update = (id, patch) => onChange(categories.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const remove = (id) => onChange(categories.filter((c) => c.id !== id));
  const add = () =>
    onChange([
      ...categories,
      { id: newCategoryId(), name: 'Новая категория', color: PALETTE[categories.length % PALETTE.length] },
    ]);

  return (
    <div>
      {categories.length === 0 && (
        <p className={styles.hint}>
          Категорий пока нет. Например: «Гласные», «Согласные», «Корень», «Суффикс» — ими можно подчёркивать части текста
          в уроках, а читатель увидит цветовую легенду.
        </p>
      )}
      <ul className={styles.list}>
        {categories.map((category) => (
          <li key={category.id} className={styles.item}>
            <span className={styles.sample} style={{ textDecorationColor: category.color }}>
              Пример
            </span>
            <input
              value={category.name}
              maxLength={LIMITS.CATEGORY_NAME_MAX}
              onChange={(e) => update(category.id, { name: e.target.value })}
              aria-label="Название категории"
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
                  onClick={() => !readOnly && update(category.id, { color })}
                  disabled={readOnly}
                />
              ))}
            </div>
            {!readOnly && (
              <Button variant="ghost" size="sm" onClick={() => remove(category.id)} aria-label="Удалить категорию">
                ✕
              </Button>
            )}
          </li>
        ))}
      </ul>
      {!readOnly && categories.length < LIMITS.COURSE_CATEGORIES_MAX && (
        <Button variant="secondary" size="sm" onClick={add}>
          + Категория
        </Button>
      )}
    </div>
  );
}
