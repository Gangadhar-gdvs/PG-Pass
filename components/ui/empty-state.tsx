import * as React from "react";
import { Icon3D, type Icon3DName, type Tint } from "@/components/brand/Icon3D";
import { Illustration, type IllustrationName } from "@/components/brand/Illustration";

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  /** A Lucide glyph (legacy) — rendered inside a glossy lilac bubble. */
  icon?: React.ReactNode;
  /** Preferred: a 3D icon from the brand set. */
  icon3d?: Icon3DName;
  /** Or a full 3D scene illustration (e.g. "clipboard"). */
  illustration?: IllustrationName;
  /** Bubble tint behind `icon3d` / `icon` (default violet). */
  tint?: Tint;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

/**
 * Friendly empty state in the reference style: a 3D visual, navy title,
 * soft description and a pill action. Sits inside its parent card (no border
 * box of its own) so it never looks like a leftover dashed placeholder.
 */
export function EmptyState({
  icon,
  icon3d,
  illustration,
  tint = "violet",
  title,
  description,
  action,
  className = "",
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center px-6 py-10 text-center ${className}`}
      {...props}
    >
      {illustration ? (
        <Illustration name={illustration} width={180} className="mb-3" />
      ) : icon3d ? (
        <span className={`icon-bubble tint-${tint} mb-4`} style={{ width: 76, height: 76 }}>
          <Icon3D name={icon3d} size={44} />
        </span>
      ) : icon ? (
        <span
          className={`icon-bubble tint-${tint} mb-4 text-brand [&>svg]:h-7 [&>svg]:w-7`}
          style={{ width: 68, height: 68 }}
        >
          {icon}
        </span>
      ) : (
        <Illustration name="clipboard" width={170} className="mb-3" />
      )}
      <h4 className="text-base font-extrabold text-ink tracking-[-0.01em]">{title}</h4>
      {description && (
        <p className="mt-1.5 max-w-sm text-[13px] text-muted leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
