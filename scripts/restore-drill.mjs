// Backup → restore drill against the Firestore EMULATOR (runbook §3).
//
// Exercises the real nightly-backup artifact format end to end and measures the
// time of each phase (the RTO for this data size):
//   1 export   — paginate each collection exactly like app/api/cron/backup, then
//                NDJSON → gzip → AES-256-GCM via lib/server/backup/format.ts
//                (byte-compatible with the route; see tests/unit/backupFormat)
//   2 store    — write one artifact per collection to a local dir laid out like
//                the B2 bucket (backups/<date>/<col>.ndjson.gz.enc) — no B2
//   3 fetch    — read the artifacts back from disk (stands in for the B2 download)
//   4 decode   — decrypt + gunzip + parse
//   5 import   — wipe the target project, then write every doc (Timestamps revived)
//   6 verify   — per-collection counts + field-level equality on a sample
//
// Usage (emulators running; see docs/runbook.md §3):
//   npm run restore:drill                       # demo-pgpass → demo-restore, nightly collections
//   npm run restore:drill -- --collections=all  # every top-level collection (shows backup gaps)
//   npm run restore:drill -- --synthetic=5000 --source=demo-drill-src   # sized drill on synthetic data
// Flags: --source=<id> --target=<id> --collections=backup|all|a,b --sample=<n>
//        --out=<dir> --keep (keep artifacts) --synthetic=<tenants> --unthrottled
//        --naive-import (negative control: skip Timestamp revival → verify must FAIL)
//
// Safety: refuses to run unless FIRESTORE_EMULATOR_HOST is a loopback address and
// the target is a `demo-*` project different from the source.
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import {
  BACKUP_COLLECTIONS,
  backupObjectKey,
  decodeCollection,
  encodeCollection,
  reviveRow,
} from '../lib/server/backup/format.ts';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, ...v] = a.replace(/^--/, '').split('=');
    return [k, v.length ? v.join('=') : true];
  })
);

const EMULATOR = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
process.env.FIRESTORE_EMULATOR_HOST = EMULATOR;
const SOURCE = String(args.source || 'demo-pgpass');
const TARGET = String(args.target || 'demo-restore');
const SAMPLE = Number(args.sample || 100);
const SYNTHETIC = Number(args.synthetic || 0);
const OUT = path.resolve(
  String(args.out || path.join(os.tmpdir(), 'pgpass-restore-drill', new Date().toISOString().replace(/[:.]/g, '-')))
);

function die(msg) {
  console.error(`restore-drill: ${msg}`);
  process.exit(2);
}
if (!/^(127\.0\.0\.1|localhost|\[::1\]|::1):\d+$/.test(EMULATOR)) die(`FIRESTORE_EMULATOR_HOST must be loopback, got ${EMULATOR}`);
if (!TARGET.startsWith('demo-')) die('target project must be a demo-* emulator project');
if (TARGET === SOURCE) die('target must differ from source');
if (SYNTHETIC && SOURCE === 'demo-pgpass') die('--synthetic seeds the SOURCE; use e.g. --source=demo-drill-src');

// Use the configured key if it is a proper 32-byte hex key, else an ephemeral one.
const envKey = process.env.BACKUP_ENCRYPTION_KEY || '';
const KEY = /^[0-9a-f]{64}$/i.test(envKey) ? envKey : randomBytes(32).toString('hex');
const KEY_SOURCE = KEY === envKey ? 'BACKUP_ENCRYPTION_KEY' : 'ephemeral random key';

const src = getFirestore(initializeApp({ projectId: SOURCE }, 'drill-src'));
const dst = getFirestore(initializeApp({ projectId: TARGET }, 'drill-dst'));

const timings = [];
async function phase(name, fn) {
  const t0 = performance.now();
  const result = await fn();
  timings.push({ phase: name, ms: performance.now() - t0 });
  return result;
}

// ---------- helpers ----------
async function exportCollection(db, colName) {
  // Same pagination as the route: orderBy(__name__) + limit(1000) + startAfter.
  const PAGE = 1000;
  const docs = [];
  let lastDoc;
  for (;;) {
    let q = db.collection(colName).orderBy('__name__').limit(PAGE);
    if (lastDoc) q = q.startAfter(lastDoc);
    const snap = await q.get();
    if (snap.empty) break;
    for (const d of snap.docs) docs.push({ id: d.id, data: d.data() });
    lastDoc = snap.docs[snap.docs.length - 1];
    if (snap.size < PAGE) break;
  }
  return docs;
}

function equal(a, b, stats) {
  if (a instanceof Timestamp) {
    stats.timestamps++;
    return b instanceof Timestamp && a.isEqual(b);
  }
  if (a === null) {
    stats.nulls++;
    return b === null;
  }
  if (Array.isArray(a)) return Array.isArray(b) && a.length === b.length && a.every((x, i) => equal(x, b[i], stats));
  if (typeof a === 'object') {
    if (b === null || typeof b !== 'object' || Array.isArray(b) || b instanceof Timestamp) return false;
    const ka = Object.keys(a).sort();
    const kb = Object.keys(b).sort();
    return ka.length === kb.length && ka.every((k, i) => k === kb[i] && equal(a[k], b[k], stats));
  }
  stats.scalars++;
  return a === b;
}

function countTimestamps(v) {
  if (v instanceof Timestamp) return 1;
  if (Array.isArray(v)) return v.reduce((n, x) => n + countTimestamps(x), 0);
  if (v && typeof v === 'object') return Object.values(v).reduce((n, x) => n + countTimestamps(x), 0);
  return 0;
}

async function seedSynthetic(db, tenants) {
  const owners = Math.max(1, Math.ceil(tenants / 40));
  const now = Timestamp.now();
  const w = db.bulkWriter({ throttling: false });
  for (let o = 0; o < owners; o++) {
    const ownerId = `syn-owner-${o}`;
    w.set(db.doc(`owners/${ownerId}`), { id: ownerId, pgName: `Synthetic PG ${o}`, plan: 'free', createdAt: now, deletedAt: null });
  }
  for (let i = 0; i < tenants; i++) {
    const ownerId = `syn-owner-${i % owners}`;
    const bedId = `syn-bed-${i}`;
    const tenantId = `syn-t-${i}`;
    const paid = i % 3 === 0;
    w.set(db.doc(`beds/${bedId}`), { id: bedId, ownerId, roomNumber: String(100 + (i % 50)), monthlyRent: 750000, status: 'occupied', tenantId, deletedAt: null, createdAt: now, updatedAt: now });
    w.set(db.doc(`tenants/${tenantId}`), { id: tenantId, ownerId, bedId, name: `Resident ${i}`, phone: `9${String(i).padStart(9, '0')}`, depositPaidPaise: 500000, moveInDate: '2026-01-05', deletedAt: null, createdAt: now, updatedAt: now });
    w.set(db.doc(`rent_records/${tenantId}_2026-11`), { id: `${tenantId}_2026-11`, ownerId, tenantId, period: '2026-11', amountPaise: 750000, paidPaise: paid ? 750000 : 0, status: paid ? 'paid' : 'pending', paidAt: paid ? now : null, createdAt: now });
    w.set(db.doc(`deposits/syn-dep-${i}`), { ownerId, tenantId, amountPaise: 500000, type: 'collected', createdAt: now });
  }
  await w.close();
}

// ---------- drill ----------
async function main() {
  const date = new Date().toISOString().split('T')[0];
  console.log(`PGPass restore drill  ${SOURCE} → ${TARGET}  (emulator ${EMULATOR})`);
  console.log(`artifacts: ${OUT}   key: ${KEY_SOURCE}   import: ${args.unthrottled ? 'unthrottled' : 'BulkWriter 500/50/5 ramp'}`);

  if (SYNTHETIC) {
    const t0 = performance.now();
    await fetch(`http://${EMULATOR}/emulator/v1/projects/${SOURCE}/databases/(default)/documents`, { method: 'DELETE' });
    await seedSynthetic(src, SYNTHETIC);
    console.log(`seeded synthetic source: ${SYNTHETIC} tenants (${((performance.now() - t0) / 1000).toFixed(1)}s, not part of RTO)`);
  }

  const topLevel = (await src.listCollections()).map((c) => c.id).sort();
  let collections;
  if (args.collections === 'all') collections = topLevel;
  else if (typeof args.collections === 'string' && args.collections !== 'backup') collections = args.collections.split(',');
  else collections = [...BACKUP_COLLECTIONS];

  // 1+2. export + encode + store
  const exported = {};
  const bytes = {};
  await phase('1 export (Firestore read)', async () => {
    for (const c of collections) exported[c] = await exportCollection(src, c);
  });
  const blobs = {};
  await phase('2 encode (NDJSON+gzip+AES-GCM)', async () => {
    for (const c of collections) if (exported[c].length) blobs[c] = encodeCollection(exported[c], KEY);
  });
  await phase('3 store artifacts (local disk)', async () => {
    for (const [c, blob] of Object.entries(blobs)) {
      const file = path.join(OUT, backupObjectKey(date, c));
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, blob);
      bytes[c] = blob.length;
    }
  });

  // ---- restore side: only the artifacts + key are used from here on ----
  const fetched = {};
  await phase('4 fetch artifacts', async () => {
    for (const c of Object.keys(blobs)) fetched[c] = await readFile(path.join(OUT, backupObjectKey(date, c)));
  });
  const decoded = {};
  await phase('5 decrypt+gunzip+parse', async () => {
    // --naive-import skips Timestamp revival (what runbook step 4 used to describe)
    // to prove the verifier catches it.
    const toDoc = args['naive-import'] ? ({ _id, ...data }) => ({ id: _id, data }) : reviveRow;
    for (const [c, blob] of Object.entries(fetched)) decoded[c] = decodeCollection(blob, KEY).map(toDoc);
  });
  await phase('6 import into target', async () => {
    const res = await fetch(`http://${EMULATOR}/emulator/v1/projects/${TARGET}/databases/(default)/documents`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`could not clear ${TARGET}: HTTP ${res.status}`);
    // Default BulkWriter applies Google's 500/50/5 ramp-up (starts at 500 ops/s),
    // which is what a restore into a FRESH production database should respect.
    // --unthrottled shows raw emulator speed for comparison.
    const w = dst.bulkWriter(args.unthrottled ? { throttling: false } : undefined);
    for (const [c, docs] of Object.entries(decoded)) for (const d of docs) w.set(dst.collection(c).doc(d.id), d.data);
    await w.close();
  });

  // 7. verify
  const rows = [];
  let failures = 0;
  const stats = { timestamps: 0, nulls: 0, scalars: 0 };
  await phase('7 verify (counts + sample fields)', async () => {
    for (const c of collections) {
      const want = exported[c];
      const got = (await dst.collection(c).count().get()).data().count;
      const step = Math.max(1, Math.floor(want.length / Math.max(1, SAMPLE)));
      const sample = want.filter((_, i) => i % step === 0).slice(0, SAMPLE);
      const snaps = sample.length ? await dst.getAll(...sample.map((d) => dst.collection(c).doc(d.id))) : [];
      let mismatched = 0;
      snaps.forEach((s, i) => {
        if (!s.exists || !equal(sample[i].data, s.data(), stats)) {
          mismatched++;
          if (mismatched <= 3) console.error(`  MISMATCH ${c}/${sample[i].id}`);
        }
      });
      const ok = got === want.length && mismatched === 0;
      if (!ok) failures++;
      rows.push({
        collection: c,
        source: want.length,
        restored: got,
        sampled: sample.length,
        mismatched,
        timestamps: want.reduce((n, d) => n + countTimestamps(d.data), 0),
        artifactBytes: bytes[c] || 0,
        ok: ok ? 'yes' : 'NO',
      });
    }
  });

  const totalDocs = rows.reduce((n, r) => n + r.source, 0);
  const totalTs = rows.reduce((n, r) => n + r.timestamps, 0);
  console.log('\nPer collection:');
  console.table(rows);
  console.log('Phase timings:');
  console.table(timings.map((t) => ({ phase: t.phase, ms: Math.round(t.ms) })));
  const restoreMs = timings.filter((t) => /^[4-7] /.test(t.phase)).reduce((n, t) => n + t.ms, 0);
  const totalMs = timings.reduce((n, t) => n + t.ms, 0);
  console.log(
    `docs: ${totalDocs} · artifact bytes: ${Object.values(bytes).reduce((a, b) => a + b, 0)} · ` +
      `fields compared: ${stats.timestamps} Timestamps, ${stats.nulls} nulls, ${stats.scalars} scalars`
  );
  console.log(`Timestamps revived from {_seconds,_nanoseconds} maps: ${totalTs} (a naive JSON import would store these as plain maps)`);
  console.log(`backup side ${(totalMs - restoreMs).toFixed(0)} ms · restore side (fetch→verify) ${restoreMs.toFixed(0)} ms · total ${totalMs.toFixed(0)} ms`);
  if (totalDocs > 0) console.log(`restore throughput ≈ ${Math.round(totalDocs / (restoreMs / 1000))} docs/s on the emulator`);

  const notBackedUp = topLevel.filter((c) => !BACKUP_COLLECTIONS.includes(c));
  if (notBackedUp.length) {
    const counts = await Promise.all(notBackedUp.map(async (c) => `${c}(${(await src.collection(c).count().get()).data().count})`));
    console.log(`\n⚠ Collections present in ${SOURCE} but NOT in the nightly backup: ${counts.join(', ')}`);
  }
  // Sub-collections can't be represented by the per-collection NDJSON format.
  const nested = new Set();
  for (const c of collections) {
    if (exported[c].length > 2000) continue;
    for (const d of exported[c]) for (const sub of await src.collection(c).doc(d.id).listCollections()) nested.add(`${c}/*/${sub.id}`);
  }
  if (nested.size) console.log(`⚠ Sub-collections not representable in the backup format: ${[...nested].join(', ')}`);

  await writeFile(path.join(OUT, 'drill-report.json'), JSON.stringify({ source: SOURCE, target: TARGET, date, rows, timings, stats }, null, 2));
  if (!args.keep) await rm(path.join(OUT, 'backups'), { recursive: true, force: true });

  if (failures) {
    console.error(`\nRESTORE DRILL FAILED: ${failures} collection(s) did not verify`);
    process.exit(1);
  }
  console.log(`\nRESTORE DRILL OK — ${rows.length} collections verified (report: ${path.join(OUT, 'drill-report.json')})`);
  process.exit(0);
}

main().catch((e) => {
  console.error('RESTORE DRILL ERROR:', e);
  process.exit(1);
});
