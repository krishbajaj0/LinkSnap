import { Link } from 'react-router';

export default function CTA() {
  return (
    <section className="landing-cta public-container" aria-labelledby="landing-cta-title">
      <div>
        <h2 id="landing-cta-title">Create your first short link.</h2>
        <p>Set up your workspace and start sharing.</p>
      </div>
      <Link className="primary-btn public-button" to="/register">Get started <span aria-hidden="true">→</span></Link>
    </section>
  );
}
