import { useEffect, useState } from 'react';
import { SRS_CHANGED_EVENT, countDueCards } from '../services/srsService.js';

const REFRESH_MS = 60000;

/**
 * Сколько карточек готово к повторению: для бейджа в шапке. Пересчитывается
 * раз в минуту, при возврате на вкладку и после добавления/повторения слов.
 */
export function useDueCount(uid) {
  const [state, setState] = useState({ uid: null, count: 0 });
  useEffect(() => {
    if (!uid) return undefined;
    let cancelled = false;
    const refresh = () =>
      countDueCards(uid).then(
        (count) => !cancelled && setState({ uid, count }),
        () => {},
      );
    refresh();
    const timer = setInterval(refresh, REFRESH_MS);
    const onVisible = () => document.visibilityState === 'visible' && refresh();
    window.addEventListener(SRS_CHANGED_EVENT, refresh);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener(SRS_CHANGED_EVENT, refresh);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [uid]);
  return state.uid === uid ? state.count : 0;
}
