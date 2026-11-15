import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { useAuth } from '../auth/useAuth.js';
import QrStudio from '../components/links/QrStudio.jsx';
import '../styles/links.css';
import '../styles/qr.css';
import Icon from '../components/dashboard/Icon.jsx';
import { EmptyState, LoadingState, PageHeader, StatusBadge } from '../components/dashboard/WorkspaceUi.jsx';

export default function QrStudioPage() {
  const { id } = useParams();
  return id ? <OwnedQrStudio key={id} id={id} /> : <QrLinkPicker />;
}

function QrLinkPicker() {
  const { authorizedApiRequest } = useAuth();
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const request = new AbortController();
    authorizedApiRequest('/links?limit=10', { signal: request.signal }).then((data) => {
      if (!request.signal.aborted) setResult(data);
    }).catch((failure) => {
      if (!request.signal.aborted) setError(failure.status ? failure.message : 'Could not load your links. Try again.');
    });
    return () => request.abort();
  }, [authorizedApiRequest, attempt]);

  return (
    <section className="qr-page workspace-subpage bento-workspace" aria-labelledby="qr-heading">
      <PageHeader id="qr-heading" title="QR Studio" description="Choose a short link to customize and download its QR code.">
        <Link className="secondary-btn workspace-button" to="/dashboard/links">Browse My Links</Link>
      </PageHeader>
      <section className="dashboard-panel workspace-card" aria-labelledby="qr-picker-title">
        <h2 id="qr-picker-title">Recent short links</h2>
        {!result && !error && <LoadingState>Loading your links…</LoadingState>}
        {error && <div className="workspace-error">
          <p role="alert">{error}</p>
          <button className="secondary-btn" type="button" onClick={() => {
            setError('');
            setAttempt((value) => value + 1);
          }}>Try again</button>
        </div>}
        {result && (result.links.length === 0 ? (
          <EmptyState icon="qr" title="Create a link to get started">
            <Link className="text-link" to="/dashboard/links#create-link">Create a short link</Link>
          </EmptyState>
        ) : (
          <ul className="qr-link-list">
            {result.links.map((link) => <li key={link.id}>
              <Link to={`/dashboard/links/${link.id}/qr`}>
                <span className="workspace-icon"><Icon name="qr" /></span>
                <span className="qr-choice"><strong>{link.shortCode}</strong><small>{link.destination}</small></span>
                <StatusBadge status={link.status} />
                <Icon name="arrow" size={16} />
              </Link>
            </li>)}
          </ul>
        ))}
      </section>
    </section>
  );
}

function OwnedQrStudio({ id }) {
  const { authorizedApiRequest } = useAuth();
  const [link, setLink] = useState(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const request = new AbortController();
    authorizedApiRequest(`/links/${encodeURIComponent(id)}`, { signal: request.signal }).then((result) => {
      if (!request.signal.aborted) setLink(result);
    }).catch((failure) => {
      if (!request.signal.aborted) setError(failure.status ? failure.message : 'Could not load the link. Try again.');
    });
    return () => request.abort();
  }, [authorizedApiRequest, id, attempt]);

  return (
    <section className="qr-page workspace-subpage bento-workspace" aria-labelledby="qr-heading">
      <Link className="text-link workspace-back" to={link ? `/dashboard/links/${link.id}` : '/dashboard/links'}>
        {link ? 'Back to link details' : 'Back to My Links'}
      </Link>
      <PageHeader id="qr-heading" title="QR Studio" description="Customize a scannable QR code for your short link." />
      {!link && !error && <LoadingState>Loading link…</LoadingState>}
      {error && <>
        <p className="form-error" role="alert">{error}</p>
        <button type="button" className="primary-btn" onClick={() => {
          setError('');
          setAttempt((value) => value + 1);
        }}>Try again</button>
      </>}
      {link && <QrStudio link={link} />}
    </section>
  );
}
