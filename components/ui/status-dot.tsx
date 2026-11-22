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
    paid: "bg-[#10B981]",
    pending: "bg-[#F59E0B]",
    verify: "bg-[#6366F1]",
    vacant: "bg-[#94A3B8]",
    danger: "bg-[#EF4444]",
    neutral: "bg-[#64748B]",
    amber: "bg-[#D97706]",
  };

  const textColors: Record<StatusType, string> = {
    paid: "text-[#065F46]",
    pending: "text-[#92400E]",
    verify: "text-[#4338CA]",
    vacant: "text-[#64748B]",
    danger: "text-[#991B1B]",
    neutral: "text-[#475569]",
    amber: "text-[#92400E]",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-semibold select-none ${textColors[status]} ${className}`}
      {...props}
    >
      <span className={`h-2 w-2 rounded-full shrink-0 ${dots[status]}`} />
      {label && <span>{label}</span>}
    </span>
  );
}
