import 'server-only';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { DocumentReference, FieldPath, GeoPoint, Timestamp } from 'firebase-admin/firestore';
import type { CollectionReference, Firestore } from 'firebase-admin/firestore';
import type { Auth, UserImportOptions, UserImportRecord, UserRecord } from 'firebase-admin/auth';

/**
 * PGPass backup format — the single definition shared by the nightly cron
 * (app/api/cron/backup/route.ts), the restore tooling (scripts/restore-drill.mjs)
 * and the tests (tests/unit/backupFormat.test.ts).
 *
 * FORMAT v2 (one encrypted object per collection + auth, plus a plain manifest):
 *   backups/<YYYY-MM-DD>/<artifact>.ndjson.gz.enc   artifact = collection path with
 *       "/*\/" → "." (e.g. `support_threads.messages`), or `auth-users`
 *   backups/<YYYY-MM-DD>/manifest.json               counts, bytes, sha256 (no PII)
 *   object bytes = AES-256-GCM( gzip( NDJSON ) ) laid out iv(12) ‖ tag(16) ‖ ciphertext
 *   NDJSON line 1 = header {"pgpassBackup":2,"kind","path","count","createdAt"}
 *   then one envelope per doc {"path":"<full doc path>","data":<typed value>}
 *   (user fields live under "data", so a field named `_id`/`path` can't clash),
 *   or per auth user (AuthUserRow).
 * Typed values: Firestore types are tagged {"__pgpass":"ts"|"geo"|"ref"|"bytes"|"num"},
 * and a user map that itself contains "__pgpass" is escaped as {"__pgpass":"map","v":…}.
 *
 * v1 (≤ 27 Nov 2026: `{"_id",…}` lines, Timestamps as {_seconds,_nanoseconds},
 * key zero-padded) is still decodable — see decodeArtifact / legacyKeyHex.
 *
 * Node builtins + firebase-admin only (no env, no '@/…' imports) so
 * `node --conditions=react-server --experimental-strip-types` can import it.
 */

export const BACKUP_FORMAT_VERSION = 2;

// ---------------------------------------------------------------- coverage

/**
 * Every top-level collection the server writes that is needed to rebuild the
 * service. tests/unit/backupFormat.test.ts scans lib/server + app/api for
 * `collection('…')` and fails if a collection is neither here nor excluded.
 */
export const BACKUP_COLLECTIONS = [
  // tenancy + money
  'owners',
  'properties',
  'beds',
  'tenants',
  'rent_records',
  'deposits',
  'expenses',
  'utility_bills',
  'utr_claims', // UTR de-dup ledger — losing it would let a UTR be replayed
  'subscription_requests',
  // people + access
  'staff',
  'residents',
  'portal_tokens', // without these every resident pass link dies
  'join_requests',
  'admin_users',
  // operations
  'maintenance_tickets',
  'notices',
  'staff_tasks',
  'visitors',
  'guest_stays',
  'assets',
  'movein_photos', // metadata; image bytes live in the B2 photo bucket
  // community + discovery
  'pg_reviews',
  'property_photos',
  'staff_ratings',
  // support + oversight
  'support_threads',
  'owner_notifications',
  'admin_notifications',
  'support_flags',
  'audit_logs',
  'metrics',
] as const;

/** Sub-collections, exported per parent doc (incl. parents that only hold sub-docs). */
export const BACKUP_SUBCOLLECTIONS = [{ parent: 'support_threads', name: 'messages' }] as const;

/** Written by the server but deliberately not backed up. */
export const EXCLUDED_FROM_BACKUP: Readonly<Record<string, string>> = {
  rate_limits: 'ephemeral limiter buckets (expire in minutes)',
  idempotency_keys: 'ephemeral request de-dup keys',
  portal_lockouts: 'ephemeral PIN lockouts — restoring stale ones would only lock residents out',
  system_logs: 'high-volume diagnostics; not needed to restore service',
};

export interface CollectionSpec {
  /** 'beds' or 'support_threads/*\/messages' */
  path: string;
  name: string;
  parent?: string;
}

export const BACKUP_SPECS: readonly CollectionSpec[] = [
  ...BACKUP_COLLECTIONS.map((c) => ({ path: c, name: c })),
  ...BACKUP_SUBCOLLECTIONS.map((s) => ({ path: `${s.parent}/*/${s.name}`, name: s.name, parent: s.parent })),
];

export const AUTH_ARTIFACT = 'auth-users';
export const artifactName = (collectionPath: string) => collectionPath.replace(/\/\*\//g, '.');
export const backupObjectKey = (date: string, artifact: string) => `backups/${date}/${artifact}.ndjson.gz.enc`;
export const manifestKey = (date: string) => `backups/${date}/manifest.json`;

// ---------------------------------------------------------------- key + crypto

/** Exactly 32 bytes as 64 hex chars — mirrored in lib/env.ts (tested to agree). */
export const BACKUP_KEY_RE = /^[0-9a-fA-F]{64}$/;

export function backupKeyStatus(key: string | undefined): 'unset' | 'valid' | 'invalid' {
  if (key === undefined || key === '') return 'unset';
  return BACKUP_KEY_RE.test(key) ? 'valid' : 'invalid';
}

/** Strict: never pads or truncates (v1 did — see legacyKeyHex). */
export function backupKeyBytes(keyHex: string): Buffer {
  if (!BACKUP_KEY_RE.test(keyHex)) {
    throw new Error('BACKUP_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)');
  }
  return Buffer.from(keyHex, 'hex');
}

/** The key v1 actually used for a malformed BACKUP_ENCRYPTION_KEY (only to read old v1 objects). */
export const legacyKeyHex = (keyHex: string) => keyHex.padEnd(64, '0').slice(0, 64);

const IV_BYTES = 12;
const TAG_BYTES = 16;

export function encryptAes256Gcm(data: Buffer, keyHex: string): Buffer {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv('aes-256-gcm', backupKeyBytes(keyHex), iv);
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]);
}

/** Inverse of encryptAes256Gcm; throws on a wrong key or any tampering (GCM auth). */
export function decryptAes256Gcm(blob: Buffer, keyHex: string): Buffer {
  if (blob.length < IV_BYTES + TAG_BYTES) throw new Error('Backup blob too short');
  const decipher = crypto.createDecipheriv('aes-256-gcm', backupKeyBytes(keyHex), blob.subarray(0, IV_BYTES));
  decipher.setAuthTag(blob.subarray(IV_BYTES, IV_BYTES + TAG_BYTES));
  return Buffer.concat([decipher.update(blob.subarray(IV_BYTES + TAG_BYTES)), decipher.final()]);
}

export const sha256Hex = (buf: Buffer) => crypto.createHash('sha256').update(buf).digest('hex');

// ---------------------------------------------------------------- typed values

const TAG = '__pgpass';
type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

const mapValues = <T>(o: Record<string, unknown>, f: (v: unknown) => T) =>
  Object.fromEntries(Object.entries(o).map(([k, v]) => [k, f(v)]));

/** Firestore value → JSON-safe, lossless (except int vs double, which JSON can't express). */
export function encodeValue(v: unknown): Json {
  if (v === null || typeof v === 'string' || typeof v === 'boolean') return v;
  if (typeof v === 'number') return Number.isFinite(v) ? v : { [TAG]: 'num', v: String(v) };
  if (v instanceof Timestamp) return { [TAG]: 'ts', s: v.seconds, n: v.nanoseconds };
  if (v instanceof GeoPoint) return { [TAG]: 'geo', lat: v.latitude, lng: v.longitude };
  if (v instanceof DocumentReference) return { [TAG]: 'ref', path: v.path };
  if (v instanceof Uint8Array) return { [TAG]: 'bytes', b64: Buffer.from(v).toString('base64') };
  if (Array.isArray(v)) return v.map(encodeValue);
  if (typeof v === 'object') {
    const out = mapValues(v as Record<string, unknown>, encodeValue);
    return TAG in (v as object) ? { [TAG]: 'map', v: out } : out;
  }
  throw new Error(`Unsupported Firestore value of type ${typeof v}`);
}

/** Inverse of encodeValue. `db` re-creates DocumentReferences in the target database. */
export function decodeValue(v: unknown, db?: Firestore): unknown {
  if (v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map((x) => decodeValue(x, db));
  const o = v as Record<string, unknown>;
  switch (o[TAG]) {
    case undefined:
      return mapValues(o, (x) => decodeValue(x, db));
    case 'map':
      return mapValues(o.v as Record<string, unknown>, (x) => decodeValue(x, db));
    case 'ts':
      return new Timestamp(o.s as number, o.n as number);
    case 'geo':
      return new GeoPoint(o.lat as number, o.lng as number);
    case 'ref':
      if (!db) throw new Error('decodeValue: a DocumentReference needs the target Firestore');
      return db.doc(o.path as string);
    case 'bytes':
      return Buffer.from(o.b64 as string, 'base64');
    case 'num':
      return Number(o.v);
    default:
      throw new Error(`Unknown backup value tag ${String(o[TAG])}`);
  }
}

/** v1 only: `{_seconds,_nanoseconds}` maps back to Timestamps (heuristic). */
function reviveV1(v: unknown): unknown {
  if (v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map(reviveV1);
  const o = v as Record<string, unknown>;
  const keys = Object.keys(o);
  if (keys.length === 2 && Number.isInteger(o._seconds) && Number.isInteger(o._nanoseconds)) {
    return new Timestamp(o._seconds as number, o._nanoseconds as number);
  }
  return mapValues(o, reviveV1);
}

// ---------------------------------------------------------------- artifacts

export interface BackupDoc {
  /** full document path, e.g. `beds/b1` or `support_threads/o1/messages/m1` */
  path: string;
  data: Record<string, unknown>;
}

export interface AuthUserRow {
  uid: string;
  email?: string;
  emailVerified: boolean;
  phoneNumber?: string;
  displayName?: string;
  photoURL?: string;
  disabled: boolean;
  customClaims?: Record<string, unknown>;
  providerData: { providerId: string; uid: string; email?: string; phoneNumber?: string; displayName?: string; photoURL?: string }[];
  metadata: { creationTime?: string; lastSignInTime?: string };
  /** base64, only when the Admin SDK returns it (SCRYPT accounts, sufficient IAM). */
  passwordHash?: string;
  passwordSalt?: string;
  tenantId?: string;
}

export interface ArtifactHeader {
  pgpassBackup: number;
  kind: 'collection' | 'auth-users';
  path: string;
  count: number;
  createdAt: string;
}

export interface ManifestEntry {
  artifact: string;
  objectKey: string;
  kind: ArtifactHeader['kind'];
  path: string;
  count: number;
  bytes: number;
  sha256: string;
}

export interface BackupManifest {
  pgpassBackup: number;
  date: string;
  createdAt: string;
  artifacts: ManifestEntry[];
  excluded: Record<string, string>;
}

export interface Artifact {
  blob: Buffer;
  entry: ManifestEntry;
}

function seal(date: string, artifact: string, header: ArtifactHeader, lines: string[], keyHex: string): Artifact {
  const ndjson = [JSON.stringify(header), ...lines].join('\n');
  const blob = encryptAes256Gcm(zlib.gzipSync(Buffer.from(ndjson, 'utf-8')), keyHex);
  const objectKey = backupObjectKey(date, artifact);
  return {
    blob,
    entry: { artifact, objectKey, kind: header.kind, path: header.path, count: header.count, bytes: blob.length, sha256: sha256Hex(blob) },
  };
}

export function collectionArtifact(date: string, collectionPath: string, docs: BackupDoc[], keyHex: string, createdAt: string): Artifact {
  const header: ArtifactHeader = { pgpassBackup: BACKUP_FORMAT_VERSION, kind: 'collection', path: collectionPath, count: docs.length, createdAt };
  const lines = docs.map((d) => JSON.stringify({ path: d.path, data: encodeValue(d.data) }));
  return seal(date, artifactName(collectionPath), header, lines, keyHex);
}

export function authArtifact(date: string, users: AuthUserRow[], keyHex: string, createdAt: string): Artifact {
  const header: ArtifactHeader = { pgpassBackup: BACKUP_FORMAT_VERSION, kind: 'auth-users', path: AUTH_ARTIFACT, count: users.length, createdAt };
  return seal(date, AUTH_ARTIFACT, header, users.map((u) => JSON.stringify(u)), keyHex);
}

export function newManifest(date: string, createdAt: string): BackupManifest {
  return { pgpassBackup: BACKUP_FORMAT_VERSION, date, createdAt, artifacts: [], excluded: { ...EXCLUDED_FROM_BACKUP } };
}

export interface DecodedArtifact {
  version: number;
  kind: ArtifactHeader['kind'];
  path: string;
  /** header count (v2) — decodeArtifact already checked it equals the rows read */
  count: number;
  docs: BackupDoc[];
  users: AuthUserRow[];
}

/**
 * decrypt → gunzip → parse. Verifies the header count. `db` is needed only to
 * revive DocumentReferences; `v1Collection` names the collection of a v1 object
 * (v1 had no header).
 */
export function decodeArtifact(blob: Buffer, keyHex: string, opts: { db?: Firestore; v1Collection?: string } = {}): DecodedArtifact {
  const lines = zlib
    .gunzipSync(decryptAes256Gcm(blob, keyHex))
    .toString('utf-8')
    .split('\n')
    .filter((l) => l.trim() !== '');
  const first = lines.length ? (JSON.parse(lines[0]) as Record<string, unknown>) : {};

  if (typeof first.pgpassBackup !== 'number') {
    if (!opts.v1Collection) throw new Error('v1 backup object: pass opts.v1Collection');
    const docs = lines.map((l) => {
      const { _id, ...rest } = JSON.parse(l) as Record<string, unknown>;
      return { path: `${opts.v1Collection}/${String(_id)}`, data: reviveV1(rest) as Record<string, unknown> };
    });
    return { version: 1, kind: 'collection', path: opts.v1Collection, count: docs.length, docs, users: [] };
  }

  const header = first as unknown as ArtifactHeader;
  if (header.pgpassBackup > BACKUP_FORMAT_VERSION) {
    throw new Error(`Backup format v${header.pgpassBackup} is newer than this tool (v${BACKUP_FORMAT_VERSION})`);
  }
  const rows = lines.slice(1).map((l) => JSON.parse(l) as Record<string, unknown>);
  if (rows.length !== header.count) {
    throw new Error(`Backup ${header.path}: header says ${header.count} rows, found ${rows.length} (truncated?)`);
  }
  if (header.kind === 'auth-users') {
    return { version: header.pgpassBackup, kind: header.kind, path: header.path, count: header.count, docs: [], users: rows as unknown as AuthUserRow[] };
  }
  const docs = rows.map((r) => ({ path: r.path as string, data: decodeValue(r.data, opts.db) as Record<string, unknown> }));
  return { version: header.pgpassBackup, kind: header.kind, path: header.path, count: header.count, docs, users: [] };
}

// ---------------------------------------------------------------- export

const PAGE = 1000;

async function exportPages(col: CollectionReference): Promise<BackupDoc[]> {
  const docs: BackupDoc[] = [];
  let q = col.orderBy(FieldPath.documentId()).limit(PAGE);
  for (;;) {
    const snap = await q.get();
    for (const d of snap.docs) docs.push({ path: d.ref.path, data: d.data() });
    if (snap.size < PAGE) break;
    q = col.orderBy(FieldPath.documentId()).startAfter(snap.docs[snap.docs.length - 1]).limit(PAGE);
  }
  return docs;
}

/** Every doc of a collection (paged by doc id), or of a sub-collection across all parents. */
export async function exportCollectionDocs(db: Firestore, spec: CollectionSpec): Promise<BackupDoc[]> {
  if (!spec.parent) return exportPages(db.collection(spec.name));
  // listDocuments also returns "missing" parents that only hold sub-collection docs.
  const parents = await db.collection(spec.parent).listDocuments();
  const out: BackupDoc[] = [];
  for (const p of parents) out.push(...(await exportPages(p.collection(spec.name))));
  return out;
}

const compact = <T extends Record<string, unknown>>(o: T): T =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null)) as T;

export function toAuthUserRow(u: UserRecord): AuthUserRow {
  return compact({
    uid: u.uid,
    email: u.email,
    emailVerified: u.emailVerified,
    phoneNumber: u.phoneNumber,
    displayName: u.displayName,
    photoURL: u.photoURL,
    disabled: u.disabled,
    customClaims: u.customClaims,
    providerData: u.providerData.map((p) =>
      compact({ providerId: p.providerId, uid: p.uid, email: p.email, phoneNumber: p.phoneNumber, displayName: p.displayName, photoURL: p.photoURL })
    ),
    metadata: compact({ creationTime: u.metadata.creationTime, lastSignInTime: u.metadata.lastSignInTime }),
    passwordHash: u.passwordHash,
    passwordSalt: u.passwordSalt,
    tenantId: u.tenantId ?? undefined,
  }) as AuthUserRow;
}

export async function exportAuthUsers(auth: Auth): Promise<AuthUserRow[]> {
  const rows: AuthUserRow[] = [];
  let pageToken: string | undefined;
  do {
    const page = await auth.listUsers(1000, pageToken);
    rows.push(...page.users.map(toAuthUserRow));
    pageToken = page.pageToken;
  } while (pageToken);
  return rows;
}

// ---------------------------------------------------------------- import (restore)

/**
 * Re-create Auth users. Password hashes are portable ONLY with the source
 * project's hash parameters (Console → Authentication → Users → ⋮ → Password
 * hash parameters; not readable via the Admin SDK) passed as `hash`. Without
 * them users are imported without passwords and must use "forgot password"
 * (owners/staff) — uid, email, phone, claims, disabled flag and federated
 * providers (Google, …) are restored either way.
 */
export async function importAuthUsers(
  auth: Auth,
  users: AuthUserRow[],
  hash?: UserImportOptions['hash']
): Promise<{ imported: number; withoutPassword: number; failed: { uid: string; reason: string }[] }> {
  let imported = 0;
  let withoutPassword = 0;
  const failed: { uid: string; reason: string }[] = [];
  for (let i = 0; i < users.length; i += 1000) {
    const batch = users.slice(i, i + 1000);
    const records: UserImportRecord[] = batch.map((u) => {
      const withPw = Boolean(hash && u.passwordHash);
      if (!withPw && u.passwordHash) withoutPassword++;
      return compact({
        uid: u.uid,
        email: u.email,
        emailVerified: u.emailVerified,
        phoneNumber: u.phoneNumber,
        displayName: u.displayName,
        photoURL: u.photoURL,
        disabled: u.disabled,
        customClaims: u.customClaims,
        metadata: u.metadata,
        // email/password + phone are carried by the top-level fields; only
        // federated identities go in providerData.
        providerData: u.providerData
          .filter((p) => p.providerId !== 'password' && p.providerId !== 'phone')
          .map((p) => compact({ ...p })),
        tenantId: u.tenantId,
        passwordHash: withPw ? Buffer.from(u.passwordHash!, 'base64') : undefined,
        passwordSalt: withPw && u.passwordSalt ? Buffer.from(u.passwordSalt, 'base64') : undefined,
      }) as UserImportRecord;
    });
    const res = await auth.importUsers(records, hash ? { hash } : undefined);
    imported += res.successCount;
    for (const e of res.errors) failed.push({ uid: batch[e.index].uid, reason: e.error.message });
  }
  return { imported, withoutPassword, failed };
}
