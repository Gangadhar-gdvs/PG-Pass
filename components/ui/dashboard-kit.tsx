'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowRight, ChevronRight } from 'lucide-react';
import { Icon3D, IconBubble, IconTile, type Icon3DName, type Tint } from '@/components/brand/Icon3D';
import { Illustration, type IllustrationName } from '@/components/brand/Illustration';

/**
 * PGPass page kit — the building blocks of the reference screens, shared by
 * the Admin, Owner and Resident panels so every page speaks one language:
 *
 *   HeroHeader      greeting band (gradient card, or light with gradient name)
 *   PageHeader      internal page title row (3D icon tile + title + actions)
 *   StatTile        pastel tile: 3D icon, big number, label, arrow
 *   QuickActionGrid tinted action tiles (grid or list layout)
 *   SectionCard     glass card with a SectionHeader (3D icon + title + View All)
 *   ActivityRow     icon bubble + title/subtitle + trailing meta
 *   DonutChart      gradient ring with centred value
 *   InfoBanner      tinted status banner (success / warning / danger / info / brand)
 *   FilterChips     pill toggles for filters
 *   KeyValue        label/value row for detail sheets
 *   ArrowDot        the small lavender circle with a violet arrow
 */

export type { Tint };

const isIconName = (v: unknown): v is Icon3DName => typeof v === 'string';

function renderIcon(icon: Icon3DName | React.ReactNode, size: number) {
  return isIconName(icon) ? <Icon3D name={icon} size={size} /> : icon;
}

/* ---------------- Small arrow circle (→) ---------------- */

export function ArrowDot({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/80 text-brand shadow-[0_4px_10px_-6px_rgba(70,40,160,0.5)] ${className}`}
      aria-hidden="true"
    >
      <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.6} />
    </span>
  );
}

/* ---------------- Hero header (greeting band) ---------------- */

export function HeroHeader({
  eyebrow,
  title,
  highlight,
  subtitle,
  right,
  children,
  illustration,
  variant = 'gradient',
  meta,
  actionsClassName = '',
}: {
  /** Small pill above the title (e.g. "Admin Panel", "Owner"). */
  eyebrow?: React.ReactNode;
  /** First line (e.g. "Welcome back,"). */
  title: React.ReactNode;
  /** Emphasised name line (gradient on light, white on gradient). */
  highlight?: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Top-right slot (e.g. a pill action). */
  right?: React.ReactNode;
  /** Row of actions under the text. */
  children?: React.ReactNode;
  illustration?: IllustrationName;
  /** gradient = violet card with white text (owner); light = on-canvas (admin/resident). */
  variant?: 'gradient' | 'light';
  /** Extra line under subtitle (e.g. location chip). */
  meta?: React.ReactNode;
  /** Extra classes for the actions row (e.g. "hidden sm:flex" when the same
   *  actions are also offered as Quick Actions on phones). */
  actionsClassName?: string;
}) {
  if (variant === 'light') {
    return (
      <section className="relative overflow-hidden">
        <div className="relative z-10 flex items-start justify-between gap-3">
          <div className="min-w-0 max-w-[62%] sm:max-w-[58%] pt-1">
            {eyebrow && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[image:var(--grad-brand)] px-3.5 py-1.5 text-[13px] font-bold text-white shadow-[var(--shadow-brand)] [&>svg]:h-4 [&>svg]:w-4">
                {eyebrow}
              </span>
            )}
            <h1 className="mt-3 text-[26px] sm:text-[34px] font-extrabold leading-[1.08] tracking-[-0.03em] text-ink">
              {title}
              {highlight && (
                <>
                  <br />
                  <span className="text-gradient">{highlight}</span>
                </>
              )}
            </h1>
            {subtitle && <p className="mt-2 text-sm sm:text-[15px] font-medium text-ink-2">{subtitle}</p>}
            <span aria-hidden className="mt-2 block h-[3px] w-40 max-w-full rounded-full bg-[linear-gradient(90deg,#8B5CF6,rgba(139,92,246,0))]" />
            {meta && <div className="mt-3">{meta}</div>}
          </div>
          {right && <div className="relative z-10 shrink-0">{right}</div>}
        </div>
        {illustration && (
          <div className="pointer-events-none absolute -right-3 sm:right-0 top-0 sm:-top-2 w-[52%] sm:w-[44%] max-w-[420px]">
            <Illustration name={illustration} width={420} priority float />
          </div>
        )}
        {children && <div className={`relative z-10 mt-5 flex flex-wrap items-center gap-2 ${actionsClassName}`}>{children}</div>}
      </section>
    );
  }

  return (
    <section className="hero-gradient relative overflow-hidden px-5 pt-5 pb-5 sm:px-6 sm:pt-6">
      {/* soft light blooms */}
      <div aria-hidden className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-white/25 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -left-12 bottom-[-40px] h-32 w-32 rounded-full bg-[#C9B0FF]/30 blur-2xl" />
      {illustration && (
        <div className="pointer-events-none absolute right-0 bottom-0 w-[50%] sm:w-[42%] max-w-[360px]">
          <Illustration name={illustration} width={360} priority />
        </div>
      )}
      <div className="relative z-10 flex items-start justify-between gap-3">
        <div className="min-w-0 max-w-[60%] sm:max-w-[58%]">
          <p className="text-[15px] sm:text-base font-semibold text-white/90">{title}</p>
          {highlight && (
            <h1 className="mt-0.5 text-[24px] sm:text-[30px] font-extrabold leading-[1.1] tracking-[-0.025em] text-white">
              {highlight}
              {eyebrow && (
                <span className="ml-2 inline-flex translate-y-[-3px] items-center gap-1 rounded-full bg-white/20 px-2.5 py-1 align-middle text-xs font-bold text-white ring-1 ring-white/25 backdrop-blur-sm [&>svg]:h-3.5 [&>svg]:w-3.5">
                  {eyebrow}
                </span>
              )}
            </h1>
          )}
          {!highlight && eyebrow && (
            <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1 text-xs font-bold text-white ring-1 ring-white/25 [&>svg]:h-3.5 [&>svg]:w-3.5">
              {eyebrow}
            </span>
          )}
          {subtitle && <p className="mt-2 text-[13px] sm:text-sm font-medium text-white/80">{subtitle}</p>}
          {meta && <div className="mt-2">{meta}</div>}
        </div>
        {right && <div className="shrink-0">{right}</div>}
      </div>
      {children && (
        <div className={`relative z-10 mt-5 flex max-w-[60%] flex-wrap items-center gap-2 ${actionsClassName}`}>{children}</div>
      )}
    </section>
  );
}

/** White pill used for actions on top of the gradient hero. */
export function HeroAction({
  children,
  onClick,
  href,
  tone = 'white',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  href?: string;
  tone?: 'white' | 'glass';
}) {
  const cls =
    tone === 'white'
      ? 'bg-white text-brand-700 shadow-[0_10px_20px_-10px_rgba(30,10,90,0.5)]'
      : 'bg-white/18 text-white ring-1 ring-white/30 backdrop-blur-sm hover:bg-white/25';
  const inner = (
    <span className={`inline-flex h-11 items-center gap-1.5 rounded-full px-4 text-[13px] font-bold press [&>svg]:h-4 [&>svg]:w-4 ${cls}`}>
      {children}
    </span>
  );
  if (href) return <Link href={href}>{inner}</Link>;
  return (
    <button type="button" onClick={onClick} className="rounded-full">
      {inner}
    </button>
  );
}

/* ---------------- Internal page header ---------------- */

export function PageHeader({
  icon,
  tint = 'violet',
  title,
  highlight,
  subtitle,
  actions,
  className = '',
}: {
  /** 3D icon name (rendered in a pastel IconTile) or any node (e.g. a GlyphTile). */
  icon?: Icon3DName | React.ReactNode;
  tint?: Tint;
  title: React.ReactNode;
  /** Optional trailing gradient word(s) in the title. */
  highlight?: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={`flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between ${className}`}>
      <div className="flex items-center gap-3.5 min-w-0">
        {icon && (isIconName(icon) ? <IconTile icon={icon} tint={tint} size={54} /> : <span className="shrink-0">{icon}</span>)}
        <div className="min-w-0">
          <h1 className="text-[22px] sm:text-[26px] font-extrabold leading-tight tracking-[-0.025em] text-ink">
            {title}
            {highlight && <span className="text-gradient"> {highlight}</span>}
          </h1>
          {subtitle && <p className="mt-0.5 text-[13px] sm:text-sm text-muted font-medium">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 sm:justify-end">{actions}</div>}
    </header>
  );
}

/* ---------------- Stat tile (pastel, 3D icon) ---------------- */

export function StatTile({
  icon,
  label,
  value,
  tint = 'violet',
  delta,
  caption,
  href,
  onClick,
  align = 'center',
}: {
  icon: Icon3DName | React.ReactNode;
  label: string;
  value: React.ReactNode;
  tint?: Tint;
  delta?: string;
  /** Small secondary line under the label (e.g. "of 24 beds"). */
  caption?: React.ReactNode;
  href?: string;
  onClick?: () => void;
  /** center = refs' admin/owner tiles; left = compact horizontal. */
  align?: 'center' | 'left';
}) {
  const interactive = Boolean(href || onClick);
  const body =
    align === 'center' ? (
      <div className={`tint-card tint-${tint} flex h-full flex-col items-center justify-center gap-1.5 px-2.5 pt-3.5 pb-3 text-center ${interactive ? 'press lift' : ''}`}>
        <span className="grid h-11 place-items-center">{renderIcon(icon, 40)}</span>
        <span className="mt-0.5 max-w-full break-words text-[17px] min-[380px]:text-[19px] sm:text-[22px] font-extrabold font-mono-numbers leading-tight tracking-[-0.02em] text-ink">
          {value}
        </span>
        <span className="flex items-center gap-1 text-[11.5px] sm:text-xs font-semibold leading-tight text-ink-2">
          <span className="line-clamp-2">{label}</span>
          {interactive && <ArrowDot className="h-5 w-5 [&>svg]:h-3 [&>svg]:w-3" />}
        </span>
        {caption && <span className="text-[11px] font-medium leading-tight text-ink-2/70">{caption}</span>}
        {delta && <span className="text-[11px] font-bold text-success-ink">{delta}</span>}
      </div>
    ) : (
      <div className={`tint-card tint-${tint} flex h-full items-center gap-3 p-3.5 ${interactive ? 'press lift' : ''}`}>
        <span className="icon-bubble bg-white/70" style={{ width: 46, height: 46, background: 'rgba(255,255,255,0.75)' }}>
          {renderIcon(icon, 30)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-xl font-extrabold font-mono-numbers leading-tight tracking-[-0.02em] text-ink truncate">{value}</div>
          <div className="text-xs font-semibold text-ink-2 truncate">{label}</div>
          {caption && <div className="text-[11px] font-medium text-ink-2/70 truncate">{caption}</div>}
        </div>
        {delta && <span className="text-[11px] font-bold text-success-ink">{delta}</span>}
        {interactive && <ArrowDot />}
      </div>
    );
  if (href) return <Link href={href} className="block h-full">{body}</Link>;
  if (onClick)
    return (
      <button type="button" onClick={onClick} className="block h-full w-full text-left">
        {body}
      </button>
    );
  return body;
}

/* ---------------- Section header + card ---------------- */

export function SectionHeader({
  title,
  icon,
  href,
  onSeeAll,
  actionLabel = 'View All',
  action,
  className = '',
}: {
  title: React.ReactNode;
  icon?: Icon3DName | React.ReactNode;
  href?: string;
  onSeeAll?: () => void;
  actionLabel?: string;
  /** Custom right-side node (e.g. a "This Month" chip). Overrides View All. */
  action?: React.ReactNode;
  className?: string;
}) {
  const seeAll = (
    <span className="inline-flex items-center gap-1 text-[13px] font-bold text-brand-700 hover:gap-1.5 transition-all">
      {actionLabel} <ArrowRight className="h-4 w-4" strokeWidth={2.4} />
    </span>
  );
  return (
    <div className={`mb-3 flex items-center justify-between gap-3 ${className}`}>
      <h2 className="flex min-w-0 items-center gap-2.5 text-[17px] font-bold tracking-[-0.015em] text-ink">
        {icon && <span className="grid shrink-0 place-items-center">{renderIcon(icon, 28)}</span>}
        <span className="truncate">{title}</span>
      </h2>
      {action ??
        (href ? (
          <Link href={href} className="shrink-0">{seeAll}</Link>
        ) : onSeeAll ? (
          <button type="button" onClick={onSeeAll} className="shrink-0">
            {seeAll}
          </button>
        ) : null)}
    </div>
  );
}

export function SectionCard({
  title,
  icon,
  href,
  onSeeAll,
  actionLabel,
  action,
  children,
  className = '',
  bodyClassName = '',
}: {
  title?: React.ReactNode;
  icon?: Icon3DName | React.ReactNode;
  href?: string;
  onSeeAll?: () => void;
  actionLabel?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={`app-card p-4 sm:p-5 ${className}`}>
      {title && (
        <SectionHeader title={title} icon={icon} href={href} onSeeAll={onSeeAll} actionLabel={actionLabel} action={action} />
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

/* ---------------- Quick actions ---------------- */

export interface QuickAction {
  label: string;
  /** 3D icon name (preferred) or any node. */
  icon: Icon3DName | React.ReactNode;
  tint?: Tint;
  href?: string;
  onClick?: () => void;
  /** Secondary line (list layout). */
  description?: string;
}

export function QuickActionGrid({
  actions,
  title = 'Quick Actions',
  icon = 'bolt',
  layout = 'grid',
  columns,
  href,
  onSeeAll,
  bare = false,
}: {
  actions: QuickAction[];
  title?: string;
  icon?: Icon3DName | React.ReactNode;
  /** grid = icon over label tiles (admin/owner); list = icon + text + arrow (resident). */
  layout?: 'grid' | 'list';
  columns?: 2 | 3 | 4 | 5;
  href?: string;
  onSeeAll?: () => void;
  /** Render without the surrounding section card. */
  bare?: boolean;
}) {
  const colMap = { 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-2 sm:grid-cols-4', 5: 'grid-cols-3 sm:grid-cols-5' } as const;
  const cols = columns ?? (layout === 'list' ? 2 : actions.length >= 5 ? 5 : 3);
  const grid = (
    <div className={`grid ${layout === 'list' ? 'grid-cols-1 min-[380px]:grid-cols-2' : colMap[cols as 2 | 3 | 4 | 5]} gap-2.5 sm:gap-3`}>
      {actions.map((a) => {
        const inner =
          layout === 'list' ? (
            <div className={`tint-card tint-${a.tint || 'violet'} flex h-full items-center gap-3 px-3.5 py-3.5 text-left press lift`}>
              <span className="grid shrink-0 place-items-center">{renderIcon(a.icon, 46)}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-bold leading-tight text-ink">{a.label}</span>
                {a.description && <span className="mt-0.5 block text-xs font-medium text-ink-2/75">{a.description}</span>}
              </span>
              <ArrowDot />
            </div>
          ) : (
            <div className={`tint-card tint-${a.tint || 'violet'} flex h-full flex-col items-center justify-center gap-2 px-1.5 py-3.5 text-center press lift`}>
              <span className="grid h-10 place-items-center">{renderIcon(a.icon, 38)}</span>
              <span className="text-[12px] sm:text-[13px] font-bold leading-tight text-ink">{a.label}</span>
            </div>
          );
        if (a.href) {
          return (
            <Link key={a.label} href={a.href} className="block h-full">
              {inner}
            </Link>
          );
        }
        return (
          <button key={a.label} type="button" onClick={a.onClick} className="block h-full w-full text-left">
            {inner}
          </button>
        );
      })}
    </div>
  );
  if (bare) return grid;
  return (
    <SectionCard title={title} icon={icon} href={href} onSeeAll={onSeeAll}>
      {grid}
    </SectionCard>
  );
}

/* ---------------- Donut / ring chart ---------------- */

export function DonutChart({
  percent,
  size = 140,
  stroke = 16,
  label,
  sublabel,
}: {
  percent: number; // 0–100
  size?: number;
  stroke?: number;
  label?: React.ReactNode;
  sublabel?: React.ReactNode;
}) {
  const id = React.useId().replace(/:/g, '');
  const pct = Math.max(0, Math.min(100, percent));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90 drop-shadow-[0_8px_14px_rgba(106,43,234,0.28)]">
        <defs>
          <linearGradient id={`${id}-g`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#A066FF" />
            <stop offset="0.55" stopColor="#7B3FF2" />
            <stop offset="1" stopColor="#5B1FE0" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E9E0FD" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${id}-g)`}
          strokeWidth={stroke}
          strokeDasharray={`${dash} ${c - dash}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.8s cubic-bezier(0.22,1,0.36,1)' }}
        />
      </svg>
      <div
        className="absolute rounded-full bg-[radial-gradient(circle_at_35%_30%,#FFFFFF,#F4EFFF)] shadow-[inset_0_2px_6px_rgba(70,40,160,0.10)]"
        style={{ inset: stroke + 4 }}
      />
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[26px] font-extrabold font-mono-numbers leading-none tracking-[-0.03em] text-ink">{label ?? `${pct}%`}</span>
        {sublabel && <span className="mt-1 text-xs font-semibold text-ink-2">{sublabel}</span>}
      </div>
    </div>
  );
}

/* ---------------- Activity / list row ---------------- */

export function ActivityRow({
  icon,
  tint = 'violet',
  title,
  subtitle,
  trailing,
  href,
  onClick,
  chevron,
}: {
  icon: Icon3DName | React.ReactNode;
  tint?: Tint;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  trailing?: React.ReactNode;
  href?: string;
  onClick?: () => void;
  chevron?: boolean;
}) {
  const showChevron = chevron ?? Boolean(href || onClick);
  const row = (
    <div className={`flex items-center gap-3 py-3 ${href || onClick ? 'press' : ''}`}>
      <IconBubble icon={isIconName(icon) ? icon : <span className="[&>svg]:h-5 [&>svg]:w-5">{icon}</span>} tint={tint} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14.5px] font-bold text-ink">{title}</div>
        {subtitle && <div className="truncate text-[12.5px] font-medium text-ink-2/75">{subtitle}</div>}
      </div>
      {trailing && <div className="shrink-0 text-right text-xs font-medium text-muted">{trailing}</div>}
      {showChevron && <ChevronRight className="h-4.5 w-4.5 shrink-0 text-ink-2/60" />}
    </div>
  );
  if (href) return <Link href={href} className="block">{row}</Link>;
  if (onClick)
    return (
      <button type="button" onClick={onClick} className="block w-full text-left">
        {row}
      </button>
    );
  return row;
}

/* ---------------- Info / status banner ---------------- */

const BANNER: Record<
  'success' | 'warning' | 'danger' | 'info' | 'brand',
  { bg: string; title: string; text: string; icon: Icon3DName }
> = {
  success: { bg: 'bg-[linear-gradient(110deg,#E8F7EF_0%,#D5EEE5_100%)]', title: 'text-success-ink', text: 'text-[#2F6B55]', icon: 'check' },
  warning: { bg: 'bg-[linear-gradient(110deg,#FFF5EE_0%,#FDE3D6_100%)]', title: 'text-warning-ink', text: 'text-[#8A4A22]', icon: 'alert' },
  danger: { bg: 'bg-[linear-gradient(110deg,#FFF3F5_0%,#FADCE2_100%)]', title: 'text-danger-ink', text: 'text-[#8E3346]', icon: 'alert' },
  info: { bg: 'bg-[linear-gradient(110deg,#F1F5FF_0%,#DCE5FD_100%)]', title: 'text-info-ink', text: 'text-[#34508F]', icon: 'doc' },
  brand: { bg: 'bg-[linear-gradient(110deg,#F7F2FF_0%,#E6DAFE_100%)]', title: 'text-brand-700', text: 'text-ink-2', icon: 'bell-purple' },
};

export function InfoBanner({
  tone = 'brand',
  title,
  description,
  icon,
  iconSize = 40,
  action,
  children,
  className = '',
}: {
  tone?: 'success' | 'warning' | 'danger' | 'info' | 'brand';
  title?: React.ReactNode;
  description?: React.ReactNode;
  icon?: Icon3DName | React.ReactNode;
  /** Size of the 3D icon in px (default 40). */
  iconSize?: number;
  action?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  const t = BANNER[tone];
  return (
    <div
      className={`relative overflow-hidden rounded-[22px] border border-white/90 ${t.bg} shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_12px_26px_-16px_rgba(70,40,160,0.35)] ${className}`}
    >
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className="grid shrink-0 place-items-center">{renderIcon(icon ?? t.icon, iconSize)}</span>
          <div className="min-w-0">
            {title && <div className={`text-[15px] font-extrabold leading-snug ${t.title}`}>{title}</div>}
            {description && <div className={`mt-0.5 text-[13px] font-medium leading-relaxed ${t.text}`}>{description}</div>}
          </div>
        </div>
        {action && <div className="shrink-0 sm:ml-2">{action}</div>}
      </div>
      {children && <div className="border-t border-white/70 bg-white/45">{children}</div>}
    </div>
  );
}

/* ---------------- Filter chips ---------------- */

export function FilterChips<T extends string>({
  options,
  value,
  onChange,
  className = '',
}: {
  options: { value: T; label: React.ReactNode; count?: number }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-2 overflow-x-auto no-scrollbar ${className}`}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            aria-pressed={active}
            className={`inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full px-4 text-[13px] font-bold transition-all press ${
              active
                ? 'bg-[image:var(--grad-brand)] text-white shadow-[0_8px_16px_-8px_rgba(106,43,234,0.6)]'
                : 'bg-white/75 text-ink-2 border border-white shadow-[0_4px_12px_-8px_rgba(70,40,160,0.35)] hover:text-brand-700'
            }`}
          >
            {o.label}
            {o.count !== undefined && (
              <span className={`rounded-full px-1.5 text-[10.5px] leading-4 ${active ? 'bg-white/25' : 'bg-brand-100 text-brand-700'}`}>
                {o.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ---------------- Key / value row ---------------- */

export function KeyValue({
  label,
  value,
  className = '',
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-center justify-between gap-3 py-2.5 ${className}`}>
      <span className="text-[13px] font-medium text-muted">{label}</span>
      <span className="text-[13.5px] font-bold text-ink text-right font-mono-numbers">{value}</span>
    </div>
  );
}
