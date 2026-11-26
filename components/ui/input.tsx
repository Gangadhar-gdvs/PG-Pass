import * as React from "react";
import { Search } from "lucide-react";

/** Shared label style for every form control (sentence case, ink-2). */
export const fieldLabelClass = "text-[13px] font-semibold text-ink-2";

/** Shared control look — soft white field, lavender border, violet focus halo. */
export const fieldBaseClass =
  "w-full rounded-2xl border bg-white/90 text-sm text-ink placeholder:text-faint transition-[border-color,box-shadow,background-color] shadow-[inset_0_1px_2px_rgba(70,40,160,0.04)] focus-visible:outline-none focus-visible:bg-white disabled:cursor-not-allowed disabled:bg-lilac disabled:text-faint";

export const fieldStateClass = (error?: string | boolean) =>
  error
    ? "border-danger focus-visible:border-danger focus-visible:shadow-[0_0_0_4px_rgba(229,72,77,0.14)]"
    : "border-line-strong hover:border-[#C7BBF0] focus-visible:border-brand focus-visible:shadow-[0_0_0_4px_rgba(123,63,242,0.14)]";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: React.ReactNode;
  error?: string;
  helperText?: string;
  /** Optional leading glyph (Lucide icon element). */
  leading?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = "", type = "text", label, error, helperText, id, leading, ...props }, ref) => {
    const generatedId = React.useId();
    const inputId = id || generatedId;

    return (
      <div className="w-full flex flex-col gap-1.5 text-left">
        {label && (
          <label htmlFor={inputId} className={fieldLabelClass}>
            {label}
          </label>
        )}
        <div className="relative">
          {leading && (
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-faint [&>svg]:h-4 [&>svg]:w-4">
              {leading}
            </span>
          )}
          <input
            id={inputId}
            type={type}
            ref={ref}
            aria-invalid={error ? true : undefined}
            className={`h-12 ${leading ? "pl-11" : "pl-4"} pr-4 ${fieldBaseClass} ${fieldStateClass(error)} ${className}`}
            {...props}
          />
        </div>
        {error && <p className="text-xs font-semibold text-danger">{error}</p>}
        {!error && helperText && (
          <p className="text-xs text-muted">{helperText}</p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: React.ReactNode;
  error?: string;
  helperText?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className = "", label, error, helperText, id, rows = 4, ...props }, ref) => {
    const generatedId = React.useId();
    const inputId = id || generatedId;
    return (
      <div className="w-full flex flex-col gap-1.5 text-left">
        {label && (
          <label htmlFor={inputId} className={fieldLabelClass}>
            {label}
          </label>
        )}
        <textarea
          id={inputId}
          ref={ref}
          rows={rows}
          aria-invalid={error ? true : undefined}
          className={`px-4 py-3 leading-relaxed resize-y ${fieldBaseClass} ${fieldStateClass(error)} ${className}`}
          {...props}
        />
        {error && <p className="text-xs font-semibold text-danger">{error}</p>}
        {!error && helperText && <p className="text-xs text-muted">{helperText}</p>}
      </div>
    );
  }
);

Textarea.displayName = "Textarea";

/** Rounded search field with a leading magnifier (lists, directories). */
export const SearchInput = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { containerClassName?: string }
>(({ className = "", containerClassName = "", ...props }, ref) => (
  <div className={`relative ${containerClassName}`}>
    <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-400" />
    <input
      ref={ref}
      type="search"
      className={`h-12 rounded-full pl-11 pr-4 ${fieldBaseClass} ${fieldStateClass()} ${className}`}
      {...props}
    />
  </div>
));

SearchInput.displayName = "SearchInput";
