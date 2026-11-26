import { assertFails } from '@firebase/rules-unit-testing';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { afterAll, beforeAll, describe, it } from 'vitest';
import { ALL_CLASSIFIED, CATCH_ALL_EXAMPLES } from './collections';
import { OWNER_A, PERSONAS, concrete, db, seed, startEnv, type PersonaKey } from './helpers';

/**
 * "Server is the only writer": firestore.rules must deny EVERY client write —
 * create, overwrite, update and delete — on every collection, for every identity
 * including admins and the doc's own owner.
 */

const WRITERS: PersonaKey[] = ['ownerA', 'staffA', 'admin', 'resident', 'anon'];
const COLLECTIONS = [
  ...ALL_CLASSIFIED.filter((c) => c !== '**').map(concrete),
  ...CATCH_ALL_EXAMPLES.map((c) => concrete(c)),
];

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await startEnv('demo-rules-writes');
  // Pre-existing docs: one owned by A, plus one whose id equals each writer's
  // uid (owners/{uid}, residents/{uid}, staff/{uid}, support_threads/{uid}).
  const docs: Record<string, Record<string, unknown>> = {};
  for (const col of COLLECTIONS) {
    docs[`${col}/existingA`] = { ownerId: OWNER_A, name: 'seed' };
    for (const w of WRITERS) {
      const uid = PERSONAS[w]?.uid;
      if (uid) docs[`${col}/${uid}`] = { ownerId: OWNER_A, name: 'self-seed' };
    }
  }
  await seed(env, docs);
});

afterAll(async () => {
  await env?.cleanup();
});

describe('every collection denies all client writes', () => {
  it.each(COLLECTIONS)('%s', async (col) => {
    for (const who of WRITERS) {
      const fs = db(env, who);
      const uid = PERSONAS[who]?.uid ?? 'anon';
      const payload = { ownerId: OWNER_A, name: `by-${who}` };
      // create (fresh id, and the persona's own id where the rules key docs by uid)
      await assertFails(fs.doc(`${col}/fresh-${who}`).set(payload));
      await assertFails(fs.collection(col).add(payload));
      // overwrite / update / delete an existing doc — the owner's and the persona's own
      for (const id of ['existingA', uid]) {
        await assertFails(fs.doc(`${col}/${id}`).set(payload));
        await assertFails(fs.doc(`${col}/${id}`).set({ name: 'merge' }, { merge: true }));
        await assertFails(fs.doc(`${col}/${id}`).update({ name: 'updated' }));
        await assertFails(fs.doc(`${col}/${id}`).delete());
      }
      // batched write is evaluated per-document — still denied
      const batch = fs.batch();
      batch.set(fs.doc(`${col}/batch-${who}`), payload);
      await assertFails(batch.commit());
    }
  });
});
