import { useRef, useState } from 'react';
import './App.css';

function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuToggle = useRef(null);

  function handleNavigationKeyDown(event) {
    if (event.key === 'Escape' && menuOpen && menuToggle.current.getClientRects().length > 0) {
      setMenuOpen(false);
      menuToggle.current.focus();
    }
  }

  return (
    <div className="app-shell">
      {/* ===== Navbar ===== */}
      <nav className="navbar" aria-label="Main navigation" onKeyDown={handleNavigationKeyDown}>
        <h1 className="brand">🔗 LinkSnap</h1>

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
          <a
            href="#features"
            className="nav-link"
            onClick={() => setMenuOpen(false)}
          >
            Features
          </a>

          <a
            href="#how-it-works"
            className="nav-link"
            onClick={() => setMenuOpen(false)}
          >
            How It Works
          </a>

          <button type="button" className="primary-btn" disabled>Get Started (coming soon)</button>
        </div>
      </nav>

      <main>
        {/* ===== Hero Section ===== */}
        <section className="hero">
          <span className="hero-badge">SMART LINK MANAGEMENT</span>

          <h2 className="hero-title">
            Shorten Links.<br />Track Results.
          </h2>

          <p className="hero-description">
            Create powerful short links, track every click,
            and grow smarter with real-time analytics.
          </p>

          <button type="button" className="primary-btn hero-button" disabled>
            Get Started Free (coming soon)
          </button>
        </section>

        {/* ===== Features Section ===== */}
        <section id="features" className="features" tabIndex={-1}>
          <h2 className="section-title">
            Everything You Need in One Place
          </h2>

          <p className="section-description">
            Powerful tools to manage, track, and share your links.
          </p>

          <div className="features-grid">
            <div className="feature-card">
              <span className="feature-icon">🔗</span>
              <h3>Smart URL Shortening</h3>
              <p>Create short, memorable links with custom aliases and auto-generated codes.</p>
            </div>

            <div className="feature-card">
              <span className="feature-icon">📊</span>
              <h3>Advanced Analytics</h3>
              <p>Track clicks, devices, browsers, locations, and referrers in real time.</p>
            </div>

            <div className="feature-card">
              <span className="feature-icon">▦</span>
              <h3>Custom QR Codes</h3>
              <p>Generate QR codes with custom colors, logos, and export as PNG or SVG.</p>
            </div>

            <div className="feature-card">
              <span className="feature-icon">📁</span>
              <h3>Link Management</h3>
              <p>Organize with tags, set expirations, enable or disable links, and bulk actions.</p>
            </div>

            <div className="feature-card">
              <span className="feature-icon">🛡️</span>
              <h3>Security &amp; Privacy</h3>
              <p>URL safety checks, suspicious link detection, and privacy-focused tracking.</p>
            </div>

            <div className="feature-card">
              <span className="feature-icon">⚡</span>
              <h3>Fast Redirects</h3>
              <p>Lightning-fast redirects with link validation and expiration handling.</p>
            </div>
          </div>
        </section>

        {/* ===== How It Works Section ===== */}
        <section id="how-it-works" className="how-it-works" tabIndex={-1}>
          <h2 className="section-title">How It Works</h2>

          <p className="section-description">
            Get started in three simple steps.
          </p>

          <div className="steps-grid">
            <div className="step-card">
              <span className="step-number">1</span>
              <h3>Paste Your Link</h3>
              <p>Enter any long URL that you want to shorten.</p>
            </div>

            <div className="step-card">
              <span className="step-number">2</span>
              <h3>Customize &amp; Create</h3>
              <p>Add a custom alias, set an expiration, and generate your short link.</p>
            </div>

            <div className="step-card">
              <span className="step-number">3</span>
              <h3>Track &amp; Analyze</h3>
              <p>Monitor clicks, devices, locations, and more from your dashboard.</p>
            </div>
          </div>
        </section>

        {/* ===== Dashboard Preview Section ===== */}
        {/* Note: This is a static CSS mockup, not a real dashboard screenshot.
            It will be replaced with an actual screenshot after the dashboard is built in Phase 6. */}
        <section className="preview">
          <h2 className="section-title">Powerful Dashboard</h2>

          <p className="section-description">
            Everything you need to manage and analyze your links in one place.
          </p>

          <div className="preview-container">
            <div className="preview-window">
              <div className="preview-topbar">
                <span className="preview-dot"></span>
                <span className="preview-dot"></span>
                <span className="preview-dot"></span>
                <span className="preview-url">linksnap.app/dashboard</span>
              </div>
              <div className="preview-body">
                {/* Static CSS-only mockup of dashboard layout */}
                <div className="mockup-sidebar">
                  <div className="mockup-sidebar-item active"></div>
                  <div className="mockup-sidebar-item"></div>
                  <div className="mockup-sidebar-item"></div>
                  <div className="mockup-sidebar-item"></div>
                </div>
                <div className="mockup-main">
                  <div className="mockup-kpi-row">
                    <div className="mockup-kpi">
                      <div className="mockup-kpi-label"></div>
                      <div className="mockup-kpi-value"></div>
                    </div>
                    <div className="mockup-kpi">
                      <div className="mockup-kpi-label"></div>
                      <div className="mockup-kpi-value"></div>
                    </div>
                    <div className="mockup-kpi">
                      <div className="mockup-kpi-label"></div>
                      <div className="mockup-kpi-value"></div>
                    </div>
                  </div>
                  <div className="mockup-chart">
                    <div className="mockup-bar" style={{ height: '40%' }}></div>
                    <div className="mockup-bar" style={{ height: '65%' }}></div>
                    <div className="mockup-bar" style={{ height: '85%' }}></div>
                    <div className="mockup-bar" style={{ height: '55%' }}></div>
                    <div className="mockup-bar" style={{ height: '70%' }}></div>
                    <div className="mockup-bar" style={{ height: '90%' }}></div>
                    <div className="mockup-bar" style={{ height: '50%' }}></div>
                  </div>
                  <div className="mockup-table">
                    <div className="mockup-table-row header"></div>
                    <div className="mockup-table-row"></div>
                    <div className="mockup-table-row"></div>
                    <div className="mockup-table-row"></div>
                  </div>
                </div>
              </div>
            </div>
            <p className="preview-note">
              <em>Dashboard preview — actual UI coming soon</em>
            </p>
          </div>
        </section>

        {/* ===== CTA Section ===== */}
        <section className="cta">
          <h2 className="cta-title">Ready to Shorten Smarter?</h2>

          <p className="cta-description">
            Free signup is coming soon. Explore how LinkSnap will help you
            shorten links and track clicks.
          </p>

          <button type="button" className="primary-btn cta-button" disabled>
            Get Started Free (coming soon)
          </button>
        </section>
      </main>

      {/* ===== Footer ===== */}
      <footer className="footer">
        <div className="footer-content">
          <div className="footer-brand">
            <h3 className="footer-logo">🔗 LinkSnap</h3>
            <p>Smart link management with powerful analytics.</p>
          </div>

          <div className="footer-links">
            <div className="footer-column">
              <h4>Product</h4>
              <a href="#features">Features</a>
              <a href="#how-it-works">How It Works</a>
            </div>

            <div className="footer-column">
              <h4>Coming Soon</h4>
              <span className="footer-placeholder">Documentation</span>
              <span className="footer-placeholder">API Reference</span>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <p>&copy; 2026 LinkSnap. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

export default App;
