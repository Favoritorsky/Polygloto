import Alert from './Alert.jsx';
import Button from './Button.jsx';
import Spinner from './Spinner.jsx';
import styles from './AsyncState.module.css';

/**
 * Единая обработка состояний запроса: loading / error / empty / success.
 * Используется каждым компонентом, который читает данные из Firebase,
 * чтобы не было «тихих» провалов.
 */
export default function AsyncState({
  loading,
  error,
  empty = false,
  emptyText = 'Здесь пока ничего нет.',
  emptyAction = null,
  onRetry,
  loadingLabel,
  children,
}) {
  if (loading) return <Spinner label={loadingLabel} />;
  if (error) {
    return (
      <Alert
        tone="error"
        title="Не удалось загрузить данные"
        action={onRetry && (
          <Button size="sm" variant="secondary" onClick={onRetry}>
            Повторить
          </Button>
        )}
      >
        {error.message || String(error)}
      </Alert>
    );
  }
  if (empty) {
    return (
      <div className={styles.empty}>
        <p>{emptyText}</p>
        {emptyAction}
      </div>
    );
  }
  return children;
}
