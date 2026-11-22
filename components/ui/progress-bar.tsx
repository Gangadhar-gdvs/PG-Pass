import * as React from "react";

export interface ProgressBarProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number; // 0 to 100
  color?: "amber" | "emerald" | "coral" | "indigo";
  height?: "sm" | "md" | "lg";
}

export function ProgressBar({
  value,
  color = "amber",
  height = "md",
  className = "",
  ...props
}: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value));

  const colors = {
    amber: "bg-[#D97706]",
    emerald: "bg-[#10B981]",
    coral: "bg-[#F43F5E]",
    indigo: "bg-[#6366F1]",
  };

  const heights = {
    sm: "h-1",
    md: "h-1.5",
    lg: "h-2.5",
  };

  return (
    <div
      className={`w-full overflow-hidden rounded-full bg-[#E2E8F0] ${heights[height]} ${className}`}
      {...props}
    >
      <div
        className={`h-full transition-all duration-300 ease-out ${colors[color]}`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
