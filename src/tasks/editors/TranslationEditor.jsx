import { TASK_LIMITS } from '../../../shared/tasks.js';
import AnswersListEditor from './AnswersListEditor.jsx';
import styles from './TaskEditors.module.css';

export default function TranslationEditor({ data, onChange, readOnly }) {
  return (
    <>
      <div className={styles.group}>
        <label className={styles.label}>
          Предложение для перевода
          <textarea rows={2} value={data.source} maxLength={TASK_LIMITS.TEXT_MAX} onChange={(e) => onChange({ ...data, source: e.target.value })} readOnly={readOnly} />
        </label>
      </div>
      <AnswersListEditor
        label="Эталонный перевод"
        answers={data.answers}
        onChange={(answers) => onChange({ ...data, answers })}
        readOnly={readOnly}
        placeholder="Основной вариант перевода"
      />
      <p className={styles.hint}>Сверка точная, но без учёта регистра, лишних пробелов и точки в конце.</p>
    </>
  );
}
