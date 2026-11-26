import * as React from "react";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: React.ReactNode;
  error?: string;
  helperText?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = "", type = "text", label, error, helperText, id, ...props }, ref) => {
    const generatedId = React.useId();
    const inputId = id || generatedId;

    return (
      <div className="w-full flex flex-col gap-1.5 text-left">
        {label && (
          <label
            htmlFor={inputId}
            className="text-[11px] font-semibold uppercase tracking-wider text-[#475569]"
          >
            {label}
          </label>
        )}
        <input
          id={inputId}
          type={type}
          ref={ref}
          className={`h-11 w-full rounded-[12px] border bg-white px-3.5 py-2 text-[13px] text-[#09090B] placeholder:text-[#94A3B8] transition-colors focus-visible:outline-none focus-visible:ring-1 disabled:cursor-not-allowed disabled:bg-[#F1F5F9] disabled:text-[#94A3B8] shadow-xs ${
            error
              ? "border-[#EF4444] focus-visible:border-[#EF4444] focus-visible:ring-[#EF4444]"
              : "border-[#E2E8F0] hover:border-[#CBD5E1] focus-visible:border-[color:var(--accent)] focus-visible:ring-[color:var(--accent)]"
          } ${className}`}
          {...props}
        />
        {error && <p className="text-xs font-medium text-[#EF4444]">{error}</p>}
        {!error && helperText && (
          <p className="text-xs text-[#64748B]">{helperText}</p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
