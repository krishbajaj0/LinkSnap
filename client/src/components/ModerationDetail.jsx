import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/useAuth.js';

export default function ModerationDetail({ kind, id, onChange }) {
  const { authorizedApiRequest } = useAuth();
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [note, setNote] = useState('');
  const [pending, setPending] = useState(false);
  const [decision, setDecision] = useState('');
  const [revision, setRevision] = useState(0);
  const dialog = useRef(null);
  const heading = useRef(null);

  useEffect(() => {
    heading.current.focus();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    authorizedApiRequest(`/admin/${kind}/${id}`, { signal: controller.signal }).then(setDetail).catch((failure) => {
      if (!controller.signal.aborted) setError(failure.status ? failure.message : 'Could not load moderation details.');
    });
    return () => controller.abort();
  }, [authorizedApiRequest, id, kind, revision]);

  const report = kind === 'reports' ? detail?.report : null;
  const link = kind === 'reports' ? detail?.link : detail;

  function confirm(action) {
    setDecision(action);
    dialog.current.showModal();
  }

  async function apply() {
    dialog.current.close();
    setPending(true);
    setError('');
    setNotice('');
    const isLinkDecision = kind === 'links' || ['block', 'unblock'].includes(decision);
    const path = isLinkDecision ? `/admin/links/${link.id}` : `/admin/reports/${id}`;
    try {
      await authorizedApiRequest(path, { method: 'PATCH', body: {
        action: decision, note, ...(isLinkDecision && report && { reportId: report._id }),
        ...(isLinkDecision && decision === 'review' && { updatedAt: link.updatedAt }),
      } });
      setNotice('Decision saved.');
      setNote('');
      setRevision((value) => value + 1);
      onChange();
    } catch (failure) {
      setError(failure.status ? failure.message : 'Could not save the decision.');
    } finally {
      setPending(false);
      heading.current?.focus();
    }
  }

  return (
    <section className="dashboard-panel" aria-labelledby="moderation-detail-heading">
      <h2 id="moderation-detail-heading" ref={heading} tabIndex={-1}>Moderation details</h2>
      {!detail && !error && <p role="status">Loading details…</p>}
      {notice && <p role="status">{notice}</p>}
      {error && <p role="alert" className="form-error">{error}</p>}
      {report && <dl>
        <dt>Reason</dt><dd>{report.reason}</dd><dt>Status</dt><dd>{report.status}</dd>
        <dt>Description</dt><dd>{report.description || 'None'}</dd>
        {report.notes && <><dt>Last moderator note</dt><dd>{report.notes}</dd></>}
      </dl>}
      {link && <dl>
        <dt>Short code</dt><dd>{link.shortCode}</dd><dt>Destination (query and fragment omitted)</dt><dd>{link.destination ?? 'Invalid destination'}</dd>
        <dt>URL assessment</dt><dd>{link.safety.classification}</dd>
        <dt>Risk flags</dt><dd>{link.safety.flags.join(', ') || 'None'}</dd>
        <dt>Moderation block</dt><dd>{link.blocked ? 'Blocked' : 'No moderation block'}</dd>
      </dl>}
      {detail && <div className="moderation-form">
        <label>Moderator note (optional)<textarea maxLength={500} rows={3} value={note} disabled={pending}
          onChange={(event) => setNote(event.target.value)} /></label>
        <div className="link-actions">
          {report?.status === 'pending' && <button type="button" className="secondary-btn" disabled={pending} onClick={() => confirm('review')}>Review</button>}
          {!report && link && !link.deleted && !link.reviewedAt && !link.blocked && link.safety.flags.length > 0
            && <button type="button" className="secondary-btn" disabled={pending} onClick={() => confirm('review')}>Mark link reviewed</button>}
          {report && ['pending', 'reviewed'].includes(report.status) && <>
            <button type="button" className="secondary-btn" disabled={pending} onClick={() => confirm('dismiss')}>Dismiss</button>
            <button type="button" className="secondary-btn" disabled={pending} onClick={() => confirm('actioned')}>Mark actioned</button>
          </>}
          {link && !link.deleted && <button type="button" className="primary-btn" disabled={pending}
            onClick={() => confirm(link.blocked ? 'unblock' : 'block')}>{link.blocked ? 'Unblock link' : 'Block link'}</button>}
        </div>
      </div>}
      {(report?.moderationHistory ?? link?.history)?.length > 0 && <details>
        <summary>Moderation history</summary>
        <ul>{(report?.moderationHistory ?? link.history).map((entry) => <li key={entry.timestamp + entry.action}>
          {entry.action} · {new Date(entry.timestamp).toLocaleString()} · {entry.moderatorId}
          {entry.note && <p>{entry.note}</p>}
        </li>)}</ul>
      </details>}
      <dialog ref={dialog} className="delete-dialog" aria-labelledby="moderation-confirm">
        <h2 id="moderation-confirm">Confirm {decision}</h2>
        <p>This decision will be recorded in the moderation history.</p>
        <div className="link-actions">
          <button type="button" className="secondary-btn" autoFocus onClick={() => dialog.current.close()}>Cancel</button>
          <button type="button" className="primary-btn" onClick={() => void apply()}>Confirm decision</button>
        </div>
      </dialog>
    </section>
  );
}
