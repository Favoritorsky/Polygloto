import { COURSE_STATUS } from '../../../shared/schema.js';
import Alert from '../../components/ui/Alert.jsx';
import { useCourseEditor } from './courseEditorContext.js';

/** Пояснение к текущему статусу курса. Кнопка отправки на проверку — этап 8. */
export default function StatusPanel() {
  const { course } = useCourseEditor();

  if (course.status === COURSE_STATUS.PUBLISHED) {
    return (
      <Alert tone="success" title="Курс опубликован">
        Править можно и дальше: первая правка создаст новую версию-черновик. Читатели будут видеть текущую
        опубликованную версию, пока новая не пройдёт модерацию.
      </Alert>
    );
  }
  if (course.status === COURSE_STATUS.REJECTED) {
    return (
      <Alert tone="error" title="Курс отклонён модератором">
        Причина: {course.rejectionReason || 'не указана'}. Исправьте курс и отправьте на проверку снова.
      </Alert>
    );
  }
  if (course.status === COURSE_STATUS.DRAFT && course.hasPublishedVersion) {
    return (
      <Alert tone="info" title="Есть несогласованные изменения">
        Читатели видят прежнюю опубликованную версию. Когда закончите правки, отправьте курс на проверку.
      </Alert>
    );
  }
  return null;
}
