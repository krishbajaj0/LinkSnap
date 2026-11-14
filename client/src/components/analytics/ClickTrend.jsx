import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

function formatBucket(timestamp, interval) {
  const iso = new Date(timestamp).toISOString();
  return interval === 'hour' ? iso.slice(5, 16).replace('T', ' ') : iso.slice(0, 10);
}

export default function ClickTrend({ trends, interval }) {
  const format = (value) => formatBucket(value, interval);
  return (
    <section className="dashboard-panel" aria-labelledby="click-trend-heading">
      <h2 id="click-trend-heading">Clicks by {interval} (UTC)</h2>
      <div className="analytics-chart">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <LineChart data={trends} accessibilityLayer margin={{ top: 12, right: 14, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="4 4" vertical={false} />
            <XAxis dataKey="timestamp" tickFormatter={format} minTickGap={36} tick={{ fontSize: 11 }} />
            <YAxis allowDecimals={false} width={38} tick={{ fontSize: 11 }} />
            <Tooltip labelFormatter={format} />
            <Line type="linear" dataKey="clicks" name="Clicks" stroke="#4F46E5" strokeWidth={3}
              dot={trends.length === 1} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <details className="trend-data">
        <summary>View trend data as a table</summary>
        <table className="recent-links" aria-labelledby="click-trend-heading">
          <thead><tr><th scope="col">Time (UTC)</th><th scope="col">Clicks</th></tr></thead>
          <tbody>{trends.map((point) => <tr key={point.timestamp}>
            <td><time dateTime={point.timestamp}>{format(point.timestamp)}</time></td><td>{point.clicks}</td>
          </tr>)}</tbody>
        </table>
      </details>
    </section>
  );
}
