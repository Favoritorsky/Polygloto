import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import VerifyEmailNotice from '../../components/auth/VerifyEmailNotice.jsx';
import Alert from '../../components/ui/Alert.jsx';
import Button from '../../components/ui/Button.jsx';
import Field from '../../components/ui/Field.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { changePassword, requestPasswordReset } from '../../services/authService.js';
import { toUserMessage } from '../../services/errors.js';
import styles from './AccountPage.module.css';

const ROLE_LABELS = { reader: 'Читатель', user: 'Автор', admin: 'Администратор' };

function ChangePasswordForm() {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [status, setStatus] = useState({ submitting: false, error: '', done: false });

  async function handleSubmit(event) {
    event.preventDefault();
    if (status.submitting) return;
    if (form.newPassword.length < 6) return setStatus({ submitting: false, error: 'Новый пароль: минимум 6 символов.' });
    if (form.newPassword !== form.confirm) return setStatus({ submitting: false, error: 'Пароли не совпадают.' });
    setStatus({ submitting: true, error: '', done: false });
    try {
      await changePassword(form);
      setForm({ currentPassword: '', newPassword: '', confirm: '' });
      setStatus({ submitting: false, error: '', done: true });
    } catch (err) {
      setStatus({ submitting: false, error: toUserMessage(err), done: false });
    }
  }

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  return (
    <form onSubmit={handleSubmit} noValidate>
      {status.error && <Alert tone="error">{status.error}</Alert>}
      {status.done && <Alert tone="success">Пароль изменён.</Alert>}
      <Field label="Текущий пароль">
        {(p) => <input {...p} type="password" autoComplete="current-password" value={form.currentPassword} onChange={update('currentPassword')} />}
      </Field>
      <Field label="Новый пароль">
        {(p) => <input {...p} type="password" autoComplete="new-password" value={form.newPassword} onChange={update('newPassword')} />}
      </Field>
      <Field label="Повторите новый пароль">
        {(p) => <input {...p} type="password" autoComplete="new-password" value={form.confirm} onChange={update('confirm')} />}
      </Field>
      <Button type="submit" loading={status.submitting}>
        Сменить пароль
      </Button>
    </form>
  );
}

function ResetByEmail({ email }) {
  const [state, setState] = useState({ sending: false, sent: false, error: '' });
  async function handleClick() {
    setState({ sending: true, sent: false, error: '' });
    try {
      await requestPasswordReset(email);
      setState({ sending: false, sent: true, error: '' });
    } catch (err) {
      setState({ sending: false, sent: false, error: toUserMessage(err) });
    }
  }
  return (
    <div>
      <p className={styles.muted}>Не помните текущий пароль? Пришлём ссылку для смены на {email}.</p>
      <Button variant="secondary" onClick={handleClick} loading={state.sending} disabled={state.sent}>
        {state.sent ? 'Письмо отправлено' : 'Прислать ссылку на почту'}
      </Button>
      {state.error && <Alert tone="error">{state.error}</Alert>}
    </div>
  );
}

export default function AccountPage() {
  const { user, profile, profileLoading, profileError, isVerified, isBanned } = useAuth();
  const [params] = useSearchParams();

  return (
    <div className={styles.page}>
      <h1>Аккаунт</h1>
      {params.get('welcome') && (
        <Alert tone="success" title="Добро пожаловать в Polygloto!">
          Мы отправили письмо для подтверждения на {user.email}. Пока можно начинать писать черновик курса.
        </Alert>
      )}
      {isBanned && <Alert tone="error">Аккаунт заблокирован администратором: создание контента недоступно.</Alert>}
      <VerifyEmailNotice />

      <section className={styles.section}>
        <h2>Данные</h2>
        {profileError && <Alert tone="error">{toUserMessage(profileError)}</Alert>}
        <dl className={styles.facts}>
          <dt>Email</dt>
          <dd>
            {user.email} {isVerified ? '✓ подтверждён' : '— не подтверждён'}
          </dd>
          <dt>Имя</dt>
          <dd>{profileLoading ? '…' : profile?.displayName ?? 'профиль создаётся…'}</dd>
          <dt>Роль</dt>
          <dd>{profileLoading ? '…' : ROLE_LABELS[profile?.role] ?? '—'}</dd>
        </dl>
        <p>
          Имя, фото и «о себе» меняются на странице <Link to={`/users/${user.uid}`}>вашего профиля</Link>.
        </p>
      </section>

      <section className={styles.section}>
        <h2>Смена пароля</h2>
        <ChangePasswordForm />
        <hr className={styles.divider} />
        <ResetByEmail email={user.email} />
      </section>
    </div>
  );
}
