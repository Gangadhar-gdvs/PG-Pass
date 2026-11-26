'use client';

import React, { useState } from 'react';
import {
  ALL_STAFF_PERMISSIONS,
  STAFF_PERMISSION_LABELS,
  StaffPermission,
} from '@/lib/constants/permissions';
import { Button } from '@/components/ui/button';
import { GlyphTile } from '@/components/brand/Icon3D';
import { ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { errorMessage } from '@/lib/utils';

/**
 * Per-staff permission toggles. Each staff member's access is independent — the
 * owner grants exactly what this person may do. Enforced server-side in withAuth.
 */
export function StaffPermissionsEditor({
  staffUid,
  initial,
  onSaved,
}: {
  staffUid: string;
  initial: StaffPermission[];
  onSaved?: (perms: StaffPermission[]) => void;
}) {
  const [selected, setSelected] = useState<Set<StaffPermission>>(new Set(initial));
  const [saving, setSaving] = useState(false);

  const toggle = (p: StaffPermission) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      const permissions = Array.from(selected);
      const res = await fetch(`/api/staff/${staffUid}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissions }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error || e.message || 'Could not save permissions');
      }
      toast.success('Permissions updated');
      onSaved?.(permissions);
    } catch (e: unknown) {
      toast.error(errorMessage(e, 'Could not save permissions'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="well mt-3 space-y-3 p-3 sm:p-4 animate-pop">
      <div className="flex items-center gap-3">
        <GlyphTile icon={ShieldCheck} tone="mint" size={38} />
        <div className="min-w-0">
          <p className="text-[14px] font-bold leading-tight text-ink">Access</p>
          <p className="mt-0.5 text-xs font-medium text-muted">Grant only what this person needs</p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {ALL_STAFF_PERMISSIONS.map((p) => {
          const on = selected.has(p);
          return (
            <button
              key={p}
              type="button"
              role="switch"
              aria-checked={on}
              onClick={() => toggle(p)}
              className={`flex min-h-12 items-center justify-between gap-3 rounded-2xl border px-3.5 py-2.5 text-left transition-all press ${
                on
                  ? 'border-white bg-white shadow-[var(--shadow-tile)]'
                  : 'border-white/70 bg-white/50 hover:bg-white/80'
              }`}
            >
              <span className={`min-w-0 text-[13px] leading-snug ${on ? 'font-bold text-ink' : 'font-semibold text-muted'}`}>
                {STAFF_PERMISSION_LABELS[p]}
              </span>
              <span
                aria-hidden="true"
                className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${
                  on ? 'bg-[image:var(--grad-brand)] shadow-[var(--shadow-brand)]' : 'bg-line-strong'
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-[var(--shadow-tile)] transition-all ${
                    on ? 'left-[18px]' : 'left-0.5'
                  }`}
                />
              </span>
            </button>
          );
        })}
      </div>
      <Button variant="solid" loading={saving} onClick={save} className="w-full sm:w-auto">
        Save permissions
      </Button>
    </div>
  );
}
