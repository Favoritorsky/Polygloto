import { useEffect, useState } from 'react';
import { subscribeToReviewQueue } from '../services/moderationService.js';

/**
 * Сколько курсов ждёт проверки: для метки у «Модерации» в шапке.
 * Подписка живая — новая заявка появляется без перезагрузки страницы.
 * Для не-админов не подписывается (правила всё равно не дали бы читать).
 */
export function useReviewQueueCount(enabled) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!enabled) return undefined;
    return subscribeToReviewQueue(
      (courses) => setCount(courses.length),
      () => setCount(0),
    );
  }, [enabled]);
  return enabled ? count : 0;
}
