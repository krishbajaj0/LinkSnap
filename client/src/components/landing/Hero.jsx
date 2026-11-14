import { Link } from 'react-router';

export default function Hero() {
  return (
    <section className="landing-hero public-container" aria-labelledby="landing-title">
      <h1 id="landing-title">Short links.<br /><span>Clear insights.</span></h1>
      <p>Create memorable short links, see how people find them, and share them anywhere with custom QR codes.</p>
      <div className="landing-actions">
        <Link className="primary-btn public-button" to="/register">Get started <span aria-hidden="true">→</span></Link>
        <Link className="public-button public-button-outline" to="/#product-preview">
          See the dashboard <span aria-hidden="true">↓</span>
        </Link>
      </div>
    </section>
  );
}
