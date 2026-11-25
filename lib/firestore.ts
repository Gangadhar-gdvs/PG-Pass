import { db } from './firebase';
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  limit,
} from 'firebase/firestore';
import { Bed, Tenant, RentRecord, SupportMessage, SupportThread } from '@/types';
import { config } from './config';

/**
 * CLIENT-SIDE READ SUBSCRIPTIONS ONLY.
 *
 * This module used to hold a second, parallel data plane: client-SDK writes
 * (createTenant/createBeds/updateRentRecord/…) plus a localStorage fallback
 * store. Those writes are rejected in production by `firestore.rules`
 * (`allow write: if false` on every collection) and silently fell back to
 * localStorage — which is exactly what produced "stale data": writes landed in
 * the browser while reads came from Firestore, and the two never reconciled.
 *
 * All mutations now go exclusively through `app/api/**` → `lib/server/services/*`
 * (Admin SDK). The super-admin platform overview moved to
 * `/api/admin/overview` (server-only, admin custom claim).
 *
 * What remains here are read-only real-time listeners, which the rules DO allow
 * (scoped `get/list` with `ownerId` + `limit <= 100`). There is no localStorage
 * fallback: if Firestore is unreachable the callback simply isn't invoked and
 * the UI keeps its last state / loading indicator, rather than silently serving
 * stale browser-cached data.
 */

const isFirebaseConfigured = () => config.firebase.isConfigured();

const noop = () => {};

// ---------------- BEDS (owner-scoped real-time read) ----------------
// `propertyId` optionally narrows to a single property; when omitted the view is
// owner-wide (unchanged legacy behavior for single-PG owners).
export function subscribeToOwnerBeds(
  ownerId: string,
  callback: (beds: Bed[]) => void,
  propertyId?: string,
  onError?: (error: { code: string }) => void
): () => void {
  if (!ownerId || !isFirebaseConfigured()) {
    callback([]);
    return noop;
  }

  const constraints = [where('ownerId', '==', ownerId)] as any[];
  if (propertyId) constraints.push(where('propertyId', '==', propertyId));
  constraints.push(limit(100)); // conforms to firestore.rules boundedList (<=100)
  const q = query(collection(db, 'beds'), ...constraints);

  return onSnapshot(
    q,
    (snap) =>
      callback(
        snap.docs
          .map((d) => ({ ...d.data(), id: d.id } as Bed))
          // Hide soft-deleted beds from the live inventory view.
          .filter((b) => !(b as any).deletedAt)
      ),
    (error) => {
      // Surface the failure (missing index, permission-denied, unreachable) so
      // the UI can show an actionable error instead of spinning forever.
      console.warn('Firestore beds subscription error:', error.code);
      onError?.({ code: error.code });
    }
  );
}

// ---------------- TENANTS (owner-scoped, active only) ----------------
export function subscribeToOwnerTenants(
  ownerId: string,
  callback: (tenants: Tenant[]) => void,
  propertyId?: string
): () => void {
  if (!ownerId || !isFirebaseConfigured()) {
    callback([]);
    return noop;
  }

  // The server marks an active resident with `deletedAt == null` (there is no
  // `active` boolean written by tenants.service). Filtering on a non-existent
  // `active` field returned nothing, so freshly-added tenants never appeared.
  const constraints = [
    where('ownerId', '==', ownerId),
    where('deletedAt', '==', null),
  ] as any[];
  if (propertyId) constraints.push(where('propertyId', '==', propertyId));
  constraints.push(limit(100));
  const q = query(collection(db, 'tenants'), ...constraints);

  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => ({ ...d.data(), id: d.id } as Tenant))),
    (error) => {
      console.warn('Firestore tenants subscription error:', error.code);
      callback([]);
    }
  );
}

// ---------------- RENT RECORDS (owner + period scoped) ----------------
// `period` is the canonical YYYY-MM field written by the server services.
// (The previous code queried a legacy `monthYear` field that records no longer
// carry, so the owner dashboard's rent board silently matched nothing.)
export function subscribeToOwnerRentRecords(
  ownerId: string,
  period: string,
  callback: (records: RentRecord[]) => void,
  propertyId?: string
): () => void {
  if (!ownerId || !period || !isFirebaseConfigured()) {
    callback([]);
    return noop;
  }

  const constraints = [
    where('ownerId', '==', ownerId),
    where('period', '==', period),
  ] as any[];
  if (propertyId) constraints.push(where('propertyId', '==', propertyId));
  constraints.push(limit(100));
  const q = query(collection(db, 'rent_records'), ...constraints);

  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => ({ ...d.data(), id: d.id } as RentRecord))),
    (error) => {
      console.warn('Firestore rent-records subscription error:', error.code);
      callback([]);
    }
  );
}

// ---------------- SUPPORT CHAT (live, push via onSnapshot — not polling) ----------------
export function subscribeToSupportMessages(
  ownerId: string,
  callback: (messages: SupportMessage[]) => void
): () => void {
  if (!ownerId || !isFirebaseConfigured()) {
    callback([]);
    return noop;
  }
  const q = query(
    collection(db, 'support_threads', ownerId, 'messages'),
    orderBy('createdAt', 'asc'),
    limit(100)
  );
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => ({ ...d.data(), id: d.id } as SupportMessage))),
    (error) => {
      console.warn('Support messages subscription error:', error.code);
      callback([]);
    }
  );
}

// Admin: live list of all support threads, most recently active first.
export function subscribeToSupportThreads(
  callback: (threads: SupportThread[]) => void
): () => void {
  if (!isFirebaseConfigured()) {
    callback([]);
    return noop;
  }
  const q = query(
    collection(db, 'support_threads'),
    orderBy('lastAt', 'desc'),
    limit(100)
  );
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => ({ ...d.data(), id: d.id } as SupportThread))),
    (error) => {
      console.warn('Support threads subscription error:', error.code);
      callback([]);
    }
  );
}
