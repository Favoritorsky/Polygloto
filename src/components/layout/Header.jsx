import { Link, NavLink, useNavigate } from 'react-router-dom';
import Button from '../ui/Button.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { logout } from '../../services/authService.js';
import styles from './Header.module.css';

const navClass = ({ isActive }) => (isActive ? styles.active : undefined);

export default function Header() {
  const { user, profile, isAdmin, initializing } = useAuth();
  const navigate = useNavigate();

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
            <NavLink to="/my-courses" className={navClass}>
              Мои курсы
            </NavLink>
          )}
          {isAdmin && (
            <NavLink to="/admin" className={navClass}>
              Модерация
            </NavLink>
          )}
        </nav>
        <div className={styles.right}>
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
            <>
              <NavLink to="/account" className={styles.userLink}>
                {profile?.displayName ?? user.email}
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
