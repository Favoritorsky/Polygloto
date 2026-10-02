import { CUSTOM_LANGUAGE_CHOICE } from '../../../shared/languages.js';
import { LIMITS } from '../../../shared/schema.js';
import Field from '../ui/Field.jsx';

/**
 * Язык курса: выпадающий список курируемых языков и пункт «Другой язык»
 * с полем для своего названия (конланги и языки, которых в списке пока нет).
 * value — { languageId, customName }; languages — [{ id, name }].
 */
export default function LanguagePicker({ value, onChange, languages, error, hint, readOnly = false }) {
  const custom = value.languageId === CUSTOM_LANGUAGE_CHOICE;
  return (
    <>
      <Field label="Язык" error={custom ? undefined : error} hint={custom ? undefined : hint}>
        {(p) => (
          <select
            {...p}
            value={value.languageId}
            disabled={readOnly}
            onChange={(e) => onChange({ ...value, languageId: e.target.value })}
          >
            {!value.languageId && <option value="">Выберите язык…</option>}
            {languages.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
            <option value={CUSTOM_LANGUAGE_CHOICE}>Другой язык</option>
          </select>
        )}
      </Field>
      {custom && (
        <Field
          label="Название языка"
          error={error}
          hint="Например, эсперанто, токипона или язык, которого пока нет в списке. Такие курсы в каталоге — в фильтре «Конланги»."
        >
          {(p) => (
            <input
              {...p}
              value={value.customName}
              maxLength={LIMITS.COURSE_LANGUAGE_MAX}
              readOnly={readOnly}
              onChange={(e) => onChange({ ...value, customName: e.target.value })}
            />
          )}
        </Field>
      )}
    </>
  );
}
