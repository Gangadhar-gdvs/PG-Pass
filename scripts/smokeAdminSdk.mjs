// Smoke test: exercise the firebase-admin → @google-cloud/firestore → google-gax
// → gaxios/uuid path against the Firestore emulator, to confirm the uuid@11
// override (package.json overrides) works at runtime, not just at build time.
//
// Run via:  firebase emulators:exec --only firestore 'node scripts/smokeAdminSdk.mjs'
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || 'localhost:8080';

const app = initializeApp({ projectId: 'pgpass-demo' });
const db = getFirestore(app);
db.settings({ ignoreUndefinedProperties: true });

async function main() {
  const col = db.collection('_smoke');
  const ref = col.doc();

  // 1. Write
  await ref.set({ hello: 'world', at: Timestamp.now() });

  // 2. Read back
  const snap = await ref.get();
  if (!snap.exists || snap.data().hello !== 'world') {
    throw new Error('Read-back mismatch');
  }

  // 3. Transaction (exercises batched/commit request path)
  await db.runTransaction(async (tx) => {
    const d = await tx.get(ref);
    tx.update(ref, { counter: (d.data().counter || 0) + 1 });
  });

  // 4. Query
  const q = await col.where('hello', '==', 'world').limit(5).get();
  if (q.empty) throw new Error('Query returned nothing');

  // 5. Cleanup
  await ref.delete();

  console.log('SMOKE_OK: firebase-admin write/read/transaction/query succeeded with uuid@11 + grpc@1.14.7');
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error('SMOKE_FAIL:', err);
    process.exit(1);
  }
);
