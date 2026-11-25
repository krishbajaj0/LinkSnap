import { Link } from 'react-router';

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
            <span>QR Studio</span>
            <span>Settings</span>
          </div>
          <div className="product-content">
            <div className="product-heading"><strong>Dashboard overview</strong></div>
            <div className="product-tools">
              <div className="product-featured">
                <span className="product-icon icon-analytics" />
                <strong>Recorded clicks</strong>
                <small>Lifetime total</small>
              </div>
              <div>
                <span className="product-icon icon-qr" />
                <strong>QR Studio</strong>
                <small>PNG and SVG</small>
              </div>
            </div>
            <div className="product-activity">
              <strong>Click activity</strong>
              <small>No sample traffic</small>
            </div>
            <div className="product-sample">
              <span className="product-icon icon-link" />
              <div><strong>/product-guide</strong><small>example.com/resources/product-guide</small></div>
              <span className="product-tag">Sample link</span>
            </div>
          </div>
        </div>
      </div>
      <figcaption><span>Illustrated dashboard preview</span><Link className="text-link" to="/dashboard">Open dashboard <span aria-hidden="true">↗</span></Link></figcaption>
    </figure>
  );
}
