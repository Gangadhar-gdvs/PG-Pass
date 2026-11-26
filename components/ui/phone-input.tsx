import * as React from "react";
import { fieldLabelClass } from "./input";

export interface PhoneInputProps {
  value: string;
  onChange: (phone: string) => void;
  label?: React.ReactNode;
  error?: string;
  disabled?: boolean;
  placeholder?: string;
}

export function PhoneInput({
  value,
  onChange,
  label,
  error,
  disabled = false,
  placeholder = "98765 43210",
}: PhoneInputProps) {
  const inputId = React.useId();
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cleaned = e.target.value.replace(/\D/g, "").slice(0, 10);
    onChange(cleaned);
  };

  return (
    <div className="w-full flex flex-col gap-1.5 text-left">
      {label && (
        <label htmlFor={inputId} className={fieldLabelClass}>
          {label}
        </label>
      )}
      <div
        className={`flex h-12 w-full items-center rounded-2xl border bg-white/90 shadow-[inset_0_1px_2px_rgba(70,40,160,0.04)] transition-[border-color,box-shadow] overflow-hidden ${
          error
            ? "border-danger shadow-[0_0_0_4px_rgba(229,72,77,0.14)]"
            : "border-line-strong hover:border-[#C7BBF0] focus-within:border-brand focus-within:shadow-[0_0_0_4px_rgba(123,63,242,0.14)]"
        }`}
      >
        <div className="flex h-full items-center gap-1.5 bg-brand-50 px-3.5 border-r border-line text-[13px] font-bold text-brand-700 select-none">
          +91
        </div>
        <input
          id={inputId}
          type="tel"
          inputMode="numeric"
          pattern="[0-9]*"
          disabled={disabled}
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          className="flex-1 h-full px-3.5 text-sm font-mono-numbers font-medium text-ink placeholder:text-faint bg-transparent focus:outline-none disabled:cursor-not-allowed disabled:bg-lilac"
        />
      </div>
      {error && <p className="text-xs font-semibold text-danger">{error}</p>}
    </div>
  );
}
