import { useState } from 'react';
import { useReviewQueueCount } from '../../hooks/useReviewQueueCount.js';
import Tabs from '../../components/ui/Tabs.jsx';
import AllCoursesTab from './AllCoursesTab.jsx';
import LanguagesTab from './LanguagesTab.jsx';
import ReviewQueueTab from './ReviewQueueTab.jsx';
import UsersTab from './UsersTab.jsx';

const TABS = [
  { id: 'queue', label: 'Очередь модерации' },
  { id: 'courses', label: 'Все курсы' },
  { id: 'users', label: 'Пользователи' },
  { id: 'languages', label: 'Языки' },
];

export default function AdminPage() {
  const [tab, setTab] = useState('queue');
  const toReview = useReviewQueueCount(true);
  const tabs = TABS.map((t) => (t.id === 'queue' && toReview > 0 ? { ...t, label: `${t.label} (${toReview})` } : t));
  return (
    <div>
      <h1>Администрирование</h1>
      <Tabs tabs={tabs} active={tab} onChange={setTab} label="Разделы админ-панели" />
      {tab === 'queue' && <ReviewQueueTab />}
      {tab === 'courses' && <AllCoursesTab />}
      {tab === 'users' && <UsersTab />}
      {tab === 'languages' && <LanguagesTab />}
    </div>
  );
}
