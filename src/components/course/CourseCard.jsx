import CardLink from '../ui/CardLink.jsx';
import styles from './CourseCard.module.css';

const DESCRIPTION_PREVIEW = 160;

/** Карточка опубликованного курса (каталог, главная, профиль). */
export default function CourseCard({ course, showAuthor = true }) {
  const description = course.description ?? '';
  return (
    <article className={styles.card}>
      <p className={styles.language}>{course.language}</p>
      <h3 className={styles.title}>
        <CardLink to={`/course/${course.id}`} className={styles.link}>
          {course.title}
        </CardLink>
      </h3>
      {showAuthor && <p className={styles.author}>{course.authorName || 'Без имени'}</p>}
      {description && (
        <p className={styles.description}>
          {description.length > DESCRIPTION_PREVIEW ? `${description.slice(0, DESCRIPTION_PREVIEW).trimEnd()}…` : description}
        </p>
      )}
      <ul className={styles.stats}>
        <li aria-label={`Нравится: ${course.likesCount ?? 0}`}>👍 {course.likesCount ?? 0}</li>
        <li aria-label={`Не нравится: ${course.dislikesCount ?? 0}`}>👎 {course.dislikesCount ?? 0}</li>
        <li>Уроков: {course.lessonsCount ?? 0}</li>
      </ul>
    </article>
  );
}
