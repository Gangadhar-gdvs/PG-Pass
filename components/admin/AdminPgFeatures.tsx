'use client';

import React, { useEffect, useState } from 'react';
import { ALL_PG_FEATURES, PG_FEATURE_LABELS, PgFeature } from '@/lib/constants/permissions';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { SectionCard } from '@/components/ui/dashboard-kit';
import { Skeleton } from '@/components/ui/skeleton';

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

  const enabledCount = features ? ALL_PG_FEATURES.filter((f) => features[f] !== false).length : 0;

  return (
    <SectionCard
      title="Feature access"
      icon="grid"
      action={
        features !== null ? (
          <span className="chip shrink-0 font-mono-numbers">
            {enabledCount}/{ALL_PG_FEATURES.length} on
          </span>
        ) : undefined
      }
    >
      <p className="-mt-1 mb-3 text-[12.5px] font-medium text-muted">
        Per-PG and enforced on the server. The owner can&apos;t override these.
      </p>
      {features === null ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" aria-label="Loading features">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {ALL_PG_FEATURES.map((f) => {
            const on = features[f] !== false;
            const saving = savingKey === f;
            return (
              <button
                key={f}
                type="button"
                role="switch"
                aria-checked={on}
                disabled={saving}
                onClick={() => toggle(f, !on)}
                className={`flex min-h-12 items-center justify-between gap-3 rounded-2xl px-3.5 py-2.5 text-left transition-colors press disabled:opacity-60 ${
                  on
                    ? 'bg-brand-50 ring-1 ring-inset ring-brand-200'
                    : 'bg-lilac ring-1 ring-inset ring-line hover:bg-brand-50/60'
                }`}
              >
                <span className={`min-w-0 truncate text-[13px] font-semibold ${on ? 'text-ink' : 'text-muted'}`}>
                  {PG_FEATURE_LABELS[f]}
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-brand" aria-hidden="true" />}
                  <span
                    aria-hidden="true"
                    className={`relative h-6 w-10 rounded-full transition-colors ${
                      on ? 'bg-[image:var(--grad-brand)]' : 'bg-line-strong'
                    }`}
                  >
                    <span
                      className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-[0_2px_6px_rgba(70,40,160,0.3)] transition-transform ${
                        on ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}
