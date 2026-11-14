import { useRef, useState } from 'react';
import { Link, useLocation } from 'react-router';
import Brand from './Brand.jsx';

export default function Navbar() {
  const { pathname, hash } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuToggle = useRef(null);
  const close = () => setMenuOpen(false);

  function handleNavigationKeyDown(event) {
    if (event.key === 'Escape' && menuOpen && menuToggle.current.getClientRects().length) {
      close();
      menuToggle.current.focus();
    }
  }

  return (
    <header className="public-header">
      <nav className="public-nav public-container" aria-label="Main navigation" onKeyDown={handleNavigationKeyDown}>
        <Brand onClick={close} />
        <button ref={menuToggle} type="button" className="public-menu-toggle" onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle navigation menu" aria-controls="main-navigation-links" aria-expanded={menuOpen}>
          <span aria-hidden="true" />
        </button>

        <div id="main-navigation-links" className="public-nav-links" data-open={menuOpen}>
          <div className="public-nav-sections">
            <Link to="/#features" aria-current={pathname === '/' && hash === '#features' ? 'location' : undefined}
              onClick={close}>Features</Link>
            <Link to="/#how-it-works" aria-current={pathname === '/' && hash === '#how-it-works' ? 'location' : undefined}
              onClick={close}>How it works</Link>
          </div>
          <div className="public-nav-account">
            <Link to="/login" aria-current={pathname === '/login' ? 'page' : undefined} onClick={close}>Log in</Link>
            <Link className="primary-btn public-button" to="/register" onClick={close}>Get started <span aria-hidden="true">↗</span></Link>
          </div>
        </div>
      </nav>
    </header>
  );
}
