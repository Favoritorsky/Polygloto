import { Transforms } from 'slate';
import { ReactEditor, useSlateStatic } from 'slate-react';

/** Обновить поля void-элемента. */
export function useUpdateElement(element) {
  const editor = useSlateStatic();
  return (patch) => {
    const path = ReactEditor.findPath(editor, element);
    Transforms.setNodes(editor, patch, { at: path });
  };
}
