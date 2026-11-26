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
- **Targets:** RPO ≈ 24h (nightly), RTO ≈ a few hours (manual restore below).
  These are pilot targets — not a production SLA until restore is tested on real data.

### Restore procedure (test this on a NON-prod project before relying on it)
1. **Fetch** the latest encrypted export object from the B2 backup bucket.
2. **Decrypt** with `BACKUP_ENCRYPTION_KEY` (AES-256-GCM; the object stores
   iv/tag/ciphertext — reverse of `encryptAes256Gcm` in the backup route).
3. **Stand up a separate Firebase project** (never restore over live data first).
4. **Import** the decrypted JSON per collection via the Admin SDK
   (`adminDb.collection(c).doc(id).set(data)` in batches).
5. **Verify integrity:** spot-check owners/tenants/rent_records counts and a few
   money totals against the last-known dashboard numbers.
6. **Cut over** only after verification; re-point env to the restored project.

> ⚠️ **Not yet exercised end-to-end.** Before any real-resident pilot, run steps
> 1–5 against synthetic data and record the actual RTO. "Backup exists" ≠
> "restore works" — the blueprint's Phase-5 exit gate requires a tested restore.
