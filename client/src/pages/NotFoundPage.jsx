import { Link } from 'react-router';
import '../styles/pages.css';

export default function NotFoundPage() {
  return (
    <section className="public-panel">
      <h1>404 — Page not found</h1>
      <p>The page you requested could not be found.</p>
      <Link className="primary-btn" to="/">Back to home</Link>
    </section>
  );
}
