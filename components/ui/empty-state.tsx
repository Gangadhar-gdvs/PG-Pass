import * as React from "react";

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className = "",
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 text-center rounded-[12px] border border-dashed border-[#E2E8F0] bg-white ${className}`}
      {...props}
    >
      {icon && (
        <div className="mb-3 text-[#64748B] p-3 rounded-full bg-[#F8FAFC] border border-[#E2E8F0]">
          {icon}
        </div>
      )}
      <h4 className="text-sm font-bold text-[#09090B]">{title}</h4>
      {description && (
        <p className="mt-1 max-w-sm text-xs text-[#64748B] leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
