import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../auth/useAuth.js';

const metrics = [
  ['total', 'Total links'], ['active', 'Active'], ['disabled', 'Disabled'], ['expired', 'Expired'],
  ['security-blocked', 'Security blocked'], ['recentlyCreated', 'Created in the last 7 days'],
  ['recentlyUpdated', 'Updated in the last 7 days'],
];

function KpiCard({ label, value }) {
  return <div className="kpi-card"><dt>{label}</dt><dd>{value}</dd></div>;
}

function RecentLinks({ title, rows, dateField }) {
  return (
    <section className="dashboard-panel">
      <h2>{title}</h2>
      {!rows.length ? <p>No links to show.</p> : (
        <table className="recent-links" aria-label={title}>
          <thead><tr><th scope="col">Short code</th><th scope="col">Status</th><th scope="col">Date</th></tr></thead>
          <tbody>
            {rows.map((link) => (
              <tr key={link.id}>
                <td><Link className="text-link" to={`links/${link.id}`}>{link.shortCode}</Link></td>
                <td><span className="link-state" data-status={link.status}>{link.status}</span></td>
                <td><time dateTime={link[dateField]}>{new Date(link[dateField]).toLocaleDateString()}</time></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

export default function DashboardOverview() {
  const { authorizedApiRequest } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const request = new AbortController();
    authorizedApiRequest('/links/overview', { signal: request.signal }).then((result) => {
      if (!request.signal.aborted) setData(result);
    }).catch((failure) => {
      if (!request.signal.aborted) setError(failure.status ? failure.message : 'Could not load your dashboard.');
    });
    return () => request.abort();
  }, [authorizedApiRequest, attempt]);

  return (
    <section className="dashboard-overview" aria-labelledby="overview-title">
      <header className="workspace-heading">
        <div><h1 id="overview-title">Dashboard Overview</h1><p>Manage your short links and review recent activity.</p></div>
        <Link className="primary-btn" to="/dashboard/links#create-link">Create link</Link>
      </header>
      {error && <div className="dashboard-panel">
        <p role="alert">{error}</p>
        <button className="primary-btn" type="button" onClick={() => {
          setError('');
          setAttempt((value) => value + 1);
        }}>Try again</button>
      </div>}
      {!data && !error && <p role="status">Loading dashboard…</p>}
      {data && (
        <>
          <dl className="kpi-grid">
            {metrics.map(([key, label]) => <KpiCard key={key} label={label} value={data.counts[key]} />)}
          </dl>
          {data.counts.total === 0 ? (
            <div className="dashboard-panel">
              <h2>Create your first short link</h2>
              <Link className="text-link" to="/dashboard/links#create-link">Open the create form</Link>
            </div>
          ) : (
            <div className="overview-tables">
              <RecentLinks title="Recently created links" rows={data.newest} dateField="createdAt" />
              <RecentLinks title="Recently updated links" rows={data.updated} dateField="updatedAt" />
            </div>
          )}
        </>
      )}
      <div className="dashboard-panel analytics-note">
        <h2>Click analytics</h2>
        <Link className="text-link" to="/dashboard/analytics">View click trends and visitor insights</Link>
      </div>
    </section>
  );
}
