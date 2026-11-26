import { describe, it, expect, vi, beforeEach } from 'vitest';
import zlib from 'zlib';
import { Timestamp } from 'firebase-admin/firestore';
import {
  BACKUP_COLLECTIONS,
  backupObjectKey,
  decodeCollection,
  decryptAes256Gcm,
  encodeCollection,
  reviveRow,
  serializeDocs,
  type BackupDoc,
} from '@/lib/server/backup/format';

/**
 * The restore drill (scripts/restore-drill.mjs) uses lib/server/backup/format.ts.
 * These tests run the REAL cron route (app/api/cron/backup/route.ts) with its I/O
 * mocked, capture the bytes it would upload to B2, and prove the shared helper
 * reads them back exactly — so a drill against the helper is a drill of the
 * production format, and any drift in the route makes this suite go red.
 */

const KEY = '0f'.repeat(32);

// Deterministic fixture covering Timestamps (incl. nested + in arrays), nulls,
// integer paise, booleans, nested maps and unicode.
const T1 = new Timestamp(1764200000, 123000000);
const T2 = new Timestamp(1700000000, 0);
const FIXTURE: Record<string, BackupDoc[]> = {
  owners: [{ id: 'o1', data: { name: 'Ramesh', pgName: 'Green Valley PG', createdAt: T1, deletedAt: null } }],
  beds: Array.from({ length: 3 }, (_, i) => ({
    id: `b${i}`,
    data: { ownerId: 'o1', monthlyRent: 7500 + i, tenantId: i === 2 ? null : `t${i}`, updatedAt: T2 },
  })),
  tenants: [
    {
      id: 't0',
      data: {
        ownerId: 'o1',
        name: 'ಅರ್ಜುನ್ Sharma',
        depositPaidPaise: 750000,
        active: true,
        history: [{ at: T1, note: 'moved in' }],
        meta: { lastSeen: T2, tags: ['a', 'b'] },
      },
    },
  ],
  rent_records: [{ id: 't0_2026-11', data: { ownerId: 'o1', amountPaise: 750000, paidAt: null, dueDate: '2026-11-05' } }],
  deposits: [],
  movein_photos: [],
};

const uploads = new Map<string, Buffer>();
const queried: string[] = [];

function fakeQuery(name: string, after?: string) {
  const all = [...(FIXTURE[name] ?? [])].sort((a, b) => a.id.localeCompare(b.id));
  let limitN = Infinity;
  const q = {
    orderBy: () => q,
    limit: (n: number) => ((limitN = n), q),
    startAfter: (doc: { id: string }) => fakeQueryWith(name, doc.id, limitN),
    get: async () => {
      const start = after ? all.findIndex((d) => d.id === after) + 1 : 0;
      const docs = all.slice(start, start + limitN).map((d) => ({ id: d.id, data: () => d.data }));
      return { empty: docs.length === 0, size: docs.length, docs };
    },
  };
  return q;
}
function fakeQueryWith(name: string, after: string, limitN: number) {
  return fakeQuery(name, after).limit(limitN);
}

vi.mock('@/lib/server/firebase-admin', () => ({
  adminDb: {
    collection: (name: string) => {
      queried.push(name);
      return fakeQuery(name);
    },
  },
}));
vi.mock('@/lib/server/storage/provider', () => ({
  storageProvider: {
    putObject: async (_bucket: string, key: string, body: Buffer) => void uploads.set(key, body),
    headObject: async (_bucket: string, key: string) => ({ contentLength: uploads.get(key)?.length ?? 0 }),
  },
}));
vi.mock('@/lib/server/services/systemLogs.service', () => ({ recordEvent: async () => {} }));
vi.mock('@/lib/server/api/withCronAuth', () => ({ withCronAuth: <T>(h: T) => h }));
vi.mock('@/lib/server/api/withErrorHandler', () => ({ withErrorHandler: <T>(h: T) => h }));
vi.mock('@/lib/env', () => ({ env: { B2_BACKUP_BUCKET: 'test-backups', BACKUP_ENCRYPTION_KEY: KEY } }));

async function runRoute() {
  uploads.clear();
  queried.length = 0;
  const { POST } = await import('@/app/api/cron/backup/route');
  const handler = POST as unknown as () => Promise<Response>;
  const res = await handler();
  return (await res.json()) as { backupDate: string; collectionCounts: Record<string, number> };
}

beforeEach(() => {
  uploads.clear();
});

describe('backup format: compatibility with the real cron route', () => {
  it('exports exactly BACKUP_COLLECTIONS (drift guard)', async () => {
    await runRoute();
    expect(queried.filter((c, i) => queried.indexOf(c) === i)).toEqual([...BACKUP_COLLECTIONS]);
  });

  it('the helper decodes what the route uploads, at the same object keys', async () => {
    const body = await runRoute();
    for (const col of BACKUP_COLLECTIONS) {
      const docs = FIXTURE[col];
      const key = backupObjectKey(body.backupDate, col);
      expect(body.collectionCounts[col]).toBe(docs.length);
      if (docs.length === 0) {
        expect(uploads.has(key)).toBe(false); // route skips empty collections
        continue;
      }
      const blob = uploads.get(key)!;
      expect(blob).toBeDefined();
      // Same plaintext pipeline: the route's gzip bytes == gzip(helper NDJSON).
      const routeGzip = decryptAes256Gcm(blob, KEY);
      expect(routeGzip.equals(zlib.gzipSync(Buffer.from(serializeDocs(docs), 'utf-8')))).toBe(true);
      // And full decode + revive restores the original docs (Timestamps included).
      const restored = decodeCollection(blob, KEY).map(reviveRow);
      expect(restored.map((d) => d.id)).toEqual(docs.map((d) => d.id));
      restored.forEach((d, i) => expect(d.data).toEqual(docs[i].data));
    }
  });

  it('a route artifact and a helper artifact share layout iv(12) | tag(16) | ciphertext', async () => {
    const body = await runRoute();
    const routeBlob = uploads.get(backupObjectKey(body.backupDate, 'beds'))!;
    const helperBlob = encodeCollection(FIXTURE.beds, KEY);
    expect(helperBlob.length).toBe(routeBlob.length); // same plaintext length → same size
    expect(decryptAes256Gcm(helperBlob, KEY).equals(decryptAes256Gcm(routeBlob, KEY))).toBe(true);
    expect(helperBlob.subarray(0, 12).equals(routeBlob.subarray(0, 12))).toBe(false); // fresh IV
  });
});

describe('backup format: codec properties', () => {
  it('Timestamps serialize as {_seconds,_nanoseconds} and revive to equal Timestamps', () => {
    const [row] = decodeCollection(encodeCollection(FIXTURE.owners, KEY), KEY);
    expect(row.createdAt).toEqual({ _seconds: 1764200000, _nanoseconds: 123000000 });
    const { data } = reviveRow(row);
    expect(data.createdAt).toBeInstanceOf(Timestamp);
    expect((data.createdAt as Timestamp).isEqual(T1)).toBe(true);
    expect(data.deletedAt).toBeNull();
  });

  it('rejects a wrong key and any tampering (GCM auth tag)', () => {
    const blob = encodeCollection(FIXTURE.tenants, KEY);
    expect(() => decodeCollection(blob, 'aa'.repeat(32))).toThrow();
    const tampered = Buffer.from(blob);
    tampered[tampered.length - 1] ^= 0x01;
    expect(() => decodeCollection(tampered, KEY)).toThrow();
    expect(() => decryptAes256Gcm(Buffer.alloc(10), KEY)).toThrow(/too short/);
  });
});
