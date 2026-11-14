import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { apiRequest } from '../services/auth.js';
import '../styles/moderation.css';

export default function DestinationPreviewPage() {
  const { code } = useParams();
  return <Preview key={code} code={code} />;
}

function Preview({ code }) {
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    apiRequest('/preview/' + encodeURIComponent(code), { signal: controller.signal }).then(setPreview).catch((failure) => {
      if (!controller.signal.aborted) setError(failure.status === 404
        ? 'This short link is unavailable.' : 'Could not load the destination preview.');
    });
    return () => controller.abort();
  }, [code, attempt]);

  return (
    <section className="public-panel safety-card" aria-labelledby="preview-heading">
      <h1 id="preview-heading">Destination preview</h1>
      {!preview && !error && <p role="status">Checking this short link…</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {error && error !== 'This short link is unavailable.' && <button className="secondary-btn" type="button" onClick={() => {
        setError('');
        setAttempt((value) => value + 1);
      }}>Retry preview</button>}
      {preview && <>
        <p>You’re about to leave LinkSnap for an external website.</p>
        <dl><dt>Destination hostname</dt><dd className="safety-host">{preview.hostname}</dd>
          <dt>Protocol</dt><dd>{preview.protocol === 'https:' ? 'HTTPS' : 'HTTP'}</dd></dl>
        {preview.needsReview && <p className="safety-warning" role="status">This address has patterns that warrant extra caution.</p>}
        <p>LinkSnap checks address patterns. The destination and any onward redirects can still be unsafe.</p>
        <a className="primary-btn" href={preview.continuePath} rel="noreferrer" referrerPolicy="no-referrer">Continue to destination</a>
      </>}
      <Link className="text-link" to={`/report/${encodeURIComponent(code)}`}>Report this short link</Link>
    </section>
  );
}
