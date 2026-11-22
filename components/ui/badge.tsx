import * as React from "react";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "paid" | "pending" | "verify" | "vacant" | "danger" | "neutral" | "amber" | "cyan";
  dot?: boolean;
}

export function Badge({
  className = "",
  variant = "default",
  dot = false,
  children,
  ...props
}: BadgeProps) {
  const variants = {
    default: "bg-[#F1F5F9] text-[#475569] border-[#E2E8F0]",
    neutral: "bg-[#F1F5F9] text-[#475569] border-[#E2E8F0]",
    amber: "bg-[#FEF3C7] text-[#92400E] border-[#FDE68A]",
    paid: "bg-[#ECFDF5] text-[#065F46] border-[#A7F3D0]",
    pending: "bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]",
    verify: "bg-[#EEF2FF] text-[#4338CA] border-[#C7D2FE]",
    vacant: "bg-[#F8FAFC] text-[#64748B] border-[#E2E8F0]",
    danger: "bg-[#FEF2F2] text-[#991B1B] border-[#FECACA]",
    cyan: "bg-[#ECFEFF] text-[#0E7490] border-[#A5F3FC]",
  };

  const dots = {
    default: "bg-[#64748B]",
    neutral: "bg-[#64748B]",
    amber: "bg-[#D97706]",
    paid: "bg-[#10B981]",
    pending: "bg-[#F59E0B]",
    verify: "bg-[#6366F1]",
    vacant: "bg-[#94A3B8]",
    danger: "bg-[#EF4444]",
    cyan: "bg-[#06B6D4]",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-[6px] border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider select-none ${variants[variant]} ${className}`}
      {...props}
    >
      {dot && (
        <span
          className={`h-1.5 w-1.5 rounded-full shrink-0 ${dots[variant]}`}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  );
}
