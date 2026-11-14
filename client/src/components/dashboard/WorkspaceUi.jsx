import Icon from './Icon.jsx';

export function PageHeader({ id, title, description, children }) {
  return (
    <header className="workspace-heading stage-page-header">
      <div><h1 id={id}>{title}</h1>{description && <p>{description}</p>}</div>
      {children}
    </header>
  );
}

export function MetricCard({ label, value, hint, icon, featured }) {
  return (
    <div className="workspace-metric" data-featured={featured || undefined}>
      <dt>{icon && <span className="workspace-icon"><Icon name={icon} /></span>}{label}</dt>
      <dd>{typeof value === 'number' ? value.toLocaleString() : value}</dd>
      {hint && <dd className="workspace-metric-hint">{hint}</dd>}
    </div>
  );
}

export function StatusBadge({ status }) {
  const label = status[0].toUpperCase() + status.slice(1).replaceAll('-', ' ');
  return <span className="link-state workspace-status" data-status={status}>{label}</span>;
}

export function EmptyState({ icon = 'link', title, children }) {
  return (
    <div className="workspace-empty">
      <span className="workspace-icon"><Icon name={icon} /></span>
      <strong>{title}</strong>
      {children}
    </div>
  );
}

export function LoadingState({ children }) {
  return <p className="workspace-loading" role="status">{children}</p>;
}
