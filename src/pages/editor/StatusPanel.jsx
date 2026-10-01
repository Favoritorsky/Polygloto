import { useState } from 'react';
import { COURSE_STATUS } from '../../../shared/schema.js';
import VerifyEmailNotice from '../../components/auth/VerifyEmailNotice.jsx';
import Alert from '../../components/ui/Alert.jsx';
import Button from '../../components/ui/Button.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { submitForReview } from '../../services/courseService.js';
import { toUserMessage } from '../../services/errors.js';
import { useCourseEditor } from './courseEditorContext.js';
import styles from './StatusPanel.module.css';

/** Статус курса и отправка на проверку. */
export default function StatusPanel() {
  const { course, courseId, flushAll, readOnly } = useCourseEditor();
  const { isVerified } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [needVerification, setNeedVerification] = useState(false);

  async function handleSubmit() {
    if (submitting) return;
    setError('');
    if (!isVerified) {
      setNeedVerification(true);
      return;
    }
    if (!course.lessonOrder?.length) {
      setError('Добавьте хотя бы один урок.');
      return;
    }
    if (!window.confirm('Отправить курс на проверку? Пока идёт модерация, править курс будет нельзя.')) return;
    setSubmitting(true);
    try {
      const saved = await flushAll();
      if (!saved) throw Object.assign(new Error('unsaved'), { userMessage: 'Не все изменения сохранены. Проверьте соединение и попробуйте снова.' });
      await submitForReview(courseId);
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  const submitButton = (
    <Button onClick={handleSubmit} loading={submitting} disabled={readOnly}>
      Отправить на проверку
    </Button>
  );

  let notice = null;
  if (course.status === COURSE_STATUS.PUBLISHED) {
    notice = (
      <Alert tone="success" title="Курс опубликован">
        Править можно и дальше: первая правка создаст новую версию-черновик. Читатели будут видеть текущую
        опубликованную версию, пока новая не пройдёт модерацию.
      </Alert>
    );
  } else if (course.status === COURSE_STATUS.REJECTED) {
    notice = (
      <Alert tone="error" title="Курс отклонён модератором">
        Причина: {course.rejectionReason || 'не указана'}. Исправьте курс и отправьте на проверку снова.
      </Alert>
    );
  } else if (course.status === COURSE_STATUS.DRAFT) {
    notice = (
      <Alert
        tone="info"
        title={course.hasPublishedVersion ? 'Есть изменения, ещё не прошедшие проверку' : 'Черновик'}
        action={submitButton}
      >
        {course.hasPublishedVersion
          ? 'Читатели видят прежнюю опубликованную версию. Когда закончите правки, отправьте курс на проверку.'
          : 'Курс виден только вам. Когда он будет готов, отправьте его на проверку — после одобрения он появится в каталоге.'}
      </Alert>
    );
  }

  return (
    <div className={styles.wrap}>
      {notice}
      {error && <Alert tone="error">{error}</Alert>}
      {needVerification && !isVerified && (
        <VerifyEmailNotice reason="Отправить курс на проверку можно только с подтверждённым email. Перейдите по ссылке из письма или запросите новое." />
      )}
    </div>
  );
}
