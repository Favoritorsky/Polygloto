import { Link, NavLink } from 'react-router-dom';
import styles from './Header.module.css';

export default function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link to="/" className={styles.logo}>
          Polygloto
        </Link>
        <nav className={styles.nav} aria-label="Основная навигация">
          <NavLink to="/catalog" className={({ isActive }) => (isActive ? styles.active : undefined)}>
            Каталог
          </NavLink>
        </nav>
      </div>
    </header>
  );
}
