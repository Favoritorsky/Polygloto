import { useEffect } from 'react';

/**
 * Пишет высоту элемента в CSS-переменную на :root (например, --header-height),
 * чтобы липкие панели ниже вставали ровно под ним, даже когда он переносится в две строки.
 */
export function useHeightVar(ref, name) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const root = document.documentElement;
    const update = () => root.style.setProperty(name, `${el.offsetHeight}px`);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => {
      observer.disconnect();
      root.style.removeProperty(name);
    };
  }, [ref, name]);
}
