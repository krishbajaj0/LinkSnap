import { Link } from 'react-router';

export default function Hero() {
  return (
    <section className="hero">
      <span className="hero-badge">SMART LINK MANAGEMENT</span>

      <h1 className="hero-title">
        Shorten Links.<br />Track Results.
      </h1>

      <p className="hero-description">
        Create powerful short links, track every click,
        and grow smarter with real-time analytics.
      </p>

      <Link className="primary-btn hero-button" to="/register">Get Started Free</Link>
    </section>
  );
}
