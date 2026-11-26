import * as React from 'react';

/**
 * 3D icon set — the actual glossy icons from the reference screens
 * (docs/screenshots), extracted with transparent backgrounds into
 * /public/brand/icons. Use these wherever the refs use a 3D icon: stat tiles,
 * quick actions, section headers, activity bubbles, feature tiles, empty states.
 *
 * Small inline glyphs (buttons, inputs, chevrons, nav bars) stay as Lucide line
 * icons — exactly like the refs, which mix 3D hero icons with flat UI glyphs.
 */
export const ICON3D = {
  // places & people
  house: 'house',            // purple house
  'home-blue': 'home-blue',  // blue house (feature tile)
  building: 'building',      // purple apartment block
  'building-orange': 'building-orange',
  users: 'users',            // blue group
  'users-purple': 'users-purple',
  residents: 'residents',    // large blue/violet group
  person: 'person',          // green owner
  staff: 'staff',            // man in suit
  'user-add': 'user-add',
  // rooms
  bed: 'bed',                // blue bed
  'bed-teal': 'bed-teal',
  // money
  wallet: 'wallet',          // violet wallet (large)
  'wallet-sm': 'wallet-sm',
  'wallet-orange': 'wallet-orange',
  rupee: 'rupee',            // green ₹ coin
  'rupee-badge': 'rupee-badge',
  // ops
  wrench: 'wrench',          // blue wrench (large)
  'wrench-orange': 'wrench-orange',
  'wrench-green': 'wrench-green',
  tools: 'tools',            // crossed wrench + screwdriver
  'tools-purple': 'tools-purple',
  bell: 'bell',              // orange bell (large)
  'bell-orange': 'bell-orange',
  'bell-purple': 'bell-purple',
  'bell-green': 'bell-green',
  megaphone: 'megaphone',
  // docs & time
  doc: 'doc',                // blue document
  'doc-green': 'doc-green',
  report: 'report',          // violet report
  calendar: 'calendar',
  'calendar-clock': 'calendar-clock',
  clock: 'clock',
  // status & misc
  check: 'check',            // green check badge
  alert: 'alert',            // orange "!" badge
  chart: 'chart',            // violet bar chart
  grid: 'grid',              // violet 2×2 grid
  bolt: 'bolt',
  star: 'star',
} as const;

export type Icon3DName = keyof typeof ICON3D;

export function Icon3D({
  name,
  size = 32,
  className = '',
  alt = '',
}: {
  name: Icon3DName;
  size?: number;
  className?: string;
  alt?: string;
}) {
  return (
    // Plain <img>: these are tiny pre-optimised PNGs; next/image would add a
    // wrapper + optimiser round-trip for no gain.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/brand/icons/${ICON3D[name]}.png`}
      alt={alt}
      aria-hidden={alt ? undefined : true}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      draggable={false}
      className={`inline-block shrink-0 object-contain select-none drop-shadow-[0_4px_6px_rgba(70,40,160,0.18)] ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

export type Tint = 'violet' | 'indigo' | 'sky' | 'mint' | 'peach' | 'rose' | 'amber' | 'slate';

/**
 * Round pastel bubble holding a 3D icon (or any glyph) — the leading icon in
 * activity rows / list rows of the reference screens.
 */
export function IconBubble({
  icon,
  tint = 'violet',
  size = 44,
  className = '',
}: {
  icon: Icon3DName | React.ReactNode;
  tint?: Tint;
  size?: number;
  className?: string;
}) {
  return (
    <span className={`icon-bubble tint-${tint} ${className}`} style={{ width: size, height: size }}>
      {typeof icon === 'string' ? <Icon3D name={icon as Icon3DName} size={Math.round(size * 0.6)} /> : icon}
    </span>
  );
}

/**
 * Glossy 3D glyph tile — a violet (or tinted) gradient rounded square with a
 * white glyph, inner highlight and soft drop shadow (like the refs' FAB and
 * "Admin Panel" pill). Use when no 3D raster icon fits (e.g. settings, chat).
 */
export function GlyphTile({
  icon: Icon,
  size = 44,
  tone = 'brand',
  className = '',
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number; style?: React.CSSProperties }>;
  size?: number;
  tone?: 'brand' | 'sky' | 'mint' | 'peach' | 'rose';
  className?: string;
}) {
  const grads: Record<string, string> = {
    brand: 'linear-gradient(145deg, #A877FF 0%, #7B3FF2 52%, #5B1FE0 100%)',
    sky: 'linear-gradient(145deg, #7FA6FF 0%, #4C7DF7 52%, #2F5BE0 100%)',
    mint: 'linear-gradient(145deg, #5FD8A6 0%, #22B07A 52%, #128A5B 100%)',
    peach: 'linear-gradient(145deg, #FFB070 0%, #F7862E 52%, #DB6612 100%)',
    rose: 'linear-gradient(145deg, #FF8FA3 0%, #EE5873 52%, #D23557 100%)',
  };
  const glyph = Math.round(size * 0.48);
  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden text-white ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.32),
        background: grads[tone],
        boxShadow:
          '0 1px 0 0 rgba(255,255,255,0.45) inset, 0 -3px 6px 0 rgba(40,10,120,0.25) inset, 0 10px 18px -8px rgba(91,31,224,0.55)',
      }}
      aria-hidden="true"
    >
      <span
        className="pointer-events-none absolute inset-x-0 top-0 h-1/2"
        style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.35), rgba(255,255,255,0))' }}
      />
      <Icon className="relative drop-shadow-[0_2px_2px_rgba(40,10,120,0.35)]" strokeWidth={2.4} style={{ width: glyph, height: glyph }} />
    </span>
  );
}

/**
 * Pastel rounded tile carrying a 3D icon — the header icon of internal pages
 * and the leading visual of feature cards.
 */
export function IconTile({
  icon,
  tint = 'violet',
  size = 52,
  className = '',
}: {
  icon: Icon3DName;
  tint?: Tint;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={`tint-card tint-${tint} inline-flex shrink-0 items-center justify-center ${className}`}
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.32) }}
    >
      <Icon3D name={icon} size={Math.round(size * 0.66)} />
    </span>
  );
}
