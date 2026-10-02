import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { catalogLanguageFilter, CONLANGS_FILTER } from '../../../shared/languages.js';
import { LIMITS, normalizeText } from '../../../shared/schema.js';
import { CATALOG_SORTS, DEFAULT_SORT } from '../../catalog/catalogQuery.js';
import CourseCard from '../../components/course/CourseCard.jsx';
import Alert from '../../components/ui/Alert.jsx';
import AsyncState from '../../components/ui/AsyncState.jsx';
import Button from '../../components/ui/Button.jsx';
import { useCuratedLanguages } from '../../hooks/useCuratedLanguages.js';
import { useAsync } from '../../hooks/useSubscription.js';
import { fetchCatalogPage, getCatalogLanguages } from '../../services/catalogService.js';
import { toUserMessage } from '../../services/errors.js';
import styles from './CatalogPage.module.css';

const SEARCH_DEBOUNCE_MS = 350;

/** Каталог: поиск по названию и языку, фильтр по языку, сортировка по оценкам. Состояние — в адресе. */
export default function CatalogPage() {
  const [params, setParams] = useSearchParams();
  const search = params.get('q') ?? '';
  const language = params.get('lang') ?? '';
  const sort = CATALOG_SORTS[params.get('sort')] ? params.get('sort') : DEFAULT_SORT;
  const [draft, setDraft] = useState(search);
  const [moreLoading, setMoreLoading] = useState(false);
  const [moreError, setMoreError] = useState('');

  // Поле поиска обновляет адрес с задержкой, чтобы не делать запрос на каждую букву.
  useEffect(() => {
    if (draft === search) return undefined;
    const timer = setTimeout(() => update({ q: draft }), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  function update(changes) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setParams(next, { replace: true });
  }

  // Пункты фильтра: курируемые языки (с числом курсов из catalogMeta) и «Конланги».
  const curated = useCuratedLanguages();
  const counts = useAsync(getCatalogLanguages, 'languages');
  const countFor = (name) => counts.data?.find((c) => c.key === normalizeText(name))?.count;
  // Пока список языков грузится, id языка из адреса не с чем сверить — ждём его.
  const waitingForLanguages = Boolean(language) && language !== CONLANGS_FILTER && curated.loading;
  const languageFilter = catalogLanguageFilter(language, curated.data ?? [], normalizeText);
  const page = useAsync(
    () => fetchCatalogPage({ search, languageFilter, sort }),
    waitingForLanguages ? null : JSON.stringify([search, languageFilter, sort]),
  );

  async function loadMore() {
    if (moreLoading) return;
    setMoreLoading(true);
    setMoreError('');
    try {
      const next = await fetchCatalogPage({ search, languageFilter, sort, cursor: page.data.cursor });
      const seen = new Set(page.data.items.map((c) => c.id));
      page.setData({ ...next, items: [...page.data.items, ...next.items.filter((c) => !seen.has(c.id))] });
    } catch (err) {
      setMoreError(toUserMessage(err));
    } finally {
      setMoreLoading(false);
    }
  }

  const filtered = Boolean(search.trim() || language);
  const items = page.data?.items ?? [];
  // Доводка поиска на клиенте могла отсеять всю страницу — тогда предлагаем искать дальше.
  const emptyButMore = items.length === 0 && page.data?.hasMore;

  return (
    <div className={styles.page}>
      <h1>Каталог курсов</h1>
      <form className={styles.filters} role="search" onSubmit={(e) => e.preventDefault()}>
        <label className={styles.search}>
          <span className="visually-hidden">Поиск по названию и языку</span>
          <input
            type="search"
            value={draft}
            maxLength={LIMITS.COURSE_TITLE_MAX}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Поиск по названию или языку"
          />
        </label>
        <div className={styles.select}>
          <label htmlFor="catalog-language">Язык</label>
          <select id="catalog-language" value={language} onChange={(e) => update({ lang: e.target.value })} disabled={curated.loading}>
            <option value="">Все языки</option>
            {curated.data?.map((l) => (
              <option key={l.id} value={l.id}>
                {countFor(l.name) ? `${l.name} (${countFor(l.name)})` : l.name}
              </option>
            ))}
            <option value={CONLANGS_FILTER}>Конланги</option>
            {/* Старая ссылка с названием языка вместо id: пункт остаётся видимым. */}
            {languageFilter?.field === 'languageLower' && <option value={language}>{language}</option>}
          </select>
        </div>
        <div className={styles.select}>
          <label htmlFor="catalog-sort">Сортировка</label>
          <select id="catalog-sort" value={sort} onChange={(e) => update({ sort: e.target.value === DEFAULT_SORT ? '' : e.target.value })}>
            {Object.entries(CATALOG_SORTS).map(([id, s]) => (
              <option key={id} value={id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        {filtered && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setDraft('');
              update({ q: '', lang: '' });
            }}
          >
            Сбросить
          </Button>
        )}
      </form>
      {curated.error && <Alert tone="warning">Не удалось загрузить список языков: фильтр по языку недоступен.</Alert>}

      <AsyncState
        loading={page.loading || waitingForLanguages}
        error={page.error}
        onRetry={page.retry}
        loadingLabel="Ищем курсы…"
        empty={items.length === 0 && !emptyButMore}
        emptyText={filtered ? 'По этому запросу ничего не нашлось. Попробуйте другое слово или сбросьте фильтры.' : 'Каталог только начинает наполняться: опубликованных курсов пока нет. Ваш может стать одним из первых.'}
      >
        {items.length > 0 && (
          <ul className={styles.grid}>
            {items.map((course) => (
              <li key={course.id}>
                <CourseCard course={course} />
              </li>
            ))}
          </ul>
        )}
        {emptyButMore && <p className={styles.muted}>Среди уже загруженных курсов совпадений нет.</p>}
        {moreError && <Alert tone="error">{moreError}</Alert>}
        {page.data?.hasMore && (
          <div className={styles.more}>
            <Button variant="secondary" loading={moreLoading} onClick={loadMore}>
              {emptyButMore ? 'Искать дальше' : 'Показать ещё'}
            </Button>
          </div>
        )}
      </AsyncState>
    </div>
  );
}
