import { Link } from 'react-router';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-content">
        <div className="footer-brand">
          <h3 className="footer-logo">🔗 LinkSnap</h3>
          <p>Smart link management with powerful analytics.</p>
        </div>

        <div className="footer-links">
          <div className="footer-column">
            <h4>Product</h4>
            <Link to="/#features">Features</Link>
            <Link to="/#how-it-works">How It Works</Link>
            <Link to="/report">Report a short link</Link>
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
  );
}
