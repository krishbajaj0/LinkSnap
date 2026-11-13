import './App.css';

function App() {
  return (
    <div className="app-shell">
      <nav className="navbar">
        <h1 className="brand">🔗 LinkSnap</h1>

        <div className="nav-links">
          <a href="#features" className="nav-link">
            Features
          </a>

          <a href="#how-it-works" className="nav-link">
            How It Works
          </a>

          <button className="primary-btn">
            Get Started
          </button>
        </div>
      </nav>

      <main>
        
        <section className="hero">
          <span className="hero-badge">
            SMART LINK MANAGEMENT
          </span>

          <h2 className="hero-title">
            Shorten Links. Track Results.
          </h2>

          <p className="hero-description">
            Create powerful short links, track every click,
            and grow smarter with analytics.
          </p>

          <button className="primary-btn hero-button">
            Get Started Free
          </button>
        </section>
        <section id="features" className="features">
  <h2 className="features-title">
    Everything You Need in One Place
  </h2>

  <p className="features-description">
    Powerful tools to manage, track, and share your links.
  </p>

  <div className="features-grid">
    <div className="feature-card">
      <span className="feature-icon">🔗</span>
      <h3>Smart URL Shortening</h3>
      <p>Create short, memorable links with custom aliases.</p>
    </div>

    <div className="feature-card">
      <span className="feature-icon">📊</span>
      <h3>Advanced Analytics</h3>
      <p>Understand your audience with detailed click insights.</p>
    </div>

    <div className="feature-card">
      <span className="feature-icon">▦</span>
      <h3>Custom QR Codes</h3>
      <p>Create customizable QR codes for easy sharing.</p>
    </div>
  </div>
</section>
      </main>
    </div>
  );
}

export default App;