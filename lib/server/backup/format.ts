import 'server-only';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { Timestamp } from 'firebase-admin/firestore';

/**
 * Nightly-backup artifact format — the single definition shared by the backup
 * cron (app/api/cron/backup/route.ts mirrors this today; tests/unit/backupFormat
 * proves byte-compatibility against the real route) and the restore tooling
 * (scripts/restore-drill.mjs).
 *
 * One object per collection at `backups/<YYYY-MM-DD>/<collection>.ndjson.gz.enc`:
 *   NDJSON lines `JSON.stringify({ _id: doc.id, ...doc.data() })`
 *   → gzip → AES-256-GCM, laid out as  iv(12) ‖ authTag(16) ‖ ciphertext.
 *
 * Known lossy spots of this format (handled on restore by `reviveRow`):
 *   - Firestore Timestamps have no toJSON, so they serialize as
 *     `{"_seconds":n,"_nanoseconds":n}` maps and must be revived on import.
 *   - A document field literally named `_id` overrides the doc id (spread order).
 *   - Sub-collections (e.g. support_threads/{id}/messages) are not representable.
 *
 * Pure: node builtins + the Timestamp class only — no env, no Firestore client —
 * so `node --conditions=react-server --experimental-strip-types` can import it.
 */

/** Collections the nightly cron currently exports (keep in sync with the route). */
export const BACKUP_COLLECTIONS = [
  'owners',
  'beds',
  'tenants',
  'rent_records',
  'deposits',
  'movein_photos',
] as const;

export const backupObjectKey = (date: string, collection: string) =>
  `backups/${date}/${collection}.ndjson.gz.enc`;

const IV_BYTES = 12;
const TAG_BYTES = 16;

/** Key derivation exactly as the route does it (hex, zero-padded/truncated to 32 bytes). */
export function backupKeyBytes(keyHex: string): Buffer {
  return Buffer.from(keyHex.padEnd(64, '0').slice(0, 64), 'hex');
}

export function encryptAes256Gcm(data: Buffer, keyHex: string): Buffer {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv('aes-256-gcm', backupKeyBytes(keyHex), iv);
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]);
}

/** Inverse of encryptAes256Gcm; throws on a wrong key or any tampering (GCM auth). */
export function decryptAes256Gcm(blob: Buffer, keyHex: string): Buffer {
  if (blob.length < IV_BYTES + TAG_BYTES) throw new Error('Backup blob too short');
  const iv = blob.subarray(0, IV_BYTES);
  const tag = blob.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const decipher = crypto.createDecipheriv('aes-256-gcm', backupKeyBytes(keyHex), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(blob.subarray(IV_BYTES + TAG_BYTES)), decipher.final()]);
}

export interface BackupDoc {
  id: string;
  data: Record<string, unknown>;
}

/** NDJSON body exactly as the route builds it. */
export function serializeDocs(docs: BackupDoc[]): string {
  return docs.map((d) => JSON.stringify({ _id: d.id, ...d.data })).join('\n');
}

/** serialize → gzip → encrypt (the bytes the route uploads for one collection). */
export function encodeCollection(docs: BackupDoc[], keyHex: string): Buffer {
  const compressed = zlib.gzipSync(Buffer.from(serializeDocs(docs), 'utf-8'));
  return encryptAes256Gcm(compressed, keyHex);
}

export type BackupRow = { _id: string } & Record<string, unknown>;

/** decrypt → gunzip → parse NDJSON (raw JSON rows; Timestamps still as maps). */
export function decodeCollection(blob: Buffer, keyHex: string): BackupRow[] {
  const ndjson = zlib.gunzipSync(decryptAes256Gcm(blob, keyHex)).toString('utf-8');
  return ndjson
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => JSON.parse(line) as BackupRow);
}

function isSerializedTimestamp(v: unknown): v is { _seconds: number; _nanoseconds: number } {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) return false;
  const keys = Object.keys(v);
  const o = v as Record<string, unknown>;
  return (
    keys.length === 2 &&
    Number.isInteger(o._seconds) &&
    Number.isInteger(o._nanoseconds)
  );
}

/** Recursively turn `{_seconds,_nanoseconds}` maps back into Firestore Timestamps. */
export function reviveValue(v: unknown): unknown {
  if (isSerializedTimestamp(v)) return new Timestamp(v._seconds, v._nanoseconds);
  if (Array.isArray(v)) return v.map(reviveValue);
  if (v !== null && typeof v === 'object') {
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, reviveValue(x)]));
  }
  return v;
}

/** Split a backup row into its doc id and Firestore-ready data. */
export function reviveRow(row: BackupRow): BackupDoc {
  const { _id, ...rest } = row;
  return { id: _id, data: reviveValue(rest) as Record<string, unknown> };
}
