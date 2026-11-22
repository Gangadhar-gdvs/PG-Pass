import * as React from "react";

const PALETTE = [
  { bg: "#F0FDFA", text: "#0F766E", border: "#99F6E4" }, // teal
  { bg: "#EFF6FF", text: "#1D4ED8", border: "#BFDBFE" }, // blue
  { bg: "#F5F3FF", text: "#6D28D9", border: "#DDD6FE" }, // purple
  { bg: "#ECFDF5", text: "#047857", border: "#A7F3D0" }, // emerald
  { bg: "#FFFBEB", text: "#B45309", border: "#FDE68A" }, // amber
  { bg: "#FDF2F8", text: "#BE185D", border: "#FBCFE8" }, // pink
  { bg: "#F8FAFC", text: "#334155", border: "#CBD5E1" }, // slate
];

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getInitials(name: string): string {
  if (!name) return "??";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  name: string;
  size?: "sm" | "md" | "lg";
}

export function Avatar({ name, size = "md", className = "", ...props }: AvatarProps) {
  const index = hashString(name) % PALETTE.length;
  const color = PALETTE[index];
  const initials = getInitials(name);

  const sizes = {
    sm: "h-7 w-7 text-[11px]",
    md: "h-9 w-9 text-xs",
    lg: "h-11 w-11 text-sm",
  };

  return (
    <div
      className={`inline-flex items-center justify-center rounded-full font-semibold border select-none shrink-0 ${sizes[size]} ${className}`}
      style={{
        backgroundColor: color.bg,
        color: color.text,
        borderColor: color.border,
      }}
      aria-label={name}
      {...props}
    >
      {initials}
    </div>
  );
}
