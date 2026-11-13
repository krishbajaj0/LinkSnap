import { Link } from 'react-router';

export default function DashboardPreview() {
  return (
    <section className="preview">
      <h2 className="section-title">Powerful Dashboard</h2>

      <p className="section-description">
        Everything you need to manage and analyze your links in one place.
      </p>

      <div className="preview-container">
        <div className="preview-window" aria-hidden="true">
          <div className="preview-topbar">
            <span className="preview-dot"></span>
            <span className="preview-dot"></span>
            <span className="preview-dot"></span>
            <span className="preview-url">linksnap.app/dashboard</span>
          </div>
          <div className="preview-body">
            {/* Static CSS-only mockup of dashboard layout */}
            <div className="mockup-sidebar">
              <div className="mockup-sidebar-item active"></div>
              <div className="mockup-sidebar-item"></div>
              <div className="mockup-sidebar-item"></div>
              <div className="mockup-sidebar-item"></div>
            </div>
            <div className="mockup-main">
              <div className="mockup-kpi-row">
                <div className="mockup-kpi">
                  <div className="mockup-kpi-label"></div>
                  <div className="mockup-kpi-value"></div>
                </div>
                <div className="mockup-kpi">
                  <div className="mockup-kpi-label"></div>
                  <div className="mockup-kpi-value"></div>
                </div>
                <div className="mockup-kpi">
                  <div className="mockup-kpi-label"></div>
                  <div className="mockup-kpi-value"></div>
                </div>
              </div>
              <div className="mockup-chart">
                <div className="mockup-bar" style={{ height: '40%' }}></div>
                <div className="mockup-bar" style={{ height: '65%' }}></div>
                <div className="mockup-bar" style={{ height: '85%' }}></div>
                <div className="mockup-bar" style={{ height: '55%' }}></div>
                <div className="mockup-bar" style={{ height: '70%' }}></div>
                <div className="mockup-bar" style={{ height: '90%' }}></div>
                <div className="mockup-bar" style={{ height: '50%' }}></div>
              </div>
              <div className="mockup-table">
                <div className="mockup-table-row header"></div>
                <div className="mockup-table-row"></div>
                <div className="mockup-table-row"></div>
                <div className="mockup-table-row"></div>
              </div>
            </div>
          </div>
        </div>
        <p className="preview-note">
          <Link className="text-link" to="/dashboard">Explore the dashboard preview</Link>
        </p>
      </div>
    </section>
  );
}
