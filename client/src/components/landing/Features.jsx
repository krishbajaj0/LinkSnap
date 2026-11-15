const features = [
  ['link', 'Short links, your way', 'Create a custom alias or let LinkSnap generate a short code for you.'],
  ['analytics', 'Click analytics', 'See traffic trends and learn which devices and referrers bring people to your links.'],
  ['qr', 'Custom QR codes', 'Adjust the colors, add a logo, and export your code as PNG or SVG.'],
  ['manage', 'Link management', 'Organize links with tags, set expirations, and make changes in bulk.'],
  ['shield', 'Link safety', 'Preview a destination hostname before opening it and report suspicious links.'],
  ['redirect', 'Reliable redirects', 'Route visitors to the right destination while your link is active.'],
];

export default function Features() {
  return (
    <section id="features" className="landing-section public-container" tabIndex={-1} aria-labelledby="features-title">
      <header className="landing-section-heading">
        <h2 id="features-title">A workspace for every link.</h2>
      </header>
      <ul className="feature-grid">
        {features.map(([icon, title, detail]) => (
          <li className="public-feature-card" key={icon}>
            <span className={`product-icon icon-${icon}`} aria-hidden="true" />
            <h3>{title}</h3>
            <p>{detail}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
