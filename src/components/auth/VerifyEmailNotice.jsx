import { useState } from 'react';
import Alert from '../ui/Alert.jsx';
import Button from '../ui/Button.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { useCooldown } from '../../hooks/useCooldown.js';
import { refreshVerificationStatus, resendVerificationEmail } from '../../services/authService.js';
import { toUserMessage } from '../../services/errors.js';
import styles from './VerifyEmailNotice.module.css';

const RESEND_COOLDOWN_SECONDS = 60;

/**
 * Предупреждение «email не подтверждён» с кнопками «Отправить письмо повторно»
 * и «Я подтвердил». reason — пояснение, зачем нужно подтверждение.
 */
export default function VerifyEmailNotice({ reason = 'Подтвердите email, чтобы отправлять курсы на публикацию.' }) {
  const { user, isVerified } = useAuth();
  const [cooldown, setCooldown] = useCooldown();
  const [sending, setSending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState(null);

  if (!user || isVerified) return null;

  async function handleResend() {
    setSending(true);
    setMessage(null);
    try {
      await resendVerificationEmail();
      setCooldown(RESEND_COOLDOWN_SECONDS);
      setMessage({ tone: 'success', text: `Письмо отправлено на ${user.email}.` });
    } catch (err) {
      setMessage({ tone: 'error', text: toUserMessage(err) });
    } finally {
      setSending(false);
    }
  }

  async function handleCheck() {
    setChecking(true);
    setMessage(null);
    try {
      const verified = await refreshVerificationStatus();
      if (!verified) {
        setMessage({ tone: 'warning', text: 'Почта пока не подтверждена. Перейдите по ссылке из письма.' });
      }
    } catch (err) {
      setMessage({ tone: 'error', text: toUserMessage(err) });
    } finally {
      setChecking(false);
    }
  }

  return (
    <Alert tone="warning" title="Email не подтверждён">
      <p className={styles.text}>{reason}</p>
      <div className={styles.buttons}>
        <Button size="sm" variant="secondary" onClick={handleResend} loading={sending} disabled={cooldown > 0}>
          {cooldown > 0 ? `Отправить повторно (${cooldown} с)` : 'Отправить письмо повторно'}
        </Button>
        <Button size="sm" variant="ghost" onClick={handleCheck} loading={checking}>
          Я подтвердил
        </Button>
      </div>
      {message && <p className={styles[message.tone]}>{message.text}</p>}
    </Alert>
  );
}
