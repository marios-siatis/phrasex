import React from 'react';
import { X } from 'lucide-react';

export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Yes',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title?: string;
  message?: string | React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  return (
    <div className="modal" role="presentation" onMouseDown={onCancel}>
      <section
        className="dialog"
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
        style={{ width: 'min(560px, calc(100vw - 32px))' }}
      >
        <button
          type="button"
          className="scheduleDialogClose"
          onClick={onCancel}
          aria-label="Close"
        >
          <X size={18} />
        </button>

        {title && <h2 style={{ marginTop: 0 }}>{title}</h2>}

        {message && <p className="small">{message}</p>}

        <div style={{ display: 'flex', gap: 8, marginTop: 18, justifyContent: 'flex-end' }}>
          <button type="button" className="textButton" onClick={onCancel}>{cancelLabel}</button>
          <button type="button" className="gold" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </section>
    </div>
  );
}
