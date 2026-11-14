import { useEffect, useState } from 'react';
import { useAuth } from '../auth/useAuth.js';
import ModerationDetail from '../components/ModerationDetail.jsx';
import '../styles/moderation.css';

export default function ModerationPage() {
  const { user } = useAuth();
  if (user.role !== 'admin') return <section><h1>Access denied</h1><p>Moderator access is required.</p></section>;
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
    }).then(setItems).catch((failure) => {
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
    <section className="moderation-page" aria-labelledby="moderation-heading">
      <h1 id="moderation-heading">Moderation</h1>
      <section className="dashboard-panel">
        <h2>Moderation queue</h2>
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
        {!items && !error && <p role="status">Loading queue…</p>}
        {error && <><p role="alert">{error}</p><button type="button" className="secondary-btn" onClick={() => {
          resetResults();
          setRevision((value) => value + 1);
        }}>Retry queue</button></>}
        {items && <>
          {!items.items.length && <p>No matching items.</p>}
          <ul className="moderation-items">
            {items.items.map((item) => <li key={item._id ?? item.id}>
              <button type="button" className="secondary-btn" onClick={() => setSelected(item._id ?? item.id)}>
                {reportQueue ? `${item.reason} · ${item.status} · ${item._id.slice(-6)}` : item.shortCode}
              </button>
            </li>)}
          </ul>
          {(page > 1 || page * items.limit < items.total) && <nav className="link-actions" aria-label="Queue pages">
            <button type="button" className="secondary-btn" disabled={page === 1} onClick={() => changePage(page - 1)}>Previous</button>
            <span>Page {page}</span>
            <button type="button" className="secondary-btn" disabled={page >= 1000 || page * items.limit >= items.total}
              onClick={() => changePage(page + 1)}>Next</button>
          </nav>}
        </>}
      </section>
      {selected && <ModerationDetail key={kind + selected} kind={kind} id={selected} onChange={() => {
        resetResults();
        setRevision((value) => value + 1);
      }} />}
    </section>
  );
}
