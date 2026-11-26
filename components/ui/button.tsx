import * as React from "react";
import { Loader2 } from "lucide-react";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "solid" | "default" | "outline" | "ghost" | "destructive" | "success" | "amber" | "soft";
  size?: "sm" | "md" | "lg" | "full" | "icon" | "icon-sm";
  loading?: boolean;
}

/**
 * Pill buttons from the reference design:
 *  - solid/default/amber → violet gradient pill with a brand glow (primary CTA)
 *  - outline/soft        → white glass pill with lavender depth (secondary)
 *  - ghost               → violet text, lilac hover (tertiary / inline)
 *  - destructive/success → rose / green gradient pills
 */
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
      "relative inline-flex items-center justify-center font-bold tracking-[-0.005em] rounded-full select-none transition-[transform,filter,box-shadow,background-color,color] duration-150 active:scale-[0.97] accent-ring disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 cursor-pointer whitespace-nowrap";

    const sizes = {
      sm: "h-10 px-4 text-xs gap-1.5",
      md: "h-11 px-5 text-sm gap-2",
      lg: "h-12 px-6 text-[15px] gap-2.5",
      full: "h-12 w-full px-5 text-sm gap-2",
      icon: "h-11 w-11 p-0 text-sm [&>svg]:h-[18px] [&>svg]:w-[18px]",
      "icon-sm": "h-10 w-10 p-0 text-xs [&>svg]:h-4 [&>svg]:w-4",
    };

    const brand =
      "text-white bg-[image:var(--grad-brand)] shadow-[0_12px_24px_-10px_rgba(106,43,234,0.6),inset_0_1px_0_rgba(255,255,255,0.35)] hover:brightness-[1.06]";
    const variants: Record<NonNullable<ButtonProps["variant"]>, string> = {
      solid: brand,
      default: brand,
      amber: brand,
      outline:
        "text-ink bg-[linear-gradient(180deg,#FFFFFF_0%,#F7F3FF_100%)] border border-[#E9E2FC] shadow-[inset_0_1px_0_#fff,0_8px_18px_-10px_rgba(70,40,160,0.3)] hover:border-brand-200 hover:text-brand-700",
      soft:
        "text-brand-700 bg-brand-100 hover:bg-brand-200/70",
      ghost: "bg-transparent text-brand-700 hover:bg-brand-50",
      destructive:
        "text-white bg-[linear-gradient(135deg,#FF7C93_0%,#EE5270_50%,#D63557_100%)] shadow-[0_12px_24px_-10px_rgba(214,53,87,0.55),inset_0_1px_0_rgba(255,255,255,0.3)] hover:brightness-105",
      success:
        "text-white bg-[linear-gradient(135deg,#4FD69C_0%,#1FAE76_50%,#128A5B_100%)] shadow-[0_12px_24px_-10px_rgba(18,138,91,0.5),inset_0_1px_0_rgba(255,255,255,0.3)] hover:brightness-105",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
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
