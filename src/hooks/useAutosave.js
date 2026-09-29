import { useCallback, useEffect, useRef, useState } from 'react';
import { AUTOSAVE_DEBOUNCE_MS } from '../../shared/schema.js';

/**
 * Debounced-автосохранение.
 *  - schedule(value): запомнить последнее значение и сохранить через delay мс тишины;
 *  - сохранения идут строго последовательно: если во время записи пришли новые
 *    правки, после неё запускается ещё одна запись с последним значением
 *    (никаких гонок, последнее слово — за последней правкой);
 *  - flush(): сохранить немедленно (при уходе со страницы / переключении урока);
 *  - при размонтировании несохранённое значение сохраняется;
 *  - пока есть несохранённые правки, браузер предупреждает при закрытии вкладки.
 * status: 'idle' | 'pending' | 'saving' | 'saved' | 'error'
 */
export function useAutosave(save, delay = AUTOSAVE_DEBOUNCE_MS) {
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);
  const saveRef = useRef(save);
  const pending = useRef(null); // { value } — несохранённое значение
  const timer = useRef(null);
  const inFlight = useRef(null);
  const runRef = useRef(null);

  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  const run = useCallback(async () => {
    clearTimeout(timer.current);
    timer.current = null;
    // Строго последовательно: дождаться текущей записи.
    while (inFlight.current) await inFlight.current;
    if (!pending.current) return;
    const { value } = pending.current;
    pending.current = null;
    setStatus('saving');
    let failed = false;
    const task = (async () => {
      try {
        await saveRef.current(value);
        setError(null);
      } catch (err) {
        failed = true;
        // Возвращаем значение в очередь, чтобы не потерять правки. Повтор — при
        // следующей правке или по кнопке (flush), без бесконечных автоповторов.
        if (!pending.current) pending.current = { value };
        setError(err);
      }
    })();
    inFlight.current = task;
    await task;
    inFlight.current = null;
    if (failed) {
      setStatus('error');
    } else if (pending.current) {
      // Пока шла запись, накопились правки — сохраняем и их.
      setStatus('pending');
      if (timer.current === null) timer.current = setTimeout(() => runRef.current(), delay);
    } else {
      setStatus('saved');
    }
  }, [delay]);

  const schedule = useCallback(
    (value) => {
      pending.current = { value };
      setStatus('pending');
      clearTimeout(timer.current);
      timer.current = setTimeout(run, delay);
    },
    [delay, run],
  );

  const flush = useCallback(() => run(), [run]);

  // Сохранить несохранённое при размонтировании.
  useEffect(() => {
    runRef.current = run;
  }, [run]);
  useEffect(
    () => () => {
      if (pending.current) runRef.current();
    },
    [],
  );

  // Предупреждение при закрытии вкладки с несохранёнными правками.
  useEffect(() => {
    function onBeforeUnload(event) {
      if (pending.current || inFlight.current) {
        event.preventDefault();
        event.returnValue = '';
      }
    }
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  const hasPending = useCallback(() => Boolean(pending.current || inFlight.current), []);

  return { status, error, schedule, flush, hasPending };
}
