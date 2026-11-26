'use client';

import * as React from 'react';
import { Button } from './button';
import { Icon3D } from '@/components/brand/Icon3D';
import { fieldLabelClass, fieldBaseClass, fieldStateClass } from './input';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Visual intent — `danger` renders a red confirm button. */
  tone?: 'danger' | 'default';
  /**
   * When provided, a text field is shown and its (trimmed, non-empty) value is
   * passed to `onConfirm`. Used for actions that require a reason, e.g. payment
   * reversal. When omitted, `onConfirm` is called with an empty string.
   */
  reasonLabel?: string;
  reasonPlaceholder?: string;
  busy?: boolean;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger',
  reasonLabel,
  reasonPlaceholder,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [reason, setReason] = React.useState('');
  const titleId = React.useId();
  const descId = React.useId();

  // Reset the reason each time the dialog opens.
  React.useEffect(() => {
    // Defer so setState runs after commit, not in the effect body (cascading-render lint rule).
    if (open) queueMicrotask(() => setReason(''));
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onCancel();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, busy, onCancel]);

  if (!open) return null;

  const reasonRequired = Boolean(reasonLabel);
  const canConfirm = !busy && (!reasonRequired || reason.trim().length > 0);

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-3 sm:p-4">
      <div
        className="fixed inset-0 bg-[#1A1458]/40 backdrop-blur-[3px] animate-fade"
        onClick={() => !busy && onCancel()}
        aria-hidden="true"
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="relative z-[61] w-full max-w-sm overflow-hidden rounded-[28px] border border-white bg-[linear-gradient(180deg,#FFFFFF_0%,#F5F0FF_100%)] p-6 shadow-[0_30px_70px_-24px_rgba(40,20,120,0.55)] animate-pop"
        style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div aria-hidden className="pointer-events-none absolute -top-14 -right-12 h-40 w-40 rounded-full bg-[#D9C6FF]/50 blur-3xl" />
        <div className="relative flex flex-col items-center text-center">
          <span
            className={`grid h-16 w-16 place-items-center rounded-full ${
              tone === 'danger' ? 'tint-peach' : 'tint-violet'
            } icon-bubble`}
            style={{ width: 64, height: 64 }}
          >
            <Icon3D name={tone === 'danger' ? 'alert' : 'check'} size={38} />
          </span>
          <h3 id={titleId} className="mt-4 text-lg font-extrabold text-ink tracking-[-0.015em]">
            {title}
          </h3>
          <p id={descId} className="mt-1.5 text-sm text-ink-2/80 leading-relaxed">
            {message}
          </p>
        </div>

        {reasonLabel && (
          <div className="relative mt-5 space-y-1.5 text-left">
            <label htmlFor={`${titleId}-reason`} className={fieldLabelClass}>
              {reasonLabel}
            </label>
            <input
              id={`${titleId}-reason`}
              autoFocus
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={reasonPlaceholder}
              className={`h-12 px-4 ${fieldBaseClass} ${fieldStateClass()}`}
            />
          </div>
        )}

        <div className="relative mt-6 grid grid-cols-2 gap-2.5">
          <Button variant="outline" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button
            variant={tone === 'danger' ? 'destructive' : 'solid'}
            onClick={() => onConfirm(reason.trim())}
            disabled={!canConfirm}
            loading={busy}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
