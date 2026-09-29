import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div>
      <h1>Страница не найдена</h1>
      <p>
        Такой страницы нет. <Link to="/">На главную</Link>
      </p>
    </div>
  );
}
