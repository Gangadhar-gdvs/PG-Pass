'use client';
import { useEffect, useState } from 'react';
import { subscribeToOwnerTenants } from '@/lib/firestore';
import { Tenant } from '@/types';

// Stop the spinner and report an error if the first snapshot hasn't arrived in
// time (slow/unreachable Firestore or a missing composite index) instead of
// showing an empty list forever.
const FIRST_LOAD_TIMEOUT_MS = 12_000;

export function useTenants(ownerId: string | null, propertyId?: string) {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ownerId) {
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    let settled = false;

    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        setLoading(false);
        setError('timeout');
      }
    }, FIRST_LOAD_TIMEOUT_MS);

    const unsub = subscribeToOwnerTenants(
      ownerId,
      (items) => {
        settled = true;
        clearTimeout(timeout);
        setTenants(items);
        setError(null);
        setLoading(false);
      },
      propertyId,
      (err) => {
        settled = true;
        clearTimeout(timeout);
        setError(err.code || 'error');
        setLoading(false);
      }
    );

    return () => {
      clearTimeout(timeout);
      unsub();
    };
  }, [ownerId, propertyId]);

  return { tenants, loading, error };
}
