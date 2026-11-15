import { Link } from 'react-router';

const tools = [
  ['link', 'Short links', 'Custom aliases'],
  ['analytics', 'Click analytics', 'Traffic and referrers'],
  ['qr', 'QR Studio', 'PNG and SVG exports'],
];

export default function DashboardPreview() {
  return (
    <figure id="product-preview" tabIndex={-1} className="product-preview public-container">
      <div className="product-window" aria-hidden="true">
        <div className="product-topbar">
          <span className="product-dots"><i /><i /><i /></span>
          <span className="product-title">LinkSnap / Dashboard</span>
        </div>
        <div className="product-body">
          <div className="product-sidebar">
            <div className="product-brand"><span className="brand-mark" /> LinkSnap</div>
            <span className="product-current">Overview</span>
            <span>My Links</span>
            <span>Analytics</span>
            <span>Settings</span>
          </div>
          <div className="product-content">
            <div className="product-heading"><strong>Dashboard</strong><span>+ Create link</span></div>
            <div className="product-tools">
              {tools.map(([icon, title, detail]) => (
                <div key={icon}>
                  <span className={`product-icon icon-${icon}`} />
                  <strong>{title}</strong>
                  <small>{detail}</small>
                </div>
              ))}
            </div>
            <div className="product-sample">
              <span className="product-icon icon-link" />
              <div><strong>/product-guide</strong><small>example.com/resources/product-guide</small></div>
              <span className="product-tag">Sample link</span>
            </div>
          </div>
        </div>
      </div>
      <figcaption><span>Illustrated product preview</span><Link className="text-link" to="/dashboard">Open dashboard <span aria-hidden="true">↗</span></Link></figcaption>
    </figure>
  );
}
