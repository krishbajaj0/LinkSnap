import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../auth/useAuth.js';
import LinkFields from '../components/links/LinkFields.jsx';
import ShortLink from '../components/links/ShortLink.jsx';
import '../styles/links.css';

export default function LinksPage() {
  const { authorizedApiRequest } = useAuth();
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [list, setList] = useState(null);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState(null);
  const [formVersion, setFormVersion] = useState(0);

  useEffect(() => {
    const request = new AbortController();
    authorizedApiRequest(`/links?page=${page}`, { signal: request.signal }).then((data) => {
      if (!request.signal.aborted) setList(data);
    }).catch((failure) => {
      if (!request.signal.aborted) setError(failure.status ? failure.message : 'Could not load your links.');
    });
    return () => request.abort();
  }, [authorizedApiRequest, page, revision]);

  function load(nextPage) {
    setList(null);
    setError('');
    setPage(nextPage);
    setRevision((value) => value + 1);
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
      <h1 id="links-title">My Links</h1>
      <div className="dashboard-panel">
        <h2>Create a short link</h2>
        <LinkFields key={formVersion} pending={creating} onSave={create} />
        {created && (
          <div className="link-created">
            <p role="status">Short link created.</p>
            <ShortLink key={created.id} path={created.shortPath} />
          </div>
        )}
      </div>
      <div className="dashboard-panel">
        <h2>Your links</h2>
        {error && (
          <>
            <p className="form-error" role="alert">{error}</p>
            <button className="primary-btn" type="button" onClick={() => load(page)}>Try again</button>
          </>
        )}
        {!list && !error && <p role="status">Loading links…</p>}
        {list && (
          <>
            {list.links.length === 0 && <p>{list.total ? 'No links on this page.' : 'No links yet. Create one above.'}</p>}
            <ul className="link-list">
              {list.links.map((link) => (
                <li key={link.id}>
                  <Link className="text-link" to={link.id}>{link.shortCode}</Link>
                  <span className="link-state">{link.status}</span>
                  <p>{link.destination}</p>
                </li>
              ))}
            </ul>
            {(list.total > list.limit || page > 1) && (
              <nav className="link-actions" aria-label="Link pages">
                <button className="primary-btn" type="button" disabled={page === 1} onClick={() => load(page - 1)}>Previous</button>
                <span>Page {page}</span>
                <button className="primary-btn" type="button" disabled={page * list.limit >= list.total || page >= 1000} onClick={() => load(page + 1)}>Next</button>
              </nav>
            )}
          </>
        )}
      </div>
    </section>
  );
}
