# PG-Pass — Operational Runbook & Incident Response

## 1. Security Incident Response

In the event of suspected key compromise, unauthorized access, or credential leak:

### Step 1: Containment
1. If Backblaze B2 keys are leaked:
   - Immediately log in to Backblaze Console and delete the compromised Application Key.
   - Generate a new restricted Application Key and update `B2_KEY_ID` and `B2_APP_KEY`.
2. If Firebase Admin credentials or cookies are suspected:
   - Call `adminAuth.revokeRefreshTokens(uid)` for affected accounts.
   - In worst-case emergency, flip `firestore.rules` to:
     ```
     rules_version = '2';
     service cloud.firestore { match /{document=**} { allow read, write: if false; } }
     ```

### Step 2: Secret Rotation
- Rotate `CRON_SECRET` in production env.
- Rotate `BACKUP_ENCRYPTION_KEY` and re-encrypt latest export.
- Push environment updates via hosting platform.

---

## 2. DPDP Resident Data Erasure (Right to Be Forgotten)

When a resident submits an official data erasure request:

1. **Verify Identity:** Confirm request from registered phone number.
2. **Move-out Check:** Ensure the tenant has formally moved out and all deposits/dues are settled.
3. **Execute Erasure:**
   - Soft-delete tenant doc: `await tenantsService.softDeleteTenant(tenantId, ownerId, 'erasure_request')`
   - Delete all associated B2 photos:
     ```ts
     const photos = await adminDb.collection('movein_photos').where('tenantId', '==', tenantId).get();
     for (const p of photos.docs) {
       await photosService.deletePhoto(p.id, ownerId);
     }
     ```
   - Anonymize tenant PII (name -> `Former Resident`, phone -> `0000000000`).
   - Revoke all portal tokens:
     ```ts
     const tokens = await adminDb.collection('portal_tokens').where('tenantId', '==', tenantId).get();
     for (const t of tokens.docs) await t.ref.delete();
     ```
4. **Log Immutable Audit:** Write PII-free audit log entry (`action: 'dpdp_erasure_fulfilled'`).

**Resident self-service data access (DPDP portability):** a resident can download
all their own data any time via **"Download my data"** on their home screen →
`GET /api/resident/export` (caller-scoped JSON; no tokens or other residents' data).

---

## 3. Backup & Restore

### Backup (automated)
- Nightly cron `POST /api/cron/backup` (Bearer `CRON_SECRET`) writes an encrypted
  backup to the B2 backup bucket (`B2_BACKUP_BUCKET`). It runs only when the bucket
  is set AND `BACKUP_ENCRYPTION_KEY` is valid; otherwise it is a logged no-op
  (`system_logs`, category `cron`) and reads nothing (saves the free-tier quota).
- **Key:** `BACKUP_ENCRYPTION_KEY` must be **exactly 64 hex characters** (32 bytes;
  `openssl rand -hex 32`). It is never padded or truncated. A malformed key logs a
  clear error at server start (`lib/env.ts`) and makes the cron **refuse** to run
  (HTTP 500 + an `error` event in `system_logs`; the key itself is never logged).
  Store the key outside B2 (password manager) — without it the backup is useless.
- **Format v2** — one definition, `lib/server/backup/format.ts`, used by the route,
  the drill and `tests/unit/backupFormat.test.ts` (which runs the real route):
  - `backups/<YYYY-MM-DD>/<artifact>.ndjson.gz.enc` — one per collection
    (`support_threads.messages` for the sub-collection) plus `auth-users`;
    bytes = AES-256-GCM(gzip(NDJSON)) laid out `iv(12) ‖ authTag(16) ‖ ciphertext`.
  - NDJSON line 1 is a header `{"pgpassBackup":2,"kind","path","count","createdAt"}`;
    each doc is an envelope `{"path":"<full doc path>","data":{…}}`, so no user field
    (e.g. `_id`) can clash with the doc id. Firestore types are tagged
    (`{"__pgpass":"ts"|"geo"|"ref"|"bytes"|"num"}`) and restored exactly.
  - Empty collections still get an artifact (count 0): "missing" ≠ "empty".
  - `backups/<YYYY-MM-DD>/manifest.json` (plain JSON, no PII): every artifact with
    count, bytes and sha256 — a restore checks completeness + integrity against it.
  - v1 objects (before 27 Nov 2026) still decode: `decodeArtifact(blob, key,
    { v1Collection })`; if the old key was malformed, decrypt with `legacyKeyHex(key)`.
- **Coverage:** all 31 business collections in `BACKUP_COLLECTIONS` (owners,
  properties, beds, tenants, rent_records, deposits, expenses, utility_bills,
  utr_claims, subscription_requests, staff, residents, portal_tokens,
  join_requests, admin_users, maintenance_tickets, notices, staff_tasks, visitors,
  guest_stays, assets, movein_photos, pg_reviews, property_photos, staff_ratings,
  support_threads, owner_notifications, admin_notifications, support_flags,
  audit_logs, metrics) + `support_threads/*/messages` + **Firebase Auth users**
  (uid, email, phone, name, photo, disabled, email-verified, custom claims,
  federated providers, metadata, and password hash/salt when the Admin SDK returns
  them). Deliberately excluded (`EXCLUDED_FROM_BACKUP`): `rate_limits`,
  `idempotency_keys`, `portal_lockouts` (ephemeral) and `system_logs` (diagnostics).
  A unit test scans `lib/server` + `app/api` and fails if a collection the server
  writes is neither backed up nor explicitly excluded.
- **Not in the backup:** B2 object bytes (move-in photos, gallery images, avatars —
  rely on the B2 buckets themselves), and Auth password *hash parameters* (see step 3).
- **Targets:** RPO ≈ 24 h (nightly). RTO: see the measured drill below. Each run
  reads every backed-up doc once — on the free tier (50k reads/day) that caps a
  nightly full backup at roughly 40–45k docs; beyond that budget for a paid plan.

### Restore drill (run it — emulator, ₹0)
With the emulators running (`firebase emulators:start --only auth,firestore --project demo-pgpass`):

```bash
npm run restore:drill                                                   # demo-pgpass → demo-restore (Firestore + Auth)
npm run restore:drill -- --collections=all --target=demo-restore-all    # + excluded/unknown top-level collections
npm run restore:drill -- --synthetic=5000 --source=demo-drill-src --target=demo-restore-syn   # ~20k docs + 1k users
npm run restore:drill -- --naive-import --target=demo-restore-naive     # negative control: must FAIL (exit 1)
```

`scripts/restore-drill.mjs` uses the route's own exporter + encoder, writes the
artifacts and manifest to a local dir laid out like the bucket (no B2), then —
from the manifest, artifacts and key only — checks bytes + sha256, decrypts,
wipes and imports into a separate `demo-*` project (Firestore via BulkWriter, Auth
via `importUsers`), re-exports the target and compares **every** doc field by field
(Timestamps, nulls, GeoPoints, refs, bytes, a field named `_id`, a map using the
tag key) and every user (email, phone, name, disabled, claims, federated
providers). It refuses non-loopback emulator hosts and non-`demo-*` targets and
uses `BACKUP_ENCRYPTION_KEY` if valid, else an ephemeral key. `--hash-config=<json>`
(base64 `key`/`saltSeparator`, `rounds`, `memoryCost`, `algorithm:"SCRYPT"`) also
restores passwords on a real project.

**Measured 27 Nov 2026** (MacBook, local emulators, format v2; wall-clock per phase):

| Run | Data | Backup side (read+encode+store) | Restore side (fetch → integrity → decrypt → import → verify all) | Result |
|---|---|---|---|---|
| demo-pgpass (32 artifacts + auth) | 31 docs, 5 users | 78 ms | 148 ms (import 76 ms) | ✅ every doc + user equal |
| `--collections=all` (+ rate_limits, system_logs) | 39 docs, 5 users | 79 ms | 130 ms | ✅ |
| synthetic, default BulkWriter | 20,625 docs, 1,000 users, 258 KB | 1.08 s | **42.6 s** (import 41.4 s ≈ 500 docs/s; verify 1.2 s) | ✅ |
| same, `--unthrottled` | 20,625 docs, 1,000 users | 1.19 s | 2.1 s (import 0.84 s) | ✅ |
| `--naive-import` (skip typed decoding) | 31 docs | — | — | ❌ as intended (exit 1, every Timestamp doc mismatches) |

Decrypt/gunzip/parse is negligible (≈ 35 ms for 20k docs). The import dominates and
is bounded by BulkWriter's default 500/50/5 ramp (500 ops/s, +50 % every 5 min) —
Google's guidance for writing into a fresh database: ≈ 150k docs import in ~5 min,
≈ 1M in ~20 min. **On the free Spark plan the target project accepts only 20,000
document writes/day** — a larger restore can't finish in one day at ₹0: get owner
approval for a temporary paid plan (AGENTS.md §8) or restore over several days. For
pilot-sized data the human steps (fetch key, create project, re-point env, check
money totals) dominate the RTO.

### Restore procedure (test this on a NON-prod project before relying on it)
1. **Fetch** `backups/<YYYY-MM-DD>/manifest.json` and every object it lists; check
   each object's byte size and sha256 against the manifest (a missing or altered
   object fails here — not silently later).
2. **Decrypt + decode** each object with `BACKUP_ENCRYPTION_KEY`:
   `decodeArtifact(blob, key, { db: targetDb })` (AES-256-GCM `iv ‖ tag ‖ ciphertext`
   → gunzip → header + envelopes; the header count is verified; a wrong key or any
   tampering throws). *The old runbook said "decrypted JSON" and skipped gunzip.*
3. **Stand up a separate Firebase project** (never restore over live data first) and
   **re-create Auth users** from `auth-users`: `importAuthUsers(auth, users, hash?)`.
   uid, email, phone, claims (admin, staff `{role, ownerId}`, resident `{role}`),
   disabled flag and federated providers (Google…) always restore. **Passwords are
   portable only with the source project's hash parameters** (Console →
   Authentication → Users → ⋮ → *Password hash parameters*; not readable via the
   Admin SDK) — keep a copy next to the backup key. Without them, users are imported
   without passwords: owners/staff use "Forgot password"; residents on the PIN portal
   are unaffected. Restoring into the **same** project (after a data-only loss)
   avoids this entirely — Auth usually survives a Firestore incident.
4. **Import** every envelope with `db.doc(row.path).set(row.data)` via BulkWriter
   (already-decoded Timestamps/refs/bytes; sub-collection docs carry their full
   path). *The old runbook imported `JSON.parse(line)` directly, which stores every
   date as a plain map — `--naive-import` shows the verifier catching it.*
5. **Verify integrity:** per-artifact counts vs the manifest and field-level equality
   (what the drill automates), then spot-check owner money totals against the
   last-known dashboard numbers.
6. **Cut over** only after verification; re-point env to the restored project.
   Resident pass links keep working (`portal_tokens` are restored).

> ⚠️ **Format, coverage and procedure are now exercised end-to-end on the
> emulators** (above), but a **production-sized drill on real infra is still
> required before a real-resident pilot**: a real B2 upload/download of the nightly
> objects, a real (non-emulator) Firestore + Auth target with its quotas and
> latency, and one password-hash import with the real project's hash parameters.
