import { Link } from 'react-router';

export default function Hero() {
  return (
    <section className="landing-hero public-container" aria-labelledby="landing-title">
      <h1 id="landing-title">Short links.<br /><span>Smarter sharing.</span></h1>
      <p>Turn long URLs into links people can remember. Share them with custom QR codes and see where your clicks come from.</p>
      <div className="landing-actions">
        <Link className="primary-btn public-button" to="/register">Get started <span aria-hidden="true">→</span></Link>
        <Link className="public-button public-button-outline" to="/login">Log in</Link>
      </div>
    </section>
  );
}
