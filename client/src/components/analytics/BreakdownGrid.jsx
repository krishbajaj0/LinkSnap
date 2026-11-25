const breakdownLabels = {
  device: 'Devices', browser: 'Browsers', os: 'Operating systems', country: 'Countries', referrer: 'Referrer domains',
};

export default function BreakdownGrid({ breakdowns, total }) {
  return (
    <div className="bento-breakdowns">
      {Object.entries(breakdownLabels).map(([key, title]) => (
        <section className="dashboard-panel workspace-card" key={key}>
          <h3>{title}</h3>
          {breakdowns[key].length === 0 ? <p className="workspace-panel-caption">No data in this period.</p> : (
            <ul className="bento-breakdown-list">
              {breakdowns[key].map(({ label, clicks }) => (
                <li key={label}>
                  <div><span>{label}</span><strong>{clicks.toLocaleString()}</strong></div>
                  <meter min="0" max={total} value={clicks} aria-label={`${label}: ${clicks} of ${total} recorded clicks`} />
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
