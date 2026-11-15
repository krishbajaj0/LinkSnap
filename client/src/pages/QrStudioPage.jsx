import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { useAuth } from '../auth/useAuth.js';
import QrStudio from '../components/links/QrStudio.jsx';
import '../styles/links.css';
import '../styles/qr.css';
import { LoadingState, PageHeader } from '../components/dashboard/WorkspaceUi.jsx';

export default function QrStudioPage() {
  const { id } = useParams();
  return <OwnedQrStudio key={id} id={id} />;
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
    <section className="qr-page workspace-subpage" aria-labelledby="qr-heading">
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
