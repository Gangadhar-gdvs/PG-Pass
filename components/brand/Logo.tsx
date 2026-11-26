import * as React from 'react';

/**
 * PGPass logo — vector redraw of the reference mark: an indigo house outline
 * with eaves + chimney, a blue four-pane window, and a violet gradient check
 * sweeping across the bottom-right (outlined in white so it lifts off the
 * house). Wordmark: "PG" in navy ink, "Pass" in the brand violet gradient.
 */
export function LogoMark({ size = 40, className = '' }: { size?: number; className?: string }) {
  const id = React.useId().replace(/:/g, '');
  return (
    <svg
      width={size}
      height={size * (84 / 100)}
      viewBox="0 0 100 84"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`${id}-house`} x1="10" y1="8" x2="88" y2="80" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#5B4BD1" />
          <stop offset="1" stopColor="#2B2196" />
        </linearGradient>
        <linearGradient id={`${id}-check`} x1="36" y1="70" x2="96" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#7C2CF6" />
          <stop offset="1" stopColor="#B068FF" />
        </linearGradient>
        <linearGradient id={`${id}-win`} x1="40" y1="38" x2="56" y2="54" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#3B7BFF" />
          <stop offset="1" stopColor="#1546E0" />
        </linearGradient>
      </defs>
      {/* roof with eaves */}
      <path d="M7 40 L47 8 L87 40" stroke={`url(#${id}-house)`} strokeWidth="7.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* chimney */}
      <path d="M73 27 V14" stroke={`url(#${id}-house)`} strokeWidth="7.5" strokeLinecap="round" />
      {/* walls (left wall + floor stub, right wall + floor stub) */}
      <path d="M20 40 V74 H36" stroke={`url(#${id}-house)`} strokeWidth="7.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M76 49 V74 H66" stroke={`url(#${id}-house)`} strokeWidth="7.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* window */}
      <g fill={`url(#${id}-win)`}>
        <rect x="40" y="37" width="6.6" height="6.6" rx="1.2" />
        <rect x="48.4" y="37" width="6.6" height="6.6" rx="1.2" />
        <rect x="40" y="45.4" width="6.6" height="6.6" rx="1.2" />
        <rect x="48.4" y="45.4" width="6.6" height="6.6" rx="1.2" />
      </g>
      {/* check — white halo first, then the gradient stroke */}
      <path d="M38 60 L50 71 L93 43" stroke="#FFFFFF" strokeWidth="15" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M38 60 L50 71 L93 43" stroke={`url(#${id}-check)`} strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Wordmark({
  className = '',
  light = false,
  style,
}: {
  className?: string;
  light?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <span className={`font-extrabold tracking-[-0.035em] leading-none ${className}`} style={style}>
      <span className={light ? 'text-white' : 'text-ink'}>PG</span>
      <span className={light ? 'text-white/85' : 'text-gradient'}>Pass</span>
    </span>
  );
}

/**
 * Full lockup. `size` drives the mark; the wordmark scales with it
 * (≈ the reference proportion: wordmark cap height ≈ 55% of the mark).
 */
export function Logo({
  size = 40,
  className = '',
  light = false,
  showWordmark = true,
}: {
  size?: number;
  className?: string;
  light?: boolean;
  showWordmark?: boolean;
}) {
  return (
    <span className={`inline-flex items-center select-none ${className}`} style={{ gap: size * 0.22 }}>
      <LogoMark size={size} />
      {showWordmark && <Wordmark light={light} style={{ fontSize: Math.round(size * 0.62) }} />}
    </span>
  );
}
