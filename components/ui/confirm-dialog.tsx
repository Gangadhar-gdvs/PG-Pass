'use client';

import * as React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from './button';

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
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs"
        onClick={() => !busy && onCancel()}
        aria-hidden="true"
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="relative z-[61] w-full max-w-sm rounded-[14px] bg-white p-5 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)] border border-[#E2E8F0] animate-in fade-in zoom-in-95 duration-150"
      >
        <div className="flex items-start gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
              tone === 'danger' ? 'bg-[#FEE2E2] text-[#DC2626]' : 'bg-[#FEF3C7] text-[#D97706]'
            }`}
          >
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <h3 id={titleId} className="text-base font-bold text-[#09090B] tracking-tight">
              {title}
            </h3>
            <p id={descId} className="text-sm text-[#64748B]">
              {message}
            </p>
          </div>
        </div>

        {reasonLabel && (
          <div className="mt-4 space-y-1">
            <label htmlFor={`${titleId}-reason`} className="text-xs font-semibold text-[#334155]">
              {reasonLabel}
            </label>
            <input
              id={`${titleId}-reason`}
              autoFocus
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={reasonPlaceholder}
              className="w-full h-11 rounded-[8px] border border-[#CBD5E1] px-3 text-sm text-[#09090B] placeholder:text-[#94A3B8] focus:border-[#D97706] focus:outline-none"
            />
          </div>
        )}

        <div className="mt-5 flex items-center justify-end gap-2">
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
