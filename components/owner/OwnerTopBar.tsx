'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useOwnerSession } from '@/hooks/useOwner';
import { Avatar } from '@/components/ui/avatar';
import { Icon3D } from '@/components/brand/Icon3D';
import { Check, ChevronDown, Plus } from 'lucide-react';

/**
 * Home (dashboard) top bar — mobile only; other pages show their own sticky
 * PageHeader and desktop uses the sidebar.
 *   • left  — current PG with an inline dropdown to switch PGs
 *   • right — profile avatar → the owner's full profile page
 */
export function OwnerTopBar({
  avatarUrl = null,
  avatarName,
}: {
  avatarUrl?: string | null;
  avatarName?: string;
}) {
  const { properties, selectedPropertyId, setSelectedPropertyId, phoneNumber, role } = useOwnerSession();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = properties.find((p) => p.id === selectedPropertyId) ?? properties[0];
  const pgLabel = selected?.pgName || (role === 'staff' ? 'Staff Console' : 'My PG');
  const name = avatarName || phoneNumber || 'Owner';
  const isOwner = role !== 'staff';

  // Close the dropdown on outside tap / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <header
      className="md:hidden sticky top-0 z-30 flex items-center justify-between gap-3 rounded-b-[26px] border-b border-[#EEE8FD] bg-white px-4 shadow-[0_10px_30px_-14px_rgba(70,40,160,0.30)]"
      style={{ paddingTop: 'max(0.625rem, env(safe-area-inset-top))', paddingBottom: '0.625rem' }}
    >
      {/* PG switcher */}
      <div ref={rootRef} className="relative min-w-0">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={`Current PG: ${pgLabel}. Switch PG`}
          className="flex min-w-0 items-center gap-2.5 rounded-full bg-white/85 py-1.5 pl-1.5 pr-3 border border-white shadow-[0_8px_18px_-10px_rgba(70,40,160,0.45)] press"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[image:var(--grad-brand-soft)]">
            <Icon3D name="building" size={24} />
          </span>
          <span className="min-w-0 text-left">
            <span className="block text-[10.5px] font-bold uppercase tracking-[0.08em] text-brand-700/80 leading-none">
              {role === 'staff' ? 'Staff' : 'My PG'}
            </span>
            <span className="mt-0.5 block truncate text-[15px] font-extrabold leading-tight text-ink max-w-[44vw]">
              {pgLabel}
            </span>
          </span>
          <ChevronDown className={`h-4 w-4 shrink-0 text-brand transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {open && (
          <div
            role="listbox"
            aria-label="Switch PG"
            className="absolute left-0 top-[calc(100%+8px)] z-40 w-[min(80vw,300px)] rounded-2xl border border-white bg-white p-1.5 shadow-[0_22px_48px_-16px_rgba(70,40,160,0.45)] ring-1 ring-line animate-pop"
          >
            {properties.length === 0 && (
              <div className="px-3 py-2.5 text-[13px] font-medium text-muted">{pgLabel}</div>
            )}
            {properties.map((p) => {
              const active = p.id === selected?.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    setSelectedPropertyId(p.id);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-left transition-colors ${
                    active ? 'bg-brand-50' : 'hover:bg-lilac'
                  }`}
                >
                  <Icon3D name={active ? 'building' : 'house'} size={26} />
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-[14px] ${active ? 'font-extrabold text-brand-700' : 'font-bold text-ink'}`}>
                      {p.pgName}
                    </span>
                    {p.isPrimary && <span className="block text-[11.5px] font-medium text-muted">Main property</span>}
                  </span>
                  {active && (
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[image:var(--grad-brand)] text-white">
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                  )}
                </button>
              );
            })}
            {isOwner && (
              <Link
                href="/settings"
                onClick={() => setOpen(false)}
                className="mt-1 flex items-center gap-2 rounded-xl border-t border-line px-2.5 pt-3 pb-2 text-[13px] font-bold text-brand-700"
              >
                <Plus className="h-4 w-4" /> Add another PG
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Profile → full profile page */}
      <Link href="/profile" className="shrink-0 rounded-full press" aria-label="Open my profile">
        <Avatar name={name} src={avatarUrl} size="md" />
      </Link>
    </header>
  );
}
