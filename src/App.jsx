import { Route, Routes } from 'react-router-dom';
import RequireAuth from './components/auth/RequireAuth.jsx';
import Layout from './components/layout/Layout.jsx';
import AuthProvider from './context/AuthProvider.jsx';
import { isFirebaseConfigured } from './services/firebase.js';
import ConfigMissingPage from './pages/ConfigMissingPage.jsx';
import HomePage from './pages/home/HomePage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';
import AccountPage from './pages/auth/AccountPage.jsx';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage.jsx';
import LoginPage from './pages/auth/LoginPage.jsx';
import RegisterPage from './pages/auth/RegisterPage.jsx';
import MyCoursesPage from './pages/courses/MyCoursesPage.jsx';
import CatalogPage from './pages/catalog/CatalogPage.jsx';
import DemoCoursePage from './pages/demo/DemoCoursePage.jsx';
import ProfilePage from './pages/profile/ProfilePage.jsx';
import CoursePage from './pages/course/CoursePage.jsx';
import CourseEditorPage from './pages/editor/CourseEditorPage.jsx';
import AdminPage from './pages/admin/AdminPage.jsx';
import ReviewCoursePage from './pages/admin/ReviewCoursePage.jsx';

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
          <Route
            path="my-courses"
            element={
              <RequireAuth>
                <MyCoursesPage />
              </RequireAuth>
            }
          />
          <Route
            path="courses/:courseId/edit"
            element={
              <RequireAuth>
                <CourseEditorPage />
              </RequireAuth>
            }
          />
          <Route
            path="admin"
            element={
              <RequireAuth adminOnly>
                <AdminPage />
              </RequireAuth>
            }
          />
          <Route
            path="admin/review/:courseId"
            element={
              <RequireAuth adminOnly>
                <ReviewCoursePage />
              </RequireAuth>
            }
          />
          <Route path="catalog" element={<CatalogPage />} />
          <Route path="demo" element={<DemoCoursePage />} />
          <Route path="course/:courseId" element={<CoursePage />} />
          <Route path="users/:uid" element={<ProfilePage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}
