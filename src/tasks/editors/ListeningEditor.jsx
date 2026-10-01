import { TASK_LIMITS } from '../../../shared/tasks.js';
import AudioRefEditor from '../../audio/AudioRefEditor.jsx';
import AnswersListEditor from './AnswersListEditor.jsx';
import OptionsEditor from './OptionsEditor.jsx';
import styles from './TaskEditors.module.css';

export default function ListeningEditor({ data, onChange, readOnly }) {
  return (
    <>
      <AudioRefEditor value={data.audio} onChange={(audio) => onChange({ ...data, audio })} readOnly={readOnly} label="Запись" />
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
      <div className={styles.group} role="radiogroup" aria-label="Как отвечать">
        <span className={styles.label}>Как отвечать</span>
        <div className={styles.row}>
          <label className={styles.row}>
            <input
              type="radio"
              checked={data.mode !== 'input'}
              onChange={() => onChange({ ...data, mode: 'choice' })}
              disabled={readOnly}
            />
            выбрать вариант
          </label>
          <label className={styles.row}>
            <input type="radio" checked={data.mode === 'input'} onChange={() => onChange({ ...data, mode: 'input' })} disabled={readOnly} />
            ввести текст
          </label>
        </div>
      </div>
      {data.mode === 'input' ? (
        <AnswersListEditor
          label="Правильный ответ"
          answers={data.answers}
          onChange={(answers) => onChange({ ...data, answers })}
          readOnly={readOnly}
          placeholder="Что звучит в записи"
        />
      ) : (
        <OptionsEditor data={data} onChange={onChange} readOnly={readOnly} />
      )}
      <div className={styles.group}>
        <label className={styles.label}>
          Расшифровка (покажется после ответа, необязательно)
          <textarea
            rows={2}
            value={data.transcript}
            maxLength={TASK_LIMITS.TEXT_MAX}
            onChange={(e) => onChange({ ...data, transcript: e.target.value })}
            readOnly={readOnly}
          />
        </label>
      </div>
    </>
  );
}
