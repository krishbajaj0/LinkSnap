import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from './useAuth.js';

export default function RequireAuth() {
  const { status, restore } = useAuth();
  const { pathname } = useLocation();

  if (status === 'loading') return <main className="public-panel" role="status">Checking your session…</main>;
  if (status === 'unavailable') {
    return (
      <main className="public-panel">
        <h1>Session check unavailable</h1>
        <button className="primary-btn" type="button" onClick={restore}>Try again</button>
      </main>
    );
  }
  if (status !== 'authenticated') return <Navigate to="/login" replace state={{ from: pathname }} />;
  return <Outlet />;
}
