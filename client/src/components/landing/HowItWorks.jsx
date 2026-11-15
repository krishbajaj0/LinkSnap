const steps = [
  ['Add a destination', 'Paste the URL you want people to visit.'],
  ['Set up your short link', 'Pick an alias, set an expiration, or generate a code.'],
  ['Share and track', 'Copy the link or export a QR code, then check traffic in Analytics.'],
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="landing-section landing-steps public-container" tabIndex={-1}
      aria-labelledby="how-title">
      <header className="landing-section-heading"><h2 id="how-title">How it works</h2></header>
      <ol className="step-grid">
        {steps.map(([title, detail], index) => (
          <li key={title}>
            <span aria-hidden="true">0{index + 1}</span>
            <h3>{title}</h3>
            <p>{detail}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
