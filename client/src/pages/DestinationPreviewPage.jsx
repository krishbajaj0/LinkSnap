import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { apiRequest } from '../services/auth.js';
import Icon from '../components/dashboard/Icon.jsx';
import '../styles/moderation.css';

export default function DestinationPreviewPage() {
  const { code } = useParams();
  return <Preview key={code} code={code} />;
}

function Preview({ code }) {
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [unavailable, setUnavailable] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    apiRequest('/preview/' + encodeURIComponent(code), { signal: controller.signal }).then((result) => {
      if (!controller.signal.aborted) setPreview(result);
    }).catch((failure) => {
      if (controller.signal.aborted) return;
      if (failure.status === 404) setUnavailable(true);
      else setError('Could not load the destination preview.');
    });
    return () => controller.abort();
  }, [code, attempt]);

  return (
    <section className="public-panel safety-card" aria-labelledby="preview-heading">
      <span className="safety-icon"><Icon name={unavailable ? 'alert' : 'external'} size={23} /></span>
      <h1 id="preview-heading">Destination preview</h1>
      {!preview && !error && !unavailable && <p role="status">Checking this short link…</p>}
      {unavailable && <div className="safety-warning" role="status">
        <Icon name="alert" /><div><strong>This short link is unavailable.</strong><p>It may be inactive, expired, or blocked.</p></div>
      </div>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {error && <button className="secondary-btn" type="button" onClick={() => {
        setError('');
        setAttempt((value) => value + 1);
      }}>Retry preview</button>}
      {preview && <>
        <p>You’re about to leave LinkSnap for an external website.</p>
        <dl><div><dt>Destination hostname</dt><dd className="safety-host">{preview.hostname}</dd></div>
          <div><dt>Protocol</dt><dd>{preview.protocol === 'https:' ? 'HTTPS' : 'HTTP'}</dd></div></dl>
        {preview.needsReview && <div className="safety-warning" role="status">
          <Icon name="alert" /><p>This address has patterns that warrant extra caution.</p>
        </div>}
        <p>A destination preview cannot verify the safety of an external site or its onward redirects.</p>
        <a className="primary-btn public-button" href={preview.continuePath} rel="noreferrer" referrerPolicy="no-referrer">
          Continue to destination <Icon name="arrow" />
        </a>
      </>}
      <Link className="text-link" to={`/report/${encodeURIComponent(code)}`}>Report this short link</Link>
    </section>
  );
}
