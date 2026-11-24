'use client';
import { useEffect, useState } from 'react';
import { subscribeToOwnerBeds } from '@/lib/firestore';
import { Bed } from '@/types';

export function useBeds(ownerId: string | null, propertyId?: string) {
  const [beds, setBeds] = useState<Bed[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ownerId) {
      setLoading(false);
      return;
    }
    const unsub = subscribeToOwnerBeds(
      ownerId,
      (items) => {
        setBeds(items);
        setLoading(false);
      },
      propertyId
    );
    return unsub;
  }, [ownerId, propertyId]);

  return { beds, loading };
}
