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
