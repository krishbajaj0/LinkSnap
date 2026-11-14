import { useId } from 'react';

export default function ConfirmDialog({ dialogRef, title, description, confirmLabel, onConfirm, onClose, danger = false }) {
  const titleId = useId();
  const descriptionId = useId();

  return (
    <dialog ref={dialogRef} className="confirm-dialog" aria-labelledby={titleId} aria-describedby={descriptionId} onClose={onClose}>
      <h2 id={titleId}>{title}</h2>
      <p id={descriptionId}>{description}</p>
      <div className="action-group">
        <button className="secondary-btn" type="button" autoFocus onClick={() => dialogRef.current.close()}>Cancel</button>
        <button className={danger ? 'primary-btn link-delete' : 'primary-btn'} type="button" onClick={() => {
          dialogRef.current.close();
          onConfirm();
        }}>{confirmLabel}</button>
      </div>
    </dialog>
  );
}
