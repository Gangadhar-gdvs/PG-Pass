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
          className={`h-14 w-12 rounded-2xl border text-center font-mono-numbers text-xl font-extrabold text-ink bg-white/90 shadow-[inset_0_1px_2px_rgba(70,40,160,0.05),0_6px_14px_-10px_rgba(70,40,160,0.35)] transition-all focus:outline-none disabled:bg-lilac disabled:text-faint ${
            error
              ? "border-danger focus:shadow-[0_0_0_4px_rgba(229,72,77,0.14)]"
              : "border-line-strong hover:border-[#C7BBF0] focus:border-brand focus:bg-white focus:shadow-[0_0_0_4px_rgba(123,63,242,0.14)]"
          }`}
          aria-label={`Digit ${i + 1}`}
        />
      ))}
    </div>
  );
}
