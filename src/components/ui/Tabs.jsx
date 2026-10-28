import { useRef } from 'react';
import { useHeightVar } from '../../hooks/useHeightVar.js';
import styles from './Tabs.module.css';

/**
 * Вкладки. tabs: [{ id, label }]. Управляемый компонент.
 * sticky — вкладки прилипают под шапкой и видны при любой прокрутке (разделы курса).
 */
export default function Tabs({ tabs, active, onChange, label, sticky = false }) {
  return sticky ? (
    <StickyTabs tabs={tabs} active={active} onChange={onChange} label={label} />
  ) : (
    <TabList tabs={tabs} active={active} onChange={onChange} label={label} />
  );
}

function StickyTabs(props) {
  const ref = useRef(null);
  useHeightVar(ref, '--tabs-height');
  return (
    <div className={styles.stickyWrap} ref={ref}>
      <TabList {...props} />
    </div>
  );
}

function TabList({ tabs, active, onChange, label }) {
  return (
    <div className={styles.tabs} role="tablist" aria-label={label}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={active === tab.id}
          className={active === tab.id ? `${styles.tab} ${styles.active}` : styles.tab}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
