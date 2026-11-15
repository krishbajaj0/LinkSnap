import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/useAuth.js';
import ConfirmDialog from './ConfirmDialog.jsx';
import { LoadingState, StatusBadge } from './dashboard/WorkspaceUi.jsx';

const decisions = {
  review: ['Mark as reviewed?', 'The item will be recorded as reviewed.', 'Mark reviewed'],
  dismiss: ['Dismiss this report?', 'The report will leave the pending queue. The link’s redirect status stays the same.', 'Dismiss report'],
  actioned: ['Mark report as actioned?', 'The report will record that moderation action was taken.', 'Mark actioned'],
  block: ['Block this link?', 'The short URL and its QR code will stop redirecting to the destination.', 'Block link'],
  unblock: ['Unblock this link?', 'Redirects can resume if the link is active and passes the current URL restrictions.', 'Unblock link'],
};

function ModerationHistory({ title, entries }) {
  if (!entries?.length) return null;
  return (
    <details className="moderation-history">
      <summary>{title}</summary>
      <ul>{entries.map((entry) => <li key={entry.timestamp + entry.action}>
        <strong>{entry.action}</strong> <time dateTime={entry.timestamp}>{new Date(entry.timestamp).toLocaleString()}</time>
        <small>Moderator {entry.moderatorId}</small>
        {entry.note && <p>{entry.note}</p>}
      </li>)}</ul>
    </details>
  );
}

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
    authorizedApiRequest(`/admin/${kind}/${id}`, { signal: controller.signal }).then((result) => {
      if (!controller.signal.aborted) setDetail(result);
    }).catch((failure) => {
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
    if (pending) return;
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
    <section className="dashboard-panel workspace-card moderation-detail" aria-labelledby="moderation-detail-heading">
      <h2 id="moderation-detail-heading" ref={heading} tabIndex={-1}>Moderation details</h2>
      {!detail && !error && <LoadingState>Loading details…</LoadingState>}
      {notice && <p className="form-success" role="status">{notice}</p>}
      {error && <p role="alert" className="form-error">{error}</p>}
      {!detail && error && <button className="secondary-btn" type="button" onClick={() => {
        setError('');
        setRevision((value) => value + 1);
      }}>Retry details</button>}
      {report && <div className="moderation-record">
        <h3>Abuse report</h3>
        <dl>
        <dt>Reason</dt><dd className="moderation-reason">{report.reason}</dd><dt>Status</dt><dd><StatusBadge status={report.status} /></dd>
        <dt>Description</dt><dd>{report.description || 'None'}</dd>
        {report.notes && <><dt>Last moderator note</dt><dd>{report.notes}</dd></>}
        </dl>
      </div>}
      {link && <div className="moderation-record">
        <h3>Link assessment</h3>
        <dl>
        <dt>Short code</dt><dd>{link.shortCode}</dd><dt>Destination (query and fragment omitted)</dt><dd>{link.destination ?? 'Invalid destination'}</dd>
        <dt>URL assessment</dt><dd>{link.safety.classification === 'needs-review' ? <StatusBadge status="flagged" /> :
          link.safety.classification === 'blocked' ? <StatusBadge status="blocked by URL policy" /> : 'No risk patterns detected'}</dd>
        <dt>Risk flags</dt><dd>{link.safety.flags.length ? <ul className="moderation-flags">
          {link.safety.flags.map((flag) => <li key={flag}>{flag}</li>)}
        </ul> : 'None'}</dd>
        <dt>Moderation block</dt><dd>{link.blocked ? <StatusBadge status="security-blocked" /> : 'No moderation block'}</dd>
        </dl>
      </div>}
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
          {link && !link.deleted && <button type="button" className={link.blocked ? 'primary-btn' : 'secondary-btn link-detail-delete'} disabled={pending}
            onClick={() => confirm(link.blocked ? 'unblock' : 'block')}>{link.blocked ? 'Unblock link' : 'Block link'}</button>}
        </div>
      </div>}
      <ModerationHistory title="Report history" entries={report?.moderationHistory} />
      <ModerationHistory title="Link moderation history" entries={link?.history} />
      <ConfirmDialog dialogRef={dialog} title={decisions[decision]?.[0]} description={decisions[decision]?.[1]}
        confirmLabel={decisions[decision]?.[2]} danger={decision === 'block'} onConfirm={() => void apply()} />
    </section>
  );
}
