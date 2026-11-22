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
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const widths = {
    sm: "max-w-md",
    md: "max-w-lg",
    lg: "max-w-xl",
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
        className={`relative z-50 flex h-full w-full flex-col bg-white shadow-[0_25px_50px_-12px_rgba(0,0,0,0.15)] md:${widths[width]} border-l border-[#E2E8F0] animate-in slide-in-from-right duration-200`}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[#E2E8F0] px-6 py-4.5 bg-[#F8FAFC]">
          <div className="space-y-0.5">
            <h3 className="text-base font-bold text-[#09090B] tracking-tight">{title}</h3>
            {description && (
              <p className="text-xs text-[#64748B]">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-[6px] p-1.5 text-[#64748B] hover:bg-[#E2E8F0] hover:text-[#09090B] transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 bg-white">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="border-t border-[#E2E8F0] bg-[#F8FAFC] px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
