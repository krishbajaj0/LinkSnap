import { Link } from 'react-router';

export default function CTA() {
  return (
    <section className="cta">
      <h2 className="cta-title">Ready to Shorten Smarter?</h2>

      <p className="cta-description">
        Create your free LinkSnap account.
      </p>

      <Link className="primary-btn cta-button" to="/register">Get Started Free</Link>
    </section>
  );
}
