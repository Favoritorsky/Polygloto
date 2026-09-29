import { missingConfigKeys } from '../services/firebase.js';
import styles from './ConfigMissingPage.module.css';

/** Показывается, если не заполнены переменные VITE_FIREBASE_* в .env.local. */
export default function ConfigMissingPage() {
  return (
    <div className={styles.page}>
      <h1>Firebase не настроен</h1>
      <p>
        Скопируйте <code>.env.example</code> в <code>.env.local</code> и заполните значения из консоли Firebase,
        либо запустите приложение с эмуляторами: <code>npm run emulators</code> и <code>npm run dev:emu</code>.
      </p>
      <p>Не заданы переменные:</p>
      <ul>
        {missingConfigKeys.map((key) => (
          <li key={key}>
            <code>{key}</code>
          </li>
        ))}
      </ul>
    </div>
  );
}
