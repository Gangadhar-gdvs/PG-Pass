'use client';

import * as React from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

/**
 * Shared "premium mobile-app" dashboard building blocks used across the owner,
 * resident and admin panels so every dashboard matches the same design language:
 * gradient hero, pastel stat tiles, donut chart, quick-action grid, activity feed.
 * Colors come from the panel's theme (`var(--accent)`) + the pastel tint tokens.
 */

type Tint = 'violet' | 'mint' | 'peach' | 'sky' | 'rose' | 'amber';

/* ---------------- Hero header (greeting band) ---------------- */

export function HeroHeader({
  eyebrow,
  title,
  subtitle,
  right,
  children,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="hero-gradient relative overflow-hidden px-5 pt-5 pb-6">
      {/* soft decorative glow blobs */}
      <div className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-white/15 blur-2xl" />
      <div className="pointer-events-none absolute -left-10 bottom-0 h-24 w-24 rounded-full bg-white/10 blur-2xl" />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          {eyebrow && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider backdrop-blur-sm">
              {eyebrow}
            </span>
          )}
          <h1 className="mt-2 text-2xl font-extrabold leading-tight tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1 text-sm font-medium text-white/85">{subtitle}</p>}
        </div>
        {right && <div className="shrink-0">{right}</div>}
      </div>
      {children && <div className="relative mt-4">{children}</div>}
    </div>
  );
}

/* ---------------- Stat tile (pastel) ---------------- */

export function StatTile({
  icon,
  label,
  value,
  tint = 'violet',
  delta,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  tint?: Tint;
  delta?: string;
}) {
  return (
    <div className={`tint-card tint-${tint} p-3.5`}>
      <div className="flex items-center justify-between">
        <span className="icon-chip" style={{ color: 'inherit' }}>
          {icon}
        </span>
        {delta && <span className="text-[11px] font-bold opacity-80">{delta}</span>}
      </div>
      <div className="mt-2.5 text-xl font-extrabold font-mono-numbers tracking-tight">{value}</div>
      <div className="text-[11px] font-semibold opacity-75">{label}</div>
    </div>
  );
}

/* ---------------- Quick-action grid ---------------- */

export interface QuickAction {
  label: string;
  icon: React.ReactNode;
  tint?: Tint;
  href?: string;
  onClick?: () => void;
}

export function QuickActionGrid({ actions, title = 'Quick Actions' }: { actions: QuickAction[]; title?: string }) {
  return (
    <section className="app-card p-4">
      <h2 className="mb-3 text-sm font-bold text-[#0F172A]">{title}</h2>
      <div className="grid grid-cols-3 gap-2.5">
        {actions.map((a) => {
          const inner = (
            <div className={`tint-card tint-${a.tint || 'violet'} flex h-full flex-col items-center gap-2 px-2 py-3.5 text-center press`}>
              <span className="icon-chip">{a.icon}</span>
              <span className="text-[11px] font-bold leading-tight">{a.label}</span>
            </div>
          );
          if (a.href) {
            return (
              <Link key={a.label} href={a.href} className="block">
                {inner}
              </Link>
            );
          }
          return (
            <button key={a.label} type="button" onClick={a.onClick} className="block text-left">
              {inner}
            </button>
          );
        })}
      </div>
    </section>
  );
}

/* ---------------- Donut / ring chart ---------------- */

export function DonutChart({
  percent,
  size = 132,
  stroke = 14,
  label,
  sublabel,
}: {
  percent: number; // 0–100
  size?: number;
  stroke?: number;
  label?: React.ReactNode;
  sublabel?: React.ReactNode;
}) {
  const pct = Math.max(0, Math.min(100, percent));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--accent-soft)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={stroke}
          strokeDasharray={`${dash} ${c - dash}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.6s cubic-bezier(0.22,1,0.36,1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-extrabold font-mono-numbers text-[#0F172A]">{label ?? `${pct}%`}</span>
        {sublabel && <span className="text-[11px] font-semibold text-[#64748B]">{sublabel}</span>}
      </div>
    </div>
  );
}

/* ---------------- Section header with "See all" ---------------- */

export function SectionHeader({ title, href, onSeeAll }: { title: string; href?: string; onSeeAll?: () => void }) {
  const seeAll = (
    <span className="inline-flex items-center gap-0.5 text-xs font-bold accent-text">
      See all <ChevronRight className="h-3.5 w-3.5" />
    </span>
  );
  return (
    <div className="mb-2.5 flex items-center justify-between">
      <h2 className="text-sm font-bold text-[#0F172A]">{title}</h2>
      {href ? (
        <Link href={href}>{seeAll}</Link>
      ) : onSeeAll ? (
        <button type="button" onClick={onSeeAll}>
          {seeAll}
        </button>
      ) : null}
    </div>
  );
}

/* ---------------- Activity row ---------------- */

export function ActivityRow({
  icon,
  tint = 'violet',
  title,
  subtitle,
  trailing,
}: {
  icon: React.ReactNode;
  tint?: Tint;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <span className={`icon-chip tint-${tint}`} style={{ background: 'var(--tint)', color: 'var(--tint-ink)' }}>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-[#0F172A]">{title}</div>
        {subtitle && <div className="truncate text-[11px] text-[#64748B]">{subtitle}</div>}
      </div>
      {trailing && <div className="shrink-0 text-right">{trailing}</div>}
    </div>
  );
}
