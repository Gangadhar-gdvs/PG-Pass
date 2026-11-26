import * as React from "react";
import { X } from "lucide-react";

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: "sm" | "md" | "lg";
}

/**
 * Lavender glass sheet. Phones: a bottom sheet (rounded top, grab handle).
 * md+: a right-side panel with rounded leading corners. Behaviour (focus
 * trap entry, Escape, scroll lock, restore focus) is unchanged.
 */
export function Drawer({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  width = "md",
}: DrawerProps) {
  const titleId = React.useId();
  const descId = React.useId();
  const panelRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = "hidden";

    // Move focus into the dialog so keyboard/screen-reader users land here and
    // Escape / tabbing operate within the drawer rather than the page behind it.
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusTarget =
      panelRef.current?.querySelector<HTMLElement>(
        'input, select, textarea, button, [href], [tabindex]:not([tabindex="-1"])'
      ) || panelRef.current;
    focusTarget?.focus?.();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
      previouslyFocused?.focus?.();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Static class names so Tailwind can see them.
  const widths: Record<NonNullable<DrawerProps["width"]>, string> = {
    sm: "md:max-w-md",
    md: "md:max-w-lg",
    lg: "md:max-w-xl",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-stretch justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#1A1458]/35 backdrop-blur-[3px] animate-fade cursor-pointer"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        ref={panelRef}
        tabIndex={-1}
        className={`relative z-50 flex w-full flex-col overflow-hidden max-h-[calc(100dvh-1.25rem)] h-[calc(100dvh-1.25rem)] md:h-full md:max-h-none rounded-t-[28px] md:rounded-t-none md:rounded-l-[28px] bg-[linear-gradient(180deg,#F8F5FF_0%,#F1ECFF_100%)] border border-white shadow-[0_-18px_60px_-20px_rgba(40,20,120,0.45)] md:shadow-[-24px_0_60px_-24px_rgba(40,20,120,0.45)] ${widths[width]} animate-sheet focus:outline-none`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        style={{
          paddingRight: "env(safe-area-inset-right)",
        }}
      >
        {/* decorative light blobs, like the app canvas */}
        <div aria-hidden className="pointer-events-none absolute -top-16 -right-10 h-48 w-48 rounded-full bg-[#C9B0FF]/40 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute top-24 -left-16 h-40 w-40 rounded-full bg-[#B0C0FF]/30 blur-3xl" />

        {/* Grab handle (phones) */}
        <div className="md:hidden relative flex justify-center pt-2.5">
          <span className="h-1.5 w-11 rounded-full bg-[#D5CBF5]" />
        </div>

        {/* Header */}
        <div className="relative flex items-start justify-between gap-3 px-5 md:px-6 pt-3 md:pt-6 pb-4">
          <div className="min-w-0 space-y-1">
            <h3 id={titleId} className="text-lg font-extrabold text-ink tracking-[-0.015em] leading-snug">
              {title}
            </h3>
            {description && (
              <p id={descId} className="text-[13px] text-muted">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-ink-2 shadow-[inset_0_1px_0_#fff,0_6px_16px_-8px_rgba(70,40,160,0.35)] border border-[#EEE8FD] hover:text-brand-700 transition-colors cursor-pointer press"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="relative flex-1 overflow-y-auto px-5 md:px-6 pb-6">{children}</div>

        {/* Footer */}
        {footer && (
          <div
            className="relative glass-bar border-t border-white/80 px-5 md:px-6 pt-4"
            style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
          >
            {footer}
          </div>
        )}
        {!footer && <div style={{ height: "env(safe-area-inset-bottom)" }} />}
      </div>
    </div>
  );
}
