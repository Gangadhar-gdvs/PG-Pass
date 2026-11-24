'use client';

import React, { useState } from 'react';
import {
  ALL_STAFF_PERMISSIONS,
  STAFF_PERMISSION_LABELS,
  StaffPermission,
} from '@/lib/constants/permissions';
import { Button } from '@/components/ui/button';
import { ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';

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
    } catch (e: any) {
      toast.error(e.message || 'Could not save permissions');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-3 pt-3 border-t border-[#E2E8F0] space-y-2.5">
      <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-[#64748B]">
        <ShieldCheck className="w-3.5 h-3.5 text-[#10B981]" />
        <span>Access — grant only what this person needs</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {ALL_STAFF_PERMISSIONS.map((p) => {
          const on = selected.has(p);
          return (
            <button
              key={p}
              type="button"
              onClick={() => toggle(p)}
              className={`flex items-center justify-between gap-2 px-3 py-2 rounded-[8px] border text-left text-xs transition-colors cursor-pointer ${
                on
                  ? 'border-[#10B981] bg-[#ECFDF5] text-[#065F46]'
                  : 'border-[#E2E8F0] bg-white text-[#64748B] hover:bg-[#F8FAFC]'
              }`}
            >
              <span className="min-w-0 truncate">{STAFF_PERMISSION_LABELS[p]}</span>
              <span
                className={`w-8 h-4.5 rounded-full relative shrink-0 transition-colors ${
                  on ? 'bg-[#10B981]' : 'bg-[#CBD5E1]'
                }`}
                style={{ height: 18 }}
              >
                <span
                  className="absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white transition-all"
                  style={{ left: on ? 16 : 2 }}
                />
              </span>
            </button>
          );
        })}
      </div>
      <Button size="sm" variant="solid" loading={saving} onClick={save}>
        Save permissions
      </Button>
    </div>
  );
}
