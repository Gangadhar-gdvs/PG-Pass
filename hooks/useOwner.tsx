'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';

export interface PropertyLite {
  id: string;
  pgName: string;
  isPrimary?: boolean;
}

export interface OwnerSession {
  uid: string;
  role: 'owner' | 'staff' | 'admin' | 'tenant';
  /** The PG account this user operates under — equals uid for owners. */
  ownerId: string;
  email?: string;
  phoneNumber?: string;
}

interface OwnerContextValue extends OwnerSession {
  /** All properties for this owner (primary first). */
  properties: PropertyLite[];
  /** Currently selected property id (defaults to the primary = ownerId). */
  selectedPropertyId: string;
  setSelectedPropertyId: (id: string) => void;
  reloadProperties: () => void;
}

const OwnerContext = createContext<OwnerContextValue | null>(null);

const STORAGE_KEY = 'pgpass_selected_property';

export function OwnerSessionProvider({
  value,
  children,
}: {
  value: OwnerSession;
  children: React.ReactNode;
}) {
  const [properties, setProperties] = useState<PropertyLite[]>([]);
  const [selectedPropertyId, setSelectedPropertyIdState] = useState<string>(value.ownerId);

  const setSelectedPropertyId = useCallback((id: string) => {
    setSelectedPropertyIdState(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      /* ignore */
    }
  }, []);

  const reloadProperties = useCallback(async () => {
    try {
      const res = await fetch('/api/properties');
      if (!res.ok) return;
      const data = await res.json();
      const list: PropertyLite[] = (data.properties || []).map((p: any) => ({
        id: p.id,
        pgName: p.pgName,
        isPrimary: p.isPrimary,
      }));
      setProperties(list);
      // Restore the previously selected property if it still exists.
      let stored: string | null = null;
      try {
        stored = localStorage.getItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
      if (stored && list.some((p) => p.id === stored)) {
        setSelectedPropertyIdState(stored);
      } else if (!list.some((p) => p.id === selectedPropertyId) && list.length > 0) {
        setSelectedPropertyIdState(list[0].id);
      }
    } catch {
      /* non-fatal */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    reloadProperties();
  }, [reloadProperties]);

  return (
    <OwnerContext.Provider
      value={{
        ...value,
        properties,
        selectedPropertyId,
        setSelectedPropertyId,
        reloadProperties,
      }}
    >
      {children}
    </OwnerContext.Provider>
  );
}

/**
 * Server-resolved session + client-selected property for owner-area pages.
 * `uid`/`ownerId` are available synchronously on first render (injected by the
 * server layout); `properties`/`selectedPropertyId` hydrate client-side.
 */
export function useOwnerSession(): OwnerContextValue {
  const ctx = useContext(OwnerContext);
  if (!ctx) {
    throw new Error('useOwnerSession must be used within OwnerSessionProvider');
  }
  return ctx;
}
