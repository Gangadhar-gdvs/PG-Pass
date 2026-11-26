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
  // Only words that contain letters count ("+91 Owner" → "OW", not "+O").
  const parts = (name || "")
    .trim()
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}]/gu, ""))
    .filter(Boolean);
  if (parts.length === 0) return "??";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  name: string;
  size?: "sm" | "md" | "lg" | "xl";
  /** Optional photo URL; falls back to initials if missing or it fails to load. */
  src?: string | null;
}

export function Avatar({ name, size = "md", src, className = "", ...props }: AvatarProps) {
  // Remember which URL failed (presigned URLs expire) so we fall back to
  // initials for that URL only — a new src gets a fresh attempt.
  const [failedSrc, setFailedSrc] = React.useState<string | null>(null);
  const showImage = Boolean(src) && src !== failedSrc;
  const index = hashString(name) % PALETTE.length;
  const color = PALETTE[index];
  const initials = getInitials(name);

  const sizes = {
    sm: "h-8 w-8 text-[11px]",
    md: "h-10 w-10 text-xs",
    lg: "h-12 w-12 text-sm",
    xl: "h-20 w-20 text-xl",
  };

  return (
    <div
      className={`relative inline-flex items-center justify-center overflow-hidden rounded-full font-extrabold ring-2 ring-white shadow-[0_6px_14px_-8px_rgba(70,40,160,0.5)] select-none shrink-0 ${sizes[size]} ${className}`}
      style={{
        background: color.bg,
        color: color.text,
      }}
      aria-label={name}
      {...props}
    >
      {showImage ? (
        // Plain <img>: short-lived presigned storage URL (not a static asset).
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src as string}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setFailedSrc(src ?? null)}
          draggable={false}
        />
      ) : /[a-zA-Z]/.test(name) ? (
        initials
      ) : (
        <User className="h-[55%] w-[55%]" strokeWidth={2.4} aria-hidden="true" />
      )}
    </div>
  );
}
