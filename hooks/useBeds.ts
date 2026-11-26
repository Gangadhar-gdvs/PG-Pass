'use client';
import { useEffect, useState } from 'react';
import { subscribeToOwnerBeds } from '@/lib/firestore';
import { Bed } from '@/types';

// If the first snapshot hasn't arrived within this window we stop the spinner
// and report an error, rather than loading forever when Firestore is slow,
// unreachable, or a required composite index hasn't been deployed yet.
const FIRST_LOAD_TIMEOUT_MS = 12_000;

export function useBeds(ownerId: string | null, propertyId?: string) {
  const [beds, setBeds] = useState<Bed[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let settled = false;
    // Reset state for this (re)subscription in a microtask so these don't run
    // synchronously in the effect body (cascading-render lint rule). Behaviour is
    // unchanged: the spinner/errors still clear on mount and on ownerId change.
    if (!ownerId) {
      queueMicrotask(() => {
        setLoading(false);
        setError(null);
      });
      return;
    }

    queueMicrotask(() => {
      setLoading(true);
      setError(null);
    });

    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        setLoading(false);
        setError('timeout');
      }
    }, FIRST_LOAD_TIMEOUT_MS);

    const unsub = subscribeToOwnerBeds(
      ownerId,
      (items) => {
        settled = true;
        clearTimeout(timeout);
        setBeds(items);
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

  return { beds, loading, error };
}
