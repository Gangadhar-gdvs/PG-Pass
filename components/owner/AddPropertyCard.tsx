'use client';

import React, { useState } from 'react';
import { useOwnerSession } from '@/hooks/useOwner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Building2, Plus } from 'lucide-react';
import toast from 'react-hot-toast';

/**
 * Lets an owner add an additional property. Once created, it appears in the
 * property switcher; the owner selects it and sets up its beds via the usual
 * flow. Lives on the Settings page.
 */
export function AddPropertyCard() {
  const { properties, reloadProperties, setSelectedPropertyId } = useOwnerSession();
  const [open, setOpen] = useState(false);
  const [pgName, setPgName] = useState('');
  const [pgAddress, setPgAddress] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (pgName.trim().length < 2) {
      toast.error('Enter a property name');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/properties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pgName: pgName.trim(), pgAddress: pgAddress.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Could not add property');
      toast.success('Property added');
      setPgName('');
      setPgAddress('');
      setOpen(false);
      await reloadProperties();
      if (data.property?.id) setSelectedPropertyId(data.property.id);
    } catch (err: any) {
      toast.error(err.message || 'Could not add property');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-[12px] p-4 sm:p-6 shadow-xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-[#D97706]" />
          <h2 className="text-sm font-bold text-[#09090B]">
            Properties <span className="text-[#64748B] font-normal">· {properties.length}</span>
          </h2>
        </div>
        {!open && (
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Add Property
          </Button>
        )}
      </div>

      {properties.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {properties.map((p) => (
            <li key={p.id} className="text-xs text-[#334155] flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#D97706]" />
              {p.pgName}
              {p.isPrimary ? <span className="text-[#94A3B8]">(Main)</span> : null}
            </li>
          ))}
        </ul>
      )}

      {open && (
        <form onSubmit={submit} className="mt-4 space-y-3">
          <Input label="Property / PG Name" value={pgName} onChange={(e) => setPgName(e.target.value)} required disabled={saving} />
          <Input label="Address (optional)" value={pgAddress} onChange={(e) => setPgAddress(e.target.value)} disabled={saving} />
          <div className="flex items-center gap-2">
            <Button type="submit" size="sm" variant="solid" loading={saving} className="flex-1">
              Create Property
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
          </div>
          <p className="text-[11px] text-[#64748B]">
            After creating, switch to the new property (top-left) and set up its beds from the dashboard.
          </p>
        </form>
      )}
    </div>
  );
}
