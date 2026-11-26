import * as React from "react";

export type StatusType = "paid" | "pending" | "verify" | "vacant" | "danger" | "neutral" | "amber";

export interface StatusDotProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: StatusType;
  label?: string;
}

export function StatusDot({
  status,
  label,
  className = "",
  ...props
}: StatusDotProps) {
  const dots: Record<StatusType, string> = {
    paid: "bg-success shadow-[0_0_0_3px_rgba(23,160,107,0.15)]",
    pending: "bg-warning shadow-[0_0_0_3px_rgba(242,121,28,0.15)]",
    verify: "bg-brand shadow-[0_0_0_3px_rgba(123,63,242,0.15)]",
    vacant: "bg-faint shadow-[0_0_0_3px_rgba(165,158,203,0.18)]",
    danger: "bg-danger shadow-[0_0_0_3px_rgba(229,72,77,0.15)]",
    neutral: "bg-muted",
    amber: "bg-brand shadow-[0_0_0_3px_rgba(123,63,242,0.15)]",
  };

  const textColors: Record<StatusType, string> = {
    paid: "text-success-ink",
    pending: "text-warning-ink",
    verify: "text-brand-700",
    vacant: "text-muted",
    danger: "text-danger-ink",
    neutral: "text-ink-2",
    amber: "text-brand-700",
  };

  // Human-readable default so status is never conveyed by colour alone
  // (colourblind users) — used for the sr-only text when no visible label.
  const defaultLabels: Record<StatusType, string> = {
    paid: "Paid",
    pending: "Pending",
    verify: "Awaiting verification",
    vacant: "Vacant",
    danger: "Attention",
    neutral: "Status",
    amber: "Notice",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-semibold select-none ${textColors[status]} ${className}`}
      {...props}
    >
      <span className={`h-2 w-2 rounded-full shrink-0 ${dots[status]}`} aria-hidden="true" />
      {label ? <span>{label}</span> : <span className="sr-only">{defaultLabels[status]}</span>}
    </span>
  );
}
