'use client';

import React from 'react';
import { useOwnerSession } from '@/hooks/useOwner';
import { Building2, ChevronDown } from 'lucide-react';

/**
 * Compact property selector. Renders only when the owner has more than one
 * property (single-PG owners see nothing — fully backward compatible).
 */
export function PropertySwitcher({ compact = false }: { compact?: boolean }) {
  const { properties, selectedPropertyId, setSelectedPropertyId } = useOwnerSession();

  if (properties.length <= 1) return null;

  return (
    <div className={`relative ${compact ? '' : 'w-full'}`}>
      <Building2 className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8] pointer-events-none" />
      <select
        aria-label="Select property"
        value={selectedPropertyId}
        onChange={(e) => setSelectedPropertyId(e.target.value)}
        className={`appearance-none ${compact ? 'h-9 pl-7 pr-7 text-xs max-w-[150px]' : 'h-11 w-full pl-8 pr-8 text-sm'} rounded-[8px] border border-[#CBD5E1] bg-white font-semibold text-[#09090B] focus:border-[#D97706] focus:outline-none truncate`}
      >
        {properties.map((p) => (
          <option key={p.id} value={p.id}>
            {p.pgName}
            {p.isPrimary ? ' (Main)' : ''}
          </option>
        ))}
      </select>
      <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8] pointer-events-none" />
    </div>
  );
}
