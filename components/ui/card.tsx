import * as React from "react";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "muted" | "flat" | "elevated";
}

/**
 * Frosted glass card — the primary surface of the reference design.
 *  - default  : glass (white → translucent) with lavender depth
 *  - elevated : same, floating higher
 *  - flat     : solid white, hairline border (dense data)
 *  - muted    : lilac inset well (nested inside another card)
 */
export function Card({
  className = "",
  variant = "default",
  children,
  ...props
}: CardProps) {
  const variants = {
    default: "app-card",
    elevated: "app-card shadow-[var(--shadow-float)]",
    flat: "glass-solid",
    muted: "well",
  };

  return (
    <div
      className={`${variants[variant]} p-5 transition-shadow duration-200 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  className = "",
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`flex flex-col gap-1 pb-4 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({
  className = "",
  children,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={`text-[17px] font-bold text-ink tracking-[-0.01em] ${className}`}
      {...props}
    >
      {children}
    </h3>
  );
}

export function CardDescription({
  className = "",
  children,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={`text-[13px] text-muted leading-relaxed ${className}`} {...props}>
      {children}
    </p>
  );
}

export function CardContent({
  className = "",
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`space-y-4 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({
  className = "",
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`flex items-center justify-between pt-4 border-t border-line text-xs text-muted ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
