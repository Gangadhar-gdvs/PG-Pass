import * as React from "react";

export interface OtpInputProps {
  value: string;
  onChange: (otp: string) => void;
  length?: number;
  disabled?: boolean;
  error?: boolean;
}

export function OtpInput({
  value,
  onChange,
  length = 6,
  disabled = false,
  error = false,
}: OtpInputProps) {
  const inputRefs = React.useRef<(HTMLInputElement | null)[]>([]);

  const digits = React.useMemo(() => {
    const arr = value.split("");
    while (arr.length < length) arr.push("");
    return arr.slice(0, length);
  }, [value, length]);

  const handleChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, "");
    if (!val) {
      const next = [...digits];
      next[index] = "";
      onChange(next.join(""));
      return;
    }

    const newDigits = [...digits];
    const incoming = val.split("");
    for (let i = 0; i < incoming.length && index + i < length; i++) {
      newDigits[index + i] = incoming[i];
    }
    const combined = newDigits.join("");
    onChange(combined);

    const nextIndex = Math.min(index + incoming.length, length - 1);
    inputRefs.current[nextIndex]?.focus();
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (pasteData) {
      onChange(pasteData);
      const focusIndex = Math.min(pasteData.length, length - 1);
      inputRefs.current[focusIndex]?.focus();
    }
  };

  return (
    <div className="flex items-center justify-between gap-2.5">
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={(el) => {
            inputRefs.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          value={digits[i] || ""}
          disabled={disabled}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          className={`h-12 w-11 rounded-[8px] border text-center font-mono-numbers text-lg font-bold text-[#09090B] bg-white transition-all focus:outline-none focus:ring-2 disabled:bg-[#F1F5F9] disabled:text-[#94A3B8] ${
            error
              ? "border-[#EF4444] focus:border-[#EF4444] focus:ring-[#EF4444]/20"
              : "border-[#E2E8F0] hover:border-[#CBD5E1] focus:border-[#D97706] focus:ring-[#D97706]/20"
          }`}
          aria-label={`Digit ${i + 1}`}
        />
      ))}
    </div>
  );
}
