import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { useAuth } from '../auth/useAuth.js';
import ClickTrend from '../components/analytics/ClickTrend.jsx';
import TopLinks from '../components/analytics/TopLinks.jsx';
import Icon from '../components/dashboard/Icon.jsx';
import { EmptyState, LoadingState, MetricCard, PageHeader } from '../components/dashboard/WorkspaceUi.jsx';
import '../styles/analytics.css';

const breakdownLabels = {
  device: 'Devices', browser: 'Browsers', os: 'Operating systems', country: 'Countries', referrer: 'Referrer domains',
};

function Breakdown({ title, rows, total }) {
  return (
    <section className="dashboard-panel workspace-card">
      <h2>{title}</h2>
      <ul className="analytics-breakdown">
        {rows.map(({ label, clicks }) => (
          <li key={label}>
            <div><span>{label}</span><strong>{clicks.toLocaleString()}</strong></div>
            <meter min="0" max={total} value={clicks} aria-label={`${label} click share`} />
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function AnalyticsPage() {
  const { id } = useParams();
  return <AnalyticsReport key={id ?? 'all'} id={id} />;
}

function AnalyticsReport({ id }) {
  const { authorizedApiRequest } = useAuth();
  const [query, setQuery] = useState('');
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState('');
  const [exportError, setExportError] = useState('');
  const endpoint = id ? `/analytics/links/${encodeURIComponent(id)}` : '/analytics';

  useEffect(() => {
    const request = new AbortController();
    authorizedApiRequest(`${endpoint}?${query}`, { signal: request.signal }).then((data) => {
      if (!request.signal.aborted) setReport(data);
    }).catch((failure) => {
      if (!request.signal.aborted) setError(failure.status ? failure.message : 'Could not load analytics.');
    });
    return () => request.abort();
  }, [authorizedApiRequest, endpoint, query, revision]);

  function load(nextQuery) {
    setQuery(nextQuery);
    setError('');
    setExportStatus('');
    setExportError('');
    setReport(null);
    setRevision((value) => value + 1);
  }

  function applyFilters(event) {
    event.preventDefault();
    const fields = new URLSearchParams();
    for (const [key, value] of new FormData(event.currentTarget)) {
      if (value) fields.set(key, value);
    }
    load(fields.toString());
  }

  async function download() {
    if (!report || exporting) return;
    setExporting(true);
    setExportStatus('');
    setExportError('');
    try {
      const { blob, truncated } = await authorizedApiRequest(`${endpoint}/export.csv?${query}`, { csv: true });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'linksnap-analytics.csv';
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setExportStatus(truncated ? 'Downloaded the latest 5,000 matching clicks. Narrow the dates for a smaller export.' : 'CSV download started.');
    } catch (failure) {
      setExportError(failure.status ? failure.message : 'Could not export analytics.');
    } finally {
      setExporting(false);
    }
  }

  const { counts, visitors } = report ?? {};
  const from = report?.range.from.slice(0, 10);
  const through = report && new Date(+new Date(report.range.toExclusive) - 1).toISOString().slice(0, 10);
  return (
    <section className="analytics-page" aria-labelledby="analytics-title">
      {id && <Link className="text-link" to={`/dashboard/links/${id}`}>Back to link details</Link>}
      <PageHeader id="analytics-title" title={id ? 'Link analytics' : 'Analytics'}
        description={report?.shortCode ? `Short code / ${report.shortCode}` : 'Understand when and how people use your short links.'}>
        <button type="button" className="primary-btn workspace-button" disabled={!report || exporting}
          onClick={() => void download()}><Icon name="download" />{exporting ? 'Preparing CSV…' : 'Export CSV'}</button>
      </PageHeader>
      <form className="dashboard-panel workspace-card analytics-filters" onSubmit={applyFilters} aria-label="Analytics filters">
        <h2>Report filters</h2>
        <fieldset disabled={exporting}>
          <label>From (UTC)<input type="date" name="from" /></label>
          <label>Through (UTC)<input type="date" name="to" /></label>
          <label>Interval<select name="interval"><option value="day">Daily</option><option value="hour">Hourly</option></select></label>
          <label>Traffic<select name="traffic"><option value="all">All traffic</option><option value="human">Human estimates</option><option value="bot">Bots only</option></select></label>
          <button type="submit" className="primary-btn">Apply filters</button>
        </fieldset>
        <p>Daily reports default to 30 days. Hourly reports default to today and support up to 7 days.</p>
      </form>
      {exportStatus && <p className="form-success" role="status">{exportStatus}</p>}
      {exportError && <p className="form-error" role="alert">{exportError}</p>}
      {error && <div className="dashboard-panel">
        <p className="form-error" role="alert">{error}</p>
        <button className="secondary-btn" type="button" onClick={() => load(query)}>Retry analytics</button>
      </div>}
      {!report && !error && <LoadingState>Loading analytics…</LoadingState>}
      {report && (
        <>
          <h2 className="analytics-section-title">Selected period</h2>
          <p>{from} through {through} (UTC) · {report.range.traffic === 'all' ? 'All traffic' : report.range.traffic === 'bot' ? 'Bots only' : 'Human estimates'}</p>
          <dl className="workspace-metric-grid">
            <MetricCard icon="chart" label="Recorded clicks" value={counts.total} featured />
            <MetricCard icon="visitors" label="Estimated human clicks" value={counts.human} />
            <MetricCard icon="shield" label="Flagged bot clicks" value={counts.bot} />
            <MetricCard icon="visitors" label="Approximate unique visitors" value={visitors.approximate ?? 'Unavailable'} />
          </dl>
          <p className="analytics-caption">
            {!visitors.enabled ? 'Visitor identification is disabled on this server.' :
              report.range.traffic === 'bot' ? 'Visitor estimates apply to non-bot traffic.' :
              `Estimate based on ${visitors.identifiedClicks.toLocaleString()} eligible clicks. Daily rotation, shared IPs, and changing networks affect the count.`}
          </p>
          {counts.total === 0 ? <div className="dashboard-panel workspace-card">
            <EmptyState icon="chart" title="No clicks match these filters"><p>Try a different date range or traffic filter.</p></EmptyState>
          </div> : (
            <>
              <ClickTrend trends={report.trends} interval={report.range.interval} description="Recorded clicks for the selected report period" />
              {!id && <TopLinks links={report.topLinks} description="Ranked by recorded clicks for the selected period." />}
              <div className="analytics-grid">
                {Object.entries(breakdownLabels).map(([key, label]) => (
                  <Breakdown key={key} title={label} rows={report.breakdowns[key]} total={counts.total} />
                ))}
              </div>
            </>
          )}
          <h2 className="analytics-section-title">Lifetime counters</h2>
          <p className="analytics-caption">All dates and traffic types. These counters outlive the 90-day event history and may differ from event totals.</p>
          <dl className="workspace-metric-grid lifetime-metric-grid">
            <MetricCard label="Lifetime clicks" value={report.lifetime.total} />
            <MetricCard label="Lifetime estimated human clicks" value={report.lifetime.human} />
            <MetricCard label="Lifetime flagged bot clicks" value={report.lifetime.bot} />
          </dl>
        </>
      )}
    </section>
  );
}
