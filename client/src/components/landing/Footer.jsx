import { Link } from 'react-router';
import Brand from './Brand.jsx';

export default function Footer() {
  return (
    <footer className="public-footer">
      <div className="public-container">
        <Brand />
        <nav aria-label="Footer navigation">
          <Link to="/#features">Features</Link>
          <Link to="/#how-it-works">How it works</Link>
          <Link to="/report">Report a short link</Link>
        </nav>
        <small>© {new Date().getFullYear()} LinkSnap</small>
      </div>
    </footer>
  );
}
