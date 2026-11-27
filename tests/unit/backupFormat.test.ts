import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import crypto from 'crypto';
import { initializeApp } from 'firebase-admin/app';
import { GeoPoint, Timestamp, getFirestore } from 'firebase-admin/firestore';
import type { UserImportRecord } from 'firebase-admin/auth';
import {
  AUTH_ARTIFACT,
  BACKUP_COLLECTIONS,
  BACKUP_KEY_RE,
  BACKUP_SPECS,
  BACKUP_SUBCOLLECTIONS,
  EXCLUDED_FROM_BACKUP,
  artifactName,
  backupKeyBytes,
  backupObjectKey,
  collectionArtifact,
  decodeArtifact,
  encryptAes256Gcm,
  importAuthUsers,
  legacyKeyHex,
  manifestKey,
  sha256Hex,
  toAuthUserRow,
  type AuthUserRow,
  type BackupManifest,
} from '@/lib/server/backup/format';

/**
 * Runs the REAL nightly cron route (app/api/cron/backup/route.ts) against an
 * in-memory Firestore/Auth/B2, then proves the shared format helper — the one
 * scripts/restore-drill.mjs uses — restores exactly what was there: every
 * collection + sub-collection + auth user, all Firestore value types, a field
 * literally named `_id`, empty collections, and a manifest with sha256s.
 */

const KEY = '0f'.repeat(32);
const refDb = getFirestore(initializeApp({ projectId: 'demo-unit-backup' }, 'backup-format-unit'));

const h = vi.hoisted(() => ({
  env: { B2_BACKUP_BUCKET: 'test-backups' as string | undefined, BACKUP_ENCRYPTION_KEY: '0f'.repeat(32) as string | undefined },
  uploads: new Map<string, Buffer>(),
  events: [] as { level?: string; message: string }[],
  store: new Map<string, Record<string, unknown>>(),
  users: [] as Record<string, unknown>[],
  collectionCalls: [] as string[],
}));

// ---- in-memory Firestore: just the surface exportCollectionDocs uses ----
type Snap = { id: string; ref: { path: string }; data: () => Record<string, unknown> };
function fakeCollection(colPath: string) {
  const depth = colPath.split('/').length + 1;
  const docs = () =>
    [...h.store.entries()]
      .filter(([p]) => p.startsWith(`${colPath}/`) && p.split('/').length === depth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([p, d]): Snap => ({ id: p.split('/').pop()!, ref: { path: p }, data: () => d }));
  const query = (after: string | null, lim: number) => ({
    limit: (n: number) => query(after, n),
    startAfter: (s: Snap) => query(s.ref.path, lim),
    get: async () => {
      const all = docs();
      const start = after ? all.findIndex((d) => d.ref.path === after) + 1 : 0;
      const page = all.slice(start, start + lim);
      return { docs: page, size: page.length, empty: page.length === 0 };
    },
  });
  return {
    orderBy: () => query(null, Infinity),
    listDocuments: async () => {
      const ids = new Set<string>();
      for (const p of h.store.keys()) {
        if (p.startsWith(`${colPath}/`)) ids.add(p.slice(colPath.length + 1).split('/')[0]);
      }
      return [...ids].sort().map((id) => fakeDocRef(`${colPath}/${id}`));
    },
  };
}
const fakeDocRef = (docPath: string) => ({ path: docPath, collection: (sub: string) => fakeCollection(`${docPath}/${sub}`) });

vi.mock('@/lib/server/firebase-admin', () => ({
  adminDb: {
    collection: (name: string) => {
      h.collectionCalls.push(name);
      return fakeCollection(name);
    },
  },
  adminAuth: {
    listUsers: async (max: number, token?: string) => {
      const start = token ? Number(token) : 0;
      const users = h.users.slice(start, start + max);
      return { users, pageToken: start + max < h.users.length ? String(start + max) : undefined };
    },
  },
}));
vi.mock('@/lib/server/storage/provider', () => ({
  storageProvider: {
    putObject: async (_b: string, key: string, body: Buffer) => void h.uploads.set(key, body),
    headObject: async (_b: string, key: string) => ({ contentLength: h.uploads.get(key)?.length ?? 0 }),
  },
}));
vi.mock('@/lib/server/services/systemLogs.service', () => ({
  recordEvent: async (e: { level?: string; message: string }) => void h.events.push(e),
}));
vi.mock('@/lib/server/api/withCronAuth', () => ({ withCronAuth: <T>(fn: T) => fn }));
vi.mock('@/lib/server/api/withErrorHandler', () => ({ withErrorHandler: <T>(fn: T) => fn }));
vi.mock('@/lib/env', () => ({ env: h.env }));

// ---- fixture ----
const T1 = new Timestamp(1764200000, 123000000);
const FIXTURE: Record<string, Record<string, unknown>> = {
  'owners/o1': { name: 'Ramesh', pgName: 'Green Valley PG', createdAt: T1, deletedAt: null, nextReceiptSeq: 7 },
  'beds/b1': { ownerId: 'o1', monthlyRent: 7500, tenantId: null, updatedAt: T1 },
  'beds/b2': { ownerId: 'o1', monthlyRent: 8000.5, tenantId: 't1', updatedAt: T1 },
  'tenants/t1': {
    ownerId: 'o1',
    _id: 'not-the-doc-id', // v1 let this overwrite the doc id
    path: 'also/not/a/path',
    name: 'ಅರ್ಜುನ್ Sharma',
    history: [{ at: T1, note: 'moved in' }],
    meta: { __pgpass: 'user data that looks like a tag', nested: { ok: true } },
    location: new GeoPoint(17.44, 78.38),
    bed: refDb.doc('beds/b2'),
    blob: Buffer.from([0, 1, 2, 250]),
    weird: Number.NaN,
  },
  'rent_records/t1_2026-11': { ownerId: 'o1', amountDuePaise: 750000, paidAt: null },
  'support_threads/o1': { ownerId: 'o1', lastMessage: 'hi' },
  'support_threads/o1/messages/m1': { sender: 'owner', text: 'hi', createdAt: T1 },
  'support_threads/o1/messages/m2': { sender: 'admin', text: 'hello', createdAt: T1 },
  // a thread whose parent doc is missing — still exported via listDocuments
  'support_threads/o2/messages/m1': { sender: 'owner', text: 'orphan', createdAt: T1 },
  'system_logs/l1': { message: 'excluded by design' },
};
const USERS = [
  {
    uid: 'o1',
    email: 'owner@pg.test',
    emailVerified: true,
    disabled: false,
    displayName: 'Ramesh',
    providerData: [
      { providerId: 'password', uid: 'owner@pg.test', email: 'owner@pg.test' },
      { providerId: 'google.com', uid: 'g-123', email: 'owner@gmail.test' },
    ],
    metadata: { creationTime: 'Fri, 27 Nov 2026 10:00:00 GMT', lastSignInTime: 'Fri, 27 Nov 2026 11:00:00 GMT' },
    passwordHash: Buffer.from('hash').toString('base64'),
    passwordSalt: Buffer.from('salt').toString('base64'),
  },
  {
    uid: 's1',
    email: 'warden@pg.test',
    emailVerified: false,
    disabled: true,
    customClaims: { role: 'staff', ownerId: 'o1', suspended: true },
    providerData: [],
    metadata: { creationTime: 'Fri, 27 Nov 2026 10:00:00 GMT' },
  },
];

async function runRoute() {
  const { POST } = await import('@/app/api/cron/backup/route');
  const res = await (POST as unknown as () => Promise<Response>)();
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

beforeEach(() => {
  h.env.B2_BACKUP_BUCKET = 'test-backups';
  h.env.BACKUP_ENCRYPTION_KEY = KEY;
  h.uploads.clear();
  h.events.length = 0;
  h.collectionCalls.length = 0;
  h.store.clear();
  for (const [p, d] of Object.entries(FIXTURE)) h.store.set(p, d);
  h.users = USERS as unknown as Record<string, unknown>[];
});

describe('backup route (format v2) → restore helper', () => {
  it('uploads one object per collection, sub-collection and auth, plus a manifest that matches them', async () => {
    const { status, body } = await runRoute();
    expect(status).toBe(200);
    const date = body.backupDate as string;
    const manifest = JSON.parse(h.uploads.get(manifestKey(date))!.toString()) as BackupManifest;
    expect(manifest.pgpassBackup).toBe(2);
    expect(manifest.artifacts.map((a) => a.path)).toEqual([...BACKUP_SPECS.map((s) => s.path), AUTH_ARTIFACT]);
    for (const a of manifest.artifacts) {
      const blob = h.uploads.get(a.objectKey)!;
      expect(a.objectKey).toBe(backupObjectKey(date, a.artifact));
      expect(a.bytes).toBe(blob.length);
      expect(a.sha256).toBe(sha256Hex(blob));
    }
    expect(h.uploads.size).toBe(BACKUP_SPECS.length + 2);
    expect(h.uploads.has(backupObjectKey(date, 'system_logs'))).toBe(false);
  });

  it('every doc restores exactly — all value types, `_id`/`path` fields, sub-collections, empty collections', async () => {
    const { body } = await runRoute();
    const date = body.backupDate as string;
    const restored = new Map<string, Record<string, unknown>>();
    for (const spec of BACKUP_SPECS) {
      const out = decodeArtifact(h.uploads.get(backupObjectKey(date, artifactName(spec.path)))!, KEY, { db: refDb });
      expect(out.path).toBe(spec.path);
      expect(out.count).toBe(out.docs.length);
      for (const d of out.docs) restored.set(d.path, d.data);
    }
    const expected = Object.entries(FIXTURE).filter(([p]) => !p.startsWith('system_logs/'));
    expect([...restored.keys()].sort()).toEqual(expected.map(([p]) => p).sort());
    for (const [p, data] of expected) {
      const got = restored.get(p)!;
      for (const [k, v] of Object.entries(data)) {
        if (v instanceof Timestamp) expect((got[k] as Timestamp).isEqual(v), `${p}.${k}`).toBe(true);
        else if (v instanceof GeoPoint) expect((got[k] as GeoPoint).isEqual(v)).toBe(true);
        else if (k === 'bed') expect((got[k] as { path: string }).path).toBe('beds/b2');
        else if (typeof v === 'number' && Number.isNaN(v)) expect(Number.isNaN(got[k])).toBe(true);
        else expect(got[k], `${p}.${k}`).toEqual(v);
      }
      expect(Object.keys(got).sort()).toEqual(Object.keys(data).sort());
    }
    // a collection with no docs still has an artifact (count 0) — "missing" ≠ "empty"
    const empty = decodeArtifact(h.uploads.get(backupObjectKey(date, 'deposits'))!, KEY);
    expect(empty.count).toBe(0);
    expect(body.collectionCounts).toMatchObject({ beds: 2, 'support_threads/*/messages': 3, deposits: 0 });
  });

  it('auth users are exported and re-imported (passwords only with the hash parameters)', async () => {
    const { body } = await runRoute();
    const out = decodeArtifact(h.uploads.get(backupObjectKey(body.backupDate as string, AUTH_ARTIFACT))!, KEY);
    expect(out.kind).toBe('auth-users');
    expect(out.users).toEqual(USERS.map((u) => toAuthUserRow(u as never)));

    const calls: { records: UserImportRecord[]; opts: unknown }[] = [];
    const fakeAuth = {
      importUsers: async (records: UserImportRecord[], opts?: unknown) => {
        calls.push({ records, opts });
        return { successCount: records.length, failureCount: 0, errors: [] };
      },
    };
    const noHash = await importAuthUsers(fakeAuth as never, out.users as AuthUserRow[]);
    expect(noHash).toEqual({ imported: 2, withoutPassword: 1, failed: [] });
    const [owner, staff] = calls[0].records;
    expect(owner.passwordHash).toBeUndefined();
    expect(owner.providerData?.map((p) => p.providerId)).toEqual(['google.com']); // password provider is implicit
    expect(staff).toMatchObject({ uid: 's1', disabled: true, customClaims: { role: 'staff', ownerId: 'o1', suspended: true } });

    const hash = { algorithm: 'SCRYPT', key: Buffer.from('k'), saltSeparator: Buffer.from('s'), rounds: 8, memoryCost: 14 } as const;
    const withHash = await importAuthUsers(fakeAuth as never, out.users as AuthUserRow[], hash);
    expect(withHash.withoutPassword).toBe(0);
    expect(calls[1].opts).toEqual({ hash });
    expect(calls[1].records[0].passwordHash).toEqual(Buffer.from('hash'));
  });

  it('refuses to run with a malformed key: 500, error event without the key, nothing read or uploaded', async () => {
    for (const bad of ['abc', '0f'.repeat(31) + 'zz', '0f'.repeat(33), ` ${'0f'.repeat(32)}`]) {
      h.env.BACKUP_ENCRYPTION_KEY = bad;
      h.events.length = 0;
      const { status, body } = await runRoute();
      expect(status).toBe(500);
      expect(body.success).toBe(false);
      expect(h.events).toHaveLength(1);
      expect(h.events[0].level).toBe('error');
      expect(h.events[0].message).toMatch(/REFUSED.*64 hex/);
      expect(h.events[0].message).not.toContain(bad.trim());
      expect(JSON.stringify(body)).not.toContain(bad.trim());
    }
    expect(h.uploads.size).toBe(0);
    expect(h.collectionCalls).toEqual([]);
  });

  it('skips (no reads, no uploads) when the bucket or key is not configured', async () => {
    h.env.BACKUP_ENCRYPTION_KEY = undefined;
    const r1 = await runRoute();
    expect(r1.body.backupConfigured).toBe(false);
    expect(h.events[0].level).toBe('warn');
    h.env.BACKUP_ENCRYPTION_KEY = KEY;
    h.env.B2_BACKUP_BUCKET = undefined;
    const r2 = await runRoute();
    expect(r2.body.backupConfigured).toBe(false);
    expect(h.uploads.size).toBe(0);
    expect(h.collectionCalls).toEqual([]);
  });
});

describe('backup format: codec properties', () => {
  it('key handling is strict (never padded/truncated) and lib/env.ts uses the same rule', async () => {
    expect(() => backupKeyBytes('0f'.repeat(31))).toThrow(/64 hex/);
    expect(() => backupKeyBytes('0f'.repeat(33))).toThrow(/64 hex/);
    expect(() => backupKeyBytes('zz'.repeat(32))).toThrow(/64 hex/);
    expect(backupKeyBytes('AB'.repeat(32))).toHaveLength(32);
    const real = await vi.importActual<typeof import('@/lib/env')>('@/lib/env');
    expect(real.BACKUP_KEY_RE.source).toBe(BACKUP_KEY_RE.source);
  });

  it('rejects a wrong key, tampering, truncation and a newer format version', () => {
    const { blob } = collectionArtifact('2026-11-27', 'beds', [{ path: 'beds/b1', data: { a: 1 } }], KEY, 'now');
    expect(() => decodeArtifact(blob, 'aa'.repeat(32))).toThrow();
    const tampered = Buffer.from(blob);
    tampered[tampered.length - 1] ^= 0x01;
    expect(() => decodeArtifact(tampered, KEY)).toThrow();

    const forge = (lines: string[]) => encryptAes256Gcm(zlib.gzipSync(Buffer.from(lines.join('\n'))), KEY);
    const header = { pgpassBackup: 2, kind: 'collection', path: 'beds', count: 2, createdAt: 'now' };
    expect(() => decodeArtifact(forge([JSON.stringify(header), '{"path":"beds/b1","data":{}}']), KEY)).toThrow(/truncated/);
    expect(() => decodeArtifact(forge([JSON.stringify({ ...header, pgpassBackup: 3, count: 0 })]), KEY)).toThrow(/newer/);
  });

  it('still reads v1 objects written by the old route (incl. a malformed, zero-padded key)', () => {
    const oldKey = 'abc123'; // v1 padded this to 64 hex chars
    const ndjson = [
      JSON.stringify({ _id: 'b1', ownerId: 'o1', updatedAt: T1, tenantId: null }),
      JSON.stringify({ _id: 'b2', ownerId: 'o1', history: [{ at: T1 }] }),
    ].join('\n');
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(legacyKeyHex(oldKey), 'hex'), iv);
    const enc = Buffer.concat([cipher.update(zlib.gzipSync(Buffer.from(ndjson))), cipher.final()]);
    const v1Blob = Buffer.concat([iv, cipher.getAuthTag(), enc]);

    const out = decodeArtifact(v1Blob, legacyKeyHex(oldKey), { v1Collection: 'beds' });
    expect(out.version).toBe(1);
    expect(out.docs.map((d) => d.path)).toEqual(['beds/b1', 'beds/b2']);
    expect((out.docs[0].data.updatedAt as Timestamp).isEqual(T1)).toBe(true);
    expect(out.docs[0].data.tenantId).toBeNull();
    expect(() => decodeArtifact(v1Blob, legacyKeyHex(oldKey))).toThrow(/v1Collection/);
  });

  it('coverage guard: every collection the server writes is backed up or explicitly excluded', () => {
    const roots = ['lib/server', 'app/api'].map((r) => path.resolve(__dirname, '../..', r));
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else if (/\.tsx?$/.test(e.name)) files.push(p);
      }
    };
    roots.forEach(walk);
    const names = new Set<string>();
    for (const f of files) {
      const src = fs.readFileSync(f, 'utf8');
      for (const m of src.matchAll(/collection\(\s*'([a-z_]+)'\s*\)|const COLLECTION = '([a-z_]+)'/g)) {
        names.add(m[1] ?? m[2]);
      }
    }
    expect(names.size).toBeGreaterThan(20);
    const known = new Set<string>([
      ...BACKUP_COLLECTIONS,
      ...Object.keys(EXCLUDED_FROM_BACKUP),
      ...BACKUP_SUBCOLLECTIONS.map((s) => s.name),
    ]);
    const unclassified = [...names].filter((n) => !known.has(n)).sort();
    expect(unclassified, 'add to BACKUP_COLLECTIONS or EXCLUDED_FROM_BACKUP in lib/server/backup/format.ts').toEqual([]);
  });
});
