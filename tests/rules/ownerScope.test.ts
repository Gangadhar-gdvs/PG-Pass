import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { OWNER_SCOPED } from './collections';
import { OWNER_A, OWNER_B, db, seed, startEnv, type PersonaKey } from './helpers';

/**
 * Owner-scoped business data (canReadOwnerScope + boundedList):
 *   get  → the owning owner, that owner's staff (role=staff + ownerId claim), admin
 *   list → same, but the query must be provably owner-filtered and limit ≤ 100
 * Everyone else — the other owner, the other owner's staff, residents, signed-out
 * users, suspended accounts, malformed staff claims — is denied.
 */

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await startEnv('demo-rules-owner-scope');
  const docs: Record<string, Record<string, unknown>> = {};
  for (const col of OWNER_SCOPED) {
    docs[`${col}/a1`] = { ownerId: OWNER_A, label: 'A-1', deletedAt: null };
    docs[`${col}/a2`] = { ownerId: OWNER_A, label: 'A-2', deletedAt: null };
    docs[`${col}/b1`] = { ownerId: OWNER_B, label: 'B-1', deletedAt: null };
  }
  await seed(env, docs);
});

afterAll(async () => {
  await env?.cleanup();
});

const ownerList = (who: PersonaKey, col: string, ownerId: string, lim: number | null = 50) => {
  const q = db(env, who).collection(col).where('ownerId', '==', ownerId);
  return (lim === null ? q : q.limit(lim)).get();
};

describe.each(OWNER_SCOPED)('%s', (col) => {
  it('owner A reads only their own docs', async () => {
    const snap = await assertSucceeds(db(env, 'ownerA').doc(`${col}/a1`).get());
    expect(snap.data()?.label).toBe('A-1');
    const list = await assertSucceeds(ownerList('ownerA', col, OWNER_A));
    expect(list.docs.map((d) => d.id).sort()).toEqual(['a1', 'a2']);
  });

  it("owner B cannot get or list owner A's docs (IDOR)", async () => {
    await assertFails(db(env, 'ownerB').doc(`${col}/a1`).get());
    await assertFails(ownerList('ownerB', col, OWNER_A));
    // B's own data is fine
    await assertSucceeds(db(env, 'ownerB').doc(`${col}/b1`).get());
  });

  it('owner cannot probe for existence of missing docs (get of a missing doc is denied)', async () => {
    await assertFails(db(env, 'ownerA').doc(`${col}/does-not-exist`).get());
  });

  it('list must be filtered by ownerId and bounded (limit ≤ 100)', async () => {
    await assertFails(db(env, 'ownerA').collection(col).limit(50).get()); // no ownerId filter
    await assertFails(ownerList('ownerA', col, OWNER_A, null)); // no limit
    await assertFails(ownerList('ownerA', col, OWNER_A, 101)); // over MAX_LIST_LIMIT
    await assertSucceeds(ownerList('ownerA', col, OWNER_A, 100));
  });

  it("staff read their owner's data only", async () => {
    await assertSucceeds(db(env, 'staffA').doc(`${col}/a1`).get());
    await assertSucceeds(ownerList('staffA', col, OWNER_A));
    await assertFails(db(env, 'staffA').doc(`${col}/b1`).get());
    await assertFails(ownerList('staffA', col, OWNER_B));
    await assertFails(db(env, 'staffB').doc(`${col}/a1`).get());
    await assertFails(ownerList('staffB', col, OWNER_A));
  });

  it('malformed / non-staff claims never grant owner scope', async () => {
    await assertFails(db(env, 'staffNoOwnerClaim').doc(`${col}/a1`).get());
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

  it('suspended accounts lose access', async () => {
    await assertFails(db(env, 'suspendedOwnerA').doc(`${col}/a1`).get());
    await assertFails(ownerList('suspendedOwnerA', col, OWNER_A));
    await assertFails(db(env, 'suspendedStaffA').doc(`${col}/a1`).get());
    await assertFails(db(env, 'suspendedAdmin').doc(`${col}/a1`).get());
  });

  it('admin reads any owner (bounded list, filter optional)', async () => {
    await assertSucceeds(db(env, 'admin').doc(`${col}/a1`).get());
    await assertSucceeds(db(env, 'admin').doc(`${col}/b1`).get());
    await assertSucceeds(ownerList('admin', col, OWNER_B));
    const all = await assertSucceeds(db(env, 'admin').collection(col).limit(100).get());
    expect(all.size).toBe(3);
    await assertFails(db(env, 'admin').collection(col).get()); // unbounded
  });
});
