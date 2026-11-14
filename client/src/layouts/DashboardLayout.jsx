import { useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { useAuth } from '../auth/useAuth.js';
import '../styles/dashboard.css';

const links = [
  { to: '/dashboard', label: 'Overview' },
  { to: '/dashboard/links', label: 'My Links' },
  { to: '/dashboard/analytics', label: 'Analytics' },
  { to: '/dashboard/settings', label: 'Settings' },
];

function DashboardShell() {
  const { user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuToggle = useRef(null);

  function closeOnEscape(event) {
    if (event.key === 'Escape' && menuOpen && menuToggle.current.getClientRects().length) {
      setMenuOpen(false);
      menuToggle.current.focus();
    }
  }

  return (
    <div className="dashboard-layout">
      <a className="primary-btn skip-link" href="#main-content">Skip to main content</a>
      <div className="dashboard-navigation" onKeyDown={closeOnEscape}>
        <header className="dashboard-header">
          <Link className="brand" to="/">🔗 LinkSnap</Link>
          <button
            ref={menuToggle}
            className="dashboard-menu-toggle"
            type="button"
            aria-controls="dashboard-sidebar"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            Menu
          </button>
        </header>

        <aside id="dashboard-sidebar" className="dashboard-sidebar" data-open={menuOpen}>
          <nav aria-label="Dashboard navigation">
            {links.map(({ to, label }) => (
              <NavLink key={to} to={to} end={to === '/dashboard' || to === '/dashboard/settings'} onClick={() => setMenuOpen(false)}>
                {label}
              </NavLink>
            ))}
            {user?.role === 'admin' && <NavLink to="/dashboard/moderation" end onClick={() => setMenuOpen(false)}>Moderation</NavLink>}
          </nav>
        </aside>
      </div>

      <main id="main-content" className="dashboard-main" tabIndex={-1}>
        <Outlet />
      </main>
    </div>
  );
}

export default function DashboardLayout() {
  const { pathname } = useLocation();

  return <DashboardShell key={pathname} />;
}
