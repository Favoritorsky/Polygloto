import { Link, useNavigate } from 'react-router-dom';

/**
 * Главная ссылка карточки. Растягивается на всю карточку через CSS
 * (::after с inset: 0 у класса из className), поэтому клик в любом месте
 * карточки ведёт по ссылке, а в разметке остаётся одна настоящая ссылка:
 * Enter, средняя кнопка мыши и «открыть в новой вкладке» работают как обычно.
 * Space ссылки по умолчанию не активирует, добавляем это для карточек.
 * Другие кнопки и ссылки внутри карточки должны лежать выше (position: relative; z-index: 1).
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
    <Link to={to} className={className} onKeyDown={onKeyDown} {...rest}>
      {children}
    </Link>
  );
}
