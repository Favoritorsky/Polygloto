import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import ContentRenderer from '../../components/content/ContentRenderer.jsx';
import DictionaryBrowser from '../../components/dictionary/DictionaryBrowser.jsx';
import Tabs from '../../components/ui/Tabs.jsx';
import { buildDictionaryIndex } from '../../content/dictionaryIndex.js';
import { useAuth } from '../../hooks/useAuth.js';
import { DEMO_CATEGORIES, DEMO_COURSE, DEMO_DICTIONARY, DEMO_SECTIONS } from './demoCourse.js';
import styles from './DemoCoursePage.module.css';

const TABS = [
  { id: 'lessons', label: 'Самоучитель' },
  { id: 'reference', label: 'Справочник' },
  { id: 'dictionary', label: 'Словарь' },
];
const TAB_IDS = TABS.map((t) => t.id);

function Sections({ sections, dictionary }) {
  return sections.map((section) => (
    <section key={section.id} className={styles.section} aria-label={section.title}>
      <ContentRenderer blocks={section.blocks} categories={DEMO_CATEGORIES} dictionary={dictionary} courseId="demo" />
    </section>
  ));
}

/**
 * Демо-курс испанского: открыт всем без входа, данные лежат в коде
 * (demoCourse.js), а показываются теми же компонентами, что и настоящие курсы.
 */
export default function DemoCoursePage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = TAB_IDS.includes(params.get('tab')) ? params.get('tab') : 'lessons';
  const dictionary = useMemo(() => buildDictionaryIndex(DEMO_DICTIONARY), []);

  return (
    <article className={styles.page}>
      <header className={styles.header}>
        <p className={styles.language}>{DEMO_COURSE.language}</p>
        <h1 className={styles.title}>{DEMO_COURSE.title}</h1>
        <p className={styles.author}>
          {DEMO_COURSE.authorName} · <span className={styles.badge}>демо-курс, без регистрации</span>
        </p>
        <p className={styles.description}>{DEMO_COURSE.description}</p>
        <ul className={styles.stats}>
          <li>Уроков: {DEMO_SECTIONS.lessons.length}</li>
          <li>Разделов справочника: {DEMO_SECTIONS.reference.length}</li>
          <li>Слов в словаре: {DEMO_DICTIONARY.length}</li>
        </ul>
      </header>

      <Tabs tabs={TABS} active={tab} onChange={(id) => setParams(id === 'lessons' ? {} : { tab: id })} label="Разделы курса" />
      <div className={styles.body}>
        {tab === 'lessons' && <Sections sections={DEMO_SECTIONS.lessons} dictionary={dictionary} />}
        {tab === 'reference' && <Sections sections={DEMO_SECTIONS.reference} dictionary={dictionary} />}
        {tab === 'dictionary' && <DictionaryBrowser entries={DEMO_DICTIONARY} />}
      </div>

      <aside className={styles.cta}>
        <p>Так выглядит курс в Polygloto. Соберите свой: уроки, справочник, словарь и упражнения в одном редакторе.</p>
        <Link to={user ? '/my-courses' : '/register'} className={styles.ctaLink}>
          {user ? 'Создать курс' : 'Стать автором'}
        </Link>
      </aside>
    </article>
  );
}
