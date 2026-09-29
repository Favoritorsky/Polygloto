import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import Alert from '../../components/ui/Alert.jsx';
import Button from '../../components/ui/Button.jsx';
import Field from '../../components/ui/Field.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { login } from '../../services/authService.js';
import { toUserMessage } from '../../services/errors.js';
import styles from './AuthPage.module.css';

export default function LoginPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = location.state?.from || '/my-courses';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (user && !submitting) return <Navigate to={redirectTo} replace />;

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return; // защита от повторной отправки
    if (!email.trim() || !password) {
      setError('Введите email и пароль.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await login({ email, password });
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(toUserMessage(err));
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.card}>
      <h1>Вход</h1>
      {error && <Alert tone="error">{error}</Alert>}
      <form onSubmit={handleSubmit} noValidate>
        <Field label="Email">
          {(props) => (
            <input {...props} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          )}
        </Field>
        <Field label="Пароль">
          {(props) => (
            <input
              {...props}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          )}
        </Field>
        <div className={styles.actions}>
          <Button type="submit" loading={submitting}>
            Войти
          </Button>
        </div>
      </form>
      <div className={styles.links}>
        <Link to="/forgot-password">Забыли пароль?</Link>
        <Link to="/register">Создать аккаунт</Link>
      </div>
    </div>
  );
}
