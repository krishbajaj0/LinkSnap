
export default function Features() {
  return (
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
  );
}
