import { lazy, Suspense, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../auth/useAuth.js';
import Icon from '../components/dashboard/Icon.jsx';
import { EmptyState, LoadingState, MetricCard, StatusBadge } from '../components/dashboard/WorkspaceUi.jsx';
import TopLinks from '../components/analytics/TopLinks.jsx';
import '../styles/overview.css';

const ClickTrend = lazy(() => import('../components/analytics/ClickTrend.jsx'));
const recentDate = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });
const createLinkPath = '/dashboard/links#create-link';

function RecentLinks({ newest, updated }) {
  const [sort, setSort] = useState('created');
  const rows = sort === 'created' ? newest : updated;
  const dateField = sort === 'created' ? 'createdAt' : 'updatedAt';
  return (
    <section className="dashboard-panel workspace-card bento-recent" aria-labelledby="recent-links-title">
      <div className="bento-recent-heading">
        <h2 id="recent-links-title">Recent links</h2>
        {Boolean(newest.length || updated.length) && (
          <div className="bento-period-toggle" role="group" aria-label="Sort recent links">
            <button type="button" aria-pressed={sort === 'created'} onClick={() => setSort('created')}>Created</button>
            <button type="button" aria-pressed={sort === 'updated'} onClick={() => setSort('updated')}>Updated</button>
          </div>
        )}
      </div>
      {!rows.length ? (
        <EmptyState title={newest.length || updated.length ? 'No links to show' : 'Create your first short link'}>
          {!newest.length && !updated.length && <Link className="text-link" to={createLinkPath}>Open the create form</Link>}
        </EmptyState>
      ) : (
        <table className="recent-links" aria-label={sort === 'created' ? 'Recently created links' : 'Recently updated links'}>
          <thead><tr><th scope="col">Short code</th><th scope="col">Status</th><th scope="col">{sort === 'created' ? 'Created' : 'Updated'}</th></tr></thead>
          <tbody>{rows.map((link) => (
            <tr key={link.id}>
              <td><Link to={`links/${link.id}`}>{link.shortCode}</Link></td>
              <td><StatusBadge status={link.status} /></td>
              <td><time dateTime={link[dateField]}>{recentDate.format(new Date(link[dateField]))}</time></td>
            </tr>
          ))}</tbody>
        </table>
      )}
    </section>
  );
}

function TrafficOverview({ counts }) {
  const humanShare = counts.total ? 100 * counts.human / counts.total : 0;
  return (
    <section className="dashboard-panel workspace-card bento-traffic" aria-labelledby="traffic-title">
      <h2 id="traffic-title">Traffic overview</h2>
      <p className="workspace-panel-caption">Last 30 days · UTC</p>
      <div className="bento-traffic-total">
        <span className="bento-traffic-ring" data-empty={counts.total === 0}
          style={{ '--human-share': `${humanShare}%` }} aria-hidden="true" />
        <div><strong>{counts.total.toLocaleString()}</strong><span>Recorded clicks</span></div>
      </div>
      <dl className="bento-traffic-breakdown">
        <div><dt>Estimated human clicks</dt><dd>{counts.human.toLocaleString()}</dd></div>
        <div><dt>Flagged bot clicks</dt><dd>{counts.bot.toLocaleString()}</dd></div>
      </dl>
    </section>
  );
}

function LinkSummary({ counts }) {
  return (
    <section className="dashboard-panel workspace-card bento-lifecycle" aria-labelledby="lifecycle-title">
      <div>
        <h2 id="lifecycle-title">Link status</h2>
        <dl className="summary-metrics">
          <div><dt>Disabled</dt><dd>{counts.disabled.toLocaleString()}</dd></div>
          <div><dt>Expired</dt><dd>{counts.expired.toLocaleString()}</dd></div>
          <div><dt>Security blocked</dt><dd>{counts['security-blocked'].toLocaleString()}</dd></div>
        </dl>
      </div>
      <div>
        <h3>Last 7 days</h3>
        <dl className="summary-metrics">
          <div><dt>Created</dt><dd>{counts.recentlyCreated.toLocaleString()}</dd></div>
          <div><dt>Updated</dt><dd>{counts.recentlyUpdated.toLocaleString()}</dd></div>
        </dl>
      </div>
    </section>
  );
}

export default function DashboardOverview() {
  const { authorizedApiRequest, user } = useAuth();
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

  const firstName = user?.name?.trim().split(/\s+/, 1)[0];
  const display = (value, section) => value ?? (errors[section] ? 'Unavailable' : '—');
  return (
    <section className="dashboard-overview" aria-labelledby="overview-title">
      <header className="workspace-heading stage-page-header bento-heading">
        <div>
          {firstName && <p className="bento-greeting">Welcome back, {firstName}</p>}
          <h1 id="overview-title">Dashboard overview</h1>
          <p>Track your short links and see how people use them.</p>
        </div>
        <Link className="primary-btn workspace-button" to={createLinkPath}><Icon name="plus" /> Create link</Link>
      </header>
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
      <dl className="bento-grid bento-metrics" aria-label="Overview metrics">
        <MetricCard icon="chart" label="Total recorded clicks" value={display(analytics?.lifetime.total, 'analytics')} hint="Lifetime total" featured />
        <MetricCard icon="link" label="Total links" value={display(data?.counts.total, 'link totals')} hint="Current links" />
        <MetricCard icon="shield" label="Active links" value={display(data?.counts.active, 'link totals')} hint="Ready to redirect" />
        <MetricCard icon="visitors" label="Approximate unique visitors"
          value={display(analytics && (analytics.visitors.approximate ?? 'Unavailable'), 'analytics')}
          hint={analytics?.visitors.enabled === false ? 'Visitor estimates are disabled' : 'Selected period · last 30 days'} />
      </dl>
      {analytics && (
        <div className="bento-grid bento-insights">
          <div className="bento-chart">
            {analytics.counts.total ? (
              <Suspense fallback={<LoadingState>Loading chart…</LoadingState>}>
                <ClickTrend trends={analytics.trends} interval={analytics.range.interval} description="Last 30 days · UTC" />
              </Suspense>
            ) : (
              <section className="dashboard-panel workspace-card bento-chart-empty" aria-labelledby="empty-chart-title">
                <h2 id="empty-chart-title">Click activity</h2>
                <p className="workspace-panel-caption">Last 30 days · UTC</p>
                <EmptyState icon="chart" title="No clicks yet"><p>Click activity appears after visitors open your short links.</p></EmptyState>
              </section>
            )}
          </div>
          <TrafficOverview counts={analytics.counts} />
        </div>
      )}
      {(analytics || data) && (
        <div className="bento-grid bento-links">
          {analytics && <TopLinks links={analytics.topLinks} limit={5} description="Ranked by recorded clicks in the last 30 days." />}
          {data && <RecentLinks newest={data.newest} updated={data.updated} />}
        </div>
      )}
      {data && <LinkSummary counts={data.counts} />}
    </section>
  );
}
