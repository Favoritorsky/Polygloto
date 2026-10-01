/**
 * Реестры редактора — точки расширения без if/else:
 *  - elementEditors: тип блока → React-компонент в редакторе;
 *  - insertables: пункты меню «Вставить» ({ id, label, group, create() }).
 * Задания (этап 7) регистрируются здесь же; для v2 (аудио, глоссы) достаточно
 * добавить запись в реестр и тип в shared/content.js.
 */
import { BLOCK_TYPES } from '../../../shared/content.js';
import AudioElementEditor from './elements/AudioElementEditor.jsx';
import GlossElementEditor from './elements/GlossElementEditor.jsx';
import TableElementEditor from './elements/TableElementEditor.jsx';

export const elementEditors = {
  [BLOCK_TYPES.TABLE]: TableElementEditor,
  [BLOCK_TYPES.AUDIO]: AudioElementEditor,
  [BLOCK_TYPES.GLOSS]: GlossElementEditor,
};

export const insertables = [
  {
    id: 'table',
    label: 'Таблица',
    group: 'Блоки',
    create: () => ({
      type: BLOCK_TYPES.TABLE,
      headerRow: true,
      headerColumn: false,
      // Пустая 2×2: подсказки в ячейках — плейсхолдеры полей, в данные не попадают.
      rows: [{ cells: ['', ''] }, { cells: ['', ''] }],
    }),
  },
  {
    id: 'audio',
    label: 'Аудио',
    group: 'Блоки',
    create: () => ({ type: BLOCK_TYPES.AUDIO, audio: null, caption: '' }),
  },
  {
    id: 'gloss',
    label: 'Подстрочный разбор',
    group: 'Блоки',
    create: () => ({ type: BLOCK_TYPES.GLOSS, source: '', gloss: '', translation: '' }),
  },
];

export function registerElementEditor(type, component) {
  elementEditors[type] = component;
}

export function registerInsertable(item) {
  if (!insertables.some((i) => i.id === item.id)) insertables.push(item);
}
