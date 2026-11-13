import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router';
import RequireAuth from './auth/RequireAuth.jsx';
import RouteFocus from './components/RouteFocus.jsx';
import DashboardLayout from './layouts/DashboardLayout.jsx';
import PublicLayout from './layouts/PublicLayout.jsx';
import AuthPage from './pages/AuthPage.jsx';
import DashboardOverview from './pages/DashboardOverview.jsx';
import LandingPage from './pages/LandingPage.jsx';
import LinksPage from './pages/LinksPage.jsx';
import LinkDetailsPage from './pages/LinkDetailsPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';

const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage.jsx'));

export default function App() {
  return (
    <>
      <RouteFocus />
      <Routes>
        <Route element={<PublicLayout />}>
          <Route index element={<LandingPage />} />
          <Route path="register" element={<AuthPage key="register" mode="register" />} />
          <Route path="login" element={<AuthPage key="login" mode="login" />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
        <Route element={<RequireAuth />}>
          <Route path="dashboard" element={<DashboardLayout />}>
            <Route index element={<DashboardOverview />} />
            <Route path="links" element={<LinksPage />} />
            <Route path="links/:id" element={<LinkDetailsPage />} />
            <Route path="analytics" element={<Suspense fallback={<p role="status">Loading analytics…</p>}><AnalyticsPage /></Suspense>} />
            <Route path="analytics/links/:id" element={<Suspense fallback={<p role="status">Loading analytics…</p>}><AnalyticsPage /></Suspense>} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Route>
      </Routes>
    </>
  );
}
