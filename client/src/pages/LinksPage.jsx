import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../auth/useAuth.js';
import LinkFields from '../components/links/LinkFields.jsx';
import LinkFilters from '../components/links/LinkFilters.jsx';
import BulkActions from '../components/links/BulkActions.jsx';
import ShortLink from '../components/links/ShortLink.jsx';
import LinksTable from '../components/links/LinksTable.jsx';
import Icon from '../components/dashboard/Icon.jsx';
import { EmptyState, LoadingState, PageHeader } from '../components/dashboard/WorkspaceUi.jsx';
import { publicShortUrl } from '../services/shortUrl.js';
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
  const [copyStatus, setCopyStatus] = useState('');
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

  async function copy(path) {
    setCopyStatus('');
    try {
      await navigator.clipboard.writeText(publicShortUrl(path));
      setCopyStatus('Short URL copied.');
    } catch {
      setCopyStatus('Clipboard unavailable. Open the short URL or copy it from Link details.');
    }
  }

  async function applyBulk(action, tag) {
    if (bulkPending) return;
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
    if (creating) return;
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
    <section className="links-page workspace-links" aria-labelledby="links-title">
      <PageHeader id="links-title" title="My Links" description="Create, organize, and manage your short links.">
        <Link className="primary-btn workspace-button" to="#create-link"><Icon name="plus" /> Create link</Link>
      </PageHeader>
      <section className="dashboard-panel workspace-card link-results" aria-labelledby="links-table-title">
        <div className="workspace-table-heading">
          <h2 id="links-table-title">Your links</h2>
          {list && <p>{list.total.toLocaleString()} {list.total === 1 ? 'result' : 'results'}</p>}
        </div>
        <LinkFilters key={filterVersion} filters={filters} defaults={defaultFilters} onApply={applyFilters} disabled={bulkPending} />
        {bulkMessage && <p className="bulk-result" role="status">{bulkMessage}</p>}
        {copyStatus && <p className="bulk-result" role="status">{copyStatus}</p>}
        {bulkError && <p className="form-error" role="alert">{bulkError}</p>}
        {error && <div className="workspace-error">
          <p role="alert">{error}</p>
          <button className="secondary-btn" type="button" onClick={() => load(page)}>Try again</button>
        </div>}
        {!list && !error && <LoadingState>Loading links…</LoadingState>}
        {list && (
          <>
            {list.links.length === 0 && (
              <EmptyState title={list.total ? 'No links on this page' : list.hasLinks ? 'No matching links' : 'No short links yet'}>
                {list.hasLinks && !list.total ? <p>Change your search or filters to see more links.</p> :
                  !list.total && <Link className="text-link" to="#create-link">Create your first link</Link>}
              </EmptyState>
            )}
            {selected.length > 0 && <BulkActions count={selected.length} pending={bulkPending}
              onClear={() => setSelected([])} onApply={applyBulk} />}
            {list.links.length > 0 && <LinksTable rows={list.links} selected={selected} disabled={bulkPending}
              onSelect={(id, checked) => setSelected((current) => checked ? [...current, id] : current.filter((item) => item !== id))}
              onSelectAll={(checked) => setSelected(checked ? list.links.map((link) => link.id) : [])} onCopy={copy} />}
            {(list.total > list.limit || page > 1) && (
              <nav className="workspace-pagination" aria-label="Link pages">
                <span>Page {page} of {Math.max(page, Math.min(1000, Math.ceil(list.total / list.limit)))}</span>
                <div>
                  <button className="secondary-btn" type="button" disabled={bulkPending || page === 1} onClick={() => load(page - 1)}>Previous</button>
                  <button className="secondary-btn" type="button" disabled={bulkPending || page * list.limit >= list.total || page >= 1000}
                    onClick={() => load(page + 1)}>Next</button>
                </div>
              </nav>
            )}
          </>
        )}
      </section>
      <section id="create-link" tabIndex={-1} className="dashboard-panel workspace-card workspace-create" aria-labelledby="create-link-title">
        <h2 id="create-link-title">Create a short link</h2>
        <p>Add a destination and choose an alias or expiration if you need one.</p>
        <LinkFields key={formVersion} pending={creating || bulkPending} onSave={create} />
        {created && <div className="link-created">
          <p className="form-success" role="status">Short link created.</p>
          <ShortLink key={created.id} path={created.shortPath} />
        </div>}
      </section>
    </section>
  );
}
