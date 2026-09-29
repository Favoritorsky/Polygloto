import { useState } from 'react';
import { Link } from 'react-router-dom';
import Alert from '../../components/ui/Alert.jsx';
import Button from '../../components/ui/Button.jsx';
import Field from '../../components/ui/Field.jsx';
import { requestPasswordReset } from '../../services/authService.js';
import { toUserMessage } from '../../services/errors.js';
import styles from './AuthPage.module.css';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError('Введите корректный email.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (err) {
      // Не раскрываем, существует ли аккаунт: «не найден» показываем как успех.
      if (err.code === 'auth/user-not-found') setSent(true);
      else setError(toUserMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.card}>
      <h1>Восстановление пароля</h1>
      <p className={styles.lead}>Мы пришлём ссылку для смены пароля на почту, привязанную к аккаунту.</p>
      {sent ? (
        <Alert tone="success" title="Письмо отправлено">
          Если аккаунт с адресом {email.trim()} существует, на него пришла ссылка для смены пароля. Проверьте папку
          «Спам», если письма нет.
        </Alert>
      ) : (
        <>
          {error && <Alert tone="error">{error}</Alert>}
          <form onSubmit={handleSubmit} noValidate>
            <Field label="Email">
              {(props) => (
                <input {...props} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              )}
            </Field>
            <div className={styles.actions}>
              <Button type="submit" loading={submitting}>
                Отправить ссылку
              </Button>
            </div>
          </form>
        </>
      )}
      <div className={styles.links}>
        <Link to="/login">Вернуться ко входу</Link>
      </div>
    </div>
  );
}
