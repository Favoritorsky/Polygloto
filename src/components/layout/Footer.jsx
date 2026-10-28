import { Link } from 'react-router-dom';
import styles from './Footer.module.css';

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <p>
        Polygloto — интерактивные самоучители любых языков прямо в браузере. <Link to="/open">Открыть файл курса (JSON)</Link>
      </p>
    </footer>
  );
}
