import { TASK_LIMITS } from '../../../shared/tasks.js';
import AnswersListEditor from './AnswersListEditor.jsx';
import styles from './TaskEditors.module.css';

export default function FillBlankEditor({ data, onChange, readOnly }) {
  return (
    <>
      <div className={styles.group}>
        <span className={styles.label}>Текст с пропуском</span>
        <div className={styles.inline}>
          <input
            value={data.before}
            maxLength={TASK_LIMITS.TEXT_MAX}
            onChange={(e) => onChange({ ...data, before: e.target.value })}
            readOnly={readOnly}
            placeholder="Текст до пропуска"
            aria-label="Текст до пропуска"
          />
          <span>＿＿</span>
          <input
            value={data.after}
            maxLength={TASK_LIMITS.TEXT_MAX}
            onChange={(e) => onChange({ ...data, after: e.target.value })}
            readOnly={readOnly}
            placeholder="Текст после пропуска"
            aria-label="Текст после пропуска"
          />
        </div>
      </div>
      <AnswersListEditor label="Правильное слово" answers={data.answers} onChange={(answers) => onChange({ ...data, answers })} readOnly={readOnly} />
    </>
  );
}
