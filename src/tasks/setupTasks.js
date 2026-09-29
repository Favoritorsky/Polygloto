/**
 * Подключает задания к редактору (пункты «Вставить» и редактор блока) и к
 * рендеру для читателя. Импортируется один раз при старте приложения.
 */
import { BLOCK_TYPES } from '../../shared/content.js';
import { registerBlockRenderer } from '../components/content/blockRenderers.js';
import { newBlockId } from '../components/editor/slateModel.js';
import { registerElementEditor, registerInsertable } from '../components/editor/editorRegistry.js';
import TaskElementEditor from './TaskElementEditor.jsx';
import TaskPlayer from './TaskPlayer.jsx';
import { taskTypeRegistry } from './taskTypeRegistry.js';

registerElementEditor(BLOCK_TYPES.TASK, TaskElementEditor);
registerBlockRenderer(BLOCK_TYPES.TASK, TaskPlayer);

for (const type of taskTypeRegistry.values()) {
  registerInsertable({
    id: `task:${type.id}`,
    label: type.label,
    group: 'Задания',
    create: () => ({ type: BLOCK_TYPES.TASK, id: newBlockId(), taskType: type.id, data: type.create() }),
  });
}
