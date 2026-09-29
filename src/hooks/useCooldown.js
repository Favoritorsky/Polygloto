import { useEffect, useState } from 'react';

/** Обратный отсчёт для кнопок вроде «отправить письмо ещё раз». */
export function useCooldown() {
  const [secondsLeft, setSecondsLeft] = useState(0);
  useEffect(() => {
    if (secondsLeft <= 0) return undefined;
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);
  return [secondsLeft, setSecondsLeft];
}
