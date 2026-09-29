import { sanitizeTaskData, taskProblems } from '../../shared/tasks.js';
import { useUpdateElement } from '../components/editor/elements/useUpdateElement.js';
import VoidBlockFrame from '../components/editor/elements/VoidBlockFrame.jsx';
import { getTaskType } from './taskTypeRegistry.js';
import styles from './TaskElementEditor.module.css';

/** Блок-задание внутри редактора Slate: форма автора из реестра + предупреждения. */
export default function TaskElementEditor({ attributes, children, element, readOnly }) {
  const update = useUpdateElement(element);
  const type = getTaskType(element.taskType);
  const data = element.data ?? {};
  const problems = type ? taskProblems(element.taskType, sanitizeTaskData(element.taskType, data)) : [];

  const content = type ? (
    <>
      <type.Editor data={data} onChange={(next) => update({ data: next })} readOnly={readOnly} />
      {problems.length > 0 && (
        <ul className={styles.problems} aria-label="Что нужно заполнить">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
    </>
  ) : (
    <p>Неизвестный тип задания.</p>
  );

  return (
    <VoidBlockFrame attributes={attributes} element={element} title={`Задание: ${type?.label ?? element.taskType}`} readOnly={readOnly} content={content}>
      {children}
    </VoidBlockFrame>
  );
}
