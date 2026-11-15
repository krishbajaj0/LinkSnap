import { Link } from 'react-router';
import Icon from '../components/dashboard/Icon.jsx';
import '../styles/pages.css';
import '../styles/moderation.css';

export default function NotFoundPage() {
  return (
    <section className="public-panel safety-card" aria-labelledby="not-found-heading">
      <span className="safety-icon"><Icon name="search" size={23} /></span>
      <h1 id="not-found-heading">Page not found</h1>
      <p>Check the address or return to the LinkSnap home page.</p>
      <Link className="primary-btn public-button" to="/">Back to home <Icon name="arrow" /></Link>
    </section>
  );
}
