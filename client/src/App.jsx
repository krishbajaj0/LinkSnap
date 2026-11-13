import { Route, Routes } from 'react-router';
import RouteFocus from './components/RouteFocus.jsx';
import DashboardLayout from './layouts/DashboardLayout.jsx';
import PublicLayout from './layouts/PublicLayout.jsx';
import AuthPage from './pages/AuthPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import LandingPage from './pages/LandingPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';

export default function App() {
  return (
    <>
      <RouteFocus />
      <Routes>
        <Route element={<PublicLayout />}>
          <Route index element={<LandingPage />} />
          <Route path="register" element={<AuthPage mode="register" />} />
          <Route path="login" element={<AuthPage mode="login" />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
        <Route path="dashboard" element={<DashboardLayout />}>
          <Route index element={<DashboardPage title="Dashboard Overview" description="Your link activity and performance summary will appear here." />} />
          <Route path="links" element={<DashboardPage title="My Links" description="Create and manage your short links here when link management is available." />} />
          <Route path="analytics" element={<DashboardPage title="Analytics" description="Click trends, devices, and referrers will appear here when tracking is available." />} />
          <Route path="settings" element={<DashboardPage title="Settings" description="Manage your profile and password here once accounts are available." />} />
        </Route>
      </Routes>
    </>
  );
}
