import * as React from "react";

export function Skeleton({
  className = "",
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`animate-shimmer rounded-[6px] bg-[#F5F3EF] ${className}`}
      {...props}
    />
  );
}
