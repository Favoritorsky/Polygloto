import { TASK_LIMITS } from '../../../shared/tasks.js';
import OptionsEditor from './OptionsEditor.jsx';
import styles from './TaskEditors.module.css';

export default function MultipleSelectEditor({ data, onChange, readOnly }) {
  return (
    <>
      <div className={styles.group}>
        <label className={styles.label}>
          Вопрос
          <input
            value={data.question}
            maxLength={TASK_LIMITS.TEXT_MAX}
            onChange={(e) => onChange({ ...data, question: e.target.value })}
            readOnly={readOnly}
          />
        </label>
      </div>
      <OptionsEditor data={data} onChange={onChange} readOnly={readOnly} multiple />
      <p className={styles.hint}>Ответ засчитывается, только если читатель выбрал ровно все правильные варианты.</p>
    </>
  );
}
