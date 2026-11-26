import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ADMIN_BOUNDED, CATCH_ALL_EXAMPLES, PUBLIC_READ, SERVER_ONLY } from './collections';
import { OWNER_A, concrete, db, seed, startEnv, type PersonaKey } from './helpers';

let env: RulesTestEnvironment;

const EVERYONE: PersonaKey[] = ['ownerA', 'ownerB', 'staffA', 'admin', 'resident', 'anon'];
const NON_ADMIN: PersonaKey[] = ['ownerA', 'staffA', 'resident', 'anon', 'suspendedAdmin', 'adminClaimFalse'];

beforeAll(async () => {
  env = await startEnv('demo-rules-public-admin');
  const docs: Record<string, Record<string, unknown>> = {};
  for (const col of PUBLIC_READ) {
    docs[`${col}/p1`] = { ownerId: OWNER_A, propertyId: 'propA', hidden: false };
    docs[`${col}/p2`] = { ownerId: OWNER_A, propertyId: 'propA', hidden: true };
  }
  for (const col of [...ADMIN_BOUNDED, ...SERVER_ONLY, ...CATCH_ALL_EXAMPLES.map((c) => concrete(c))]) {
    docs[`${col}/d1`] = { ownerId: OWNER_A, tenantId: 't1' };
  }
  await seed(env, docs);
});

afterAll(async () => {
  await env?.cleanup();
});

describe.each(PUBLIC_READ)('public read: %s', (col) => {
  it('anyone — including signed-out visitors — can get and list (bounded)', async () => {
    for (const who of EVERYONE) {
      await assertSucceeds(db(env, who).doc(`${col}/p1`).get());
      await assertSucceeds(db(env, who).collection(col).where('propertyId', '==', 'propA').limit(20).get());
    }
  });
  it('list must be bounded (limit ≤ 100)', async () => {
    await assertFails(db(env, 'anon').collection(col).get());
    await assertFails(db(env, 'anon').collection(col).limit(101).get());
    await assertSucceeds(db(env, 'anon').collection(col).limit(100).get());
  });
  it('documents current behaviour: the rule does not filter on `hidden` (see report)', async () => {
    // pg_reviews.hidden (admin moderation) is only enforced in reviews.service; the
    // rule is `allow get: if true`, so a hidden doc is still client-readable.
    const snap = await assertSucceeds(db(env, 'anon').doc(`${col}/p2`).get());
    expect(snap.exists).toBe(true);
  });
});

describe.each(ADMIN_BOUNDED)('admin-only (bounded): %s', (col) => {
  it('admin can list with limit ≤ 100', async () => {
    const snap = await assertSucceeds(db(env, 'admin').collection(col).limit(100).get());
    expect(snap.size).toBe(1);
    await assertFails(db(env, 'admin').collection(col).get());
    await assertFails(db(env, 'admin').collection(col).limit(101).get());
  });
  it('documents current behaviour: admin single-doc GET is denied (boundedList() on a get — see report)', async () => {
    // `allow get, list: if isAdmin() && boundedList()` — a get has no query limit,
    // so boundedList() can never hold and the get is denied even for admins.
    await assertFails(db(env, 'admin').doc(`${col}/d1`).get());
  });
  it('non-admins (incl. the doc’s owner, suspended admins, admin:false) are denied', async () => {
    for (const who of NON_ADMIN) {
      await assertFails(db(env, who).doc(`${col}/d1`).get());
      await assertFails(db(env, who).collection(col).limit(10).get());
    }
    await assertFails(db(env, 'ownerA').collection(col).where('ownerId', '==', OWNER_A).limit(10).get());
  });
});

describe.each([...SERVER_ONLY, ...CATCH_ALL_EXAMPLES])('server-only (no client reads): %s', (pattern) => {
  const col = concrete(pattern);
  it('nobody can get or list — not the doc owner, staff, resident or admin', async () => {
    for (const who of [...EVERYONE, 'staffB', 'suspendedOwnerA'] as PersonaKey[]) {
      await assertFails(db(env, who).doc(`${col}/d1`).get());
      await assertFails(db(env, who).collection(col).limit(10).get());
      await assertFails(db(env, who).collection(col).where('ownerId', '==', OWNER_A).limit(10).get());
    }
  });
});
