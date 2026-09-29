/**
 * Реестр рендереров блоков для режима чтения. Новый тип блока = новая запись,
 * без правок ContentRenderer. Задания подключаются из реестра заданий (этап 7).
 */
import { BLOCK_TYPES } from '../../../shared/content.js';
import TableView from './TableView.jsx';
import { HeadingView, ParagraphView } from './TextBlock.jsx';
import V2Placeholder from './V2Placeholder.jsx';

export const blockRenderers = {
  [BLOCK_TYPES.PARAGRAPH]: ParagraphView,
  [BLOCK_TYPES.HEADING]: HeadingView,
  [BLOCK_TYPES.TABLE]: TableView,
  [BLOCK_TYPES.AUDIO]: V2Placeholder,
  [BLOCK_TYPES.GLOSS]: V2Placeholder,
};

export function registerBlockRenderer(type, component) {
  blockRenderers[type] = component;
}
