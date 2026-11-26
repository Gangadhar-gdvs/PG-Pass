import * as React from "react";

export interface MetricProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  value: string | number;
  subtext?: string;
  highlight?: "default" | "success" | "warning" | "danger" | "amber";
  isCurrency?: boolean;
}

export function Metric({
  label,
  value,
  subtext,
  highlight = "default",
  isCurrency = false,
  className = "",
  ...props
}: MetricProps) {
  const highlights = {
    default: "text-ink",
    success: "text-success-ink",
    warning: "text-warning-ink",
    danger: "text-danger",
    amber: "text-brand-700",
  };

  return (
    <div className={`flex flex-col text-left ${className}`} {...props}>
      <span className="text-xs font-semibold text-muted">
        {label}
      </span>
      <span
        className={`mt-0.5 text-2xl font-extrabold tracking-[-0.02em] font-mono-numbers ${
          isCurrency ? "font-mono-numbers" : ""
        } ${highlights[highlight]}`}
      >
        {value}
      </span>
      {subtext && (
        <span className="mt-0.5 text-[11px] font-medium text-faint">{subtext}</span>
      )}
    </div>
  );
}
