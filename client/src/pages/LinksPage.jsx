import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../auth/useAuth.js';
import LinkFields from '../components/links/LinkFields.jsx';
import LinkFilters from '../components/links/LinkFilters.jsx';
import BulkActions from '../components/links/BulkActions.jsx';
import ShortLink from '../components/links/ShortLink.jsx';
import '../styles/links.css';

const defaultFilters = {
  search: '', status: '', tag: '', createdFrom: '', createdTo: '', sort: 'newest', limit: '10',
};

export default function LinksPage() {
  const { authorizedApiRequest } = useAuth();
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState(defaultFilters);
  const [filterVersion, setFilterVersion] = useState(0);
  const [selected, setSelected] = useState([]);
  const [bulkPending, setBulkPending] = useState(false);
  const [bulkMessage, setBulkMessage] = useState('');
  const [bulkError, setBulkError] = useState('');
  const [revision, setRevision] = useState(0);
  const [list, setList] = useState(null);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState(null);
  const [formVersion, setFormVersion] = useState(0);

  useEffect(() => {
    const request = new AbortController();
    const query = new URLSearchParams({ ...filters, page });
    authorizedApiRequest(`/links?${query}`, { signal: request.signal }).then((data) => {
      if (!request.signal.aborted) setList(data);
    }).catch((failure) => {
      if (!request.signal.aborted) setError(failure.status ? failure.message : 'Could not load your links.');
    });
    return () => request.abort();
  }, [authorizedApiRequest, filters, page, revision]);

  function load(nextPage) {
    setList(null);
    setError('');
    setSelected([]);
    setPage(nextPage);
    setRevision((value) => value + 1);
  }

  function applyFilters(values, resetForm = false) {
    setFilters(values);
    if (resetForm) setFilterVersion((value) => value + 1);
    setBulkMessage('');
    setBulkError('');
    load(1);
  }

  async function applyBulk(action, tag) {
    setBulkPending(true);
    setBulkMessage('');
    setBulkError('');
    try {
      const { changed, skipped } = await authorizedApiRequest('/links/bulk', {
        method: 'POST', body: { action, ids: selected, ...(tag !== undefined && { tag }) },
      });
      setBulkMessage(`${changed} changed. ${skipped} skipped.`);
      load(page);
    } catch (failure) {
      setBulkError(failure.status ? failure.message : 'Could not complete the bulk action.');
    } finally {
      setBulkPending(false);
    }
  }

  async function create(fields) {
    setCreating(true);
    try {
      const link = await authorizedApiRequest('/links', { method: 'POST', body: fields });
      setCreated(link);
      setFormVersion((value) => value + 1);
      load(1);
    } finally {
      setCreating(false);
    }
  }

  return (
    <section className="links-page" aria-labelledby="links-title">
      <header className="workspace-heading">
        <div><h1 id="links-title">My Links</h1><p>Search, organize and manage your short links.</p></div>
        <Link className="primary-btn" to="#create-link">Create link</Link>
      </header>
      <div id="create-link" tabIndex={-1} className="dashboard-panel">
        <h2>Create a short link</h2>
        <LinkFields key={formVersion} pending={creating || bulkPending} onSave={create} />
        {created && (
          <div className="link-created">
            <p role="status">Short link created.</p>
            <ShortLink key={created.id} path={created.shortPath} />
          </div>
        )}
      </div>
      <div className="dashboard-panel link-results">
        <h2>Your links</h2>
        <LinkFilters key={filterVersion} filters={filters} defaults={defaultFilters} onApply={applyFilters} disabled={bulkPending} />
        {bulkMessage && <p className="bulk-result" role="status">{bulkMessage}</p>}
        {bulkError && <p className="form-error" role="alert">{bulkError}</p>}
        {error && (
          <>
            <p className="form-error" role="alert">{error}</p>
            <button className="primary-btn" type="button" onClick={() => load(page)}>Try again</button>
          </>
        )}
        {!list && !error && <p role="status">Loading links…</p>}
        {list && (
          <>
            {list.links.length === 0 && <p>{list.total ? 'No links on this page.' : list.hasLinks ? 'No links match these filters.' : 'No links yet. Create one above.'}</p>}
            {list.links.length > 0 && (
              <label className="link-checkbox">
                <input type="checkbox" disabled={bulkPending} checked={selected.length === list.links.length}
                  onChange={(event) => setSelected(event.target.checked ? list.links.map((link) => link.id) : [])} />
                Select all links on this page
              </label>
            )}
            {selected.length > 0 && <BulkActions count={selected.length} pending={bulkPending}
              onClear={() => setSelected([])} onApply={applyBulk} />}
            <ul className="link-list">
              {list.links.map((link) => (
                <li key={link.id}>
                  <div className="link-row-heading">
                    <input type="checkbox" aria-label={`Select ${link.shortCode}`} disabled={bulkPending} checked={selected.includes(link.id)}
                      onChange={(event) => setSelected(event.target.checked
                        ? [...selected, link.id] : selected.filter((id) => id !== link.id))} />
                    <Link className="text-link" to={link.id}>{link.shortCode}</Link>
                    <Link className="text-link" to={`${link.id}/qr`} aria-label={`QR Studio for ${link.shortCode}`}>QR Studio</Link>
                    <span className="link-state" data-status={link.status}>{link.status}</span>
                  </div>
                  <p>{link.destination}</p>
                  {link.tags.length > 0 && <ul className="tag-list" aria-label="Tags">
                    {link.tags.map((tag) => <li className="tag-pill" key={tag}>{tag}</li>)}
                  </ul>}
                  <ShortLink path={link.shortPath} />
                </li>
              ))}
            </ul>
            {(list.total > list.limit || page > 1) && (
              <nav className="link-actions" aria-label="Link pages">
                <button className="primary-btn" type="button" disabled={bulkPending || page === 1} onClick={() => load(page - 1)}>Previous</button>
                <span>Page {page}</span>
                <button className="primary-btn" type="button" disabled={bulkPending || page * list.limit >= list.total || page >= 1000} onClick={() => load(page + 1)}>Next</button>
              </nav>
            )}
          </>
        )}
      </div>
    </section>
  );
}
