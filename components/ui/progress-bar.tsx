import * as React from "react";

export interface ProgressBarProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number; // 0 to 100
  color?: "brand" | "amber" | "emerald" | "coral" | "indigo";
  height?: "sm" | "md" | "lg";
}

export function ProgressBar({
  value,
  color = "brand",
  height = "md",
  className = "",
  ...props
}: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value));

  const colors = {
    brand: "bg-[image:var(--grad-brand)]",
    amber: "bg-[linear-gradient(90deg,#FFB070,#F2791C)]",
    emerald: "bg-[linear-gradient(90deg,#4FD69C,#17A06B)]",
    coral: "bg-[linear-gradient(90deg,#FF8FA3,#E5484D)]",
    indigo: "bg-[image:var(--grad-brand)]",
  };

  const heights = {
    sm: "h-1.5",
    md: "h-2",
    lg: "h-3",
  };

  return (
    <div
      className={`w-full overflow-hidden rounded-full bg-brand-100 shadow-[inset_0_1px_2px_rgba(70,40,160,0.12)] ${heights[height]} ${className}`}
      {...props}
    >
      <div
        className={`h-full rounded-full transition-all duration-500 ease-out ${colors[color]}`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
