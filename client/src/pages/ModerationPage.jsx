import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../auth/useAuth.js';
import ModerationDetail from '../components/ModerationDetail.jsx';
import Icon from '../components/dashboard/Icon.jsx';
import { CardHeading, EmptyState, LoadingState, PageHeader, StatusBadge } from '../components/dashboard/WorkspaceUi.jsx';
import '../styles/moderation.css';

export default function ModerationPage() {
  const { user } = useAuth();
  if (user.role !== 'admin') return (
    <section className="dashboard-panel workspace-card">
      <h1>Access denied</h1>
      <p>Moderator access is required.</p>
      <Link className="text-link" to="/dashboard">Back to overview</Link>
    </section>
  );
  return <ModerationQueue />;
}

function ModerationQueue() {
  const { authorizedApiRequest } = useAuth();
  const [kind, setKind] = useState('reports');
  const [filter, setFilter] = useState('pending');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [revision, setRevision] = useState(0);
  const reportQueue = kind === 'reports';

  useEffect(() => {
    const controller = new AbortController();
    authorizedApiRequest(`/admin/${kind}?${reportQueue ? 'status' : 'state'}=${filter}&page=${page}`, {
      signal: controller.signal,
    }).then((result) => {
      if (!controller.signal.aborted) setItems(result);
    }).catch((failure) => {
      if (!controller.signal.aborted) setError(failure.status ? failure.message : 'Could not load moderation queue.');
    });
    return () => controller.abort();
  }, [authorizedApiRequest, filter, kind, page, reportQueue, revision]);

  function resetResults() {
    setItems(null);
    setError('');
  }

  function changePage(value) {
    resetResults();
    setSelected(null);
    setPage(value);
  }

  return (
    <section className="moderation-page workspace-subpage" aria-labelledby="moderation-heading">
      <PageHeader id="moderation-heading" title="Moderation" description="Review abuse reports and flagged links." />
      <div className="moderation-workbench">
        <section className="dashboard-panel workspace-card moderation-queue">
          <CardHeading title="Moderation queue" icon="shield" />
          <div className="moderation-filters moderation-form">
            <label>Queue<select value={kind} onChange={(event) => {
              const value = event.target.value;
              setKind(value);
              setFilter(value === 'reports' ? 'pending' : 'flagged');
              changePage(1);
            }}>
              <option value="reports">Abuse reports</option><option value="links">Flagged and blocked links</option>
            </select></label>
            <label>Filter<select value={filter} onChange={(event) => {
              setFilter(event.target.value);
              changePage(1);
            }}>
              {(reportQueue ? ['pending', 'reviewed', 'dismissed', 'actioned', 'all'] : ['flagged', 'blocked'])
                .map((value) => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}
            </select></label>
          </div>
          {!items && !error && <LoadingState>Loading queue…</LoadingState>}
          {error && <><p role="alert">{error}</p><button type="button" className="secondary-btn" onClick={() => {
            resetResults();
            setRevision((value) => value + 1);
          }}>Retry queue</button></>}
          {items && <>
            {!items.items.length && <EmptyState icon="shield" title={reportQueue ? 'No reports match this filter' : 'No links match this filter'} />}
            <ul className="moderation-items">
              {items.items.map((item) => {
                const id = item._id ?? item.id;
                return <li key={id}>
                  <button type="button" className="moderation-item" aria-pressed={selected === id} onClick={() => setSelected(id)}>
                    <span><strong>{reportQueue ? item.reason : item.shortCode}</strong>
                      {reportQueue && <small>Report {id.slice(-6)}</small>}</span>
                    <StatusBadge status={reportQueue ? item.status : item.blocked ? 'security-blocked' : 'flagged'} />
                    <Icon name="arrow" size={16} />
                  </button>
                </li>;
              })}
            </ul>
            {(page > 1 || page * items.limit < items.total) && <nav className="link-actions" aria-label="Queue pages">
              <button type="button" className="secondary-btn" disabled={page === 1} onClick={() => changePage(page - 1)}>Previous</button>
              <span>Page {page}</span>
              <button type="button" className="secondary-btn" disabled={page >= 1000 || page * items.limit >= items.total}
                onClick={() => changePage(page + 1)}>Next</button>
            </nav>}
          </>}
        </section>
        {selected ? <ModerationDetail key={kind + selected} kind={kind} id={selected} onChange={() => {
          resetResults();
          setRevision((value) => value + 1);
        }} /> : <section className="dashboard-panel workspace-card moderation-selection">
          <EmptyState icon="shield" title="Select a queue item"><p>Open a report or link to review details and take action.</p></EmptyState>
        </section>}
      </div>
    </section>
  );
}
