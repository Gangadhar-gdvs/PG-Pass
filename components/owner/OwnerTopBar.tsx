'use client';

import React, { useState } from 'react';
import { useOwnerSession } from '@/hooks/useOwner';
import { Avatar } from '@/components/ui/avatar';
import { Drawer } from '@/components/ui/drawer';
import { PropertySwitcher } from '@/components/owner/PropertySwitcher';
import { ChevronDown, LogOut, Building } from 'lucide-react';

/**
 * Sticky mobile top bar for the owner console (modern app pattern):
 *   • left  — current PG name (tap opens the profile sheet when multi-property)
 *   • right — profile avatar button → opens a sheet with profile details,
 *             property switcher, and sign out.
 *
 * Desktop keeps the sidebar (this bar is `md:hidden`). Being sticky, it fixes
 * the header on scroll (issue #9) while giving direct profile access (issue #6)
 * and a cleaner home for the property switcher (issue #10).
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
      <header className="md:hidden sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-slate-100 px-4 h-14 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="flex items-center gap-2 min-w-0 text-left press"
          aria-label="Open profile and property menu"
        >
          <div className="w-8 h-8 rounded-[10px] accent-bg flex items-center justify-center shrink-0 shadow-sm">
            <Building className="w-4 h-4" />
          </div>
          <span className="flex items-center gap-1 min-w-0">
            <span className="font-extrabold text-sm tracking-tight truncate">{pgLabel}</span>
            {multiProperty && <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="shrink-0 rounded-full press"
          aria-label="Open profile"
        >
          <Avatar name={displayPhone} size="sm" />
        </button>
      </header>

      <Drawer isOpen={sheetOpen} onClose={() => setSheetOpen(false)} title="Profile" width="sm">
        <div className="space-y-5">
          {/* Profile identity */}
          <div className="flex items-center gap-3">
            <Avatar name={displayPhone} size="lg" />
            <div className="min-w-0">
              <span className="text-sm font-bold block truncate">
                {role === 'staff' ? 'Warden / Staff' : 'PG Owner'}
              </span>
              <span className="text-xs font-mono-numbers text-slate-500 block truncate">
                {displayPhone}
              </span>
            </div>
          </div>

          {/* Property switcher (only rendered by PropertySwitcher when >1 PG) */}
          {multiProperty && (
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Switch Property
              </span>
              <PropertySwitcher />
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              setSheetOpen(false);
              onSignOut();
            }}
            className="w-full flex items-center justify-center gap-1.5 py-3 rounded-[12px] border-2 border-slate-200 text-sm font-bold text-slate-500 hover:bg-[#FEF2F2] hover:text-[#EF4444] hover:border-[#FECACA] transition-colors press"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </Drawer>
    </>
  );
}
