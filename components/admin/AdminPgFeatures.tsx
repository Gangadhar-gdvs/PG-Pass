'use client';

import React, { useEffect, useState } from 'react';
import { ALL_PG_FEATURES, PG_FEATURE_LABELS, PgFeature } from '@/lib/constants/permissions';
import { SlidersHorizontal, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

/**
 * Admin-only per-PG feature control. The admin enables/disables whole features
 * for a specific PG; enforcement is server-side (withAuth `feature` gate). The
 * owner cannot override these.
 */
export function AdminPgFeatures({ ownerId }: { ownerId: string }) {
  const [features, setFeatures] = useState<Record<string, boolean> | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  useEffect(() => {
    // Defer so setState runs after commit, not in the effect body (cascading-render lint rule).
    queueMicrotask(() => {
      setFeatures(null);
    });
    fetch(`/api/admin/features?ownerId=${encodeURIComponent(ownerId)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setFeatures(d.features))
      .catch(() => setFeatures({}));
  }, [ownerId]);

  const toggle = async (feature: PgFeature, next: boolean) => {
    setSavingKey(feature);
    // Optimistic update.
    setFeatures((f) => ({ ...(f || {}), [feature]: next }));
    try {
      const res = await fetch('/api/admin/features', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ownerId, feature, enabled: next }),
      });
      if (!res.ok) throw new Error();
      toast.success(`${PG_FEATURE_LABELS[feature]} ${next ? 'enabled' : 'disabled'}`);
    } catch {
      setFeatures((f) => ({ ...(f || {}), [feature]: !next })); // revert
      toast.error('Could not update feature');
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-[12px] p-4.5 space-y-2.5 shadow-xs">
      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#64748B] flex items-center gap-1.5">
        <SlidersHorizontal className="w-3.5 h-3.5" />
        Feature Access (per-PG, server-enforced)
      </span>
      {features === null ? (
        <div className="flex items-center gap-2 text-xs text-[#94A3B8] py-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
          {ALL_PG_FEATURES.map((f) => {
            const on = features[f] !== false;
            return (
              <button
                key={f}
                type="button"
                disabled={savingKey === f}
                onClick={() => toggle(f, !on)}
                className={`flex items-center justify-between gap-2 px-3 py-2 rounded-[8px] border text-left text-xs transition-colors cursor-pointer disabled:opacity-60 ${
                  on
                    ? 'border-[#4F46E5] bg-[#EEF2FF] text-[#3730A3]'
                    : 'border-[#E2E8F0] bg-white text-[#64748B] hover:bg-[#F8FAFC]'
                }`}
              >
                <span className="min-w-0 truncate">{PG_FEATURE_LABELS[f]}</span>
                <span
                  className={`w-8 rounded-full relative shrink-0 transition-colors ${
                    on ? 'bg-[#4F46E5]' : 'bg-[#CBD5E1]'
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
      )}
    </div>
  );
}
