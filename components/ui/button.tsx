import * as React from "react";
import { Loader2 } from "lucide-react";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "solid" | "default" | "outline" | "ghost" | "destructive" | "success" | "amber";
  size?: "sm" | "md" | "lg" | "full";
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className = "",
      variant = "default",
      size = "md",
      loading = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const base =
      "inline-flex items-center justify-center font-semibold transition-all duration-150 rounded-[8px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-[0.98] select-none";

    const sizes = {
      sm: "h-8 px-3 text-xs gap-1.5",
      md: "h-9.5 px-4 text-[13px] gap-2",
      lg: "h-11 px-5 text-sm gap-2.5",
      full: "h-10 w-full px-4 text-sm gap-2",
    };

    const variants = {
      solid:
        "bg-[#D97706] text-white hover:bg-[#B45309] focus-visible:ring-[#F59E0B] shadow-[0_1px_2px_0_rgba(217,119,6,0.25)]",
      default:
        "bg-[#D97706] text-white hover:bg-[#B45309] focus-visible:ring-[#F59E0B] shadow-[0_1px_2px_0_rgba(217,119,6,0.25)]",
      amber:
        "bg-[#D97706] text-white hover:bg-[#B45309] focus-visible:ring-[#F59E0B] shadow-[0_1px_2px_0_rgba(217,119,6,0.25)]",
      outline:
        "bg-white border border-[#E2E8F0] text-[#09090B] hover:bg-[#F8FAFC] hover:border-[#CBD5E1] focus-visible:ring-[#D97706] shadow-xs",
      ghost:
        "bg-transparent text-[#475569] hover:bg-[#F1F5F9] hover:text-[#09090B] focus-visible:ring-[#D97706]",
      destructive:
        "bg-[#EF4444] text-white hover:bg-[#DC2626] focus-visible:ring-[#EF4444] shadow-xs",
      success:
        "bg-[#10B981] text-white hover:bg-[#059669] focus-visible:ring-[#10B981] shadow-xs",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
        {...props}
      >
        {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
