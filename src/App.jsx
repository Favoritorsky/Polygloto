import { Route, Routes } from 'react-router-dom';
import RequireAuth from './components/auth/RequireAuth.jsx';
import Layout from './components/layout/Layout.jsx';
import AuthProvider from './context/AuthProvider.jsx';
import { isFirebaseConfigured } from './services/firebase.js';
import ConfigMissingPage from './pages/ConfigMissingPage.jsx';
import HomePage from './pages/HomePage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';
import AccountPage from './pages/auth/AccountPage.jsx';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage.jsx';
import LoginPage from './pages/auth/LoginPage.jsx';
import RegisterPage from './pages/auth/RegisterPage.jsx';

export default function App() {
  if (!isFirebaseConfigured) return <ConfigMissingPage />;
  return (
    <AuthProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />
          <Route path="forgot-password" element={<ForgotPasswordPage />} />
          <Route
            path="account"
            element={
              <RequireAuth>
                <AccountPage />
              </RequireAuth>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}
