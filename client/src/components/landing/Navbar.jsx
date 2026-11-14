import { useRef, useState } from 'react';
import { Link, useLocation } from 'react-router';

export default function Navbar() {
  const { pathname, hash } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuToggle = useRef(null);

  function handleNavigationKeyDown(event) {
    if (event.key === 'Escape' && menuOpen && menuToggle.current.getClientRects().length > 0) {
      setMenuOpen(false);
      menuToggle.current.focus();
    }
  }
  return (
    <nav className="navbar" aria-label="Main navigation" onKeyDown={handleNavigationKeyDown}>
      <Link className="brand" to="/" onClick={() => setMenuOpen(false)}>🔗 LinkSnap</Link>

      <button
        ref={menuToggle}
        type="button"
        className="menu-toggle"
        onClick={() => setMenuOpen((open) => !open)}
        aria-label="Toggle navigation menu"
        aria-controls="main-navigation-links"
        aria-expanded={menuOpen}
      >
        <span className={`hamburger ${menuOpen ? 'hamburger-open' : ''}`} aria-hidden="true"></span>
      </button>

      <div id="main-navigation-links" className={`nav-links ${menuOpen ? 'nav-open' : ''}`}>
        <Link
          to="/#features"
          className="nav-link"
          aria-current={pathname === '/' && hash === '#features' ? 'location' : undefined}
          onClick={() => setMenuOpen(false)}
        >
          Features
        </Link>

        <Link
          to="/#how-it-works"
          className="nav-link"
          aria-current={pathname === '/' && hash === '#how-it-works' ? 'location' : undefined}
          onClick={() => setMenuOpen(false)}
        >
          How It Works
        </Link>

        <Link className="primary-btn" to="/register" onClick={() => setMenuOpen(false)}>Get Started</Link>
      </div>
    </nav>
  );
}
