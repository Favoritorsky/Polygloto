import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import ContentRenderer from '../../components/content/ContentRenderer.jsx';
import CourseCard from '../../components/course/CourseCard.jsx';
import AsyncState from '../../components/ui/AsyncState.jsx';
import { buildDictionaryIndex } from '../../content/dictionaryIndex.js';
import { useAuth } from '../../hooks/useAuth.js';
import { useAsync } from '../../hooks/useSubscription.js';
import { fetchCatalogPage } from '../../services/catalogService.js';
import { DEMO_BLOCKS, DEMO_CATEGORIES, DEMO_DICTIONARY } from './demoLesson.js';
import styles from './HomePage.module.css';

const SHOWCASE_SIZE = 6;

const AUDIENCES = [
  {
    title: 'Авторам',
    text: 'Преподавателям, репетиторам, носителям языка и всем, кто хочет поделиться знаниями. Пишите грамматику, словарь и упражнения в одном редакторе и делитесь курсом ссылкой.',
  },
  {
    title: 'Учащимся',
    text: 'Всем, кто учит язык: английский, испанский, японский или любой другой, от самых популярных до редких и даже придуманных. Бесплатно и прямо в браузере.',
  },
];

const VS_PDF = [
  ['🔎', 'Словарь под рукой', 'Слова в тексте связаны со словарём курса: перевод появляется по наведению, листать в конец книги не нужно.'],
  ['✅', 'Упражнения с проверкой', 'Выбор ответа, пропуски, пары, перевод и свободный ответ проверяются сразу, и можно попробовать ещё раз.'],
  ['🎨', 'Цветная разметка', 'Автор выделяет цветом части речи или падежи, а легенда рядом с текстом объясняет, что есть что.'],
  ['🔄', 'Всегда свежая версия', 'Автор исправляет ошибку, и после проверки все читатели сразу видят новую версию. Не нужно рассылать файл заново.'],
  ['💬', 'Живое сообщество', 'Комментарии, реакции на уроки и оценки курсов помогают автору, а новичкам — выбрать курс.'],
  ['📱', 'Удобно на телефоне', 'Текст подстраивается под экран, а таблицы не вылезают за край, как в PDF.'],
];

const STEPS = [
  ['Зарегистрируйтесь', 'Нужны только почта и пароль. Подтвердите почту по ссылке из письма.'],
  ['Создайте черновик', 'Уроки, справочник и словарь сохраняются автоматически, пока вы пишете.'],
  ['Отправьте на проверку', 'Модератор посмотрит курс и опубликует его или подскажет, что поправить.'],
  ['Делитесь и развивайте', 'Курс появится в каталоге. Правки после публикации тоже проходят проверку, а читатели видят прежнюю версию, пока новая не одобрена.'],
];

/** Главная: что такое Polygloto, для кого, чем лучше PDF, как стать автором, витрина курсов. */
export default function HomePage() {
  const { user } = useAuth();
  const dictionary = useMemo(() => buildDictionaryIndex(DEMO_DICTIONARY), []);
  const showcase = useAsync(() => fetchCatalogPage({ sort: 'rating', pageSize: SHOWCASE_SIZE }), 'home-showcase');
  const authorLink = user ? '/my-courses' : '/register';

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <h1 className={styles.heroTitle}>Интерактивные самоучители любых языков мира</h1>
        <p className={styles.lead}>
          Polygloto — площадка, где авторы собирают курсы с уроками, словарём и упражнениями прямо в браузере, а учащиеся
          проходят их бесплатно.
        </p>
        <div className={styles.actions}>
          <Link to="/catalog" className={styles.primary}>
            Открыть каталог
          </Link>
          <Link to={authorLink} className={styles.secondary}>
            {user ? 'Создать курс' : 'Стать автором'}
          </Link>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="demo-title">
        <h2 id="demo-title">Попробуйте прямо здесь</h2>
        <p className={styles.muted}>Так выглядит урок в Polygloto: наведите на слово и решите задание.</p>
        <div className={styles.demo}>
          <ContentRenderer blocks={DEMO_BLOCKS} categories={DEMO_CATEGORIES} dictionary={dictionary} />
        </div>
      </section>

      <section className={styles.section} aria-labelledby="audience-title">
        <h2 id="audience-title">Для кого Polygloto</h2>
        <div className={styles.twoCols}>
          {AUDIENCES.map((a) => (
            <div key={a.title} className={styles.panel}>
              <h3>{a.title}</h3>
              <p>{a.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="pdf-title">
        <h2 id="pdf-title">Чем это лучше самоучителя в PDF</h2>
        <ul className={styles.features}>
          {VS_PDF.map(([icon, title, text]) => (
            <li key={title}>
              <span className={styles.featureIcon} aria-hidden="true">
                {icon}
              </span>
              <h3>{title}</h3>
              <p>{text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.section} aria-labelledby="steps-title">
        <h2 id="steps-title">Как стать автором</h2>
        <ol className={styles.steps}>
          {STEPS.map(([title, text]) => (
            <li key={title}>
              <h3>{title}</h3>
              <p>{text}</p>
            </li>
          ))}
        </ol>
        <Link to={authorLink} className={styles.primary}>
          {user ? 'Перейти к моим курсам' : 'Зарегистрироваться'}
        </Link>
      </section>

      <section className={styles.section} aria-labelledby="showcase-title">
        <div className={styles.sectionHead}>
          <h2 id="showcase-title">Популярные курсы</h2>
          <Link to="/catalog">Весь каталог →</Link>
        </div>
        <AsyncState
          loading={showcase.loading}
          error={showcase.error}
          onRetry={showcase.retry}
          loadingLabel="Загружаем курсы…"
          empty={showcase.data?.items.length === 0}
          emptyText="Опубликованных курсов пока нет. Ваш может стать первым!"
          emptyAction={<Link to={authorLink}>Создать курс</Link>}
        >
          <ul className={styles.grid}>
            {showcase.data?.items.map((course) => (
              <li key={course.id}>
                <CourseCard course={course} />
              </li>
            ))}
          </ul>
        </AsyncState>
      </section>
    </div>
  );
}
