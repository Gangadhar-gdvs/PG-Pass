'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, Plus, X } from 'lucide-react';

export interface TabItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

export interface CenterAction {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  onClick: () => void;
}

/**
 * Bottom tab bar (bold mobile-app style), flush to the screen edge with a
 * rounded top. Shows a few ESSENTIAL tabs plus a "More" button that opens a
 * full-menu sheet. The theme accent is inherited from the panel's `theme-*`
 * class.
 *
 * - `primary`: the 2–4 essential tabs shown directly in the bar. The ACTIVE one
 *   renders as an icon-only circular accent pill (no label).
 * - `center`: optional prominent "+" action (e.g. resident "Find a PG").
 * - `more`: everything else, revealed in the full-menu sheet. The "More" button
 *   itself shows as active when the current route is one of these items.
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
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  // "More" is active when the current route lives in the more-menu AND no
  // primary tab already owns it (primary takes precedence, so a route can never
  // light up both a primary tab and the More button at once).
  const primaryActive = primary.some((p) => isActive(p.href));
  const moreActive = !primaryActive && more.some((m) => isActive(m.href));

  // Active tab = icon only, inside a filled circular accent pill (no text).
  // Inactive tabs = icon + small label in muted grey.
  const Tab = ({ item }: { item: TabItem }) => {
    const Icon = item.icon;
    const active = isActive(item.href);
    if (active) {
      return (
        <Link
          href={item.href}
          aria-current="page"
          aria-label={item.label}
          className="flex items-center justify-center min-w-[52px]"
        >
          <span className="accent-bg w-12 h-12 rounded-full flex items-center justify-center shadow-[0_6px_16px_-4px_rgba(15,23,42,0.35)] press">
            <Icon className="w-[22px] h-[22px]" />
          </span>
        </Link>
      );
    }
    return (
      <Link
        href={item.href}
        className="flex flex-col items-center justify-center gap-0.5 min-w-[52px] min-h-[48px] press text-slate-400"
      >
        <Icon className="w-[22px] h-[22px]" />
        <span className="text-[10px] font-semibold">{item.label}</span>
      </Link>
    );
  };

  return (
    <>
      {/* Bottom bar — flush to the edge, rounded top corners only */}
      <nav className="md:hidden fixed inset-x-0 bottom-0 z-40">
        <div
          className="flex items-center justify-around bg-white rounded-t-[24px] px-2 pt-2 border-t border-slate-100 shadow-[0_-8px_30px_-12px_rgba(15,23,42,0.18)]"
          style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))' }}
        >
          {/* With a center action, split the primary tabs EVENLY around it so the
              bar stays balanced regardless of tab count; otherwise render all
              four inline. */}
          {center
            ? primary.slice(0, Math.ceil(primary.length / 2)).map((t) => <Tab key={t.href} item={t} />)
            : primary.slice(0, 4).map((t) => <Tab key={t.href} item={t} />)}

          {center && (
            <button
              type="button"
              onClick={center.onClick}
              aria-label={center.label}
              className="accent-bg -mt-6 w-14 h-14 rounded-full flex items-center justify-center shadow-[0_8px_24px_-6px_rgba(15,23,42,0.4)] press"
            >
              {center.icon ? <center.icon className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
            </button>
          )}

          {center && primary.slice(Math.ceil(primary.length / 2)).map((t) => <Tab key={t.href} item={t} />)}

          {more.length > 0 && (
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="More"
              className={`flex flex-col items-center justify-center gap-0.5 min-w-[52px] min-h-[48px] press ${
                moreActive ? '' : 'text-slate-400'
              }`}
            >
              {moreActive ? (
                <span className="accent-bg w-12 h-12 rounded-full flex items-center justify-center shadow-[0_6px_16px_-4px_rgba(15,23,42,0.35)]">
                  <Menu className="w-[22px] h-[22px]" />
                </span>
              ) : (
                <>
                  <Menu className="w-[22px] h-[22px]" />
                  <span className="text-[10px] font-semibold">More</span>
                </>
              )}
            </button>
          )}
        </div>
      </nav>

      {/* Full-menu sheet — lists ONLY the overflow (more) items, never the ones
          already present in the primary bottom tabs. */}
      {menuOpen && (
        <div className="md:hidden fixed inset-0 z-50" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setMenuOpen(false)} />
          <div
            className="absolute inset-x-0 bottom-0 bg-white rounded-t-[24px] p-5 animate-pop"
            style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom))' }}
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-bold text-slate-900">Menu</span>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center press"
                aria-label="Close menu"
              >
                <X className="w-4 h-4 text-slate-600" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {more.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    className="flex flex-col items-center justify-center gap-2 py-4 rounded-[16px] press"
                    style={
                      active
                        ? { background: 'var(--accent-tint)', color: 'var(--accent)' }
                        : { background: '#F8FAFC', color: '#334155' }
                    }
                  >
                    <Icon className="w-6 h-6" />
                    <span className="text-[11px] font-semibold text-center leading-tight">{item.label}</span>
                  </Link>
                );
              })}
            </div>
            {footer && <div className="mt-4 pt-4 border-t border-slate-100">{footer}</div>}
          </div>
        </div>
      )}
    </>
  );
}
