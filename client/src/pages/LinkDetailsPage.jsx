import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useAuth } from '../auth/useAuth.js';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import LinkFields from '../components/links/LinkFields.jsx';
import LinkTags from '../components/links/LinkTags.jsx';
import ShortLink from '../components/links/ShortLink.jsx';
import Icon from '../components/dashboard/Icon.jsx';
import { CardHeading, LoadingState, PageHeader, StatusBadge } from '../components/dashboard/WorkspaceUi.jsx';
import '../styles/links.css';
import '../styles/link-details.css';

export default function LinkDetailsPage() {
  const { id } = useParams();
  return <OwnedLinkDetails key={id} id={id} />;
}

function OwnedLinkDetails({ id }) {
  const { authorizedApiRequest } = useAuth();
  const navigate = useNavigate();
  const [link, setLink] = useState(null);
  const [analytics, setAnalytics] = useState({ status: 'loading' });
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

  useEffect(() => {
    const request = new AbortController();
    authorizedApiRequest(`/analytics/links/${encodeURIComponent(id)}`, { signal: request.signal })
      .then((report) => { if (!request.signal.aborted) setAnalytics({ status: 'ready', report }); })
      .catch(() => { if (!request.signal.aborted) setAnalytics({ status: 'unavailable' }); });
    return () => request.abort();
  }, [authorizedApiRequest, id]);

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
    <section className="links-page link-details-page workspace-subpage" aria-labelledby="details-title">
      <Link className="text-link workspace-back" to="/dashboard/links">Back to My Links</Link>
      <PageHeader id="details-title" title="Link details" description="Manage the destination, status, and sharing options.">
        {link && <Link className="primary-btn workspace-button" to="qr"><Icon name="qr" />Open QR Studio</Link>}
      </PageHeader>
      {error && <p className="form-error" role="alert">{error}</p>}
      {success && !error && <p className="form-success" role="status">{success}</p>}
      {!link && !error && <LoadingState>Loading link…</LoadingState>}
      {!link && error && (
        <button className="secondary-btn" type="button" onClick={() => {
          setError('');
          setRevision((value) => value + 1);
        }}>Try again</button>
      )}
      {link && (
        <>
          <section className="dashboard-panel workspace-card link-detail-summary" aria-labelledby="link-summary-title">
            <div className="link-detail-summary-heading">
              <CardHeading id="link-summary-title" title={link.shortCode} icon="link" />
              <div className="link-detail-badges">
                <StatusBadge status={link.status} />
                {link.needsReview && <StatusBadge status="flagged" />}
              </div>
            </div>
            {link.status === 'security-blocked' && <p className="form-error">Short URL and QR redirects are blocked.</p>}
            <dl className="link-detail-meta">
              <div><dt>Destination</dt><dd>{link.destination}</dd></div>
              <div><dt>Expiration</dt><dd>{link.expiresAt ? new Date(link.expiresAt).toLocaleString() : 'No expiration'}</dd></div>
            </dl>
            <ShortLink path={link.shortPath} />
            <div className="link-actions">
              <Link className="text-link" to={`/preview/${link.shortCode}`}>Open destination preview</Link>
              <button className="secondary-btn" type="button" disabled={pending || (!link.enabled && link.status === 'security-blocked')}
                onClick={() => void run(() => update({ enabled: !link.enabled }, link.enabled ? 'Link disabled.' : 'Link enabled.'))}>
                {link.enabled ? 'Disable link' : 'Enable link'}
              </button>
              <button ref={deleteTrigger} className="secondary-btn link-detail-delete" type="button" disabled={pending}
                onClick={() => deleteDialog.current.showModal()}>Delete link</button>
            </div>
            <ConfirmDialog dialogRef={deleteDialog} title="Delete this link?"
              description="This will disable redirects permanently and keep the alias reserved."
              confirmLabel="Confirm deletion" danger onClose={() => deleteTrigger.current?.focus()}
              onConfirm={() => void run(remove)} />
          </section>
          <div className="link-detail-grid">
            <section className="dashboard-panel workspace-card" aria-labelledby="link-edit-title">
              <CardHeading id="link-edit-title" title="Edit destination" icon="settings">The short code stays the same when you edit this link.</CardHeading>
              <LinkFields key={`${link.id}:${link.destination}:${link.expiresAt}`} link={link} pending={pending} onSave={update} />
            </section>
            <div className="link-detail-side">
              <section className="dashboard-panel workspace-card" aria-labelledby="link-analytics-title">
                <CardHeading id="link-analytics-title" title="Click analytics" icon="chart" />
                {analytics.status === 'loading' && <LoadingState>Loading analytics…</LoadingState>}
                {analytics.status === 'unavailable' && <p role="status">Analytics summary unavailable.</p>}
                {analytics.status === 'ready' && <dl className="link-detail-meta link-detail-counts">
                  <div><dt>Recorded clicks · last 30 days</dt><dd>{analytics.report.counts.total.toLocaleString()}</dd></div>
                  <div><dt>Lifetime recorded clicks</dt><dd>{analytics.report.lifetime.total.toLocaleString()}</dd></div>
                </dl>}
                <Link className="text-link workspace-back" to={`/dashboard/analytics/links/${link.id}`}>View link analytics</Link>
              </section>
              <LinkTags tags={link.tags} pending={pending} onSave={async (tags) => {
                let saved = false;
                await run(async () => {
                  await update({ tags }, 'Tags updated.');
                  saved = true;
                });
                return saved;
              }} />
            </div>
          </div>
        </>
      )}
    </section>
  );
}
