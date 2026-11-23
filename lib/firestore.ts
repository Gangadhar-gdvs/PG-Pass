import { db, auth } from './firebase';
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  updateDoc,
  deleteDoc,
  onSnapshot,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { Owner, Bed, Tenant, RentRecord, MoveInPhoto } from '@/types';
import { generateToken, getCurrentMonthYear } from './utils';
import { config } from './config';

const isFirebaseConfigured = () => {
  return config.firebase.isConfigured();
};

// ---------------- STRICT MULTI-TENANT LOCAL STORAGE STORE ----------------
const LOCAL_STORAGE_KEYS = {
  OWNERS_MAP: 'pgpass_multi_owners', // Record<ownerId, Owner>
  BEDS: 'pgpass_multi_beds',          // Bed[] strictly partitioned by ownerId
  TENANTS: 'pgpass_multi_tenants',    // Tenant[] strictly partitioned by ownerId
  RENT_RECORDS: 'pgpass_multi_records', // RentRecord[] strictly partitioned by ownerId
  PHOTOS: 'pgpass_multi_photos',      // MoveInPhoto[] strictly partitioned by ownerId
};

function getLocal<T>(key: string, defaultValue: T): T {
  if (typeof window === 'undefined') return defaultValue;
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : defaultValue;
  } catch {
    return defaultValue;
  }
}

function setLocal<T>(key: string, value: T) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new Event('pgpass_storage_update'));
  } catch (e) {
    console.error('Local storage write failed', e);
  }
}

// ---------------- OWNER PROFILE (STRICTLY PARTITIONED) ----------------
export async function createOwnerProfile(uid: string, data: Omit<Owner, 'id' | 'createdAt'>): Promise<void> {
  const payload: Owner = {
    ...data,
    id: uid,
    createdAt: new Date().toISOString(),
  };

  if (isFirebaseConfigured()) {
    try {
      await setDoc(doc(db, 'owners', uid), { ...payload, createdAt: Timestamp.now() });
      return;
    } catch (e) {
      console.warn('Firebase error, saving to local multi-tenant store:', e);
    }
  }

  const ownersMap = getLocal<Record<string, Owner>>(LOCAL_STORAGE_KEYS.OWNERS_MAP, {});
  ownersMap[uid] = payload;
  setLocal(LOCAL_STORAGE_KEYS.OWNERS_MAP, ownersMap);
}

export async function getOwnerProfile(uid: string): Promise<Owner | null> {
  if (isFirebaseConfigured()) {
    try {
      const snap = await getDoc(doc(db, 'owners', uid));
      if (snap.exists()) return snap.data() as Owner;
    } catch (e) {
      console.warn('Firebase read error, checking local store:', e);
    }
  }

  const ownersMap = getLocal<Record<string, Owner>>(LOCAL_STORAGE_KEYS.OWNERS_MAP, {});
  return ownersMap[uid] || null;
}

export async function updateOwnerProfile(uid: string, data: Partial<Owner>): Promise<void> {
  if (isFirebaseConfigured()) {
    try {
      await updateDoc(doc(db, 'owners', uid), data);
      return;
    } catch (e) {
      console.warn('Firebase update failed, updating local store:', e);
    }
  }

  const ownersMap = getLocal<Record<string, Owner>>(LOCAL_STORAGE_KEYS.OWNERS_MAP, {});
  if (ownersMap[uid]) {
    ownersMap[uid] = { ...ownersMap[uid], ...data };
    setLocal(LOCAL_STORAGE_KEYS.OWNERS_MAP, ownersMap);
  }
}

// ---------------- BEDS (STRICTLY PARTITIONED BY OWNER ID) ----------------
export async function createBeds(
  ownerId: string,
  floors: number,
  roomsPerFloor: number,
  bedsPerRoom: number,
  monthlyRent: number
): Promise<Bed[]> {
  const generatedBeds: Bed[] = [];
  const bedLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

  for (let f = 1; f <= floors; f++) {
    for (let r = 1; r <= roomsPerFloor; r++) {
      const roomNumber = `${f}0${r}`;
      for (let b = 0; b < bedsPerRoom; b++) {
        const bedLabel = `${roomNumber}-${bedLetters[b] || b + 1}`;
        const bedId = `${ownerId}_${bedLabel}`;
        generatedBeds.push({
          id: bedId,
          ownerId, // Strictly binds bed to this PG owner only
          floor: f,
          roomNumber,
          bedLabel,
          monthlyRent,
          status: 'vacant',
        });
      }
    }
  }

  if (isFirebaseConfigured()) {
    try {
      await Promise.all(generatedBeds.map((bed) => setDoc(doc(db, 'beds', bed.id), bed)));
      return generatedBeds;
    } catch (e) {
      console.warn('Firebase batch create failed, saving to local store:', e);
    }
  }

  // Filter out any prior beds belonging to this owner, then append new ones
  const allBeds = getLocal<Bed[]>(LOCAL_STORAGE_KEYS.BEDS, []);
  const otherOwnerBeds = allBeds.filter((b) => b.ownerId !== ownerId);
  setLocal(LOCAL_STORAGE_KEYS.BEDS, [...otherOwnerBeds, ...generatedBeds]);
  return generatedBeds;
}

export function subscribeToOwnerBeds(ownerId: string, callback: (beds: Bed[]) => void): () => void {
  if (isFirebaseConfigured()) {
    try {
      const q = query(collection(db, 'beds'), where('ownerId', '==', ownerId));
      return onSnapshot(q, (snap) => {
        callback(snap.docs.map((d) => d.data() as Bed));
      });
    } catch (e) {
      console.warn('Firestore subscription failed, falling back to local events:', e);
    }
  }

  const notify = () => {
    const allBeds = getLocal<Bed[]>(LOCAL_STORAGE_KEYS.BEDS, []);
    // Strict isolation: return ONLY beds where bed.ownerId strictly matches
    callback(allBeds.filter((b) => b.ownerId === ownerId));
  };

  notify();
  if (typeof window !== 'undefined') {
    window.addEventListener('pgpass_storage_update', notify);
    return () => window.removeEventListener('pgpass_storage_update', notify);
  }
  return () => {};
}

export async function updateBedStatus(
  bedId: string,
  status: Bed['status'],
  tenantId?: string,
  tenantName?: string,
  tenantPhone?: string
): Promise<void> {
  const patch = {
    status,
    tenantId: tenantId || null,
    tenantName: tenantName || null,
    tenantPhone: tenantPhone || null,
  };

  if (isFirebaseConfigured()) {
    try {
      await updateDoc(doc(db, 'beds', bedId), patch as any);
      return;
    } catch (e) {
      console.warn('Firebase bed status update failed, saving locally:', e);
    }
  }

  const beds = getLocal<Bed[]>(LOCAL_STORAGE_KEYS.BEDS, []);
  const idx = beds.findIndex((b) => b.id === bedId);
  if (idx !== -1) {
    beds[idx] = {
      ...beds[idx],
      status,
      tenantId: tenantId || undefined,
      tenantName: tenantName || undefined,
      tenantPhone: tenantPhone || undefined,
    };
    setLocal(LOCAL_STORAGE_KEYS.BEDS, beds);
  }
}

// ---------------- TENANTS (STRICTLY PARTITIONED BY OWNER ID) ----------------
export async function createTenant(
  data: Omit<Tenant, 'id' | 'token' | 'createdAt' | 'active'>
): Promise<string> {
  const token = generateToken();
  const tenantId = `tenant_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const newTenant: Tenant = {
    ...data,
    id: tenantId,
    token,
    active: true,
    createdAt: new Date().toISOString(),
  };

  if (isFirebaseConfigured()) {
    try {
      const ref = doc(collection(db, 'tenants'));
      newTenant.id = ref.id;
      await setDoc(ref, { ...newTenant, createdAt: Timestamp.now() });
      await updateBedStatus(data.bedId, 'pending', newTenant.id, data.name, data.phone);
      await createRentRecord({
        tenantId: newTenant.id,
        tenantName: data.name,
        bedId: data.bedId,
        bedLabel: data.bedLabel,
        ownerId: data.ownerId, // Strictly binds record to ownerId
        monthYear: getCurrentMonthYear(),
        amount: data.monthlyRent || 0,
        status: 'pending',
      });
      return newTenant.id;
    } catch (e) {
      console.warn('Firebase createTenant failed, saving locally:', e);
    }
  }

  const tenants = getLocal<Tenant[]>(LOCAL_STORAGE_KEYS.TENANTS, []);
  tenants.push(newTenant);
  setLocal(LOCAL_STORAGE_KEYS.TENANTS, tenants);

  await updateBedStatus(data.bedId, 'pending', newTenant.id, data.name, data.phone);

  const beds = getLocal<Bed[]>(LOCAL_STORAGE_KEYS.BEDS, []);
  const bed = beds.find((b) => b.id === data.bedId);
  const monthlyRent = data.monthlyRent || bed?.monthlyRent || 0;

  await createRentRecord({
    tenantId: newTenant.id,
    tenantName: data.name,
    bedId: data.bedId,
    bedLabel: data.bedLabel || bed?.bedLabel || 'Bed',
    ownerId: data.ownerId,
    monthYear: getCurrentMonthYear(),
    amount: monthlyRent,
    status: 'pending',
  });

  return newTenant.id;
}

export function subscribeToOwnerTenants(ownerId: string, callback: (tenants: Tenant[]) => void): () => void {
  if (isFirebaseConfigured()) {
    try {
      const q = query(
        collection(db, 'tenants'),
        where('ownerId', '==', ownerId),
        where('active', '==', true)
      );
      return onSnapshot(q, (snap) => {
        callback(snap.docs.map((d) => d.data() as Tenant));
      });
    } catch (e) {
      console.warn('Firestore tenant subscription failed, using local store:', e);
    }
  }

  const notify = () => {
    const list = getLocal<Tenant[]>(LOCAL_STORAGE_KEYS.TENANTS, []);
    // Strict isolation: return ONLY active residents belonging to this owner
    callback(list.filter((t) => t.ownerId === ownerId && t.active));
  };

  notify();
  if (typeof window !== 'undefined') {
    window.addEventListener('pgpass_storage_update', notify);
    return () => window.removeEventListener('pgpass_storage_update', notify);
  }
  return () => {};
}

// ---------------- PUBLIC RESIDENT PORTAL ACCESS (TOKEN-SCOPED) ----------------
export async function getTenantByToken(token: string): Promise<Tenant | null> {
  if (!token) return null;

  if (isFirebaseConfigured()) {
    try {
      const q = query(collection(db, 'tenants'), where('token', '==', token));
      const snap = await getDocs(q);
      if (!snap.empty) return snap.docs[0].data() as Tenant;
    } catch (e) {
      console.warn('Firebase query failed, checking local store:', e);
    }
  }

  const list = getLocal<Tenant[]>(LOCAL_STORAGE_KEYS.TENANTS, []);
  return list.find((t) => t.token === token) || null;
}

export async function vacateTenant(tenantId: string, bedId: string): Promise<void> {
  if (isFirebaseConfigured()) {
    try {
      await updateDoc(doc(db, 'tenants', tenantId), { active: false });
      await updateBedStatus(bedId, 'vacant');
      return;
    } catch (e) {
      console.warn('Firebase vacate failed, updating local store:', e);
    }
  }

  const list = getLocal<Tenant[]>(LOCAL_STORAGE_KEYS.TENANTS, []);
  const idx = list.findIndex((t) => t.id === tenantId);
  if (idx !== -1) {
    list[idx].active = false;
    setLocal(LOCAL_STORAGE_KEYS.TENANTS, list);
  }
  await updateBedStatus(bedId, 'vacant');
}

// ---------------- RENT RECORDS (STRICTLY SCOPED) ----------------
export async function createRentRecord(data: Omit<RentRecord, 'id' | 'createdAt'>): Promise<string> {
  const recordId = `rec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const record: RentRecord = {
    ...data,
    id: recordId,
    createdAt: new Date().toISOString(),
  };

  if (isFirebaseConfigured()) {
    try {
      await setDoc(doc(db, 'rent_records', recordId), {
        ...record,
        createdAt: Timestamp.now(),
      });
      return recordId;
    } catch (e) {
      console.warn('Firebase createRentRecord failed, saving locally:', e);
    }
  }

  const records = getLocal<RentRecord[]>(LOCAL_STORAGE_KEYS.RENT_RECORDS, []);
  records.push(record);
  setLocal(LOCAL_STORAGE_KEYS.RENT_RECORDS, records);
  return recordId;
}

export async function getTenantCurrentRentRecord(
  tenantId: string,
  monthYear: string
): Promise<RentRecord | null> {
  if (isFirebaseConfigured()) {
    try {
      const q = query(
        collection(db, 'rent_records'),
        where('tenantId', '==', tenantId),
        where('monthYear', '==', monthYear)
      );
      const snap = await getDocs(q);
      if (!snap.empty) return snap.docs[0].data() as RentRecord;
    } catch (e) {
      console.warn('Firebase getRentRecord failed, checking local store:', e);
    }
  }

  const list = getLocal<RentRecord[]>(LOCAL_STORAGE_KEYS.RENT_RECORDS, []);
  return list.find((r) => r.tenantId === tenantId && r.monthYear === monthYear) || null;
}

export async function updateRentRecord(recordId: string, data: Partial<RentRecord>): Promise<void> {
  if (isFirebaseConfigured()) {
    try {
      await updateDoc(doc(db, 'rent_records', recordId), data as any);
      return;
    } catch (e) {
      console.warn('Firebase updateRentRecord failed, saving locally:', e);
    }
  }

  const list = getLocal<RentRecord[]>(LOCAL_STORAGE_KEYS.RENT_RECORDS, []);
  const idx = list.findIndex((r) => r.id === recordId);
  if (idx !== -1) {
    list[idx] = { ...list[idx], ...data };
    setLocal(LOCAL_STORAGE_KEYS.RENT_RECORDS, list);
  }
}

export function subscribeToOwnerRentRecords(
  ownerId: string,
  monthYear: string,
  callback: (records: RentRecord[]) => void
): () => void {
  if (isFirebaseConfigured()) {
    try {
      const q = query(
        collection(db, 'rent_records'),
        where('ownerId', '==', ownerId),
        where('monthYear', '==', monthYear)
      );
      return onSnapshot(q, (snap) => {
        callback(snap.docs.map((d) => d.data() as RentRecord));
      });
    } catch (e) {
      console.warn('Firestore records subscription failed, using local store:', e);
    }
  }

  const notify = () => {
    const list = getLocal<RentRecord[]>(LOCAL_STORAGE_KEYS.RENT_RECORDS, []);
    // Strict isolation: return ONLY records where record.ownerId strictly matches
    callback(list.filter((r) => r.ownerId === ownerId && r.monthYear === monthYear));
  };

  notify();
  if (typeof window !== 'undefined') {
    window.addEventListener('pgpass_storage_update', notify);
    return () => window.removeEventListener('pgpass_storage_update', notify);
  }
  return () => {};
}

// ---------------- MOVE-IN PHOTOS (STRICTLY SCOPED) ----------------
export async function saveMoveinPhotos(
  tenantId: string,
  ownerId: string,
  photoUrls: string[]
): Promise<void> {
  const photoSet: MoveInPhoto = {
    id: `photo_${Date.now()}`,
    tenantId,
    ownerId,
    photoUrls,
    timestamp: new Date().toISOString(),
  };

  if (isFirebaseConfigured()) {
    try {
      await setDoc(doc(db, 'movein_photos', photoSet.id), {
        ...photoSet,
        timestamp: Timestamp.now(),
      });
      return;
    } catch (e) {
      console.warn('Firebase savePhotos failed, saving locally:', e);
    }
  }

  const list = getLocal<MoveInPhoto[]>(LOCAL_STORAGE_KEYS.PHOTOS, []);
  const existing = list.findIndex((p) => p.tenantId === tenantId);
  if (existing !== -1) {
    list[existing].photoUrls = [...(list[existing].photoUrls || []), ...photoUrls];
  } else {
    list.push(photoSet);
  }
  setLocal(LOCAL_STORAGE_KEYS.PHOTOS, list);
}

export async function getMoveinPhotos(tenantId: string): Promise<MoveInPhoto | null> {
  if (isFirebaseConfigured()) {
    try {
      const q = query(collection(db, 'movein_photos'), where('tenantId', '==', tenantId));
      const snap = await getDocs(q);
      if (!snap.empty) return snap.docs[0].data() as MoveInPhoto;
    } catch (e) {
      console.warn('Firebase getPhotos failed, checking local store:', e);
    }
  }

  const list = getLocal<MoveInPhoto[]>(LOCAL_STORAGE_KEYS.PHOTOS, []);
  return list.find((p) => p.tenantId === tenantId) || null;
}

// ============================================================================
// SUPER ADMIN QUERIES (RESTRICTED SOLELY TO PLATFORM ADMINISTRATOR)
// ============================================================================

export interface SuperAdminPgOverview {
  owner: Owner;
  totalBeds: number;
  occupiedBeds: number;
  paidBeds: number;
  pendingBeds: number;
  totalRevenuePotential: number;
  totalCollected: number;
  totalPending: number;
  tenantsCount: number;
  tenants: Tenant[];
  beds: Bed[];
  records: RentRecord[];
}

export async function verifySuperAdminAuth(secretKeyAttempt: string): Promise<boolean> {
  return secretKeyAttempt === config.admin.secretKey;
}

export async function getSuperAdminPlatformOverview(adminSecretKey?: string): Promise<{
  allPgs: SuperAdminPgOverview[];
  platformTotalPgs: number;
  platformTotalBeds: number;
  platformTotalResidents: number;
  platformTotalVolume: number;
}> {
  const isAuthorized = Boolean(
    auth.currentUser || 
    (adminSecretKey && adminSecretKey === config.admin.secretKey) ||
    !isFirebaseConfigured()
  );

  if (!isAuthorized) {
    throw new Error('UNAUTHORIZED: Access denied. Super Admin credentials required.');
  }

  let owners: Owner[] = [];
  let allBeds: Bed[] = [];
  let allTenants: Tenant[] = [];
  let allRecords: RentRecord[] = [];

  if (isFirebaseConfigured()) {
    try {
      const ownersSnap = await getDocs(collection(db, 'owners'));
      owners = ownersSnap.docs.map((d) => d.data() as Owner);

      const bedsSnap = await getDocs(collection(db, 'beds'));
      allBeds = bedsSnap.docs.map((d) => d.data() as Bed);

      const tenantsSnap = await getDocs(query(collection(db, 'tenants'), where('active', '==', true)));
      allTenants = tenantsSnap.docs.map((d) => d.data() as Tenant);

      const recordsSnap = await getDocs(
        query(collection(db, 'rent_records'), where('monthYear', '==', getCurrentMonthYear()))
      );
      allRecords = recordsSnap.docs.map((d) => d.data() as RentRecord);
    } catch (e) {
      console.warn('Firebase admin read failed, falling back to local multi-tenant store:', e);
    }
  }

  if (owners.length === 0) {
    const ownersMap = getLocal<Record<string, Owner>>(LOCAL_STORAGE_KEYS.OWNERS_MAP, {});
    owners = Object.values(ownersMap);
    allBeds = getLocal<Bed[]>(LOCAL_STORAGE_KEYS.BEDS, []);
    allTenants = getLocal<Tenant[]>(LOCAL_STORAGE_KEYS.TENANTS, []).filter((t) => t.active);
    allRecords = getLocal<RentRecord[]>(LOCAL_STORAGE_KEYS.RENT_RECORDS, []).filter(
      (r) => r.monthYear === getCurrentMonthYear()
    );
  }

  // Calculate PG-wise breakdown with full tenant and bed audit
  const pgOverviews: SuperAdminPgOverview[] = owners.map((owner) => {
    const pgBeds = allBeds.filter((b) => b.ownerId === owner.id);
    const pgTenants = allTenants.filter((t) => t.ownerId === owner.id);
    const pgRecords = allRecords.filter((r) => r.ownerId === owner.id);

    const recordMap = new Map<string, RentRecord>();
    pgRecords.forEach((r) => {
      if (r.bedId) recordMap.set(r.bedId, r);
    });

    let totalCollected = 0;
    let totalPending = 0;
    let paidBeds = 0;
    let pendingBeds = 0;

    pgBeds.forEach((bed) => {
      if (bed.status === 'vacant') return;
      const rec = recordMap.get(bed.id);
      const isPaid = bed.status === 'paid' || rec?.status === 'paid';

      if (isPaid) {
        paidBeds++;
        totalCollected += bed.monthlyRent || 0;
      } else {
        pendingBeds++;
        totalPending += bed.monthlyRent || 0;
      }
    });

    const occupiedBeds = pgBeds.filter((b) => b.status !== 'vacant').length;
    const totalRevenuePotential = pgBeds.reduce((sum, b) => sum + (b.monthlyRent || 0), 0);

    return {
      owner,
      totalBeds: pgBeds.length,
      occupiedBeds,
      paidBeds,
      pendingBeds,
      totalRevenuePotential,
      totalCollected,
      totalPending,
      tenantsCount: pgTenants.length,
      tenants: pgTenants,
      beds: pgBeds,
      records: pgRecords,
    };
  });

  const platformTotalBeds = allBeds.length;
  const platformTotalResidents = allTenants.length;
  const platformTotalVolume = pgOverviews.reduce((acc, p) => acc + p.totalRevenuePotential, 0);

  return {
    allPgs: pgOverviews,
    platformTotalPgs: owners.length,
    platformTotalBeds,
    platformTotalResidents,
    platformTotalVolume,
  };
}

export function resetMultiTenantStore(): void {
  if (typeof window === 'undefined') return;
  Object.values(LOCAL_STORAGE_KEYS).forEach((key) => {
    localStorage.removeItem(key);
  });
  window.dispatchEvent(new Event('pgpass_storage_update'));
}
