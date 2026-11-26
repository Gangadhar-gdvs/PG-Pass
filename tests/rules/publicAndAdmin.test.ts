import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ADMIN_BOUNDED, CATCH_ALL_EXAMPLES, SERVER_ONLY } from './collections';
import { OWNER_A, concrete, db, seed, startEnv, type PersonaKey } from './helpers';

let env: RulesTestEnvironment;

const EVERYONE: PersonaKey[] = ['ownerA', 'ownerB', 'staffA', 'admin', 'resident', 'anon'];
const NON_ADMIN: PersonaKey[] = ['ownerA', 'staffA', 'resident', 'anon', 'suspendedAdmin', 'adminClaimFalse'];

beforeAll(async () => {
  env = await startEnv('demo-rules-public-admin');
  const docs: Record<string, Record<string, unknown>> = {};
  for (const col of [...ADMIN_BOUNDED, ...SERVER_ONLY, ...CATCH_ALL_EXAMPLES.map((c) => concrete(c))]) {
    docs[`${col}/d1`] = { ownerId: OWNER_A, tenantId: 't1' };
  }
  await seed(env, docs);
});

afterAll(async () => {
  await env?.cleanup();
});

describe('R-S1/R-S2: reviews + gallery metadata are API-only', () => {
  it('nobody — signed out, owner, staff, resident or admin — reads pg_reviews / property_photos directly', async () => {
    await seed(env, {
      'pg_reviews/hidden1': { ownerId: OWNER_A, propertyId: 'propA', reviewerUid: 'residentR', hidden: true },
      'property_photos/ph1': { ownerId: OWNER_A, propertyId: 'propA', uploadedBy: OWNER_A },
    });
    for (const who of [...EVERYONE, 'staffANoPerms'] as PersonaKey[]) {
      await assertFails(db(env, who).doc('pg_reviews/hidden1').get());
      await assertFails(db(env, who).collection('pg_reviews').where('propertyId', '==', 'propA').limit(20).get());
      await assertFails(db(env, who).doc('property_photos/ph1').get());
      await assertFails(db(env, who).collection('property_photos').where('propertyId', '==', 'propA').limit(20).get());
    }
  });
});

describe.each(ADMIN_BOUNDED)('admin-only (bounded): %s', (col) => {
  it('admin can list with limit ≤ 100', async () => {
    const snap = await assertSucceeds(db(env, 'admin').collection(col).limit(100).get());
    expect(snap.size).toBe(1);
    await assertFails(db(env, 'admin').collection(col).get());
    await assertFails(db(env, 'admin').collection(col).limit(101).get());
  });
  it('R-S4: admin can get a single doc (get is not subject to the list bound)', async () => {
    const snap = await assertSucceeds(db(env, 'admin').doc(`${col}/d1`).get());
    expect(snap.data()?.ownerId).toBe(OWNER_A);
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
