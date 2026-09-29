import { useState } from 'react';
import Tabs from '../../components/ui/Tabs.jsx';
import AllCoursesTab from './AllCoursesTab.jsx';
import ReviewQueueTab from './ReviewQueueTab.jsx';
import UsersTab from './UsersTab.jsx';

const TABS = [
  { id: 'queue', label: 'Очередь модерации' },
  { id: 'courses', label: 'Все курсы' },
  { id: 'users', label: 'Пользователи' },
];

export default function AdminPage() {
  const [tab, setTab] = useState('queue');
  return (
    <div>
      <h1>Администрирование</h1>
      <Tabs tabs={TABS} active={tab} onChange={setTab} label="Разделы админ-панели" />
      {tab === 'queue' && <ReviewQueueTab />}
      {tab === 'courses' && <AllCoursesTab />}
      {tab === 'users' && <UsersTab />}
    </div>
  );
}
