import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { useAuth } from '../auth/useAuth.js';
import ClickTrend from '../components/analytics/ClickTrend.jsx';
import '../styles/analytics.css';

const breakdownLabels = {
  device: 'Devices', browser: 'Browsers', os: 'Operating systems', country: 'Countries', referrer: 'Referrer domains',
};

function Metrics({ items }) {
  return <dl className="kpi-grid">{items.map(([label, value]) => (
    <div className="kpi-card" key={label}><dt>{label}</dt><dd>{typeof value === 'number' ? value.toLocaleString() : value}</dd></div>
  ))}</dl>;
}

function Breakdown({ title, rows, total }) {
  return (
    <section className="dashboard-panel">
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
      <header className="workspace-heading">
        <div><h1 id="analytics-title">{id ? 'Link analytics' : 'Analytics'}</h1>
          {report?.shortCode && <p>Short code {report.shortCode}</p>}</div>
        <button type="button" className="primary-btn" disabled={!report || exporting}
          onClick={() => void download()}>{exporting ? 'Preparing CSV…' : 'Export CSV'}</button>
      </header>
      <form className="dashboard-panel analytics-filters" onSubmit={applyFilters} aria-label="Analytics filters">
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
      {!report && !error && <p className="state-note" role="status">Loading analytics…</p>}
      {report && (
        <>
          <h2 className="analytics-section-title">Selected period</h2>
          <p>{from} through {through} (UTC) · {report.range.traffic === 'all' ? 'All traffic' : report.range.traffic === 'bot' ? 'Bots only' : 'Human estimates'}</p>
          <Metrics items={[
            ['Recorded clicks', counts.total], ['Estimated human clicks', counts.human],
            ['Flagged bot clicks', counts.bot], ['Approximate unique visitors', visitors.approximate ?? 'Unavailable'],
          ]} />
          <p className="analytics-caption">
            {!visitors.enabled ? 'Visitor identification is disabled on this server.' :
              report.range.traffic === 'bot' ? 'Visitor estimates apply to non-bot traffic.' :
              `Estimate based on ${visitors.identifiedClicks.toLocaleString()} eligible clicks. Daily rotation, shared IPs, and changing networks affect the count.`}
          </p>
          {counts.total === 0 ? <p className="dashboard-panel">No clicks match these filters.</p> : (
            <>
              <ClickTrend trends={report.trends} interval={report.range.interval} />
              <div className="analytics-grid">
                {Object.entries(breakdownLabels).map(([key, label]) => (
                  <Breakdown key={key} title={label} rows={report.breakdowns[key]} total={counts.total} />
                ))}
              </div>
              {!id && report.topLinks.length > 0 && (
                <section className="dashboard-panel">
                  <h2>Most clicked links</h2>
                  <table className="recent-links" aria-label="Most clicked links">
                    <thead><tr><th scope="col">Short code</th><th scope="col">Recorded clicks</th></tr></thead>
                    <tbody>{report.topLinks.map((link) => <tr key={link.id}>
                      <td>{link.deleted ? `${link.shortCode} (deleted)` :
                        <Link className="text-link" to={`/dashboard/analytics/links/${link.id}`}>{link.shortCode}</Link>}</td>
                      <td>{link.clicks.toLocaleString()}</td>
                    </tr>)}</tbody>
                  </table>
                </section>
              )}
            </>
          )}
          <h2 className="analytics-section-title">Lifetime counters</h2>
          <p className="analytics-caption">All dates and traffic types. These counters outlive the 90-day event history and may differ from event totals.</p>
          <Metrics items={[
            ['Lifetime clicks', report.lifetime.total], ['Lifetime estimated human clicks', report.lifetime.human],
            ['Lifetime flagged bot clicks', report.lifetime.bot],
          ]} />
        </>
      )}
    </section>
  );
}
