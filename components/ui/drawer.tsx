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

  // Static class names so Tailwind can see them (a `md:${...}` template literal
  // compiles to nothing, which previously left the drawer full-width on desktop).
  const widths: Record<NonNullable<DrawerProps["width"]>, string> = {
    sm: "md:max-w-md",
    md: "md:max-w-lg",
    lg: "md:max-w-xl",
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity duration-200 cursor-pointer"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer Container */}
      <div
        ref={panelRef}
        tabIndex={-1}
        className={`relative z-50 flex h-full w-full flex-col bg-white shadow-[0_25px_50px_-12px_rgba(0,0,0,0.15)] ${widths[width]} border-l border-[#E2E8F0] animate-in slide-in-from-right duration-200 focus:outline-none`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        style={{
          paddingTop: "env(safe-area-inset-top)",
          paddingRight: "env(safe-area-inset-right)",
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[#E2E8F0] px-6 py-4.5 bg-[#F8FAFC]">
          <div className="space-y-0.5">
            <h3 id={titleId} className="text-base font-bold text-[#09090B] tracking-tight">{title}</h3>
            {description && (
              <p id={descId} className="text-xs text-[#64748B]">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 w-11 items-center justify-center rounded-[6px] text-[#64748B] hover:bg-[#E2E8F0] hover:text-[#09090B] transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 bg-white">{children}</div>

        {/* Footer */}
        {footer && (
          <div
            className="border-t border-[#E2E8F0] bg-[#F8FAFC] px-6 py-4"
            style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
