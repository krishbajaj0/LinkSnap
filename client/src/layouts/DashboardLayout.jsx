import { useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useMatch } from 'react-router';
import { useAuth } from '../auth/useAuth.js';
import Icon from '../components/dashboard/Icon.jsx';
import ActionDisclosure from '../components/dashboard/ActionDisclosure.jsx';
import Brand from '../components/landing/Brand.jsx';
import '../styles/dashboard.css';
import '../styles/workspace.css';
import '../styles/bento-workspace.css';

const links = [
  { to: '/dashboard', label: 'Overview', icon: 'overview', end: true },
  { to: '/dashboard/links', label: 'My Links', icon: 'link' },
  { to: '/dashboard/analytics', label: 'Analytics', icon: 'chart' },
  { to: '/dashboard/links/qr', label: 'QR Studio', icon: 'qr' },
  { to: '/dashboard/settings', label: 'Settings', icon: 'settings', end: true },
];

function DashboardShell() {
  const { user, logout } = useAuth();
  const qrActive = Boolean(useMatch('/dashboard/links/:id?/qr'));
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const menuToggle = useRef(null);
  const navigation = user?.role === 'admin'
    ? [...links, { to: '/dashboard/moderation', label: 'Moderation', icon: 'shield', end: true }]
    : links;
  const initials = Array.from(user?.name?.trim() || user?.email || 'L')[0].toUpperCase();

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    setLogoutError('');
    try {
      await logout();
    } catch {
      setLogoutError('Could not log out. Please try again.');
      setSigningOut(false);
    }
  }

  function closeOnEscape(event) {
    if (event.key === 'Escape' && menuOpen && menuToggle.current?.getClientRects().length) {
      setMenuOpen(false);
      menuToggle.current.focus();
    }
  }

  return (
    <div className="dashboard-layout workspace-shell">
      <a className="primary-btn skip-link" href="#main-content">Skip to main content</a>
      <div className="dashboard-navigation" onKeyDown={closeOnEscape}>
        <header className="dashboard-header">
          <Brand />
          <button ref={menuToggle} className="dashboard-menu-toggle" type="button"
            aria-label="Toggle dashboard navigation" aria-controls="dashboard-sidebar" aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}><Icon name="menu" /> Menu</button>
          <ActionDisclosure className="workspace-account" label={`Account menu${user?.name ? `, ${user.name}` : ''}`} trigger={
            <><span className="workspace-avatar" aria-hidden="true">{initials}</span>
              <span className="workspace-account-name">{user?.name}</span><Icon name="chevron" size={15} /></>
          }>
            <div className="workspace-account-details"><strong>{user?.name}</strong><small>{user?.email}</small></div>
            <Link to="/dashboard/settings">Account settings</Link>
            <button type="button" onClick={() => void signOut()} aria-disabled={signingOut}>
              {signingOut ? 'Logging out…' : 'Log out'}
            </button>
            {logoutError && <p className="form-error" role="alert">{logoutError}</p>}
          </ActionDisclosure>
        </header>
        <aside id="dashboard-sidebar" className="dashboard-sidebar" data-open={menuOpen}>
          <nav aria-label="Dashboard navigation">
            {navigation.map(({ to, label, icon, end }) => to === '/dashboard/links/qr' ? (
              <Link key={to} to={to} aria-current={qrActive ? 'page' : undefined} onClick={() => setMenuOpen(false)}>
                <Icon name={icon} /> {label}
              </Link>
            ) : (
              <NavLink key={to} to={to} end={end || (qrActive && to === '/dashboard/links')} onClick={() => setMenuOpen(false)}>
                <Icon name={icon} /> {label}
              </NavLink>
            ))}
          </nav>
        </aside>
      </div>
      <main id="main-content" className="dashboard-main" tabIndex={-1}><Outlet /></main>
    </div>
  );
}

export default function DashboardLayout() {
  const { pathname } = useLocation();
  return <DashboardShell key={pathname} />;
}
