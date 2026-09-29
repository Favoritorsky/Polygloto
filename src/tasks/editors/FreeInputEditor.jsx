import { TASK_LIMITS } from '../../../shared/tasks.js';
import AnswersListEditor from './AnswersListEditor.jsx';
import styles from './TaskEditors.module.css';

export default function FreeInputEditor({ data, onChange, readOnly }) {
  return (
    <>
      <div className={styles.group}>
        <label className={styles.label}>
          Вопрос
          <input value={data.question} maxLength={TASK_LIMITS.TEXT_MAX} onChange={(e) => onChange({ ...data, question: e.target.value })} readOnly={readOnly} />
        </label>
      </div>
      <AnswersListEditor label="Правильный ответ" answers={data.answers} onChange={(answers) => onChange({ ...data, answers })} readOnly={readOnly} />
      <p className={styles.hint}>Регистр и лишние пробелы не важны.</p>
    </>
  );
}
