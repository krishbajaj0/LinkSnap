import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useAuth } from '../auth/useAuth.js';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import LinkFields from '../components/links/LinkFields.jsx';
import LinkTags from '../components/links/LinkTags.jsx';
import ShortLink from '../components/links/ShortLink.jsx';
import '../styles/links.css';

export default function LinkDetailsPage() {
  const { id } = useParams();
  const { authorizedApiRequest } = useAuth();
  const navigate = useNavigate();
  const [link, setLink] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [pending, setPending] = useState(false);
  const deleteDialog = useRef(null);
  const deleteTrigger = useRef(null);
  const [revision, setRevision] = useState(0);
  const path = `/links/${encodeURIComponent(id)}`;

  useEffect(() => {
    const request = new AbortController();
    authorizedApiRequest(path, { signal: request.signal }).then((data) => {
      if (!request.signal.aborted) setLink(data);
    }).catch((failure) => {
      if (!request.signal.aborted) setError(failure.status ? failure.message : 'Could not load this link.');
    });
    return () => request.abort();
  }, [authorizedApiRequest, path, revision]);

  async function update(fields, message = 'Link updated.') {
    setPending(true);
    setSuccess('');
    try {
      const updated = await authorizedApiRequest(path, { method: 'PATCH', body: fields });
      setLink(updated);
      setSuccess(message);
    } finally {
      setPending(false);
    }
  }

  async function run(action) {
    setError('');
    try {
      await action();
    } catch (failure) {
      setError(failure.status ? failure.message : 'Could not update this link. Try again.');
    }
  }

  async function remove() {
    setPending(true);
    setSuccess('');
    try {
      await authorizedApiRequest(path, { method: 'DELETE' });
      navigate('/dashboard/links', { replace: true });
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="links-page" aria-labelledby="details-title">
      <Link className="text-link" to="/dashboard/links">Back to My Links</Link>
      <h1 id="details-title">Link details</h1>
      {error && <p className="form-error" role="alert">{error}</p>}
      {success && !error && <p className="form-success" role="status">{success}</p>}
      {!link && !error && <p role="status">Loading link…</p>}
      {!link && error && (
        <button className="primary-btn" type="button" onClick={() => {
          setError('');
          setRevision((value) => value + 1);
        }}>Try again</button>
      )}
      {link && (
        <>
          <div className="dashboard-panel">
            <h2>{link.shortCode}</h2>
            <nav className="link-detail-nav" aria-label="Link tools">
              <Link className="text-link" to={`/dashboard/analytics/links/${link.id}`}>View link analytics</Link>
              <Link className="text-link" to="qr">Open QR Studio</Link>
              <Link className="text-link" to={`/preview/${link.shortCode}`}>Open destination preview</Link>
            </nav>
            <p>Status <strong className="link-state" data-status={link.status}>{link.status}</strong>
              {link.needsReview && <strong className="link-state" data-status="flagged">Flagged for review</strong>}</p>
            {link.status === 'security-blocked' && <p>Short URL and QR redirects are blocked.</p>}
            <p>Destination {link.destination}</p>
            <p>Expiration {link.expiresAt ? new Date(link.expiresAt).toLocaleString() : 'None'}</p>
            <ShortLink path={link.shortPath} />
            <div className="link-actions">
              <button className="primary-btn" type="button" disabled={pending || (!link.enabled && link.status === 'security-blocked')}
                onClick={() => void run(() => update({ enabled: !link.enabled }, link.enabled ? 'Link disabled.' : 'Link enabled.'))}>
                {link.enabled ? 'Disable link' : 'Enable link'}
              </button>
              <button ref={deleteTrigger} className="secondary-btn" type="button" disabled={pending}
                onClick={() => deleteDialog.current.showModal()}>Delete link</button>
            </div>
            <ConfirmDialog dialogRef={deleteDialog} title="Delete this link?"
              description="This will disable redirects permanently and keep the alias reserved."
              confirmLabel="Confirm deletion" danger onClose={() => deleteTrigger.current?.focus()}
              onConfirm={() => void run(remove)} />
          </div>
          <LinkTags tags={link.tags} pending={pending} onSave={async (tags) => {
            let saved = false;
            await run(async () => {
              await update({ tags }, 'Tags updated.');
              saved = true;
            });
            return saved;
          }} />
          <div className="dashboard-panel">
            <h2>Edit link</h2>
            <LinkFields key={`${link.id}:${link.destination}:${link.expiresAt}`} link={link} pending={pending} onSave={update} />
          </div>
        </>
      )}
    </section>
  );
}
