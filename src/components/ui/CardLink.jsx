import { Link, useNavigate } from 'react-router-dom';
import styles from './CardLink.module.css';

/**
 * Главная ссылка карточки. Растягивается на всю карточку через CSS
 * (::after с inset: 0, см. CardLink.module.css), поэтому клик в любом месте
 * карточки ведёт по ссылке, а в разметке остаётся одна настоящая ссылка:
 * Enter, средняя кнопка мыши и «открыть в новой вкладке» работают как обычно.
 * Space ссылки по умолчанию не активирует, добавляем это для карточек.
 * Контейнер карточки получает класс tile, другие кнопки и ссылки внутри — above:
 *   import tile from '../ui/CardLink.module.css';
 *   <li className={`${styles.item} ${tile.tile}`}>…<CardLink …/>…<Button className={tile.above} /></li>
 */
export default function CardLink({ to, className, children, ...rest }) {
  const navigate = useNavigate();
  const onKeyDown = (event) => {
    if (event.key === ' ' && !event.repeat) {
      event.preventDefault();
      navigate(to);
    }
  };
  return (
    <Link to={to} className={className ? `${styles.stretched} ${className}` : styles.stretched} onKeyDown={onKeyDown} {...rest}>
      {children}
    </Link>
  );
}
