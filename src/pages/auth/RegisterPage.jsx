import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { LIMITS } from '../../../shared/schema.js';
import Alert from '../../components/ui/Alert.jsx';
import Button from '../../components/ui/Button.jsx';
import Field from '../../components/ui/Field.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { register } from '../../services/authService.js';
import { toUserMessage } from '../../services/errors.js';
import { validateProfile } from '../../services/userService.js';
import styles from './AuthPage.module.css';

const MIN_PASSWORD = 6;

function validate({ displayName, email, password, confirm }) {
  const errors = validateProfile({ displayName });
  if (!/^\S+@\S+\.\S+$/.test(email.trim())) errors.email = 'Введите корректный email.';
  if (password.length < MIN_PASSWORD) errors.password = `Минимум ${MIN_PASSWORD} символов.`;
  if (confirm !== password) errors.confirm = 'Пароли не совпадают.';
  return errors;
}

export default function RegisterPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ displayName: '', email: '', password: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (user && !submitting) return <Navigate to="/my-courses" replace />;

  const update = (field) => (event) => setForm((f) => ({ ...f, [field]: event.target.value }));

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;
    const nextErrors = validate(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    setSubmitting(true);
    setError('');
    try {
      await register(form);
      navigate('/account?welcome=1', { replace: true });
    } catch (err) {
      setError(toUserMessage(err));
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.card}>
      <h1>Регистрация</h1>
      <p className={styles.lead}>
        Сразу после регистрации можно писать черновики курсов. Чтобы отправить курс на публикацию, подтвердите email.
      </p>
      {error && (
        <Alert tone="error">
          {error}
          {error.includes('уже зарегистрирован') && (
            <>
              {' '}
              <Link to="/login">Войти</Link> · <Link to="/forgot-password">Восстановить пароль</Link>
            </>
          )}
        </Alert>
      )}
      <form onSubmit={handleSubmit} noValidate>
        <Field label="Отображаемое имя" error={errors.displayName} hint="Его увидят другие пользователи.">
          {(props) => (
            <input {...props} maxLength={LIMITS.DISPLAY_NAME_MAX} value={form.displayName} onChange={update('displayName')} />
          )}
        </Field>
        <Field label="Email" error={errors.email}>
          {(props) => <input {...props} type="email" autoComplete="email" value={form.email} onChange={update('email')} />}
        </Field>
        <Field label="Пароль" error={errors.password}>
          {(props) => (
            <input {...props} type="password" autoComplete="new-password" value={form.password} onChange={update('password')} />
          )}
        </Field>
        <Field label="Повторите пароль" error={errors.confirm}>
          {(props) => (
            <input {...props} type="password" autoComplete="new-password" value={form.confirm} onChange={update('confirm')} />
          )}
        </Field>
        <div className={styles.actions}>
          <Button type="submit" loading={submitting}>
            Зарегистрироваться
          </Button>
        </div>
      </form>
      <div className={styles.links}>
        <span>
          Уже есть аккаунт? <Link to="/login">Войти</Link>
        </span>
      </div>
    </div>
  );
}
