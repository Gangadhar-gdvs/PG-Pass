'use client';

import React from 'react';
import { useOwnerSession } from '@/hooks/useOwner';
import { Dropdown } from '@/components/ui/dropdown';

/**
 * Compact property selector. Renders only when the owner has more than one
 * property (single-PG owners see nothing — fully backward compatible). Uses the
 * themed custom Dropdown so the open list follows the app theme (not the native
 * OS menu).
 */
export function PropertySwitcher({ compact = false }: { compact?: boolean }) {
  const { properties, selectedPropertyId, setSelectedPropertyId } = useOwnerSession();

  if (properties.length <= 1) return null;

  return (
    <Dropdown
      aria-label="Select property"
      value={selectedPropertyId}
      onChange={setSelectedPropertyId}
      containerClassName={compact ? 'w-auto min-w-[150px]' : 'w-full'}
      className={compact ? 'h-9 text-xs font-semibold' : 'h-11 text-sm font-semibold'}
      options={properties.map((p) => ({
        value: p.id,
        label: `${p.pgName}${p.isPrimary ? ' (Main)' : ''}`,
      }))}
    />
  );
}
