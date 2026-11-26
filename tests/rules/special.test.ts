import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BROKEN_STAFF, OWNER_A, OWNER_B, db, seed, startEnv } from './helpers';

/** Collections with bespoke rules (SPECIAL in collections.ts). */

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await startEnv('demo-rules-special');
  await seed(env, {
    [`owners/${OWNER_A}`]: { id: OWNER_A, pgName: 'A PG' },
    [`owners/${OWNER_B}`]: { id: OWNER_B, pgName: 'B PG' },
    // staff/staffA, staff/staffB, … come from STAFF_DOCS (seeded by startEnv).
    'staff/staffA2': { id: 'staffA2', ownerId: OWNER_A, name: 'Warden A2', accountStatus: 'active', permissions: [] },
    [`support_threads/${OWNER_A}`]: { ownerId: OWNER_A, unread: 0 },
    [`support_threads/${OWNER_B}`]: { ownerId: OWNER_B, unread: 0 },
    [`support_threads/${OWNER_A}/messages/m1`]: { from: 'owner', text: 'hi' },
    [`support_threads/${OWNER_B}/messages/m1`]: { from: 'owner', text: 'hello' },
    'residents/residentR': { uid: 'residentR', name: 'Resident R' },
    'residents/residentS': { uid: 'residentS', name: 'Resident S' },
    'metrics/2026-11-27': { activeOwners: 2 },
  });
});

afterAll(async () => {
  await env?.cleanup();
});

describe('owners/{ownerId}', () => {
  it('owner gets only their own profile', async () => {
    await assertSucceeds(db(env, 'ownerA').doc(`owners/${OWNER_A}`).get());
    await assertFails(db(env, 'ownerA').doc(`owners/${OWNER_B}`).get());
  });
  it("staff get their owner's profile only", async () => {
    await assertSucceeds(db(env, 'staffA').doc(`owners/${OWNER_A}`).get());
    await assertFails(db(env, 'staffA').doc(`owners/${OWNER_B}`).get());
  });
  it('admin gets any owner; only admin can list (bounded)', async () => {
    await assertSucceeds(db(env, 'admin').doc(`owners/${OWNER_B}`).get());
    const all = await assertSucceeds(db(env, 'admin').collection('owners').limit(100).get());
    expect(all.size).toBe(2);
    await assertFails(db(env, 'admin').collection('owners').get());
    await assertFails(db(env, 'ownerA').collection('owners').limit(10).get());
    await assertFails(db(env, 'staffA').collection('owners').limit(10).get());
  });
  it('staff whose staff doc is revoked / suspended / moved / missing are denied at once', async () => {
    for (const who of BROKEN_STAFF) await assertFails(db(env, who).doc(`owners/${OWNER_A}`).get());
    // an active staff member with no permissions still sees the PG profile
    await assertSucceeds(db(env, 'staffANoPerms').doc(`owners/${OWNER_A}`).get());
  });
  it('residents, signed-out and suspended users are denied', async () => {
    await assertFails(db(env, 'resident').doc(`owners/${OWNER_A}`).get());
    await assertFails(db(env, 'anon').doc(`owners/${OWNER_A}`).get());
    await assertFails(db(env, 'suspendedOwnerA').doc(`owners/${OWNER_A}`).get());
    await assertFails(db(env, 'suspendedStaffA').doc(`owners/${OWNER_A}`).get());
  });
});

describe('staff/{staffUid}', () => {
  it('a staff member gets their own doc but not a colleague’s', async () => {
    await assertSucceeds(db(env, 'staffA').doc('staff/staffA').get());
    await assertFails(db(env, 'staffA').doc('staff/staffA2').get());
    await assertFails(db(env, 'staffA').doc('staff/staffB').get());
  });
  it('owner gets their own staff only; admin gets any', async () => {
    await assertSucceeds(db(env, 'ownerA').doc('staff/staffA2').get());
    await assertFails(db(env, 'ownerA').doc('staff/staffB').get());
    await assertSucceeds(db(env, 'admin').doc('staff/staffB').get());
  });
  it('nobody can list staff from the client (served via GET /api/staff)', async () => {
    await assertFails(db(env, 'ownerA').collection('staff').where('ownerId', '==', OWNER_A).limit(10).get());
    await assertFails(db(env, 'admin').collection('staff').limit(10).get());
    await assertFails(db(env, 'staffA').collection('staff').where('ownerId', '==', OWNER_A).limit(10).get());
  });
  it('a revoked staff member can still read their OWN record (to see they were revoked), nothing else', async () => {
    await assertSucceeds(db(env, 'revokedStaffA').doc('staff/staffA-revoked').get());
    await assertFails(db(env, 'revokedStaffA').doc('staff/staffA').get());
  });
  it('suspended staff, residents and signed-out users are denied', async () => {
    await assertFails(db(env, 'suspendedStaffA').doc('staff/staffA').get());
    await assertFails(db(env, 'resident').doc('staff/staffA').get());
    await assertFails(db(env, 'anon').doc('staff/staffA').get());
  });
});

describe('support_threads/{ownerId} + messages', () => {
  it('owner reads only their own thread and its messages', async () => {
    await assertSucceeds(db(env, 'ownerA').doc(`support_threads/${OWNER_A}`).get());
    await assertSucceeds(db(env, 'ownerA').doc(`support_threads/${OWNER_A}/messages/m1`).get());
    await assertSucceeds(db(env, 'ownerA').collection(`support_threads/${OWNER_A}/messages`).limit(50).get());
    await assertFails(db(env, 'ownerA').doc(`support_threads/${OWNER_B}`).get());
    await assertFails(db(env, 'ownerA').doc(`support_threads/${OWNER_B}/messages/m1`).get());
    await assertFails(db(env, 'ownerA').collection(`support_threads/${OWNER_B}/messages`).limit(50).get());
  });
  it('messages list must be bounded', async () => {
    await assertFails(db(env, 'ownerA').collection(`support_threads/${OWNER_A}/messages`).get());
    await assertFails(db(env, 'ownerA').collection(`support_threads/${OWNER_A}/messages`).limit(101).get());
  });
  it('only admin lists threads; owner cannot list even with an ownerId filter', async () => {
    await assertSucceeds(db(env, 'admin').collection('support_threads').limit(100).get());
    await assertFails(db(env, 'ownerA').collection('support_threads').where('ownerId', '==', OWNER_A).limit(10).get());
    await assertSucceeds(db(env, 'admin').doc(`support_threads/${OWNER_B}/messages/m1`).get());
    await assertSucceeds(db(env, 'admin').collection(`support_threads/${OWNER_B}/messages`).limit(100).get());
  });
  it("staff, residents, signed-out and suspended users can't read support chat", async () => {
    for (const who of ['staffA', 'resident', 'anon', 'suspendedOwnerA'] as const) {
      await assertFails(db(env, who).doc(`support_threads/${OWNER_A}`).get());
      await assertFails(db(env, who).doc(`support_threads/${OWNER_A}/messages/m1`).get());
    }
  });
});

describe('residents/{uid} (self only)', () => {
  it('a resident gets only their own profile', async () => {
    await assertSucceeds(db(env, 'resident').doc('residents/residentR').get());
    await assertFails(db(env, 'resident').doc('residents/residentS').get());
  });
  it('nobody lists residents — not even admin', async () => {
    await assertFails(db(env, 'resident').collection('residents').limit(10).get());
    await assertFails(db(env, 'admin').collection('residents').limit(10).get());
  });
  it('owners, staff, admin and signed-out users cannot get a resident profile', async () => {
    for (const who of ['ownerA', 'staffA', 'admin', 'anon'] as const) {
      await assertFails(db(env, who).doc('residents/residentR').get());
    }
  });
  it('suspended resident loses access to own profile', async () => {
    const suspended = env.authenticatedContext('residentR', { role: 'resident', suspended: true }).firestore();
    await assertFails(suspended.doc('residents/residentR').get());
  });
});

describe('metrics/{date} (admin get only)', () => {
  it('admin can get a day, but not list', async () => {
    await assertSucceeds(db(env, 'admin').doc('metrics/2026-11-27').get());
    await assertFails(db(env, 'admin').collection('metrics').limit(10).get());
  });
  it('everyone else is denied', async () => {
    for (const who of ['ownerA', 'staffA', 'resident', 'anon', 'suspendedAdmin'] as const) {
      await assertFails(db(env, who).doc('metrics/2026-11-27').get());
    }
  });
});
