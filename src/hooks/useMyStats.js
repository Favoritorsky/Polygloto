import { useEffect, useState } from 'react';
import { subscribeToStats } from '../services/gamificationService.js';
import { useSubscription } from './useSubscription.js';

/** Очки, серия и счётчики пользователя (userStats/{uid}), живая подписка. */
export function useUserStats(uid) {
  return useSubscription((onData, onError) => subscribeToStats(uid, onData, onError), uid ?? null);
}

/**
 * Текущее время для «сегодня» и «эта неделя» (дни по UTC). refreshMs — как
 * часто обновлять (шапка висит часами и должна заметить смену дня).
 */
export function useNow(refreshMs = 0) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!refreshMs) return undefined;
    const timer = setInterval(() => setNow(Date.now()), refreshMs);
    return () => clearInterval(timer);
  }, [refreshMs]);
  return now;
}
