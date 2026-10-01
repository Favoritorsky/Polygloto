import { Link, NavLink, useNavigate } from 'react-router-dom';
import Avatar from '../profile/Avatar.jsx';
import ThemeToggle from './ThemeToggle.jsx';
import Button from '../ui/Button.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { useDueCount } from '../../hooks/useDueCount.js';
import { useNow, useUserStats } from '../../hooks/useMyStats.js';
import { currentStreak } from '../../../shared/gamification.js';
import { logout } from '../../services/authService.js';
import styles from './Header.module.css';

const navClass = ({ isActive }) => (isActive ? styles.active : undefined);

export default function Header() {
  const { user, profile, isAdmin, initializing } = useAuth();
  const navigate = useNavigate();
  const due = useDueCount(user?.uid);
  const stats = useUserStats(user?.uid);
  const now = useNow(60000);
  const streak = currentStreak(stats.data, now);

  async function handleLogout() {
    await logout();
    navigate('/');
  }

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link to="/" className={styles.logo}>
          Polygloto
        </Link>
        <nav className={styles.nav} aria-label="Основная навигация">
          <NavLink to="/catalog" className={navClass}>
            Каталог
          </NavLink>
          {user && (
            <NavLink to="/feed" className={navClass}>
              Лента
            </NavLink>
          )}
          {user && (
            <NavLink to="/my-courses" className={navClass}>
              Мои курсы
            </NavLink>
          )}
          {user && (
            <NavLink to="/review" className={navClass}>
              Повторение
              {due > 0 && (
                <span className={styles.badge} aria-label={`к повторению: ${due}`}>
                  {due > 99 ? '99+' : due}
                </span>
              )}
            </NavLink>
          )}
          <NavLink to="/leaderboard" className={navClass}>
            Рейтинг
          </NavLink>
          {isAdmin && (
            <NavLink to="/admin" className={navClass}>
              Модерация
            </NavLink>
          )}
        </nav>
        <div className={styles.right}>
          <ThemeToggle />
          {!initializing && !user && (
            <>
              <Button variant="ghost" size="sm" onClick={() => navigate('/login')}>
                Войти
              </Button>
              <Button size="sm" onClick={() => navigate('/register')}>
                Стать автором
              </Button>
            </>
          )}
          {user && (
            <NavLink
              to="/progress"
              className={streak > 0 ? styles.streak : `${styles.streak} ${styles.streakOff}`}
              title="Мой прогресс: серия дней, очки, задания дня"
              aria-label={`Мой прогресс, серия: ${streak} дн.`}
            >
              <span aria-hidden="true">🔥</span> {streak}
            </NavLink>
          )}
          {user && (
            <>
              <NavLink to={`/users/${user.uid}`} className={styles.userLink} title="Мой профиль">
                <Avatar name={profile?.displayName ?? user.email} url={profile?.photoURL} seed={user.uid} size={28} />
                <span>{profile?.displayName ?? user.email}</span>
              </NavLink>
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                Выйти
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
