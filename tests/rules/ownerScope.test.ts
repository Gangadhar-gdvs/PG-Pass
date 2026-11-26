import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ALL_STAFF_PERMISSIONS } from '@/lib/constants/permissions';
import { OWNER_ADMIN_ONLY, OWNER_SCOPED } from './collections';
import { BROKEN_STAFF, OWNER_A, OWNER_B, db, seed, singlePermStaffDb, startEnv, type PersonaKey } from './helpers';

/**
 * Owner-scoped business data:
 *   get  → the owning owner, admin, and ACTIVE staff of that owner (live staff
 *          doc) holding one of the collection's permissions ([] = any active staff)
 *   list → same, but the query must be provably owner-filtered and limit ≤ 100
 * Everyone else — the other owner and their staff, residents, signed-out users,
 * suspended/revoked/moved staff, malformed claims — is denied.
 */

let env: RulesTestEnvironment;
const COLLECTIONS = Object.keys(OWNER_SCOPED);

beforeAll(async () => {
  env = await startEnv('demo-rules-owner-scope');
  const docs: Record<string, Record<string, unknown>> = {};
  for (const col of [...COLLECTIONS, ...OWNER_ADMIN_ONLY]) {
    docs[`${col}/a1`] = { ownerId: OWNER_A, label: 'A-1', deletedAt: null };
    docs[`${col}/a2`] = { ownerId: OWNER_A, label: 'A-2', deletedAt: null };
    docs[`${col}/b1`] = { ownerId: OWNER_B, label: 'B-1', deletedAt: null };
  }
  await seed(env, docs);
});

afterAll(async () => {
  await env?.cleanup();
});

const listAs = (fs: ReturnType<typeof db>, col: string, ownerId: string, lim: number | null = 50) => {
  const q = fs.collection(col).where('ownerId', '==', ownerId);
  return (lim === null ? q : q.limit(lim)).get();
};
const expectAccess = (allowed: boolean, p: Promise<unknown>) => (allowed ? assertSucceeds(p) : assertFails(p));
const ownerList = (who: PersonaKey, col: string, ownerId: string, lim: number | null = 50) =>
  listAs(db(env, who), col, ownerId, lim);

describe.each(COLLECTIONS)('%s', (col) => {
  const needs = OWNER_SCOPED[col];

  it('owner A reads only their own docs', async () => {
    const snap = await assertSucceeds(db(env, 'ownerA').doc(`${col}/a1`).get());
    expect(snap.data()?.label).toBe('A-1');
    const list = await assertSucceeds(ownerList('ownerA', col, OWNER_A));
    expect(list.docs.map((d) => d.id).sort()).toEqual(['a1', 'a2']);
  });

  it("owner B cannot get or list owner A's docs (IDOR)", async () => {
    await assertFails(db(env, 'ownerB').doc(`${col}/a1`).get());
    await assertFails(ownerList('ownerB', col, OWNER_A));
    await assertSucceeds(db(env, 'ownerB').doc(`${col}/b1`).get());
  });

  it('owner cannot probe for existence of missing docs (get of a missing doc is denied)', async () => {
    await assertFails(db(env, 'ownerA').doc(`${col}/does-not-exist`).get());
  });

  it('list must be filtered by ownerId and bounded (limit ≤ 100)', async () => {
    await assertFails(db(env, 'ownerA').collection(col).limit(50).get());
    await assertFails(ownerList('ownerA', col, OWNER_A, null));
    await assertFails(ownerList('ownerA', col, OWNER_A, 101));
    await assertSucceeds(ownerList('ownerA', col, OWNER_A, 100));
  });

  it("fully-permissioned active staff read their owner's data only", async () => {
    await assertSucceeds(db(env, 'staffA').doc(`${col}/a1`).get());
    await assertSucceeds(ownerList('staffA', col, OWNER_A));
    await assertFails(db(env, 'staffA').doc(`${col}/b1`).get());
    await assertFails(ownerList('staffA', col, OWNER_B));
    await assertFails(db(env, 'staffB').doc(`${col}/a1`).get());
    await assertFails(ownerList('staffB', col, OWNER_A));
  });

  it(`staff need ${needs.length ? `one of [${needs.join(', ')}]` : 'no specific permission'}`, async () => {
    for (const perm of ALL_STAFF_PERMISSIONS) {
      const fs = singlePermStaffDb(env, perm);
      const allowed = needs.length === 0 || needs.includes(perm);
      await expectAccess(allowed, fs.doc(`${col}/a1`).get());
      await expectAccess(allowed, listAs(fs, col, OWNER_A));
    }
    await expectAccess(needs.length === 0, db(env, 'staffANoPerms').doc(`${col}/a1`).get());
    await expectAccess(needs.length === 0, ownerList('staffANoPerms', col, OWNER_A));
  });

  it('suspended / revoked / moved / doc-less staff are denied immediately (claims alone are not enough)', async () => {
    for (const who of BROKEN_STAFF) {
      await assertFails(db(env, who).doc(`${col}/a1`).get());
      await assertFails(ownerList(who, col, OWNER_A));
    }
  });

  it('malformed / non-staff claims never grant owner scope', async () => {
    await assertFails(db(env, 'residentWithOwnerClaim').doc(`${col}/a1`).get());
    await assertFails(ownerList('residentWithOwnerClaim', col, OWNER_A));
    await assertFails(db(env, 'adminClaimFalse').doc(`${col}/a1`).get());
  });

  it('residents and signed-out users cannot read owner data', async () => {
    await assertFails(db(env, 'resident').doc(`${col}/a1`).get());
    await assertFails(ownerList('resident', col, OWNER_A));
    await assertFails(db(env, 'anon').doc(`${col}/a1`).get());
    await assertFails(ownerList('anon', col, OWNER_A));
  });

  it('suspended owners and admins lose access', async () => {
    await assertFails(db(env, 'suspendedOwnerA').doc(`${col}/a1`).get());
    await assertFails(ownerList('suspendedOwnerA', col, OWNER_A));
    await assertFails(db(env, 'suspendedAdmin').doc(`${col}/a1`).get());
  });

  it('admin reads any owner (bounded list, filter optional)', async () => {
    await assertSucceeds(db(env, 'admin').doc(`${col}/a1`).get());
    await assertSucceeds(db(env, 'admin').doc(`${col}/b1`).get());
    await assertSucceeds(ownerList('admin', col, OWNER_B));
    const all = await assertSucceeds(db(env, 'admin').collection(col).limit(100).get());
    expect(all.size).toBe(3);
    await assertFails(db(env, 'admin').collection(col).get());
  });
});

describe.each(OWNER_ADMIN_ONLY)('%s (owner + admin only, never staff)', (col) => {
  it('owner reads own docs only (filtered, bounded list)', async () => {
    await assertSucceeds(db(env, 'ownerA').doc(`${col}/a1`).get());
    await assertSucceeds(ownerList('ownerA', col, OWNER_A));
    await assertFails(db(env, 'ownerA').doc(`${col}/b1`).get());
    await assertFails(ownerList('ownerA', col, OWNER_B));
    await assertFails(ownerList('ownerA', col, OWNER_A, 101));
    await assertFails(ownerList('ownerA', col, OWNER_A, null));
  });
  it("even fully-permissioned staff can't read them", async () => {
    await assertFails(db(env, 'staffA').doc(`${col}/a1`).get());
    await assertFails(ownerList('staffA', col, OWNER_A));
  });
  it('admin reads all (bounded); residents, signed-out and suspended owners are denied', async () => {
    await assertSucceeds(db(env, 'admin').doc(`${col}/b1`).get());
    await assertSucceeds(db(env, 'admin').collection(col).limit(100).get());
    await assertFails(db(env, 'admin').collection(col).get());
    for (const who of ['resident', 'anon', 'suspendedOwnerA'] as const) {
      await assertFails(db(env, who).doc(`${col}/a1`).get());
    }
  });
});
