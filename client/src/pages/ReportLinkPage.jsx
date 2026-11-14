import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { apiRequest } from '../services/auth.js';
import '../styles/moderation.css';

const reasons = [
  ['phishing', 'Phishing'], ['malware', 'Malware'], ['spam', 'Spam'],
  ['impersonation', 'Impersonation'], ['other', 'Other'],
];

export default function ReportLinkPage() {
  const { code } = useParams();
  return <ReportForm key={code} code={code} />;
}

function ReportForm({ code }) {
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState('');
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    if (pending || sent) return;
    const body = Object.fromEntries(new FormData(event.currentTarget));
    body.shortCode = body.shortCode.trim();
    setPending(true);
    setError('');
    try {
      const result = await apiRequest('/reports', { method: 'POST', body });
      setSent(result.message);
    } catch (failure) {
      setError(failure.status ? failure.message : 'Could not send the report. Try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="public-panel safety-card" aria-labelledby="report-heading">
      <h1 id="report-heading">Report a short link</h1>
      <p>Share what looks suspicious. Please leave out passwords and personal details.</p>
      {sent ? <p className="form-success" role="status">{sent}</p> : (
        <form className="moderation-form" onSubmit={submit} aria-busy={pending}>
          {error && <p className="form-error" role="alert">{error}</p>}
          <fieldset disabled={pending}>
            <label>Short code (required)<input name="shortCode" required minLength={4} maxLength={32}
              defaultValue={code} autoCapitalize="none" spellCheck={false} /></label>
            <label>Reason (required)<select name="reason" required defaultValue="">
              <option value="" disabled>Choose a reason</option>
              {reasons.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select></label>
            <label>Description (optional)<textarea name="description" maxLength={500} rows={4} /></label>
            <div hidden><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
            <button className="primary-btn" type="submit">{pending ? 'Sending…' : 'Submit report'}</button>
          </fieldset>
        </form>
      )}
      {code && <Link className="text-link" to={`/preview/${encodeURIComponent(code)}`}>Back to destination preview</Link>}
    </section>
  );
}
