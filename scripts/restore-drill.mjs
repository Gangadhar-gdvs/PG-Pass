// Backup → restore drill against the Firebase EMULATORS (runbook §3).
//
// Runs the real nightly-backup format (v2, lib/server/backup/format.ts — the same
// module the cron route uses) end to end and times each phase (= the RTO for
// this data size):
//   1 export   — every backed-up collection + sub-collection (same exporter as
//                the route) + Firebase Auth users
//   2 encode   — typed NDJSON → gzip → AES-256-GCM, one artifact each + manifest
//   3 store    — write them to a local dir laid out like the B2 bucket (no B2)
//   4 fetch    — read manifest + artifacts back, check bytes + sha256
//   5 decode   — decrypt + gunzip + parse (header counts checked)
//   6 import   — wipe the target project (Firestore + Auth), write every doc,
//                re-create every auth user (importUsers)
//   7 verify   — re-export the target and compare EVERY doc field-by-field
//                (Timestamps, nulls, refs, bytes, `_id` fields…) + every user
//
// Usage (emulators running; see docs/runbook.md §3):
//   npm run restore:drill                                    # demo-pgpass → demo-restore
//   npm run restore:drill -- --collections=all --target=demo-restore-all   # + excluded/unknown collections
//   npm run restore:drill -- --synthetic=5000 --source=demo-drill-src --target=demo-restore-syn
// Flags: --source=<id> --target=<id> --collections=backup|all|a,b --out=<dir> --keep
//        --synthetic=<tenants> --unthrottled --no-auth
//        --hash-config=<json file> (SCRYPT params → restore password hashes; real projects only)
//        --naive-import (negative control: skip typed decoding → verify must FAIL)
//
// Safety: refuses non-loopback emulator hosts and non-`demo-*` targets.
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { DocumentReference, GeoPoint, Timestamp, getFirestore } from 'firebase-admin/firestore';
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import zlib from 'node:zlib';
import {
  BACKUP_COLLECTIONS,
  BACKUP_SPECS,
  EXCLUDED_FROM_BACKUP,
  authArtifact,
  collectionArtifact,
  decodeArtifact,
  decryptAes256Gcm,
  exportAuthUsers,
  exportCollectionDocs,
  importAuthUsers,
  manifestKey,
  newManifest,
  sha256Hex,
} from '../lib/server/backup/format.ts';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, ...v] = a.replace(/^--/, '').split('=');
    return [k, v.length ? v.join('=') : true];
  })
);

const FS_HOST = (process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8080');
const AUTH_HOST = (process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099');
const SOURCE = String(args.source || 'demo-pgpass');
const TARGET = String(args.target || 'demo-restore');
const SYNTHETIC = Number(args.synthetic || 0);
const WITH_AUTH = !args['no-auth'];
const OUT = path.resolve(
  String(args.out || path.join(os.tmpdir(), 'pgpass-restore-drill', new Date().toISOString().replace(/[:.]/g, '-')))
);

function die(msg) {
  console.error(`restore-drill: ${msg}`);
  process.exit(2);
}
const LOOPBACK = /^(127\.0\.0\.1|localhost|\[::1\]|::1):\d+$/;
if (!LOOPBACK.test(FS_HOST) || !LOOPBACK.test(AUTH_HOST)) die('emulator hosts must be loopback');
if (!TARGET.startsWith('demo-')) die('target project must be a demo-* emulator project');
if (TARGET === SOURCE) die('target must differ from source');
if (SYNTHETIC && SOURCE === 'demo-pgpass') die('--synthetic seeds the SOURCE; use e.g. --source=demo-drill-src');

const envKey = process.env.BACKUP_ENCRYPTION_KEY || '';
const KEY = /^[0-9a-f]{64}$/i.test(envKey) ? envKey : randomBytes(32).toString('hex');
const KEY_SOURCE = KEY === envKey ? 'BACKUP_ENCRYPTION_KEY' : 'ephemeral random key';
const hashConfig = args['hash-config'] ? JSON.parse(await readFile(String(args['hash-config']), 'utf8')) : undefined;
if (hashConfig) for (const k of ['key', 'saltSeparator']) if (hashConfig[k]) hashConfig[k] = Buffer.from(hashConfig[k], 'base64');

const srcApp = initializeApp({ projectId: SOURCE }, 'drill-src');
const dstApp = initializeApp({ projectId: TARGET }, 'drill-dst');
const src = getFirestore(srcApp);
const dst = getFirestore(dstApp);
const srcAuth = getAuth(srcApp);
const dstAuth = getAuth(dstApp);

const timings = [];
async function phase(name, fn) {
  const t0 = performance.now();
  const result = await fn();
  timings.push({ phase: name, ms: performance.now() - t0 });
  return result;
}

// ---------- helpers ----------
function equal(a, b, stats) {
  if (a instanceof Timestamp) return stats.timestamps++, b instanceof Timestamp && a.isEqual(b);
  if (a instanceof GeoPoint) return b instanceof GeoPoint && a.isEqual(b);
  if (a instanceof DocumentReference) return b instanceof DocumentReference && a.path === b.path;
  if (a instanceof Uint8Array) return b instanceof Uint8Array && Buffer.from(a).equals(Buffer.from(b));
  if (a === null) return stats.nulls++, b === null;
  if (Array.isArray(a)) return Array.isArray(b) && a.length === b.length && a.every((x, i) => equal(x, b[i], stats));
  if (typeof a === 'object') {
    if (b === null || typeof b !== 'object' || Array.isArray(b) || b instanceof Timestamp) return false;
    const ka = Object.keys(a).sort();
    const kb = Object.keys(b).sort();
    return ka.length === kb.length && ka.every((k, i) => k === kb[i] && equal(a[k], b[k], stats));
  }
  stats.scalars++;
  return a === b || (Number.isNaN(a) && Number.isNaN(b));
}

const countTimestamps = (v) =>
  v instanceof Timestamp ? 1
  : Array.isArray(v) ? v.reduce((n, x) => n + countTimestamps(x), 0)
  : v && typeof v === 'object' && !(v instanceof Uint8Array) && !(v instanceof DocumentReference) && !(v instanceof GeoPoint)
    ? Object.values(v).reduce((n, x) => n + countTimestamps(x), 0)
  : 0;

const userView = (u) => ({
  email: u.email ?? null,
  phoneNumber: u.phoneNumber ?? null,
  displayName: u.displayName ?? null,
  disabled: Boolean(u.disabled),
  emailVerified: Boolean(u.emailVerified),
  customClaims: u.customClaims ?? null,
  federated: u.providerData.filter((p) => !['password', 'phone'].includes(p.providerId)).map((p) => `${p.providerId}:${p.uid}`).sort(),
});

async function wipe(projectId) {
  for (const url of [
    `http://${FS_HOST}/emulator/v1/projects/${projectId}/databases/(default)/documents`,
    ...(WITH_AUTH ? [`http://${AUTH_HOST}/emulator/v1/projects/${projectId}/accounts`] : []),
  ]) {
    const res = await fetch(url, { method: 'DELETE' });
    if (!res.ok) throw new Error(`could not clear ${url}: HTTP ${res.status}`);
  }
}

async function seedSynthetic(tenants) {
  const owners = Math.max(1, Math.ceil(tenants / 40));
  const now = Timestamp.now();
  const w = src.bulkWriter({ throttling: false });
  for (let o = 0; o < owners; o++) {
    const ownerId = `syn-owner-${o}`;
    w.set(src.doc(`owners/${ownerId}`), { id: ownerId, pgName: `Synthetic PG ${o}`, plan: 'free', createdAt: now, deletedAt: null });
    w.set(src.doc(`support_threads/${ownerId}`), { ownerId, lastMessage: 'hello', lastAt: now });
    for (let m = 0; m < 3; m++) w.set(src.doc(`support_threads/${ownerId}/messages/m${m}`), { sender: m % 2 ? 'admin' : 'owner', text: `msg ${m}`, createdAt: now });
  }
  for (let i = 0; i < tenants; i++) {
    const ownerId = `syn-owner-${i % owners}`;
    const bedId = `syn-bed-${i}`;
    const tenantId = `syn-t-${i}`;
    const paid = i % 3 === 0;
    w.set(src.doc(`beds/${bedId}`), { id: bedId, ownerId, roomNumber: String(100 + (i % 50)), monthlyRent: 7500, status: 'occupied', tenantId, deletedAt: null, createdAt: now, updatedAt: now });
    w.set(src.doc(`tenants/${tenantId}`), {
      id: tenantId, ownerId, bedId, name: `Resident ${i}`, phone: `9${String(i).padStart(9, '0')}`, depositPaidPaise: 500000,
      moveInDate: '2026-01-05', deletedAt: null, createdAt: now, updatedAt: now,
      // format edge cases: v1 let a field named `_id` hijack the doc id
      ...(i === 0 ? { _id: 'not-the-id', meta: { __pgpass: 'user map using the tag key' }, geo: new GeoPoint(17.4, 78.4), raw: Buffer.from('ok') } : {}),
    });
    w.set(src.doc(`rent_records/${tenantId}_2026-11`), { id: `${tenantId}_2026-11`, ownerId, tenantId, period: '2026-11', amountDuePaise: 750000, amountPaidPaise: paid ? 750000 : 0, status: paid ? 'paid' : 'pending', paidAt: paid ? now : null, createdAt: now });
    w.set(src.doc(`deposits/syn-dep-${i}`), { ownerId, tenantId, amountPaise: 500000, type: 'collected', createdAt: now });
  }
  await w.close();
  if (WITH_AUTH) {
    const users = Array.from({ length: Math.min(tenants, 1000) }, (_, i) => ({
      uid: `syn-user-${i}`,
      email: `user${i}@drill.test`,
      displayName: `User ${i}`,
      customClaims: i % 10 === 0 ? { role: 'staff', ownerId: `syn-owner-${i % owners}` } : { role: 'resident' },
    }));
    await srcAuth.importUsers(users);
  }
}

// ---------- drill ----------
async function main() {
  const date = new Date().toISOString().split('T')[0];
  console.log(`PGPass restore drill  ${SOURCE} → ${TARGET}  (firestore ${FS_HOST}, auth ${AUTH_HOST})`);
  console.log(`artifacts: ${OUT}   key: ${KEY_SOURCE}   import: ${args.unthrottled ? 'unthrottled' : 'BulkWriter 500/50/5 ramp'}`);

  if (SYNTHETIC) {
    const t0 = performance.now();
    await wipe(SOURCE);
    await seedSynthetic(SYNTHETIC);
    console.log(`seeded synthetic source: ${SYNTHETIC} tenants (${((performance.now() - t0) / 1000).toFixed(1)}s, not part of RTO)`);
  }

  const topLevel = (await src.listCollections()).map((c) => c.id).sort();
  const extra = topLevel.filter((c) => !BACKUP_COLLECTIONS.includes(c));
  let specs = [...BACKUP_SPECS];
  if (args.collections === 'all') specs = [...specs, ...extra.map((c) => ({ path: c, name: c }))];
  else if (typeof args.collections === 'string' && args.collections !== 'backup') {
    const wanted = args.collections.split(',');
    specs = specs.filter((s) => wanted.includes(s.path));
  }

  // 1-3: the backup side (what the cron route does, minus B2)
  const exported = {};
  let srcUsers = [];
  await phase('1 export (Firestore + Auth read)', async () => {
    for (const s of specs) exported[s.path] = await exportCollectionDocs(src, s);
    if (WITH_AUTH) srcUsers = await exportAuthUsers(srcAuth);
  });
  const createdAt = new Date().toISOString();
  const manifest = newManifest(date, createdAt);
  const artifacts = [];
  await phase('2 encode (typed NDJSON+gzip+AES-GCM)', async () => {
    for (const s of specs) artifacts.push(collectionArtifact(date, s.path, exported[s.path], KEY, createdAt));
    if (WITH_AUTH) artifacts.push(authArtifact(date, srcUsers, KEY, createdAt));
    manifest.artifacts = artifacts.map((a) => a.entry);
  });
  await phase('3 store artifacts (local disk)', async () => {
    for (const a of artifacts) {
      const file = path.join(OUT, a.entry.objectKey);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, a.blob);
    }
    await writeFile(path.join(OUT, manifestKey(date)), JSON.stringify(manifest, null, 2));
  });

  // ---- restore side: only the manifest, artifacts and key are used from here on ----
  const fetched = [];
  await phase('4 fetch + integrity (bytes, sha256)', async () => {
    const m = JSON.parse(await readFile(path.join(OUT, manifestKey(date)), 'utf8'));
    for (const e of m.artifacts) {
      const blob = await readFile(path.join(OUT, e.objectKey));
      if (blob.length !== e.bytes || sha256Hex(blob) !== e.sha256) throw new Error(`integrity check failed for ${e.objectKey}`);
      fetched.push({ entry: e, blob });
    }
  });
  const decoded = [];
  let restoreUsers = [];
  await phase('5 decrypt+gunzip+parse', async () => {
    for (const { entry, blob } of fetched) {
      if (args['naive-import'] && entry.kind === 'collection') {
        // negative control: parse the JSON but skip typed decoding
        const lines = zlib.gunzipSync(decryptAes256Gcm(blob, KEY)).toString('utf8').split('\n').filter(Boolean).slice(1);
        decoded.push({ path: entry.path, docs: lines.map((l) => JSON.parse(l)) });
        continue;
      }
      const out = decodeArtifact(blob, KEY, { db: dst });
      if (out.count !== entry.count) throw new Error(`${entry.path}: manifest count ${entry.count} ≠ artifact ${out.count}`);
      if (out.kind === 'auth-users') restoreUsers = out.users;
      else decoded.push({ path: out.path, docs: out.docs });
    }
  });
  let authImport = { imported: 0, withoutPassword: 0, failed: [] };
  await phase('6 import into target (Firestore + Auth)', async () => {
    await wipe(TARGET);
    // Default BulkWriter applies Google's 500/50/5 ramp (starts at 500 ops/s) —
    // what a restore into a FRESH production database should respect.
    const w = dst.bulkWriter(args.unthrottled ? { throttling: false } : undefined);
    for (const c of decoded) for (const d of c.docs) w.set(dst.doc(d.path), d.data);
    await w.close();
    if (WITH_AUTH) authImport = await importAuthUsers(dstAuth, restoreUsers, hashConfig);
  });

  // 7: verify by re-exporting the target with the same exporter
  const rows = [];
  let failures = 0;
  const stats = { timestamps: 0, nulls: 0, scalars: 0 };
  let authRow = null;
  await phase('7 verify (all docs + all users)', async () => {
    for (const s of specs) {
      const want = exported[s.path];
      const got = await exportCollectionDocs(dst, s);
      const byPath = new Map(got.map((d) => [d.path, d.data]));
      let mismatched = 0;
      for (const d of want) {
        if (!byPath.has(d.path) || !equal(d.data, byPath.get(d.path), stats)) {
          if (++mismatched <= 3) console.error(`  MISMATCH ${d.path}`);
        }
      }
      const ok = got.length === want.length && mismatched === 0;
      if (!ok) failures++;
      rows.push({
        collection: s.path,
        source: want.length,
        restored: got.length,
        mismatched,
        timestamps: want.reduce((n, d) => n + countTimestamps(d.data), 0),
        bytes: artifacts.find((a) => a.entry.path === s.path)?.entry.bytes ?? 0,
        ok: ok ? 'yes' : 'NO',
      });
    }
    if (WITH_AUTH) {
      const got = new Map((await exportAuthUsers(dstAuth)).map((u) => [u.uid, u]));
      let mismatched = 0;
      for (const u of srcUsers) {
        const g = got.get(u.uid);
        if (!g || JSON.stringify(userView(u)) !== JSON.stringify(userView(g))) {
          if (++mismatched <= 3) console.error(`  AUTH MISMATCH ${u.uid}`);
        }
      }
      const ok = got.size === srcUsers.length && mismatched === 0 && authImport.failed.length === 0;
      if (!ok) failures++;
      authRow = { collection: 'auth users', source: srcUsers.length, restored: got.size, mismatched, timestamps: 0, bytes: artifacts.at(-1).entry.bytes, ok: ok ? 'yes' : 'NO' };
      rows.push(authRow);
    }
  });

  const totalDocs = rows.filter((r) => r !== authRow).reduce((n, r) => n + r.source, 0);
  console.log('\nPer collection:');
  console.table(rows);
  console.log('Phase timings:');
  console.table(timings.map((t) => ({ phase: t.phase, ms: Math.round(t.ms) })));
  const restoreMs = timings.filter((t) => /^[4-7] /.test(t.phase)).reduce((n, t) => n + t.ms, 0);
  const totalMs = timings.reduce((n, t) => n + t.ms, 0);
  console.log(
    `docs: ${totalDocs} in ${specs.length} collections · auth users: ${srcUsers.length} · artifact bytes: ${artifacts.reduce((n, a) => n + a.entry.bytes, 0)} · ` +
      `fields compared: ${stats.timestamps} Timestamps, ${stats.nulls} nulls, ${stats.scalars} scalars`
  );
  if (WITH_AUTH) {
    console.log(
      `auth: ${authImport.imported} imported, ${authImport.withoutPassword} without password hash ` +
        `(${hashConfig ? 'hash config given' : 'no --hash-config: they must reset their password'}), ${authImport.failed.length} failed`
    );
  }
  console.log(`backup side ${(totalMs - restoreMs).toFixed(0)} ms · restore side (fetch→verify) ${restoreMs.toFixed(0)} ms · total ${totalMs.toFixed(0)} ms`);

  if (extra.length) {
    const counts = await Promise.all(extra.map(async (c) => `${c}(${(await src.collection(c).count().get()).data().count}${EXCLUDED_FROM_BACKUP[c] ? '' : ' ⚠ NOT CLASSIFIED'})`));
    console.log(`\nTop-level collections outside the backup set (excluded by design unless flagged): ${counts.join(', ')}`);
  }

  await writeFile(path.join(OUT, 'drill-report.json'), JSON.stringify({ source: SOURCE, target: TARGET, date, rows, timings, stats, authImport }, null, 2));
  if (!args.keep) await rm(path.join(OUT, 'backups'), { recursive: true, force: true });

  if (failures) {
    console.error(`\nRESTORE DRILL FAILED: ${failures} artifact(s) did not verify`);
    process.exit(1);
  }
  console.log(`\nRESTORE DRILL OK — ${rows.length} artifacts verified (report: ${path.join(OUT, 'drill-report.json')})`);
  process.exit(0);
}

main().catch((e) => {
  console.error('RESTORE DRILL ERROR:', e);
  process.exit(1);
});
