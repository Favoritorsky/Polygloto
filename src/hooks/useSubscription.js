import { useCallback, useEffect, useState } from 'react';

/**
 * Подписка на данные Firestore с явными состояниями loading / error / data.
 * subscribe(onData, onError) должна вернуть функцию отписки.
 * key — когда он меняется, подписка пересоздаётся (null — не подписываться).
 */
export function useSubscription(subscribe, key) {
  const [state, setState] = useState({ key: undefined, data: undefined, error: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (key === null || key === undefined) return undefined;
    return subscribe(
      (data) => setState({ key, data, error: null }),
      (error) => setState({ key, data: undefined, error }),
    );
    // subscribe намеренно не в зависимостях: она пересоздаётся на каждый рендер.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt]);

  const retry = useCallback(() => {
    setState((s) => ({ ...s, key: undefined, error: null }));
    setAttempt((a) => a + 1);
  }, []);

  const current = state.key === key;
  return {
    data: current ? state.data : undefined,
    error: current ? state.error : null,
    loading: key !== null && key !== undefined && !current,
    retry,
  };
}

/** Однократная загрузка (Promise) с теми же состояниями. */
export function useAsync(load, key) {
  const [state, setState] = useState({ key: undefined, data: undefined, error: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (key === null || key === undefined) return undefined;
    let cancelled = false; // защита от гонки: ответ на устаревший запрос игнорируем
    load().then(
      (data) => !cancelled && setState({ key, data, error: null }),
      (error) => !cancelled && setState({ key, data: undefined, error }),
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt]);

  const retry = useCallback(() => {
    setState((s) => ({ ...s, key: undefined }));
    setAttempt((a) => a + 1);
  }, []);

  const current = state.key === key;
  return {
    data: current ? state.data : undefined,
    error: current ? state.error : null,
    loading: key !== null && key !== undefined && !current,
    retry,
    setData: (data) => setState({ key, data, error: null }),
  };
}
