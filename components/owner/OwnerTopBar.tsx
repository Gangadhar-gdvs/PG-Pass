'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useOwnerSession } from '@/hooks/useOwner';
import { Avatar } from '@/components/ui/avatar';
import { Drawer } from '@/components/ui/drawer';
import { PropertySwitcher } from '@/components/owner/PropertySwitcher';
import { Logo } from '@/components/brand/Logo';
import { Icon3D } from '@/components/brand/Icon3D';
import { Bell, ChevronDown, LogOut } from 'lucide-react';

/**
 * Sticky mobile top bar for the owner console (reference layout):
 *   • left  — PGPass logo
 *   • right — notices bell + profile avatar (opens the profile sheet with the
 *             current PG, property switcher and sign out).
 * Desktop keeps the sidebar (this bar is `md:hidden`).
 */
export function OwnerTopBar({ onSignOut }: { onSignOut: () => void }) {
  const { properties, selectedPropertyId, phoneNumber, role } = useOwnerSession();
  const [sheetOpen, setSheetOpen] = useState(false);

  const selected = properties.find((p) => p.id === selectedPropertyId);
  const pgLabel = selected?.pgName || (role === 'staff' ? 'Staff Console' : 'My PG');
  const displayPhone = phoneNumber || '+91 Owner';
  const multiProperty = properties.length > 1;

  return (
    <>
      <header
        className="md:hidden sticky top-0 z-30 glass-bar px-4 flex items-center justify-between gap-3"
        style={{ paddingTop: 'max(0.6rem, env(safe-area-inset-top))', paddingBottom: '0.6rem' }}
      >
        <Link href="/dashboard" className="flex items-center min-w-0 press" aria-label="PGPass home">
          <Logo size={36} />
        </Link>

        <div className="flex items-center gap-2.5 shrink-0">
          <Link
            href="/notices"
            className="relative grid h-11 w-11 place-items-center rounded-full bg-white/90 border border-white text-ink shadow-[0_8px_18px_-10px_rgba(70,40,160,0.45)] press"
            aria-label="Notices"
          >
            <Bell className="h-5 w-5" strokeWidth={2.1} />
          </Link>
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="flex items-center gap-1 rounded-full press"
            aria-label="Open profile and property menu"
          >
            <Avatar name={displayPhone} size="md" />
            <ChevronDown className="h-4 w-4 text-ink-2" />
          </button>
        </div>
      </header>

      <Drawer isOpen={sheetOpen} onClose={() => setSheetOpen(false)} title="Profile" width="sm">
        <div className="space-y-4">
          {/* Profile identity */}
          <div className="app-card flex items-center gap-3 p-4">
            <Avatar name={displayPhone} size="lg" />
            <div className="min-w-0">
              <span className="block truncate text-[15px] font-extrabold text-ink">
                {role === 'staff' ? 'Warden / Staff' : 'PG Owner'}
              </span>
              <span className="block truncate font-mono-numbers text-[13px] font-medium text-muted">
                {displayPhone}
              </span>
            </div>
          </div>

          {/* Current PG */}
          <div className="tint-card tint-violet flex items-center gap-3 p-4">
            <Icon3D name="building" size={36} />
            <div className="min-w-0">
              <span className="block text-xs font-semibold text-ink-2/75">Current PG</span>
              <span className="block truncate text-[15px] font-extrabold text-ink">{pgLabel}</span>
            </div>
          </div>

          {/* Property switcher (only rendered by PropertySwitcher when >1 PG) */}
          {multiProperty && (
            <div className="space-y-1.5">
              <span className="text-[13px] font-semibold text-ink-2">Switch Property</span>
              <PropertySwitcher />
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              setSheetOpen(false);
              onSignOut();
            }}
            className="flex w-full items-center justify-center gap-1.5 rounded-full border border-[#EEE8FD] bg-white py-3 text-sm font-bold text-ink-2 shadow-[0_6px_14px_-10px_rgba(70,40,160,0.4)] transition-colors hover:bg-danger-bg hover:text-danger-ink press"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </Drawer>
    </>
  );
}
