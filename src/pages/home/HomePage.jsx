import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import ContentRenderer from '../../components/content/ContentRenderer.jsx';
import CourseCard from '../../components/course/CourseCard.jsx';
import RatingControl from '../../components/course/RatingControl.jsx';
import ReactionBar from '../../components/reactions/ReactionBar.jsx';
import AsyncState from '../../components/ui/AsyncState.jsx';
import { buildDictionaryIndex } from '../../content/dictionaryIndex.js';
import { useAuth } from '../../hooks/useAuth.js';
import { useAsync } from '../../hooks/useSubscription.js';
import { fetchCatalogPage } from '../../services/catalogService.js';
import { FRENCH_BLOCKS, FRENCH_CATEGORIES, FRENCH_DICTIONARY, FRENCH_PREVIEW } from './frenchPreview.js';
import { counts, loadFeedback, saveFeedback, toggle } from './previewFeedback.js';
import styles from './HomePage.module.css';

const SHOWCASE_SIZE = 6;

const AUDIENCES = [
  {
    title: 'Авторам',
    text: 'Преподавателям, репетиторам, носителям языка и всем, кто хочет поделиться знаниями. Пишите грамматику, словарь и упражнения в одном редакторе и делитесь курсом ссылкой.',
  },
  {
    title: 'Учащимся',
    text: 'Всем, кто учит язык. Курс можно создать для любого языка: от самых популярных до редких и даже придуманных. Учиться бесплатно, прямо в браузере.',
  },
];

const VS_PDF = [
  ['🔎', 'Словарь под рукой', 'Слова в тексте связаны со словарём курса: перевод появляется по наведению, листать в конец книги не нужно.'],
  [
    '✅',
    'Упражнения с проверкой',
    'Восемь типов заданий, от выбора ответа до аудирования, проверяются сразу, и можно попробовать ещё раз.',
  ],
  ['🎨', 'Цветная разметка', 'Автор выделяет цветом части речи или падежи, а легенда рядом с текстом объясняет, что есть что.'],
  [
    '🔄',
    'Всегда свежая версия',
    'Автор исправляет ошибку, и после проверки все читатели сразу видят новую версию. Не нужно рассылать файл заново.',
  ],
  [
    '💬',
    'Сообщество только начинается',
    'Комментарии к курсам и урокам, реакции и оценки уже работают. Станьте одним из первых, кто задаст вопрос автору и поможет новичкам выбрать курс.',
  ],
  ['📱', 'Удобно на телефоне', 'Текст подстраивается под экран, а таблицы не вылезают за край, как в PDF.'],
];

const PREVIEW_RULES = [
  ['ou', '[у]'],
  ['ch', '[ш]'],
  ['eu', '[ё]'],
  ['on, an, in', 'носовые'],
  ['-s, -t, -d', 'молчат'],
];

const STEPS = [
  ['Зарегистрируйтесь', 'Нужны только почта и пароль. Подтвердите почту по ссылке из письма.'],
  ['Создайте черновик', 'Уроки, справочник и словарь сохраняются автоматически, пока вы пишете.'],
  ['Отправьте на проверку', 'Модератор посмотрит курс и опубликует его или подскажет, что поправить.'],
  [
    'Делитесь и развивайте',
    'Курс появится в каталоге. Правки после публикации тоже проходят проверку, а читатели видят прежнюю версию, пока новая не одобрена.',
  ],
];

/**
 * Главная и первый экран нового посетителя: что такое Polygloto, урок-превью по французской
 * фонетике без регистрации (с оценкой и реакциями), для кого, чем лучше PDF, как стать автором, витрина.
 */
export default function HomePage() {
  const { user } = useAuth();
  const dictionary = useMemo(() => buildDictionaryIndex(FRENCH_DICTIONARY), []);
  const [feedback, setFeedback] = useState(loadFeedback);
  useEffect(() => saveFeedback(feedback), [feedback]);
  const tally = counts(feedback);
  const showcase = useAsync(() => fetchCatalogPage({ sort: 'rating', pageSize: SHOWCASE_SIZE }), 'home-showcase');
  const authorLink = user ? '/my-courses' : '/register';

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroText}>
          <h1 className={styles.heroTitle}>Интерактивные самоучители любых языков мира</h1>
          <p className={styles.lead}>
            Polygloto — площадка, где авторы собирают курсы с уроками, словарём и упражнениями прямо в браузере, а учащиеся проходят их
            бесплатно.
          </p>
          <div className={styles.actions}>
            <a href="#preview" className={styles.primary}>
              Пройти урок-превью
            </a>
            <Link to="/catalog" className={styles.secondary}>
              Открыть каталог
            </Link>
            <Link to={authorLink} className={styles.secondary}>
              {user ? 'Создать курс' : 'Стать автором'}
            </Link>
          </div>
        </div>
        <a href="#preview" className={styles.teaser} aria-label="Начать урок-превью по французской фонетике">
          <span className={styles.teaserLabel}>Урок-превью · без регистрации</span>
          <strong className={styles.teaserTitle}>Как читать по-французски</strong>
          <ul className={styles.teaserRules}>
            {PREVIEW_RULES.map(([letters, sound]) => (
              <li key={letters}>
                <b>{letters}</b>
                <span>{sound}</span>
              </li>
            ))}
          </ul>
          <span className={styles.teaserCta}>Начать урок ↓</span>
        </a>
      </section>

      <section id="preview" className={styles.section} aria-labelledby="preview-title">
        <h2 id="preview-title">Попробуйте прямо здесь</h2>
        <p className={styles.muted}>
          Короткий урок из пяти правил: читайте, наводите на слова, решайте задания, а в конце оцените урок и поставьте реакцию. Регистрация
          не нужна.
        </p>
        <article className={styles.lesson} aria-label={FRENCH_PREVIEW.title}>
          <header className={styles.lessonHeader}>
            <p className={styles.lessonLanguage}>{FRENCH_PREVIEW.language}</p>
            <h3 className={styles.lessonTitle}>{FRENCH_PREVIEW.title}</h3>
          </header>
          <ContentRenderer blocks={FRENCH_BLOCKS} categories={FRENCH_CATEGORIES} dictionary={dictionary} courseId="preview" />
          <footer className={styles.feedback}>
            <div className={styles.feedbackRow}>
              <span className={styles.feedbackLabel}>Как вам урок?</span>
              <RatingControl
                likes={tally.likes}
                dislikes={tally.dislikes}
                mine={feedback.rating}
                onVote={(value) => setFeedback((f) => toggle(f, 'rating', value))}
              />
            </div>
            <div className={styles.feedbackRow}>
              <span className={styles.feedbackLabel}>Реакция</span>
              <ReactionBar summary={tally.reactions} onToggle={(emoji) => setFeedback((f) => toggle(f, 'reaction', emoji))} />
            </div>
            <p className={styles.feedbackNote}>
              Стрелки — оценка урока или курса, эмодзи — ваша реакция. На превью они сохраняются только в этом браузере, а в настоящих
              курсах их видят автор и другие читатели.
            </p>
          </footer>
        </article>
        <div className={styles.actions}>
          <Link to="/demo" className={styles.primary}>
            Открыть демо-курс испанского
          </Link>
          {!user && (
            <Link to="/register" className={styles.secondary}>
              Зарегистрироваться
            </Link>
          )}
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
          <h2 id="showcase-title">Курсы в каталоге</h2>
          <Link to="/catalog">Весь каталог →</Link>
        </div>
        <AsyncState
          loading={showcase.loading}
          error={showcase.error}
          onRetry={showcase.retry}
          loadingLabel="Загружаем курсы…"
          empty={showcase.data?.items.length === 0}
          emptyText="Каталог только начинает наполняться. Ваш курс может стать одним из первых!"
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
