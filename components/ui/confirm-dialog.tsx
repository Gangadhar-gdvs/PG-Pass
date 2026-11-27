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
  const panelRef = React.useRef<HTMLDivElement>(null);

  // Reset the reason each time the dialog opens.
  React.useEffect(() => {
    // Defer so setState runs after commit, not in the effect body (cascading-render lint rule).
    if (open) queueMicrotask(() => setReason(''));
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';

    // Move focus into the dialog and restore it on close, so a keyboard user
    // isn't left focused on the page behind this (alert)dialog.
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const FOCUSABLE =
      'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';
    queueMicrotask(() => {
      const target = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE) || panelRef.current;
      target?.focus?.();
    });

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (!busy) onCancel();
        return;
      }
      // Focus trap — keep Tab / Shift+Tab inside the dialog.
      if (e.key !== 'Tab' || !panelRef.current) return;
      const items = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && (active === first || active === panelRef.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      previouslyFocused?.focus?.();
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
        ref={panelRef}
        tabIndex={-1}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="relative z-[61] w-full max-w-sm max-h-[calc(100dvh-1.5rem)] overflow-y-auto overflow-x-hidden rounded-[28px] border border-white bg-[linear-gradient(180deg,#FFFFFF_0%,#F5F0FF_100%)] p-6 shadow-[0_30px_70px_-24px_rgba(40,20,120,0.55)] animate-pop focus:outline-none"
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

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'default';
}

/**
 * Promise-based confirmation in the app's own dialog (replaces the browser's
 * unstyled `window.confirm`). Render `dialog` once in the component, then:
 *
 *   const [confirm, dialog] = useConfirm();
 *   if (!(await confirm({ title: 'Remove photo?', message: '…' }))) return;
 */
export function useConfirm() {
  const [pending, setPending] = React.useState<(ConfirmOptions & { resolve: (ok: boolean) => void }) | null>(null);

  const confirm = React.useCallback(
    (opts: ConfirmOptions) => new Promise<boolean>((resolve) => setPending({ ...opts, resolve })),
    []
  );

  const settle = (ok: boolean) => {
    pending?.resolve(ok);
    setPending(null);
  };

  const dialog = (
    <ConfirmDialog
      open={pending !== null}
      title={pending?.title ?? ''}
      message={pending?.message ?? ''}
      confirmLabel={pending?.confirmLabel}
      cancelLabel={pending?.cancelLabel}
      tone={pending?.tone ?? 'danger'}
      onConfirm={() => settle(true)}
      onCancel={() => settle(false)}
    />
  );

  return [confirm, dialog] as const;
}
