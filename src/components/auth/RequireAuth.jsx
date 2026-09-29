import { Navigate, useLocation } from 'react-router-dom';
import Spinner from '../ui/Spinner.jsx';
import { useAuth } from '../../hooks/useAuth.js';

/** Пускает только вошедших; adminOnly — только админов. */
export default function RequireAuth({ adminOnly = false, children }) {
  const { user, initializing, profileLoading, isAdmin } = useAuth();
  const location = useLocation();

  if (initializing) return <Spinner />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (adminOnly) {
    if (profileLoading) return <Spinner />;
    if (!isAdmin) return <Navigate to="/" replace />;
  }
  return children;
}
