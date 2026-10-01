import { TASK_LIMITS, orderTokens } from '../../../shared/tasks.js';
import AnswersListEditor from './AnswersListEditor.jsx';
import styles from './TaskEditors.module.css';

export default function SentenceOrderEditor({ data, onChange, readOnly }) {
  const words = orderTokens(data.answers[0]);
  return (
    <>
      <div className={styles.group}>
        <label className={styles.label}>
          Задание
          <input
            value={data.instruction}
            maxLength={TASK_LIMITS.TEXT_MAX}
            onChange={(e) => onChange({ ...data, instruction: e.target.value })}
            readOnly={readOnly}
          />
        </label>
        <label className={styles.label}>
          Подсказка-перевод (необязательно)
          <input
            value={data.translation}
            maxLength={TASK_LIMITS.TEXT_MAX}
            onChange={(e) => onChange({ ...data, translation: e.target.value })}
            readOnly={readOnly}
          />
        </label>
      </div>
      <AnswersListEditor
        label="Предложение в правильном порядке"
        answers={data.answers}
        onChange={(answers) => onChange({ ...data, answers })}
        readOnly={readOnly}
        placeholder="Yo me llamo Ana"
      />
      <p className={styles.hint}>
        Читатель увидит {words.length > 0 ? `${words.length} перемешанных слов` : 'слова вперемешку'} (делятся по пробелам, знаки препинания
        остаются при словах). Другие варианты — допустимые порядки тех же слов.
      </p>
    </>
  );
}
