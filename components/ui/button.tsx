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
    // Bold mobile-app: rounded-full pills, generous tap targets, springy press.
    const base =
      "inline-flex items-center justify-center font-bold tracking-tight transition-all duration-150 rounded-full accent-ring disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-[0.96] select-none";

    const sizes = {
      sm: "h-9 px-4 text-xs gap-1.5",
      md: "h-11 px-5 text-sm gap-2",
      lg: "h-12 px-6 text-[15px] gap-2.5",
      full: "h-12 w-full px-5 text-sm gap-2",
    };

    // `accent` variants pull the panel theme color (var(--accent)) so buttons
    // match whichever panel (resident/owner/admin) they render in.
    const accentSolid =
      "text-white shadow-[0_6px_18px_-6px_color-mix(in_srgb,var(--accent)_55%,transparent)] hover:brightness-105";
    const variants: Record<string, string> = {
      solid: accentSolid,
      default: accentSolid,
      amber: accentSolid,
      outline:
        "bg-white border-2 border-slate-200 text-slate-900 hover:border-slate-300 hover:bg-slate-50",
      ghost: "bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900",
      destructive: "bg-[#EF4444] text-white hover:bg-[#DC2626] shadow-[0_6px_18px_-6px_rgba(239,68,68,0.5)]",
      success: "bg-[#10B981] text-white hover:bg-[#059669] shadow-[0_6px_18px_-6px_rgba(16,185,129,0.5)]",
    };

    const useAccent = variant === "solid" || variant === "default" || variant === "amber";

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        style={useAccent ? { background: "var(--accent)" } : undefined}
        className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
        {...props}
      >
        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
