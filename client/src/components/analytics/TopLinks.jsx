import { Link } from 'react-router';
import { EmptyState } from '../dashboard/WorkspaceUi.jsx';

export default function TopLinks({ links, description, limit = links.length }) {
  return (
    <section className="dashboard-panel workspace-card top-links">
      <h2>Top-performing links</h2>
      <p className="workspace-panel-caption">{description}</p>
      {links.length === 0 ? <EmptyState icon="chart" title="No clicks in this period" /> : (
        <table className="recent-links" aria-label="Top-performing links">
          <thead><tr><th scope="col">Short code</th><th scope="col">Clicks</th></tr></thead>
          <tbody>{links.slice(0, limit).map((link) => (
            <tr key={link.id}>
              <td>{link.deleted ? `${link.shortCode} (deleted)` :
                <Link to={`/dashboard/analytics/links/${link.id}`}>{link.shortCode}</Link>}</td>
              <td>{link.clicks.toLocaleString()}</td>
            </tr>
          ))}</tbody>
        </table>
      )}
    </section>
  );
}
