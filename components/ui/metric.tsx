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
    default: "text-[#09090B]",
    success: "text-[#10B981]",
    warning: "text-[#F59E0B]",
    danger: "text-[#EF4444]",
    amber: "text-[#D97706]",
  };

  return (
    <div className={`flex flex-col text-left ${className}`} {...props}>
      <span className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">
        {label}
      </span>
      <span
        className={`mt-0.5 text-2xl font-bold tracking-tight ${
          isCurrency ? "font-mono-numbers" : ""
        } ${highlights[highlight]}`}
      >
        {value}
      </span>
      {subtext && (
        <span className="mt-0.5 text-[11px] text-[#94A3B8]">{subtext}</span>
      )}
    </div>
  );
}
