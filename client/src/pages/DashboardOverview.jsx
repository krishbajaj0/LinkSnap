import { lazy, Suspense, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../auth/useAuth.js';
import Icon from '../components/dashboard/Icon.jsx';
import { EmptyState, LoadingState, MetricCard, PageHeader, StatusBadge } from '../components/dashboard/WorkspaceUi.jsx';
import TopLinks from '../components/analytics/TopLinks.jsx';

const ClickTrend = lazy(() => import('../components/analytics/ClickTrend.jsx'));

function RecentLinks({ title, rows, dateField }) {
  return (
    <section className="dashboard-panel workspace-card">
      <h2>{title}</h2>
      {!rows.length ? <EmptyState title="No links to show" /> : (
        <table className="recent-links" aria-label={title}>
          <thead><tr><th scope="col">Short code</th><th scope="col">Status</th><th scope="col">Date</th></tr></thead>
          <tbody>{rows.map((link) => (
            <tr key={link.id}>
              <td><Link to={`links/${link.id}`}>{link.shortCode}</Link></td>
              <td><StatusBadge status={link.status} /></td>
              <td><time dateTime={link[dateField]}>{new Date(link[dateField]).toLocaleDateString(undefined,
                { month: 'short', day: 'numeric' })}</time></td>
            </tr>
          ))}</tbody>
        </table>
      )}
    </section>
  );
}

function LinkSummary({ counts }) {
  return (
    <section className="dashboard-panel workspace-summary" aria-label="Link status and recent activity">
      <dl className="summary-metrics">
        <div><dt>Disabled</dt><dd>{counts.disabled.toLocaleString()}</dd></div>
        <div><dt>Expired</dt><dd>{counts.expired.toLocaleString()}</dd></div>
        <div><dt>Security blocked</dt><dd>{counts['security-blocked'].toLocaleString()}</dd></div>
      </dl>
      <div className="workspace-summary-period">
        <strong>Last 7 days</strong>
        <dl className="summary-metrics">
          <div><dt>Created</dt><dd>{counts.recentlyCreated.toLocaleString()}</dd></div>
          <div><dt>Updated</dt><dd>{counts.recentlyUpdated.toLocaleString()}</dd></div>
        </dl>
      </div>
    </section>
  );
}

export default function DashboardOverview() {
  const { authorizedApiRequest } = useAuth();
  const [data, setData] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [errors, setErrors] = useState({});
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const request = new AbortController();
    const options = { signal: request.signal };
    async function load(section, path, setter) {
      try {
        const result = await authorizedApiRequest(path, options);
        if (!request.signal.aborted) setter(result);
      } catch (failure) {
        if (!request.signal.aborted) setErrors((current) => ({
          ...current, [section]: failure.status ? failure.message : `Could not load ${section}.`,
        }));
      }
    }
    void load('link totals', '/links/overview', setData);
    void load('analytics', '/analytics', setAnalytics);
    return () => request.abort();
  }, [authorizedApiRequest, attempt]);

  const noLinks = data?.counts.total === 0;
  const display = (value, section) => value ?? (errors[section] ? 'Unavailable' : '—');
  return (
    <section className="dashboard-overview" aria-labelledby="overview-title">
      <PageHeader id="overview-title" title="Overview" description="Your links and click activity at a glance.">
        <Link className="primary-btn workspace-button" to="/dashboard/links#create-link"><Icon name="plus" /> Create link</Link>
      </PageHeader>
      {Object.keys(errors).length > 0 && (
        <div className="workspace-error">
          {Object.entries(errors).map(([section, error]) => <p role="alert" key={section}>{error}</p>)}
          <button className="secondary-btn" type="button" onClick={() => {
            setErrors({});
            setAttempt((value) => value + 1);
          }}>Try again</button>
        </div>
      )}
      {!data && !errors['link totals'] && <LoadingState>Loading link totals…</LoadingState>}
      {!analytics && !errors.analytics && <LoadingState>Loading click activity…</LoadingState>}
      <dl className="workspace-metric-grid" aria-label="Overview metrics">
        <MetricCard icon="link" label="Total links" value={display(data?.counts.total, 'link totals')} hint="Current links" featured />
        <MetricCard icon="shield" label="Active links" value={display(data?.counts.active, 'link totals')} hint="Ready to redirect" />
        <MetricCard icon="chart" label="Total recorded clicks" value={display(analytics?.lifetime.total, 'analytics')} hint="Lifetime total" />
        <MetricCard icon="visitors" label="Approximate unique visitors"
          value={display(analytics && (analytics.visitors.approximate ?? 'Unavailable'), 'analytics')}
          hint={analytics?.visitors.enabled === false ? 'Visitor estimates are disabled' : 'Selected period · last 30 days'} />
      </dl>
      {data && <LinkSummary counts={data.counts} />}
      {analytics && (
        <div className="overview-activity">
          {analytics.counts.total ? (
            <Suspense fallback={<LoadingState>Loading chart…</LoadingState>}>
              <ClickTrend trends={analytics.trends} interval={analytics.range.interval} description="Last 30 days · UTC" />
            </Suspense>
          ) : <section className="dashboard-panel workspace-card">
            <h2>Click activity</h2><EmptyState icon="chart" title="No clicks yet"><p>Click activity appears after visitors open your short links.</p></EmptyState>
          </section>}
          <TopLinks links={analytics.topLinks} limit={5} description="Ranked by recorded clicks in the last 30 days." />
        </div>
      )}
      {noLinks && <div className="dashboard-panel workspace-card">
        <EmptyState title="Create your first short link">
          <Link className="text-link" to="/dashboard/links#create-link">Open the create form</Link>
        </EmptyState>
      </div>}
      {data && !noLinks && (
        <div className="overview-tables">
          <RecentLinks title="Recently created links" rows={data.newest} dateField="createdAt" />
          <RecentLinks title="Recently updated links" rows={data.updated} dateField="updatedAt" />
        </div>
      )}
    </section>
  );
}
