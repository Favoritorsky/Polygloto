/**
 * Реестры редактора — точки расширения без if/else:
 *  - elementEditors: тип блока → React-компонент в редакторе;
 *  - insertables: пункты меню «Вставить» ({ id, label, group, create() }).
 * Задания (этап 7) регистрируются здесь же; для v2 (аудио, глоссы) достаточно
 * добавить запись в реестр и тип в shared/content.js.
 */
import { BLOCK_TYPES } from '../../../shared/content.js';
import TableElementEditor from './elements/TableElementEditor.jsx';

export const elementEditors = {
  [BLOCK_TYPES.TABLE]: TableElementEditor,
};

export const insertables = [
  {
    id: 'table',
    label: 'Таблица',
    group: 'Блоки',
    create: () => ({
      type: BLOCK_TYPES.TABLE,
      headerRow: true,
      rows: [{ cells: ['Слово', 'Перевод'] }, { cells: ['', ''] }],
    }),
  },
];

export function registerElementEditor(type, component) {
  elementEditors[type] = component;
}

export function registerInsertable(item) {
  if (!insertables.some((i) => i.id === item.id)) insertables.push(item);
}
