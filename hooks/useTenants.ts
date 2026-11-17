'use client';
import { useEffect, useState } from 'react';
import { subscribeToOwnerTenants } from '@/lib/firestore';
import { Tenant } from '@/types';

export function useTenants(ownerId: string | null) {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ownerId) {
      setLoading(false);
      return;
    }
    const unsub = subscribeToOwnerTenants(ownerId, (items) => {
      setTenants(items);
      setLoading(false);
    });
    return unsub;
  }, [ownerId]);

  return { tenants, loading };
}
