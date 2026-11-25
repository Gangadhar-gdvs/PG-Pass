import * as React from 'react';
import { ChevronDown } from 'lucide-react';

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: React.ReactNode;
  error?: string;
  helperText?: string;
  /** Override the outer wrapper (e.g. `w-auto` for inline filter selects). */
  containerClassName?: string;
}

/**
 * Styled native <select> that matches the shared <Input> look: label, focus
 * ring, error state, and a custom chevron (native dropdown arrows are removed
 * via `appearance-none`). Keeps full native behaviour/accessibility while
 * replacing the inconsistent default browser control used across the app.
 */
export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className = '', containerClassName = 'w-full', label, error, helperText, id, children, ...props }, ref) => {
    const generatedId = React.useId();
    const selectId = id || generatedId;

    return (
      <div className={`flex flex-col gap-1.5 text-left ${containerClassName}`}>
        {label && (
          <label
            htmlFor={selectId}
            className="text-[11px] font-semibold uppercase tracking-wider text-[#475569]"
          >
            {label}
          </label>
        )}
        <div className="relative">
          <select
            id={selectId}
            ref={ref}
            className={`h-10 w-full appearance-none rounded-[8px] border bg-white pl-3.5 pr-9 py-2 text-[13px] text-[#09090B] transition-colors focus-visible:outline-none focus-visible:ring-1 disabled:cursor-not-allowed disabled:bg-[#F1F5F9] disabled:text-[#94A3B8] shadow-xs cursor-pointer ${
              error
                ? 'border-[#EF4444] focus-visible:border-[#EF4444] focus-visible:ring-[#EF4444]'
                : 'border-[#E2E8F0] hover:border-[#CBD5E1] focus-visible:border-[#D97706] focus-visible:ring-[#D97706]'
            } ${className}`}
            {...props}
          >
            {children}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
        </div>
        {error && <p className="text-xs font-medium text-[#EF4444]">{error}</p>}
        {!error && helperText && <p className="text-xs text-[#64748B]">{helperText}</p>}
      </div>
    );
  }
);

Select.displayName = 'Select';
