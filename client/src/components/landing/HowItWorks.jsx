
export default function HowItWorks() {
  return (
    <section id="how-it-works" className="how-it-works" tabIndex={-1}>
      <h2 className="section-title">How It Works</h2>

      <p className="section-description">
        Get started in three simple steps.
      </p>

      <div className="steps-grid">
        <div className="step-card">
          <span className="step-number">1</span>
          <h3>Paste Your Link</h3>
          <p>Enter any long URL that you want to shorten.</p>
        </div>

        <div className="step-card">
          <span className="step-number">2</span>
          <h3>Customize &amp; Create</h3>
          <p>Add a custom alias, set an expiration, and generate your short link.</p>
        </div>

        <div className="step-card">
          <span className="step-number">3</span>
          <h3>Track &amp; Analyze</h3>
          <p>Monitor clicks, devices, locations, and more from your dashboard.</p>
        </div>
      </div>
    </section>
  );
}
