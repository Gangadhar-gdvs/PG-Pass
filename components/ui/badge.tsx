import * as React from "react";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "paid" | "pending" | "verify" | "vacant" | "danger" | "neutral" | "amber" | "cyan" | "brand";
  dot?: boolean;
}

/**
 * Soft status pill (ref: "In Progress", "Upcoming", "Owner", "28 Nov").
 * Sentence-case, rounded-full, pastel fill with a deeper ink of the same hue.
 */
export function Badge({
  className = "",
  variant = "default",
  dot = false,
  children,
  ...props
}: BadgeProps) {
  const variants = {
    default: "bg-lilac-2 text-ink-2",
    neutral: "bg-lilac-2 text-ink-2",
    brand: "bg-brand-100 text-brand-700",
    amber: "bg-brand-100 text-brand-700",
    verify: "bg-brand-100 text-brand-700",
    paid: "bg-success-bg text-success-ink",
    pending: "bg-warning-bg text-warning-ink",
    vacant: "bg-lilac text-muted ring-1 ring-inset ring-line",
    danger: "bg-danger-bg text-danger-ink",
    cyan: "bg-info-bg text-info-ink",
  };

  const dots = {
    default: "bg-muted",
    neutral: "bg-muted",
    brand: "bg-brand",
    amber: "bg-brand",
    verify: "bg-brand",
    paid: "bg-success",
    pending: "bg-warning",
    vacant: "bg-faint",
    danger: "bg-danger",
    cyan: "bg-info",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-[3px] text-[11px] font-semibold leading-[1.35] select-none ${variants[variant]} ${className}`}
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
