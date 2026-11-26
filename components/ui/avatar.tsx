import * as React from "react";
import { User } from "lucide-react";

const PALETTE = [
  { bg: "linear-gradient(145deg,#F3ECFF,#DCCBFF)", text: "#5814E6" }, // violet
  { bg: "linear-gradient(145deg,#EEF3FF,#D4E0FF)", text: "#2347B8" }, // sky
  { bg: "linear-gradient(145deg,#ECFAF4,#CDEEE0)", text: "#0E7A50" }, // mint
  { bg: "linear-gradient(145deg,#FFF3EC,#FDD9C8)", text: "#B8520E" }, // peach
  { bg: "linear-gradient(145deg,#FFF0F3,#F8D3DC)", text: "#B42335" }, // rose
  { bg: "linear-gradient(145deg,#F1F0FF,#D8D5FD)", text: "#3B2FB8" }, // indigo
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
    sm: "h-8 w-8 text-[11px]",
    md: "h-10 w-10 text-xs",
    lg: "h-12 w-12 text-sm",
  };

  return (
    <div
      className={`inline-flex items-center justify-center rounded-full font-extrabold ring-2 ring-white shadow-[0_6px_14px_-8px_rgba(70,40,160,0.5)] select-none shrink-0 ${sizes[size]} ${className}`}
      style={{
        background: color.bg,
        color: color.text,
      }}
      aria-label={name}
      {...props}
    >
      {/[a-zA-Z]/.test(name) ? initials : <User className="h-[55%] w-[55%]" strokeWidth={2.4} aria-hidden="true" />}
    </div>
  );
}
