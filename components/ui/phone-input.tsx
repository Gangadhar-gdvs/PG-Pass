import * as React from "react";

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
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cleaned = e.target.value.replace(/\D/g, "").slice(0, 10);
    onChange(cleaned);
  };

  return (
    <div className="w-full flex flex-col gap-1.5 text-left">
      {label && (
        <label className="text-[11px] font-semibold uppercase tracking-wider text-[#475569]">
          {label}
        </label>
      )}
      <div
        className={`flex h-10 w-full items-center rounded-[8px] border bg-white shadow-xs transition-colors overflow-hidden ${
          error
            ? "border-[#EF4444] ring-1 ring-[#EF4444]"
            : "border-[#E2E8F0] hover:border-[#CBD5E1] focus-within:border-[#D97706] focus-within:ring-1 focus-within:ring-[#D97706]"
        }`}
      >
        <div className="flex h-full items-center bg-[#F8FAFC] px-3.5 border-r border-[#E2E8F0] text-xs font-bold text-[#475569] select-none">
          +91
        </div>
        <input
          type="tel"
          inputMode="numeric"
          pattern="[0-9]*"
          disabled={disabled}
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          className="flex-1 h-full px-3.5 text-[13px] font-mono-numbers text-[#09090B] placeholder:text-[#94A3B8] bg-transparent focus:outline-none disabled:cursor-not-allowed disabled:bg-[#F1F5F9]"
        />
      </div>
      {error && <p className="text-xs font-medium text-[#EF4444]">{error}</p>}
    </div>
  );
}
