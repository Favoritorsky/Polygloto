/**
 * Мост между форматом хранения (shared/content.js) и моделью Slate.
 * Формат почти совпадает: у Slate у void-блоков есть служебные children,
 * которые при сохранении отбрасываются через sanitizeBlocks.
 */
import { Editor, Element, Node, Path, Transforms } from 'slate';
import { BLOCK_TYPES, VOID_BLOCK_TYPES, sanitizeBlocks } from '../../../shared/content.js';

const EMPTY_PARAGRAPH = () => ({ type: BLOCK_TYPES.PARAGRAPH, children: [{ text: '' }] });

export function toSlate(blocks) {
  const nodes = (blocks ?? []).map((block) =>
    VOID_BLOCK_TYPES.includes(block.type) ? { ...block, children: [{ text: '' }] } : block,
  );
  return nodes.length ? nodes : [EMPTY_PARAGRAPH()];
}

export function fromSlate(value, categories = []) {
  return sanitizeBlocks(value, { categoryIds: new Set(categories.map((c) => c.id)) });
}

/** Плагин Slate: void-блоки и нормализация структуры. */
export function withPolygloto(editor) {
  const { isVoid, normalizeNode } = editor;

  editor.isVoid = (element) => VOID_BLOCK_TYPES.includes(element.type) || isVoid(element);

  editor.normalizeNode = (entry) => {
    const [node, path] = entry;
    // Корень: после последнего void-блока всегда есть абзац, чтобы было куда писать дальше.
    if (path.length === 0) {
      const last = node.children[node.children.length - 1];
      if (!last || editor.isVoid(last)) {
        Transforms.insertNodes(editor, EMPTY_PARAGRAPH(), { at: [node.children.length] });
        return;
      }
    }
    // Только плоский список блоков верхнего уровня; вложенные элементы разворачиваются.
    if (Element.isElement(node) && path.length > 1) {
      Transforms.unwrapNodes(editor, { at: path });
      return;
    }
    // Неизвестный тип блока превращается в абзац.
    if (Element.isElement(node) && path.length === 1 && !Object.values(BLOCK_TYPES).includes(node.type)) {
      Transforms.setNodes(editor, { type: BLOCK_TYPES.PARAGRAPH }, { at: path });
      return;
    }
    normalizeNode(entry);
  };

  return editor;
}

export function isMarkActive(editor, mark) {
  const marks = Editor.marks(editor);
  return Boolean(marks?.[mark]);
}

export function toggleMark(editor, mark) {
  if (isMarkActive(editor, mark)) Editor.removeMark(editor, mark);
  else Editor.addMark(editor, mark, true);
}

export function setMarkValue(editor, mark, value) {
  if (value === null || value === undefined) Editor.removeMark(editor, mark);
  else Editor.addMark(editor, mark, value);
}

/** «Обычный текст»: снять всё оформление с выделения. */
export function clearFormatting(editor) {
  for (const mark of ['bold', 'italic', 'underline', 'color', 'category', 'dictRef']) Editor.removeMark(editor, mark);
}

export function currentBlockType(editor) {
  const { selection } = editor;
  if (!selection) return null;
  const [match] = Editor.nodes(editor, {
    at: Editor.unhangRange(editor, selection),
    match: (n) => Element.isElement(n) && Editor.isBlock(editor, n),
  });
  if (!match) return null;
  const [node] = match;
  return node.type === BLOCK_TYPES.HEADING ? `heading${node.level}` : node.type;
}

export function setTextBlockType(editor, kind) {
  const props =
    kind === 'paragraph'
      ? { type: BLOCK_TYPES.PARAGRAPH, level: undefined }
      : { type: BLOCK_TYPES.HEADING, level: kind === 'heading3' ? 3 : 2 };
  Transforms.setNodes(editor, props, {
    match: (n) => Element.isElement(n) && [BLOCK_TYPES.PARAGRAPH, BLOCK_TYPES.HEADING].includes(n.type),
  });
  if (kind === 'paragraph') Transforms.unsetNodes(editor, 'level', { match: (n) => Element.isElement(n) && n.type === BLOCK_TYPES.PARAGRAPH });
}

/** Вставляет void-блок после текущего блока (или в конец) и абзац за ним. */
export function insertVoidBlock(editor, block) {
  const node = { ...block, children: [{ text: '' }] };
  const { selection } = editor;
  let at = [editor.children.length];
  if (selection) {
    const top = selection.anchor.path[0];
    const current = editor.children[top];
    const isEmptyParagraph = current && current.type === BLOCK_TYPES.PARAGRAPH && Node.string(current) === '';
    at = isEmptyParagraph ? [top] : Path.next([top]);
    if (isEmptyParagraph) Transforms.removeNodes(editor, { at: [top] });
  }
  Transforms.insertNodes(editor, node, { at });
}

export function newBlockId() {
  return `b_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
