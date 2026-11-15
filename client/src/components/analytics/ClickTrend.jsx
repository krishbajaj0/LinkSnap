import { useId } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const dayLabel = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
const hourLabel = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' });

export default function ClickTrend({ trends, interval, description }) {
  const id = useId();
  const daily = interval === 'day';
  const spansDays = trends[0]?.timestamp.slice(0, 10) !== trends.at(-1)?.timestamp.slice(0, 10);
  const timestampLabel = (timestamp) => daily ? dayLabel.format(new Date(timestamp))
    : `${dayLabel.format(new Date(timestamp))}, ${hourLabel.format(new Date(timestamp))}`;
  const ticks = (timestamp) => daily || spansDays ? timestampLabel(timestamp) : hourLabel.format(new Date(timestamp));
  const tooltipLabel = (timestamp) => timestamp ? `${timestampLabel(timestamp)} UTC` : '';
  const total = trends.reduce((sum, point) => sum + point.clicks, 0);
  const peak = trends.reduce((highest, point) => point.clicks > highest.clicks ? point : highest, trends[0]);
  const activeBuckets = trends.filter(({ clicks }) => clicks > 0).length;
  return (
    <section className="dashboard-panel workspace-card workspace-trend" aria-labelledby={`${id}-heading`}>
      <div className="workspace-chart-heading">
        <div><h2 id={`${id}-heading`}>Click activity</h2><p>{description}</p></div>
        <span className="workspace-chart-legend">Recorded clicks</span>
      </div>
      <div className="analytics-chart">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <AreaChart data={trends} accessibilityLayer margin={{ top: 14, right: 12, left: 0, bottom: 3 }}>
            <defs><linearGradient id={`${id}-fill`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#4F46E5" stopOpacity={0.22} />
              <stop offset="100%" stopColor="#4F46E5" stopOpacity={0.025} />
            </linearGradient></defs>
            <CartesianGrid stroke="#e5e6ef" strokeDasharray="4 4" vertical={false} />
            <XAxis dataKey="timestamp" tickFormatter={ticks} minTickGap={32} tickMargin={8} axisLine={false}
              tickLine={false} tick={{ fontSize: 11, fill: '#505467' }} />
            <YAxis allowDecimals={false} width={36} axisLine={false} tickLine={false}
              domain={[0, (max) => Math.max(max, 1)]} tick={{ fontSize: 11, fill: '#505467' }} />
            <Tooltip labelFormatter={tooltipLabel} cursor={{ stroke: '#aaa4ef' }} isAnimationActive={false} />
            <Area type="linear" dataKey="clicks" name="Recorded clicks" stroke="#4F46E5" strokeWidth={2}
              fill={`url(#${id}-fill)`} dot={activeBuckets <= 3 ? ({ cx, cy, payload }) =>
                payload.clicks > 0 && <circle key={payload.timestamp} cx={cx} cy={cy} r={4} fill="#4F46E5" stroke="#fff" strokeWidth={1.5} />
                : false} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <p className="workspace-chart-summary">{total.toLocaleString()} recorded {total === 1 ? 'click' : 'clicks'}
        {peak?.clicks > 0 && ` · Peak: ${peak.clicks.toLocaleString()} on ${timestampLabel(peak.timestamp)}`} · UTC</p>
      <details className="trend-data">
        <summary>View trend data as a table</summary>
        <table className="recent-links" aria-labelledby={`${id}-heading`}>
          <thead><tr><th scope="col">Time (UTC)</th><th scope="col">Clicks</th></tr></thead>
          <tbody>{trends.map((point) => <tr key={point.timestamp}>
            <td><time dateTime={point.timestamp}>{timestampLabel(point.timestamp)}</time></td><td>{point.clicks}</td>
          </tr>)}</tbody>
        </table>
      </details>
    </section>
  );
}
