import { useRef, useState } from 'react';
import ConfirmDialog from '../ConfirmDialog.jsx';

export default function BulkActions({ count, pending, onClear, onApply }) {
  const [action, setAction] = useState('disable');
  const [tag, setTag] = useState('');
  const dialog = useRef(null);
  const trigger = useRef(null);
  const usesTag = action === 'add-tag' || action === 'remove-tag';

  function submit(event) {
    event.preventDefault();
    if (pending) return;
    if (action === 'delete') dialog.current.showModal();
    else void onApply(action, usesTag ? tag : undefined);
  }

  return (
    <div className="bulk-actions">
      <form onSubmit={submit} aria-label="Bulk actions">
        <fieldset disabled={pending}>
          <strong>{count} selected</strong>
          <label>Bulk action<select value={action} onChange={(event) => setAction(event.target.value)}>
            <option value="disable">Disable</option><option value="enable">Enable</option><option value="delete">Delete</option>
            <option value="add-tag">Add tag</option><option value="remove-tag">Remove tag</option>
          </select></label>
          {usesTag && <label>Bulk tag<input required maxLength={32} value={tag} onChange={(event) => setTag(event.target.value)} /></label>}
          <button className="primary-btn" type="submit" ref={trigger}>{pending ? 'Applying…' : 'Apply action'}</button>
          <button className="secondary-btn" type="button" onClick={onClear}>Clear selection</button>
        </fieldset>
      </form>
      <ConfirmDialog dialogRef={dialog} title={`Delete ${count} selected ${count === 1 ? 'link' : 'links'}?`}
        description="Deleted links stop redirecting and their aliases stay reserved."
        confirmLabel="Confirm bulk deletion" danger onClose={() => trigger.current?.focus()}
        onConfirm={() => void onApply('delete')} />
    </div>
  );
}
