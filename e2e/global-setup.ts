import { createHash } from 'node:crypto';
import { mkdirSync, rmSync } from 'node:fs';
import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldPath, Timestamp, getFirestore, type Firestore } from 'firebase-admin/firestore';
import {
  ADMIN,
  AUTH_DIR,
  BEDS,
  OWNER,
  PASSWORD,
  PROJECT_ID,
  RESIDENT_ACCOUNT,
  TENANTS,
  TICKET,
  currentPeriodIST,
} from './fixtures';

/**
 * Seeds the E2E fixture into the running `demo-pgpass` emulator via the Admin
 * SDK. Idempotent: every run first deletes everything owned by the e2e-* uids
 * (including docs the previous run's UI flows created), then recreates a known
 * state. Never touches the manual dev seed (owner-gv / Green Valley PG).
 */

process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099';

const LOOPBACK = /^(127\.0\.0\.1|localhost|\[::1\]):\d+$/;
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

async function deleteWhere(db: Firestore, ownerIds: string[]) {
  const collections = await db.listCollections();
  for (const col of collections) {
    for (;;) {
      const snap = await col.where('ownerId', 'in', ownerIds).limit(300).get();
      if (snap.empty) break;
      const batch = db.batch();
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  }
}

/** The app's Firestore-backed limiter keys every local request as 127.0.0.1;
 *  reset the auth/portal buckets so repeated runs never trip the 10/min login cap. */
async function resetRateLimits(db: Firestore) {
  for (const prefix of ['rl:_api_auth_session:', 'rl:_api_portal_']) {
    const snap = await db
      .collection('rate_limits')
      .where(FieldPath.documentId(), '>=', prefix)
      .where(FieldPath.documentId(), '<', `${prefix}`)
      .get();
    await Promise.all(snap.docs.map((d) => d.ref.delete()));
  }
}

export default async function globalSetup() {
  for (const v of ['FIRESTORE_EMULATOR_HOST', 'FIREBASE_AUTH_EMULATOR_HOST'] as const) {
    if (!LOOPBACK.test(process.env[v]!)) throw new Error(`${v} must point at a local emulator`);
  }
  const app = initializeApp({ projectId: PROJECT_ID }, `e2e-seed-${Date.now()}`);
  const auth = getAuth(app);
  const db = getFirestore(app);

  try {
    // ---- reset ----
    await deleteWhere(db, [OWNER.uid]);
    const hashes = Object.values(TENANTS).map((t) => sha256(t.token));
    await Promise.all([
      db.doc(`owners/${OWNER.uid}`).delete(),
      db.doc(`support_threads/${OWNER.uid}`).delete(),
      db.doc(`residents/${RESIDENT_ACCOUNT.uid}`).delete(),
      ...hashes.flatMap((h) => [db.doc(`portal_tokens/${h}`).delete(), db.doc(`portal_lockouts/${h}`).delete()]),
    ]);
    await resetRateLimits(db);

    const users: { uid: string; email: string; displayName: string; claims: Record<string, unknown> | null }[] = [
      { uid: OWNER.uid, email: OWNER.email, displayName: OWNER.name, claims: null },
      { uid: ADMIN.uid, email: ADMIN.email, displayName: ADMIN.name, claims: { admin: true } },
      { uid: RESIDENT_ACCOUNT.uid, email: RESIDENT_ACCOUNT.email, displayName: RESIDENT_ACCOUNT.name, claims: { role: 'resident' } },
    ];
    for (const u of users) {
      await auth.deleteUser(u.uid).catch(() => {});
      await auth.createUser({ uid: u.uid, email: u.email, password: PASSWORD, displayName: u.displayName });
      if (u.claims) await auth.setCustomUserClaims(u.uid, u.claims);
    }

    // ---- seed ----
    const now = Timestamp.now();
    const period = currentPeriodIST();
    const dueDate = `${period}-05`;
    const batch = db.batch();

    batch.set(db.doc(`owners/${OWNER.uid}`), {
      id: OWNER.uid,
      name: OWNER.name,
      email: OWNER.email,
      phone: '9000000001',
      pgName: OWNER.pgName,
      pgAddress: OWNER.pgAddress,
      city: 'Hyderabad',
      upiId: 'lotusresidency@okaxis',
      plan: 'pro',
      accountStatus: 'active',
      rentDueDay: 5,
      createdAt: now,
      updatedAt: now,
    });
    batch.set(db.doc(`properties/${OWNER.uid}`), {
      id: OWNER.uid,
      ownerId: OWNER.uid,
      isPrimary: true,
      pgName: OWNER.pgName,
      pgAddress: OWNER.pgAddress,
      city: 'Hyderabad',
      rentDueDay: 5,
      createdAt: now,
      updatedAt: now,
    });
    batch.set(db.doc(`residents/${RESIDENT_ACCOUNT.uid}`), {
      id: RESIDENT_ACCOUNT.uid,
      name: RESIDENT_ACCOUNT.name,
      phone: RESIDENT_ACCOUNT.phone,
      email: RESIDENT_ACCOUNT.email,
      createdAt: now,
      updatedAt: now,
    });

    for (const b of BEDS) {
      const t = b.tenant ? TENANTS[b.tenant] : null;
      batch.set(db.doc(`beds/${b.id}`), {
        id: b.id,
        ownerId: OWNER.uid,
        propertyId: OWNER.uid,
        floor: b.floor,
        roomNumber: b.room,
        bedLabel: b.label,
        sharingType: '2',
        monthlyRent: b.rent,
        rentAmountPaise: b.rent * 100,
        status: t ? 'occupied' : 'vacant',
        tenantId: b.tenant,
        tenantName: t?.name ?? null,
        tenantPhone: t?.phone ?? null,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
      });
      if (!b.tenant || !t) continue;
      batch.set(db.doc(`tenants/${b.tenant}`), {
        id: b.tenant,
        ownerId: OWNER.uid,
        propertyId: OWNER.uid,
        ownerName: OWNER.name,
        bedId: b.id,
        roomNumber: b.room,
        bedLabel: b.label,
        name: t.name,
        phone: t.phone,
        phoneLast4: t.phone.slice(-4),
        idProofType: 'aadhaar',
        accountStatus: 'active',
        securityDepositPaise: b.rent * 100,
        depositPaidPaise: b.rent * 100,
        moveInDate: '2026-06-01',
        token: t.token,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
      });
      batch.set(db.doc(`rent_records/${b.tenant}_${period}`), {
        id: `${b.tenant}_${period}`,
        ownerId: OWNER.uid,
        propertyId: OWNER.uid,
        tenantId: b.tenant,
        period,
        roomNumber: b.room,
        bedLabel: b.label,
        lineItems: [{ label: 'Base Rent', amountPaise: b.rent * 100 }],
        prorated: false,
        amountDuePaise: b.rent * 100,
        amountPaidPaise: 0,
        status: 'pending',
        dueDate,
        createdAt: now,
        updatedAt: now,
      });
      const expires = new Date();
      expires.setDate(expires.getDate() + 90);
      batch.set(db.doc(`portal_tokens/${sha256(t.token)}`), {
        tokenHash: sha256(t.token),
        tenantId: b.tenant,
        ownerId: OWNER.uid,
        expiresAt: Timestamp.fromDate(expires),
        singleUse: false,
        usedAt: null,
        revokedAt: null,
        createdAt: now,
      });
    }
    batch.set(db.doc(`maintenance_tickets/${TICKET.id}`), {
      id: TICKET.id,
      ownerId: OWNER.uid,
      propertyId: OWNER.uid,
      tenantId: 'e2e-t-portal',
      tenantName: TENANTS['e2e-t-portal'].name,
      bedLabel: '101-B',
      roomNumber: '101',
      category: 'plumbing',
      description: TICKET.description,
      status: 'open',
      createdAt: now,
      updatedAt: now,
    });
    await batch.commit();
  } finally {
    await deleteApp(app);
  }

  rmSync(AUTH_DIR, { recursive: true, force: true });
  mkdirSync(AUTH_DIR, { recursive: true });
}
