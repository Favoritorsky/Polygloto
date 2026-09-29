import { useRef, useState } from 'react';
import { LIMITS } from '../../../shared/schema.js';
import Avatar from '../../components/profile/Avatar.jsx';
import Alert from '../../components/ui/Alert.jsx';
import Button from '../../components/ui/Button.jsx';
import Field from '../../components/ui/Field.jsx';
import { AVATAR_ACCEPT, removeAvatar, uploadAvatar, validateAvatarFile } from '../../services/avatarService.js';
import { toUserMessage } from '../../services/errors.js';
import { updateOwnProfile, validateProfile } from '../../services/userService.js';
import styles from './ProfilePage.module.css';

/** Редактирование собственного профиля: фото, имя, «о себе». */
export default function ProfileEditForm({ uid, profile, onDone }) {
  const [form, setForm] = useState({ displayName: profile.displayName ?? '', bio: profile.bio ?? '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState('');
  const fileInput = useRef(null);

  async function handleFile(event) {
    const file = event.target.files?.[0];
    event.target.value = ''; // тот же файл можно выбрать повторно
    if (!file || avatarBusy) return;
    const problem = validateAvatarFile(file);
    if (problem) return setAvatarError(problem);
    setAvatarBusy(true);
    setAvatarError('');
    try {
      await uploadAvatar(uid, file, profile.photoURL);
    } catch (err) {
      setAvatarError(toUserMessage(err));
    } finally {
      setAvatarBusy(false);
    }
  }

  async function handleRemove() {
    if (avatarBusy) return;
    setAvatarBusy(true);
    setAvatarError('');
    try {
      await removeAvatar(uid, profile.photoURL);
    } catch (err) {
      setAvatarError(toUserMessage(err));
    } finally {
      setAvatarBusy(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (saving) return;
    const found = validateProfile(form);
    setErrors(found);
    if (Object.keys(found).length) return;
    setSaving(true);
    setError('');
    try {
      await updateOwnProfile(uid, form);
      onDone();
    } catch (err) {
      setError(toUserMessage(err));
      setSaving(false);
    }
  }

  return (
    <form className={styles.editForm} onSubmit={handleSubmit} noValidate>
      <div className={styles.avatarEdit}>
        <Avatar name={form.displayName} url={profile.photoURL} seed={uid} size={96} />
        <div className={styles.avatarActions}>
          <input ref={fileInput} type="file" accept={AVATAR_ACCEPT} onChange={handleFile} hidden aria-label="Файл фотографии" />
          <Button size="sm" variant="secondary" loading={avatarBusy} onClick={() => fileInput.current.click()}>
            {profile.photoURL ? 'Сменить фото' : 'Загрузить фото'}
          </Button>
          {profile.photoURL && (
            <Button size="sm" variant="ghost" disabled={avatarBusy} onClick={handleRemove}>
              Удалить фото
            </Button>
          )}
          <p className={styles.hint}>JPEG, PNG, WebP или GIF. Фото будет обрезано до квадрата.</p>
        </div>
      </div>
      {avatarError && <Alert tone="error">{avatarError}</Alert>}

      <Field label="Отображаемое имя" error={errors.displayName}>
        {(p) => (
          <input {...p} value={form.displayName} maxLength={LIMITS.DISPLAY_NAME_MAX} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
        )}
      </Field>
      <Field label="О себе" error={errors.bio} hint={`${form.bio.length}/${LIMITS.BIO_MAX}. Какие языки изучаете или придумываете?`}>
        {(p) => <textarea {...p} rows={4} value={form.bio} maxLength={LIMITS.BIO_MAX} onChange={(e) => setForm({ ...form, bio: e.target.value })} />}
      </Field>
      {error && <Alert tone="error">{error}</Alert>}
      <div className={styles.formActions}>
        <Button type="submit" loading={saving}>
          Сохранить
        </Button>
        <Button variant="ghost" onClick={onDone} disabled={saving}>
          Отмена
        </Button>
      </div>
    </form>
  );
}
