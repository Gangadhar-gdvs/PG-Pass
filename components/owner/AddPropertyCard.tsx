'use client';

import React, { useState } from 'react';
import { useOwnerSession } from '@/hooks/useOwner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { IconBubble, IconTile } from '@/components/brand/Icon3D';
import { Building2, MapPin, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { errorMessage } from '@/lib/utils';
import { apiPost } from '@/lib/client/api';

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
      const data = await apiPost<{ property?: { id?: string } }>('/api/properties', {
        pgName: pgName.trim(),
        pgAddress: pgAddress.trim(),
      });
      toast.success('Property added');
      setPgName('');
      setPgAddress('');
      setOpen(false);
      await reloadProperties();
      if (data.property?.id) setSelectedPropertyId(data.property.id);
    } catch (err: unknown) {
      toast.error(errorMessage(err, 'Could not add property'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="app-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <IconTile icon="building" tint="violet" size={48} />
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-[17px] font-bold tracking-[-0.015em] text-ink">
              Properties
              <span className="chip font-mono-numbers">{properties.length}</span>
            </h2>
          </div>
        </div>
        {!open && (
          <Button variant="outline" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> Add Property
          </Button>
        )}
      </div>

      {properties.length > 0 && (
        <ul className="mt-3 divide-y divide-line stagger">
          {properties.map((p) => (
            <li key={p.id} className="flex items-center gap-3 py-2.5">
              <IconBubble icon={p.isPrimary ? 'house' : 'building'} tint={p.isPrimary ? 'violet' : 'sky'} size={40} />
              <span className="min-w-0 flex-1 truncate text-[14px] font-bold text-ink">{p.pgName}</span>
              {p.isPrimary ? <Badge variant="brand">Main</Badge> : null}
            </li>
          ))}
        </ul>
      )}

      {open && (
        <form onSubmit={submit} className="well mt-4 space-y-3.5 p-4 animate-pop">
          <Input
            label="Property / PG Name"
            value={pgName}
            onChange={(e) => setPgName(e.target.value)}
            leading={<Building2 />}
            required
            disabled={saving}
          />
          <Input
            label="Address (optional)"
            value={pgAddress}
            onChange={(e) => setPgAddress(e.target.value)}
            leading={<MapPin />}
            disabled={saving}
          />
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button type="submit" variant="solid" loading={saving} className="w-full sm:w-auto sm:flex-1">
              Create Property
            </Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving} className="w-full sm:w-auto">
              Cancel
            </Button>
          </div>
          <p className="text-xs font-medium leading-relaxed text-muted">
            After creating, switch to the new property (top-left) and set up its beds from the dashboard.
          </p>
        </form>
      )}
    </section>
  );
}
