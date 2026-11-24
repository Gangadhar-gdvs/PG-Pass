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
 * Floating bottom tab bar (bold mobile-app style). Shows a few ESSENTIAL tabs
 * plus a prominent center action and a "More" button that opens a full-menu
 * sheet with every destination. Used on mobile/tablet across all panels; the
 * theme accent is inherited from the panel's `theme-*` class.
 *
 * - `primary`: the 2–4 essential tabs shown directly in the bar.
 * - `center`: optional prominent "+" action (e.g. Add Tenant / Find PG).
 * - `more`: everything else, revealed in the full-menu sheet.
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

  const Tab = ({ item }: { item: TabItem }) => {
    const Icon = item.icon;
    const active = isActive(item.href);
    return (
      <Link
        href={item.href}
        className="flex flex-col items-center justify-center gap-0.5 min-w-[56px] min-h-[48px] press"
        style={active ? { color: 'var(--accent)' } : { color: '#94A3B8' }}
      >
        <Icon className="w-[22px] h-[22px]" />
        <span className="text-[10px] font-semibold">{item.label}</span>
      </Link>
    );
  };

  return (
    <>
      {/* Floating bar */}
      <nav
        className="md:hidden fixed inset-x-0 bottom-0 z-40 flex justify-center pointer-events-none"
        style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))' }}
      >
        <div className="pointer-events-auto mx-3 mb-1 w-full max-w-md flex items-center justify-around bg-white rounded-[22px] px-2 py-1.5 border border-slate-100 shadow-[0_10px_40px_-10px_rgba(15,23,42,0.25)]">
          {primary.slice(0, 2).map((t) => (
            <Tab key={t.href} item={t} />
          ))}

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

          {primary.slice(2, 4).map((t) => (
            <Tab key={t.href} item={t} />
          ))}

          {more.length > 0 && (
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="More"
              className="flex flex-col items-center justify-center gap-0.5 min-w-[56px] min-h-[48px] text-slate-400 press"
            >
              <Menu className="w-[22px] h-[22px]" />
              <span className="text-[10px] font-semibold">More</span>
            </button>
          )}
        </div>
      </nav>

      {/* Full-menu sheet */}
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
              {[...primary, ...more].map((item) => {
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
