import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import CourseCard from '../../components/course/CourseCard.jsx';
import Avatar from '../../components/profile/Avatar.jsx';
import AsyncState from '../../components/ui/AsyncState.jsx';
import Button from '../../components/ui/Button.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { useAsync, useSubscription } from '../../hooks/useSubscription.js';
import { plural } from '../../model/plural.js';
import { computeBadges, computeProfileStats } from '../../profile/profileStats.js';
import { countUserComments } from '../../services/commentService.js';
import { subscribeToAuthorCourses } from '../../services/profileService.js';
import { subscribeToUser } from '../../services/userService.js';
import ProfileEditForm from './ProfileEditForm.jsx';
import styles from './ProfilePage.module.css';

function memberSince(ts) {
  return ts?.toDate ? ts.toDate().toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }) : null;
}

/** Публичный профиль: фото, имя, «о себе», статистика, бейджи и опубликованные курсы. */
export default function ProfilePage() {
  const { uid } = useParams();
  const { user, isBanned } = useAuth();
  const isOwn = user?.uid === uid;
  // Ключ сбрасывает режим правки при переходе на другой профиль.
  const [editingUid, setEditingUid] = useState(null);
  const editing = isOwn && editingUid === uid;

  const profile = useSubscription((onData, onError) => subscribeToUser(uid, onData, onError), uid);
  const courses = useSubscription((onData, onError) => subscribeToAuthorCourses(uid, onData, onError), profile.data ? uid : null);

  const comments = useAsync(() => countUserComments(uid), profile.data ? uid : null);
  const stats = computeProfileStats(courses.data ?? [], comments.data ?? 0);
  const badges = computeBadges(stats);
  const since = memberSince(profile.data?.createdAt);

  return (
    <AsyncState loading={profile.loading} error={profile.error} onRetry={profile.retry} loadingLabel="Загружаем профиль…">
      {profile.data === null ? (
        <div className={styles.missing}>
          <h1>Пользователь не найден</h1>
          <p>Возможно, аккаунт удалён.</p>
          <Link to="/catalog">Перейти в каталог</Link>
        </div>
      ) : (
        profile.data && (
          <div className={styles.page}>
            <section className={styles.card}>
              {editing ? (
                <ProfileEditForm uid={uid} profile={profile.data} onDone={() => setEditingUid(null)} />
              ) : (
                <div className={styles.head}>
                  <Avatar name={profile.data.displayName} url={profile.data.photoURL} seed={uid} size={96} />
                  <div className={styles.identity}>
                    <h1 className={styles.name}>{profile.data.displayName}</h1>
                    {since && <p className={styles.muted}>На Polygloto с {since}</p>}
                    {profile.data.bio ? (
                      <p className={styles.bio}>{profile.data.bio}</p>
                    ) : (
                      isOwn && <p className={styles.muted}>Расскажите о себе: какие языки изучаете или придумываете?</p>
                    )}
                    {isOwn && (
                      <div className={styles.ownActions}>
                        {!isBanned && (
                          <Button size="sm" variant="secondary" onClick={() => setEditingUid(uid)}>
                            Редактировать профиль
                          </Button>
                        )}
                        <Link to="/account" className={styles.accountLink}>
                          Настройки аккаунта
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </section>

            <section className={styles.stats} aria-label="Статистика">
              <div>
                <strong>{courses.loading ? '…' : stats.coursesCount}</strong>
                <span>{plural(stats.coursesCount, ['курс', 'курса', 'курсов'])}</span>
              </div>
              <div>
                <strong>{courses.loading ? '…' : stats.likes}</strong>
                <span>{plural(stats.likes, ['лайк', 'лайка', 'лайков'])}</span>
              </div>
              <div>
                <strong>{courses.loading ? '…' : stats.approval === null ? '—' : `${stats.approval}%`}</strong>
                <span>{stats.approval === null ? 'пока без оценок' : 'положительных оценок'}</span>
              </div>
              <div>
                <strong>{comments.loading ? '…' : stats.commentsCount}</strong>
                <span>{plural(stats.commentsCount, ['комментарий', 'комментария', 'комментариев'])}</span>
              </div>
            </section>

            <section>
              <h2 className={styles.sectionTitle}>Бейджи</h2>
              <ul className={styles.badges}>
                {badges.map((badge) => (
                  <li
                    key={badge.id}
                    className={badge.earned ? styles.badge : `${styles.badge} ${styles.locked}`}
                    title={badge.earned ? badge.hint : `Как получить: ${badge.hint.toLowerCase()}`}
                  >
                    <span className={styles.badgeIcon} aria-hidden="true">
                      {badge.icon}
                    </span>
                    <span>
                      <strong>{badge.title}</strong>
                      <span className={styles.badgeHint}>{badge.earned ? 'Получен' : badge.hint}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h2 className={styles.sectionTitle}>Опубликованные курсы</h2>
              <AsyncState
                loading={courses.loading}
                error={courses.error}
                onRetry={courses.retry}
                empty={courses.data?.length === 0}
                emptyText={isOwn ? 'У вас пока нет опубликованных курсов.' : 'Опубликованных курсов пока нет.'}
                emptyAction={isOwn && <Link to="/my-courses">Перейти к моим курсам</Link>}
              >
                <ul className={styles.grid}>
                  {courses.data?.map((course) => (
                    <li key={course.id}>
                      <CourseCard course={course} showAuthor={false} />
                    </li>
                  ))}
                </ul>
              </AsyncState>
            </section>
          </div>
        )
      )}
    </AsyncState>
  );
}
