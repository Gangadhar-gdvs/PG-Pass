'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutGrid, Plus, X } from 'lucide-react';
import { IconTile, type Icon3DName, type Tint } from '@/components/brand/Icon3D';

export interface TabItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number; fill?: string; fillOpacity?: number }>;
  /** 3D icon used for this destination inside the More / quick sheets. */
  icon3d?: Icon3DName;
  tint?: Tint;
  /** Short helper line in sheets. */
  description?: string;
}

export interface CenterAction {
  label: string;
  icon?: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  /** Either run a callback… */
  onClick?: () => void;
  /** …or open a quick-actions sheet with these destinations. */
  items?: TabItem[];
}

/**
 * Bottom navigation from the reference screens: a frosted white bar with
 * rounded top, icon + label tabs (active = violet with an underline marker),
 * and a raised violet gradient FAB in the middle wrapped in a white halo.
 * Overflow destinations live in a "More" sheet of 3D tiles.
 */
export function BottomTabBar({
  primary,
  more = [],
  center,
  footer,
}: {
  primary: TabItem[];
  more?: TabItem[];
  center?: CenterAction;
  footer?: React.ReactNode;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  // Optimistic navigation feedback: the tapped tab lights up IMMEDIATELY (before
  // the route commits) so on a slow network the user sees the tap registered.
  // We remember the pathname AT TAP TIME; the optimistic highlight is cleared as
  // soon as the pathname CHANGES at all — whether the route landed on the tapped
  // tab, a different tab (rapid re-tap), or a redirect. Clearing only on an exact
  // match used to leave the highlight STUCK on the wrong tab after a rapid
  // double-tap or a redirect, so the bar showed a tab you weren't actually on.
  const matchesPath = (href: string) => pathname === href || pathname.startsWith(href + '/');
  const [pending, setPending] = useState<{ href: string; from: string } | null>(null);
  if (pending && (pathname !== pending.from || matchesPath(pending.href))) {
    // Navigation resolved (pathname moved) OR we're already on the target.
    setPending(null);
  }
  const pendingHref = pending?.href ?? null;
  const startPending = (href: string) => setPending({ href, from: pathname });
  const isActive = (href: string) => (pendingHref ? pendingHref === href : matchesPath(href));

  // Safety net: if a navigation never resolves (a redirect back to the same
  // route, a cancelled/failed nav), the render-time clear above never fires and
  // the optimistic highlight would stick forever. Clear it after a short window
  // so the bar always falls back to the real `pathname`.
  useEffect(() => {
    if (!pending) return;
    const id = setTimeout(() => setPending(null), 2500);
    return () => clearTimeout(id);
  }, [pending]);

  const primaryActive = primary.some((p) => isActive(p.href));
  const moreActive = !primaryActive && more.some((m) => isActive(m.href));

  const tabShell = (active: boolean, label: string, children: React.ReactNode) => (
    <span className="relative flex min-w-[56px] flex-col items-center justify-center gap-1 pt-1 pb-2">
      <span className={active ? 'text-brand' : 'text-faint'}>{children}</span>
      <span className={`text-[11px] leading-none ${active ? 'font-bold text-brand-700' : 'font-semibold text-muted'}`}>
        {label}
      </span>
      <span
        aria-hidden
        className={`absolute -bottom-0.5 h-[3px] rounded-full bg-[image:var(--grad-brand)] transition-all duration-300 ${
          active ? 'w-9 opacity-100' : 'w-0 opacity-0'
        }`}
      />
    </span>
  );

  const renderTab = (item: TabItem) => {
    const Icon = item.icon;
    const active = isActive(item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => startPending(item.href)}
        aria-current={active ? 'page' : undefined}
        className="flex flex-1 justify-center press"
      >
        {tabShell(
          active,
          item.label,
          <Icon
            className="h-6 w-6"
            strokeWidth={active ? 2.3 : 2}
            fill={active ? 'currentColor' : 'none'}
            fillOpacity={active ? 0.16 : 0}
          />
        )}
      </Link>
    );
  };

  const leftCount = center ? Math.ceil(Math.min(primary.length, 4) / 2) : 0;
  const leftTabs = center ? primary.slice(0, leftCount) : primary.slice(0, 4);
  const rightTabs = center ? primary.slice(leftCount, 4) : [];

  const onCenter = () => {
    if (!center) return;
    if (center.onClick) center.onClick();
    else if (center.items?.length) setQuickOpen(true);
  };
  const CenterIcon = center?.icon || Plus;

  const sheetGrid = (items: TabItem[], onPick: () => void) => (
    <div className="grid grid-cols-3 gap-2.5">
      {items.map((item) => {
        const Icon = item.icon;
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => {
              startPending(item.href);
              onPick();
            }}
            className={`tint-card tint-${item.tint || 'violet'} flex flex-col items-center justify-center gap-2 px-1.5 py-3.5 text-center press ${
              active ? 'ring-2 ring-brand/60' : ''
            }`}
          >
            {item.icon3d ? (
              <IconTile icon={item.icon3d} tint={item.tint || 'violet'} size={44} className="!bg-white/70 !shadow-none" />
            ) : (
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/70 text-brand">
                <Icon className="h-6 w-6" />
              </span>
            )}
            <span className="text-[12px] font-bold leading-tight text-ink">{item.label}</span>
          </Link>
        );
      })}
    </div>
  );

  const sheet = (title: string, onClose: () => void, children: React.ReactNode) => (
    <div className="md:hidden fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-[#1A1458]/35 backdrop-blur-[3px] animate-fade" onClick={onClose} />
      <div
        className="absolute inset-x-0 bottom-0 overflow-hidden rounded-t-[30px] border border-white bg-[linear-gradient(180deg,#F9F6FF_0%,#F0EAFF_100%)] px-4 pt-2.5 shadow-[0_-20px_60px_-20px_rgba(40,20,120,0.5)] animate-sheet"
        style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom))' }}
      >
        <div aria-hidden className="pointer-events-none absolute -top-16 -right-10 h-44 w-44 rounded-full bg-[#C9B0FF]/40 blur-3xl" />
        <div className="relative flex justify-center pb-2">
          <span className="h-1.5 w-11 rounded-full bg-[#D5CBF5]" />
        </div>
        <div className="relative mb-4 flex items-center justify-between">
          <span className="text-[17px] font-extrabold tracking-[-0.015em] text-ink">{title}</span>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-full bg-white text-ink-2 shadow-[0_6px_14px_-8px_rgba(70,40,160,0.4)] press"
            aria-label="Close menu"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>
        <div className="relative">{children}</div>
      </div>
    </div>
  );

  return (
    <>
      <nav className="md:hidden fixed inset-x-0 bottom-0 z-40" aria-label="Primary">
        {/* Solid bar that fills to the very bottom edge (incl. the home-indicator
            safe area) — no translucent gap below it. The centre action sits
            INSIDE the bar (no overflowing halo). */}
        <div
          className="relative flex items-center justify-around rounded-t-[26px] border-t border-[#EEE8FD] bg-white px-1.5 pt-2 shadow-[0_-10px_30px_-14px_rgba(70,40,160,0.30)]"
          style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
        >
          {leftTabs.map(renderTab)}

          {center && (
            <div className="flex flex-1 justify-center">
              <button
                type="button"
                onClick={onCenter}
                aria-label={center.label}
                className="relative grid h-14 w-14 place-items-center rounded-full bg-[image:var(--grad-brand)] text-white shadow-[0_10px_20px_-8px_rgba(106,43,234,0.65),inset_0_1px_0_rgba(255,255,255,0.35)] ring-4 ring-brand-50 press"
              >
                <span aria-hidden className="absolute inset-x-3 top-1 h-1/3 rounded-full bg-white/25 blur-[2px]" />
                <CenterIcon className="relative h-6 w-6" strokeWidth={2.6} />
              </button>
            </div>
          )}

          {rightTabs.map(renderTab)}

          {more.length > 0 && (
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="More"
              aria-expanded={menuOpen}
              className="flex flex-1 justify-center press"
            >
              {tabShell(
                moreActive,
                'More',
                <LayoutGrid
                  className="h-6 w-6"
                  strokeWidth={moreActive ? 2.3 : 2}
                  fill={moreActive ? 'currentColor' : 'none'}
                  fillOpacity={moreActive ? 0.16 : 0}
                />
              )}
            </button>
          )}
        </div>
      </nav>

      {menuOpen &&
        sheet(
          'Menu',
          () => setMenuOpen(false),
          <>
            {sheetGrid(more, () => setMenuOpen(false))}
            {footer && <div className="mt-4 border-t border-white/80 pt-4">{footer}</div>}
          </>
        )}

      {quickOpen &&
        center?.items &&
        sheet(center.label, () => setQuickOpen(false), sheetGrid(center.items, () => setQuickOpen(false)))}
    </>
  );
}
