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
- Nightly cron `POST /api/cron/backup` (Bearer `CRON_SECRET`) exports Firestore
  collections, AES-256-GCM encrypts with `BACKUP_ENCRYPTION_KEY`, and uploads to
  the B2 backup bucket (`B2_BACKUP_BUCKET`). Configured only when all backup env
  vars are set; otherwise it's a logged no-op (visible in `system_logs`,
  category `cron`).
- **Artifact format** (single definition: `lib/server/backup/format.ts`; the
  route's bytes are proven compatible by `tests/unit/backupFormat.test.ts`):
  one object **per collection** at `backups/<YYYY-MM-DD>/<collection>.ndjson.gz.enc`
  = NDJSON lines `{"_id": docId, ...fields}` → gzip → AES-256-GCM laid out as
  `iv(12 bytes) ‖ authTag(16) ‖ ciphertext`. Empty collections produce no object.
- **What is covered today — only 6 collections:** `owners, beds, tenants,
  rent_records, deposits, movein_photos` (`BACKUP_COLLECTIONS`).
  **Not backed up:** `properties`, `staff`, `residents`, `expenses`,
  `maintenance_tickets`, `notices`, `guest_stays`, `subscription_requests`,
  `support_threads` (+ `messages` sub-collection — the format cannot represent
  sub-collections), `staff_tasks`, `visitors`, `utility_bills`, `assets`,
  `pg_reviews`, `property_photos`, `staff_ratings`, `join_requests`,
  `portal_tokens` (every resident pass link dies on restore), `owner_notifications`,
  `admin_users`, `audit_logs`, `metrics`, `system_logs`. **Firebase Auth users and
  custom claims (admin/staff/resident roles) are not backed up at all.**
  The drill prints this gap list on every run (`⚠ Collections present … NOT in
  the nightly backup`).
- **Targets:** RPO ≈ 24h (nightly) — *for the 6 covered collections only*.
  RTO: see measured drill numbers below; still a pilot target, not an SLA.

### Restore drill (run it — emulator, ₹0, ~1 s)
With the emulators running (`firebase emulators:start --only auth,firestore --project demo-pgpass`):

```bash
npm run restore:drill                                   # demo-pgpass → demo-restore, the 6 nightly collections
npm run restore:drill -- --collections=all --target=demo-restore-all   # every top-level collection
npm run restore:drill -- --synthetic=5000 --source=demo-drill-src --target=demo-restore-syn   # sized run (~20k docs)
npm run restore:drill -- --naive-import                 # negative control: skips Timestamp revival → must FAIL
```

`scripts/restore-drill.mjs` exports exactly like the route (orderBy `__name__`,
1000-doc pages), encodes with the shared format helper, writes the artifacts to a
local dir laid out like the bucket (no B2), then — using only the artifacts + key
— decrypts, gunzips, wipes and imports into a separate `demo-*` project, and
verifies per-collection counts plus field-level equality on a sample (Timestamps,
nulls, nested maps/arrays). It refuses non-loopback emulator hosts and non-`demo-*`
targets. Uses `BACKUP_ENCRYPTION_KEY` if it is 64 hex chars, otherwise an ephemeral key.

**Measured 27 Nov 2026** (MacBook, local emulator; times are wall-clock per phase):

| Run | Docs | Backup side (read+encode+store) | Restore side (fetch → decrypt → import → verify) | Result |
|---|---|---|---|---|
| demo-pgpass, nightly 6 collections | 23 | 65 ms | 79 ms (import 34 ms) | ✅ all counts + 48 Timestamps / 23 nulls equal |
| demo-pgpass, `--collections=all` (13 colls) | 53 | 43 ms | 105 ms | ✅ |
| synthetic 5,000 tenants, default BulkWriter | 20,125 | 688 ms (246 KB artifacts) | **40.5 s** (import 40.4 s ≈ 500 docs/s) | ✅ |
| same, `--unthrottled` | 20,125 | 541 ms | 0.63 s (≈ 32k docs/s) | ✅ |
| `--naive-import` (no Timestamp revival) | 23 | — | — | ❌ as intended: every doc with a Timestamp mismatches |

Reading the numbers: decrypt/gunzip/parse is negligible (≈ 37 ms for 20k docs).
The import dominates and is bounded by the Firestore write ramp — BulkWriter's
default 500/50/5 throttle (500 ops/s, +50 % every 5 min), which is also Google's
guidance for writing into a fresh database. At that ramp ≈ 150k docs import in
~5 min and ≈ 1M docs in ~20 min. **On the free Spark plan the target project can
only take 20,000 document writes/day** — a restore larger than that cannot finish
in one day at ₹0; budget a temporary Blaze upgrade (needs explicit approval per
AGENTS.md §8) or restore over several days. The human steps (fetch key, create
project, re-point env, verify money totals) dominate the RTO for pilot-sized data.

### Restore procedure (test this on a NON-prod project before relying on it)
1. **Fetch** the objects for the chosen date: `backups/<YYYY-MM-DD>/*.ndjson.gz.enc`
   (one per collection; a missing object = that collection was empty).
2. **Decrypt then gunzip** each object with `BACKUP_ENCRYPTION_KEY`:
   `decodeCollection(blob, key)` in `lib/server/backup/format.ts` (AES-256-GCM,
   `iv ‖ tag ‖ ciphertext`; a wrong key or any tampering throws). *Previously
   documented as "decrypted JSON" — it is gzip'd NDJSON, the gunzip step was missing.*
3. **Stand up a separate Firebase project** (never restore over live data first).
   Firebase Auth is **not** in the backup: export/import users separately
   (`firebase auth:export users.json --project <prod>` → `firebase auth:import`
   with the project's password-hash config) and re-apply custom claims (admin,
   staff `{role, ownerId}`, resident `{role}`), or nobody can sign in after cut-over.
4. **Import** each row with `reviveRow()` (strips `_id` → doc id, turns the
   `{"_seconds","_nanoseconds"}` maps back into Firestore Timestamps), batched via
   BulkWriter. *Previously documented as `set(JSON.parse(line))`, which silently
   stores every date as a plain map — the drill's `--naive-import` proves the
   verifier catches it.*
5. **Verify integrity:** per-collection counts vs the export, field-level sample
   equality (what the drill automates), then spot-check owner money totals against
   the last-known dashboard numbers.
6. **Cut over** only after verification; re-point env to the restored project.
   Re-issue resident pass links (`portal_tokens` are not backed up) and expect to
   rebuild every non-covered collection listed above from other sources.

> ⚠️ **Format + procedure now exercised end-to-end on the emulator** (above), but a
> **production-sized drill on real infra is still required before a real-resident
> pilot**: real B2 download, a real (non-emulator) Firestore target with its write
> quotas/latency, the Firebase Auth export/import, and a `BACKUP_ENCRYPTION_KEY`
> that is exactly 64 hex chars (the route zero-pads/truncates whatever it is given
> and `lib/env.ts` does not validate its format). Widening `BACKUP_COLLECTIONS`
> (and adding Auth export) is a prerequisite for the RPO above to mean "the PG".
