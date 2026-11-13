import { Link } from 'react-router';

export default function CTA() {
  return (
    <section className="cta">
      <h2 className="cta-title">Ready to Shorten Smarter?</h2>

      <p className="cta-description">
        See the registration preview. Free signup will open when authentication is available.
      </p>

      <Link className="primary-btn cta-button" to="/register">Get Started Free</Link>
    </section>
  );
}
