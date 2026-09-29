import { Route, Routes } from 'react-router-dom';
import Layout from './components/layout/Layout.jsx';
import { isFirebaseConfigured } from './services/firebase.js';
import ConfigMissingPage from './pages/ConfigMissingPage.jsx';
import HomePage from './pages/HomePage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';

export default function App() {
  if (!isFirebaseConfigured) return <ConfigMissingPage />;
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
