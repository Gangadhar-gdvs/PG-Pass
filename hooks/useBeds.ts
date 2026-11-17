'use client';
import { useEffect, useState } from 'react';
import { subscribeToOwnerBeds } from '@/lib/firestore';
import { Bed } from '@/types';

export function useBeds(ownerId: string | null) {
  const [beds, setBeds] = useState<Bed[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ownerId) {
      setLoading(false);
      return;
    }
    const unsub = subscribeToOwnerBeds(ownerId, (items) => {
      setBeds(items);
      setLoading(false);
    });
    return unsub;
  }, [ownerId]);

  return { beds, loading };
}
