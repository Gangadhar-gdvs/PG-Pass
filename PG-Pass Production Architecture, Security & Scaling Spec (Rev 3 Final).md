# PG-Pass — Production Architecture, Security & Scaling Spec

*Internal engineering reference. Every rule below is mandatory unless explicitly marked optional. Written so an engineer or AI coding agent can implement directly without further interpretation or guesswork.*

**Revision 3 (Final) — 23 Nov 2026.** Complete production spec built around a **₹0, zero-credit-card, zero-rent-commission, host-agnostic** full-stack architecture designed for real Indian PGs.

| Area | What changed in Rev 3 (Final) |
| --- | --- |
| **Permanent Object Storage** | Replaced Cloudflare R2 (requires a payment card to activate) and legacy Cloudinary ($89/mo pricing cliff at 25 credits) with **Backblaze B2** (10 GB free forever, **no credit card required**, S3-compatible API, EU Central `eu-central-003`, ~$6.95/TB / ~₹0.58/GB beyond free tier, handles both private photos and encrypted DB backups — zero future migration needed). §11 updated completely. |
| **Dedicated Backend Inside Next.js** | Consolidated all server-only backend code cleanly under `lib/server/` (`firebase-admin`, `storage/b2`, `api/` middleware wrappers, `security/`, `services/`) with `import 'server-only'` and a strict rule never to pass `NextRequest`/`NextResponse` into services, keeping a single ₹0 deployment that stays 100% extractable to standalone Express/Fastify/Workers if ever needed (§3, §4). |
| **Authentication (D1 Decided)** | Dropped Firebase Phone Auth SMS OTP (requires Blaze card, ~₹6/SMS in India, SMS-pumping risk) and Spark Email-Link (capped at 5/day). Default login for Owners & Staff is **Firebase Auth Google Sign-In + Email/Password** (50,000 MAUs free on Spark, no card). Tenant portal stays hashed `/portal/[token]` hardened with a **last-4-digit phone PIN** unlock (§6). |
| **0%-Fee Rent Collection & Monetization (D5 Decided)** | Removed the 2% payment gateway path for tenant rent. Standardized on **0%-fee direct UPI** (owner UPI ID / Merchant Business QR + client-side `qrcode` + 1-tap Copy UPI/Amount + `pending → verify → paid` + **UTR reuse anti-fraud** + `nextReceiptSeq` `jspdf` receipts + **"Remind Pending Queue" `Send & Next` WhatsApp modal** with `lastRemindedAt` + optional Phase 2 client-side bank CSV matcher). Added **Flat-Fee SaaS Subscription** pricing (Free / ₹399 / ₹899) collected via UPI + Super Admin upgrade (§9, §10). |
| **Warden / Caretaker Role** | Added a scoped **`staff` (warden)** sub-role under an `ownerId` so owners never share personal passwords with caretakers handling daily move-ins and rent logging (§2, §5, §7). Locked `staff` list queries strictly to `GET /api/staff` (`allow list: if false;` in rules). |
| **Real-World PG Edge Cases** | Added proration & variable `lineItems` (base rent + electricity/extras), separate `deposits` ledger & move-out deductions, mid-month bed-swap snapshots (`roomNumber`/`bedLabel` frozen on `rent_records`), atomic bed-booking transactions, SHA-256 tamper-evident move-in photo checksums, recycled Indian SIM protection (never key by phone number), 7-day reversible soft-deletes, and audited `paid` record reversals (§5, §8, §10, §11). |
| **Spark Quota & Lockout Hardening** | Replaced per-read `get()` (`ownerIsActive`) in Firestore rules with `suspended` custom claims + `revokeRefreshTokens` + live `withAuth` verification. Separated PIN brute-force lockouts into `portal_lockouts/{tokenHash}` (`attempts`, `lockedUntil`, `expiresAt`) distinct from `rate_limits/{key}` (`tokens`, `windowStart`, `expiresAt`). Added explicit Firestore "rules are not filters" query contract (§5, §6.5, §7.1, §8.9). |
| **Host-Agnostic Dev & Pilot Shipping Cutline** | Hosting selection (D2) deferred until product completion. Added 100% free offline dev stack (**Firebase Local Emulator Suite + MinIO**). Split §17 and §18.6 clearly into **Pilot Launch Gate (First 3–5 PGs)** vs. **Post-Pilot Scale Hardening** so solo development ships fast without compromising security. |
| **Audit & Backlog Preserved** | Retained all Rev 2 repository audit findings (`F-1` through `F-13`), interim hardened rules (§18.4), and local audit verification checklist (§18.5). |

---

## 0. Context *(updated)*

PG-Pass is a Next.js 16 (App Router) + Firebase (Auth, Firestore) full-stack web app for PG (paying-guest accommodation) owners in India to automate beds, tenants, deposits, rent collection, and move-in photo evidence, with a QR/token-based pass for tenants. Four roles exist: **PG Owner**, **Warden/Caretaker (`staff`)**, **Resident/Tenant**, and **Super Admin**.

Stack at the time of the repository audit (from `package.json`): Next.js 16.4.6, React 19.3.0, Tailwind CSS 4.3, Firebase JS SDK 13.4, `jspdf`. Permanent file storage (private move-in/move-out/payment photos and encrypted backups) is **Backblaze B2** via the standard S3 SDK (`@aws-sdk/client-s3`).

There is currently no backend/API layer in the repository — everything goes straight from the browser to Firestore (no `firebase-admin` dependency exists yet), which is why the rules below are strict and layered: Firestore rules are, today, the *only* security boundary. §18 lists every gap where the deployed repository falls short of this spec.

This document is the single source of truth. If a future change conflicts with a rule here, update this document first, then the code.

### 0.1 Plan, Card-Free & Hosting Constraints (Read First) *(updated)*

PG-Pass is engineered to build, launch, and serve its initial paying PGs at **₹0 cost with zero credit cards attached**, without forcing painful migrations when revenue scales.

| Service | Free-Plan Reality (checked Nov 2026) | Card Required? | Consequence in This Spec |
| --- | --- | --- | --- |
| **Firebase Auth (Google + Email/Password)** | 50,000 MAUs free on Spark; 150 password resets/day | **No** | **Selected (D1).** Replaces SMS OTP and Email-Link. |
| **Firebase Phone Auth (SMS OTP)** | Blaze only; only 10 SMS/day free, then ~$0.07 (~₹6)/SMS in India | Yes | **Not used.** Too expensive and vulnerable to SMS-pumping bots. |
| **Firebase Email-Link Sign-In** | Capped at 5 emails/day on Spark | No | **Not used.** Breaks immediately in real usage. |
| **Cloud Firestore (Spark)** | 1 GiB storage, 50K reads/day, 20K writes/day | **No** | **Selected for launch.** Paginated queries + quota-safe rules/rate-limiting stretch Spark across dozens of PGs. Upgrade to Blaze only after subscription revenue covers it. |
| **Firebase Storage** | Requires paid Blaze plan | Yes | **Not used.** Replaced by Backblaze B2 (§11). |
| **Firebase Cloud Functions** | Blaze only | Yes | **Not used.** Replaced by Next.js Route Handlers + atomic service batches + GitHub Actions `cron.yml` (§9.4, §12.2). |
| **Backblaze B2** | **10 GB storage free forever**, free Class A/B/C daily caps, **3× stored data free monthly egress**; ~$6.95/TB (~₹0.58/GB) beyond 10 GB | **No** | **Selected permanently (D4).** Holds ~80,000+ client-compressed WebP photos + encrypted DB backups for ₹0; scales for pennies without ever migrating. |
| **GitHub Actions** | Free for public repos (2,000 min/mo for private) | **No** | **Selected** for CI/CD and nightly scheduled jobs (§12.2, §13). |
| **Local Dev (Firebase Emulators + MinIO)** | Unlimited local Auth, Firestore, and S3 storage | **No** | **Selected** for zero-quota offline development (§13.1). |
| **App Hosting (Decision D2)** | Deferred until product development finishes | Depends | Build 100% host-agnostic Node/Next.js code first. Commercial-safe launch candidates: **Oracle Always-Free / Hetzner VPS + Docker/Coolify**, **Cloudflare Workers/Pages (OpenNext)**, **Render/Railway**, or **Vercel Pro** (note: Vercel Hobby is non-commercial). |

**Architecture Decisions Ledger:**

- **D1 — Auth method:** **Decided.** Firebase Auth **Google Sign-In (primary)** + **Email/Password (fallback)** for Owners and Wardens/Staff on Spark. Optional DIY WhatsApp Click-to-Verify (`wa.me`) if phone ownership confirmation is ever needed later.
- **D2 — Hosting platform:** **Deferred until product completion.** All backend business logic lives in pure TypeScript under `/lib/server/services/` with thin Next.js Route Handler wrappers, zero host-specific SDKs, and env-configurable S3 endpoints so deployment works on VPS/Docker, Cloudflare, Render, Railway, or Vercel without rewrites.
- **D3 — Tenant access:** **Decided.** No tenant account required in v1. Tenants open `/portal/[token]` and unlock with the **last 4 digits of their registered phone number** (§6.5).
- **D4 — Object storage:** **Decided (Permanent).** **Backblaze B2** (`eu-central-003`) using `@aws-sdk/client-s3`. Replaces both Firebase Storage and legacy Cloudinary permanently.
- **D5 — Rent collection & monetization:** **Decided.** **0%-fee direct UPI** (`pending → verify → paid` + UTR deduplication + PDF receipts + `Send & Next` WhatsApp reminders) for tenant rent. Platform revenue comes from **flat-fee SaaS plans** (Free / ₹399 / ₹899 per month) paid by PG owners.

---

## 1. Non-Negotiable Rules *(updated)*

1. **No hardcoded values anywhere.** Every URL, phone number, UPI ID, API key, magic string/status, limit, or threshold lives in an env var or a single constants file — never inline in a component, a Firestore rule, or a config file. Admin identity may never appear as a literal phone number or email anywhere in rules or source code.
2. **One place per concern, no duplication.** Each Firestore collection has exactly one service file under `/lib/server/services/` that touches it. Each cross-cutting concern (error handling, auth, RBAC, rate limiting, validation, logging) is one wrapper reused everywhere — never re-implemented per route.
3. **Deny by default.** Every Firestore rule, every API route, and every Backblaze B2 bucket denies unless an explicit condition allows it. The default branch is always `false`; object storage has zero public access.
4. **Never trust the client.** Amounts, line-item totals, statuses, roles, plan limits (`maxBeds`, `maxTenants`, `maxPhotos`, `maxStaff`), and ownership are always derived or re-verified server-side. The client can suggest; only the server (Admin SDK / route handler) decides.
5. **Official, zero-card / free-tier-first dependencies only.** Prefer built-in browser APIs (`<canvas>`, `qrcode`, `jspdf`) and services already in the stack (Firestore, Firebase Auth, Backblaze B2, GitHub Actions) over paid add-ons or anonymous third-party HTTP APIs (including external QR-code and public image-hosting APIs). Every external vendor must appear in §14 before use.
6. **Everything scales horizontally and respects Spark quotas by default.** No code path assumes a fixed number of users or unbounded reads; see §8.
7. **Money is integer paise.** No floats, ever. All monetary field names end in `Paise` (e.g., `rentAmountPaise`, `securityDepositPaise`, `amountDuePaise`).
8. **Zero rent commissions.** Never impose a percentage-based gateway fee on tenant rent payments; preserve 0%-fee direct UPI settlement to the PG owner.
9. **Host-agnostic & backend-decoupled by construction.** Route handlers remain thin HTTP adapters around pure `/lib/server/services/*.service.ts` modules. Never pass `NextRequest`/`NextResponse` into service files, and never bind business logic to Vercel-only, Cloudflare-only, or Firebase-Cloud-Functions-only primitives.
10. **Plan-aware.** Any feature that requires a paid plan, credit card, or quota-limited tier must be recorded in §0.1 or §14 before it is built.

---

## 2. Roles & Permission Model *(updated)*

| Role | Identity | Scope | Granted Via |
| --- | --- | --- | --- |
| **Guest** | Unauthenticated | Public marketing pages, `/privacy`, `/terms` | n/a |
| **Resident / Tenant** | Hashed portal token + **last-4-digit phone PIN** (§6.5) | Own pass view, own deposit & rent history, UPI pay card, and "I Paid" UTR claim via Portal API only | `portal_tokens` record created by owner/staff |
| **Warden / Caretaker (`staff`)** *(new)* | Firebase Auth (Google or Email/Password) | Scoped strictly to one `ownerId`: view assigned PG beds/tenants, onboard tenants, assign vacant beds, upload move-in/move-out photos, log payment claims. **Denied:** deleting tenants, editing base rent/PG settings, approving irreversible plan/account changes, viewing total revenue analytics | Owner creates staff invite via `/api/staff`; server sets custom claims `{ role: 'staff', ownerId }` |
| **PG Owner (`owner`)** | Firebase Auth (Google or Email/Password) | Own `owners/{ownerId}` doc, staff management, billing/upgrade requests, full CRUD on all collections scoped by `ownerId` | `uid == ownerId` (custom claim `{ role: 'owner' }`) |
| **Super Admin (`admin`)** | Firebase Auth + custom claim | Entire platform, read-most / write-via-API, owner suspension, plan upgrades, audit review | `request.auth.token.admin == true`, granted only via bootstrap script or existing admin through `/api/admin/claims` — **never hardcoded** |

**Account Status & Suspension Enforcement:**
Every Owner, Staff member, and Tenant carries `accountStatus` (`active` | `suspended` | `pending_review`). A suspended Owner or Staff account is blocked at **three independent layers**:
1. **Auth custom claim + token revocation:** Suspension sets `{ suspended: true }` custom claim and calls `auth.revokeRefreshTokens(uid)`, blocking both new session cookies and Firestore rules without costing extra `get()` reads.
2. **`proxy.ts`:** Optimistic session cookie check on protected routes.
3. **`withAuth`:** Authoritative server check (`verifySessionCookie(cookie, checkRevoked = true)` + live `accountStatus === 'active'` check on every API call and Server Action).

Suspending an Owner automatically blocks all `staff` accounts under that `ownerId` inside `withAuth`.

---

## 3. Architecture Rules *(updated)*

### 3.1 Layering — Single Full-Stack Repo with Clean Backend Isolation

PG-Pass keeps a **single Next.js 16 full-stack repository** (one ₹0 deployment, same-origin `httpOnly` cookies, shared Zod schemas and TypeScript types) while isolating 100% of backend internals inside `lib/server/` guarded by `import 'server-only'`.

```
Browser (Next.js Client / Server Components)
   │  Direct Firestore reads ONLY for: signed-in user's own small, bounded, ownerId-filtered queries
   │  (Never direct Firestore writes; never cross-user reads; never unauthenticated reads)
   ▼
proxy.ts  (Next.js 16 — optimistic check only: session cookie present? redirect; injects per-request CSP nonce)
   ▼
Next.js Route Handlers (/app/api/**) & Server Actions   ← SINGLE entry point for every write & privileged read
   │  wrapped by: withErrorHandler → withAuth → withRateLimit → withValidation
   ▼
Backend Service Layer (/lib/server/services/*.service.ts) ← Pure TS; ONLY code calling Firebase Admin SDK or B2 client
   ▼
Firestore (Admin SDK)  /  Backblaze B2 (S3 Presigned URLs; MinIO locally)  /  GitHub Actions Cron (§12.2)
```

Rules:
- **Zero direct client writes.** Every create, update, delete, status transition, plan-limit check, cross-user read, staff listing, portal lookup, and admin action flows through `/app/api/**` → `/lib/server/services/*.service.ts`.
- **Golden Backend Decoupling Rule:** Never import or pass `NextRequest` or `NextResponse` into `/lib/server/services/*.service.ts`. Route handlers parse HTTP inputs, run the wrapper chain, call pure TypeScript service functions with typed arguments, and serialize JSON responses. If PG-Pass ever needs a standalone Express/Fastify/Worker backend later, `lib/server/` copies over intact with zero business-logic rewrites.
- **Standard REST APIs for Future Mobile Apps:** Prefer `/app/api/**` Route Handlers over React-only Server Actions for domain operations so a future mobile app can call the exact same REST endpoints. Any Server Action exported from a `"use server"` file is still a public HTTP endpoint and must use the identical wrapper chain (`proxy.ts` does not protect Server Actions).
- **`proxy.ts` is not a security boundary.** Next.js 16 renamed `middleware.ts` to `proxy.ts` for optimistic checks and CSP nonces only. Real authentication, role, `ownerId` ownership, and `accountStatus` verification always happen in `withAuth` and the service layer.
- **Files never touch Firestore or the repo.** Browsers compress images on a `<canvas>` and upload/download directly to/from Backblaze B2 via short-lived server-minted S3 presigned URLs (§11).

### 3.2 No Duplicate API / Service Creation
Before adding a new API route or database query, check `/lib/server/services/`. Extend the collection's single service file rather than writing a second data-access path.

### 3.3 Centralized Config (`lib/env.ts`)
One `lib/env.ts` validates `process.env` with `zod` at startup and exports a typed `env` object. No other file reads `process.env` directly. `.env.example` lists every variable (§16) with one-line comments and **must be committed** (update `.gitignore` to include `!.env.example`).

### 3.4 Centralized Constants (`lib/constants/`)
- `status.ts`: every enum (`RENT_STATUS`, `ACCOUNT_STATUS`, `BED_STATUS`, `PHOTO_TYPE`, `PLAN_TIER`, `SUBSCRIPTION_REQUEST_STATUS`, `ROLE`).
- `limits.ts`: numeric thresholds (page sizes, plan tier limits, rate-limit windows, PIN lockout thresholds, file size caps, presigned-URL TTLs, retention days, 7-day soft-delete undo window).
- `routes.ts`: internal route paths used in redirects.
- `storage.ts`: B2 key prefixes (`pending/`, `movein/`, `moveout/`, `payment_proof/`), allowed MIME types (`image/jpeg`, `image/webp`).

Firestore rules reference the same literal status/limit values — keep both in sync with a comment pointing here and verify sync in `tests/rules`.

---

## 4. Production Folder Structure *(updated)*

```
pg-pass/
├── app/
│   ├── (public)/                        # unauthenticated frontend
│   │   ├── page.tsx
│   │   ├── privacy/page.tsx             # data-protection notice (§15)
│   │   ├── terms/page.tsx
│   │   └── portal/[token]/page.tsx      # tenant pass + 0% UPI card — PIN-gated via /api/portal
│   ├── (owner)/                         # owner & scoped staff frontend
│   │   ├── dashboard/page.tsx
│   │   ├── beds/
│   │   ├── tenants/
│   │   ├── deposits/                    # security deposit ledger & deductions
│   │   ├── rent/                        # pending, verify queue, paid receipts, Send & Next WhatsApp queue
│   │   ├── staff/                       # warden/caretaker management (owner-only, reads via /api/staff)
│   │   └── billing/                     # flat SaaS plan status & UPI upgrade submission
│   ├── (admin)/                         # super-admin frontend
│   │   ├── dashboard/page.tsx
│   │   ├── owners/
│   │   ├── residents/
│   │   ├── subscriptions/               # approve/reject owner SaaS plan UTR upgrades
│   │   ├── flags/                       # support_flags inbox
│   │   └── notifications/               # admin_notifications inbox
│   ├── api/                             # THIN HTTP ADAPTERS ONLY (calls lib/server/services)
│   │   ├── auth/session/route.ts        # exchanges Firebase ID token for httpOnly session cookie / clears cookie
│   │   ├── owners/route.ts              # owner profile & UPI ID / Merchant QR settings
│   │   ├── staff/
│   │   │   ├── route.ts                 # owner invites/lists wardens (GET uses Admin SDK; no client list rule)
│   │   │   └── [staffUid]/route.ts      # revoke/suspend warden
│   │   ├── beds/
│   │   │   ├── route.ts
│   │   │   └── [id]/route.ts
│   │   ├── tenants/
│   │   │   ├── route.ts                 # create tenant + atomic bed assignment transaction
│   │   │   └── [id]/
│   │   │       ├── route.ts             # update / soft-delete (7-day undo) / swap bed
│   │   │       ├── restore/route.ts     # undo soft-delete within 7 days
│   │   │       └── moveout/route.ts     # atomic move-out: free bed, settle deposit, close rent
│   │   ├── deposits/
│   │   │   └── [tenantId]/route.ts      # record deposit installment / deduction / refund
│   │   ├── rent/
│   │   │   ├── route.ts                 # create / list paginated rent records (supports lineItems & proration)
│   │   │   └── [id]/
│   │   │       ├── claim/route.ts       # tenant "I Paid" + UTR dedup check (portal token + PIN) — pending → verify
│   │   │       ├── confirm/route.ts     # owner/staff confirm (verify → paid + receipt#) or reject (verify → pending)
│   │   │       ├── reminded/route.ts    # records lastRemindedAt when owner taps Send & Next in WhatsApp queue
│   │   │       └── reverse/route.ts     # owner audited reversal of accidental 'paid' record
│   │   ├── portal/[token]/
│   │   │   ├── unlock/route.ts          # validates last-4-digit phone PIN (with portal_lockouts) & returns view payload
│   │   │   └── route.ts                 # Admin-SDK-only whitelisted pass lookup
│   │   ├── uploads/
│   │   │   ├── intent/route.ts          # mint presigned PUT (Backblaze B2) for movein / moveout / payment_proof
│   │   │   └── confirm/route.ts         # HeadObject + magic-bytes + SHA-256 + CopyObject + create movein_photos doc
│   │   ├── photos/[photoId]/url/route.ts # mint short-lived presigned GET (Backblaze B2)
│   │   ├── billing/upgrade/route.ts     # owner submits flat SaaS subscription UPI UTR
│   │   ├── flags/route.ts               # any signed-in user submits support/abuse flag
│   │   ├── admin/
│   │   │   ├── accounts/route.ts        # suspend/reactivate owners, staff, tenants
│   │   │   ├── subscriptions/route.ts   # approve/reject owner SaaS plan upgrade & update limits
│   │   │   └── claims/route.ts          # grant admin claim (admin-only)
│   │   ├── cron/                        # secured by CRON_SECRET (§12.2)
│   │   │   ├── metrics/route.ts         # nightly metrics + daily rent generation
│   │   │   ├── backup/route.ts          # AES-256-GCM encrypted NDJSON export to B2_BACKUP_BUCKET
│   │   │   └── cleanup/route.ts         # orphan B2 keys, expired tokens, retention purges
│   │   └── health/route.ts              # shallow 200 uptime check (?deep=1 requires CRON_SECRET)
│   ├── layout.tsx
│   └── globals.css
├── proxy.ts                             # Next.js 16: optimistic cookie gate + per-request CSP nonce
├── components/
│   ├── ui/
│   ├── owner/
│   ├── staff/
│   ├── admin/
│   └── tenant/
├── lib/
│   ├── env.ts                           # centralized zod env validation (shared public + server parsing)
│   ├── constants/
│   │   ├── status.ts
│   │   ├── limits.ts
│   │   ├── routes.ts
│   │   └── storage.ts
│   ├── validation/                      # shared zod schemas (used by browser forms & API routes)
│   ├── firebase/
│   │   └── client.ts                    # browser-safe client SDK init (connects to emulators in dev)
│   ├── client/
│   │   ├── imageCompress.ts             # browser <canvas> WebP compressor (~120 KB) + EXIF stripper
│   │   ├── upi.ts                       # UPI QR payload + Copy UPI/Amount + WhatsApp wa.me link builders
│   │   └── receiptPdf.ts                # jspdf numbered receipt generator from verified 'paid' records
│   └── server/                          # 100% BACKEND — every file begins with `import 'server-only'`
│       ├── firebase-admin.ts            # Firebase Admin SDK init (Auth + Firestore)
│       ├── storage/
│       │   ├── b2.ts                    # S3Client for Backblaze B2 (or local MinIO) + presign/head/copy/hash helpers
│       │   └── provider.ts              # thin storage interface isolating B2 implementation details
│       ├── security/
│       │   ├── csp.ts                   # per-request nonce CSP builder
│       │   └── tokens.ts                # crypto.randomBytes portal tokens + SHA-256 hashing + UTR hashing
│       ├── api/
│       │   ├── withAuth.ts              # session cookie + revocation + role/ownerId/accountStatus check
│       │   ├── withRateLimit.ts         # two-tier: in-memory bucket + Firestore TTL lock on sensitive routes
│       │   ├── withValidation.ts        # shared zod validation
│       │   └── withErrorHandler.ts      # structured logging + safe generic error with requestId
│       ├── monitoring/
│       │   ├── logger.ts
│       │   └── metrics.ts
│       └── services/                    # pure TS business logic (NO NextRequest/NextResponse imports)
│           ├── owners.service.ts
│           ├── staff.service.ts
│           ├── beds.service.ts
│           ├── tenants.service.ts
│           ├── deposits.service.ts
│           ├── rent.service.ts
│           ├── portal.service.ts
│           ├── photos.service.ts        # ONLY code touching movein_photos AND Backblaze B2 objects
│           ├── subscriptions.service.ts
│           ├── notifications.service.ts
│           ├── audit.service.ts
│           ├── rateLimits.service.ts
│           ├── portalLockouts.service.ts
│           └── idempotency.service.ts
├── scripts/
│   ├── bootstrapAdmin.ts                # one-time first-admin script (uid passed as CLI arg)
│   ├── migrateCloudinaryToB2.ts         # one-off migration script (§11.8)
│   ├── restoreFromBackup.ts             # quarterly staging restore drill (§12.3)
│   └── README.md
├── infra/
│   ├── b2-cors.json                     # Backblaze B2 S3 CORS policy
│   └── b2-lifecycle.md                  # lifecycle rules for pending/ (1 day) and backups (30 days)
├── docs/
│   ├── data-inventory.md                # personal-data inventory (§15)
│   └── runbook.md                       # incident & erasure runbook (§12.4, §15)
├── .github/
│   ├── workflows/ci.yml                 # required PR checks (§13)
│   ├── workflows/cron.yml               # nightly metrics, rent-gen, backup, cleanup (§12.2)
│   └── dependabot.yml
├── docker-compose.yml                   # local MinIO S3 container for zero-cost offline dev (§13.1)
├── firebase.json                        # emulator + rules + indexes config
├── firestore.rules
├── firestore.indexes.json
├── .env.example
└── tests/
    ├── rules/                           # @firebase/rules-unit-testing
    ├── unit/                            # vitest
    └── e2e/                             # Playwright
```

*(Note: `storage.rules` and `functions/` are intentionally removed — neither Firebase Storage nor Cloud Functions is used.)*

---

## 5. Data Rules — Firestore Schema *(updated)*

Every document has `createdAt` (server timestamp, immutable) and `updatedAt` (server timestamp, updated on every write). `ownerId` and `tenantId` are **immutable after creation** — enforced in the service layer and covered by unit tests. **All writes are server-side; target Firestore rules deny every client write** (§7.1). All money fields are integer paise (`*Paise`).

**Recycled Indian SIM Rule:** Telecom operators in India recycle inactive prepaid phone numbers after ~90 days. **Never use a phone number as a Firestore document ID or unique permanent account key.** Always key accounts and documents by Firebase Auth `uid` or server-generated UUIDs.

| Collection | Key Fields | Immutable After Create | Who Writes |
| --- | --- | --- | --- |
| `owners/{ownerId}` (id = Auth uid) | `name`, `email`, `phone`, `pgName`, `address`, `upiId`, `upiMerchantName`, `accountStatus`, `plan`, `subscriptionExpiresAt`, `maxBeds`, `maxTenants`, `maxPhotos`, `maxStaff`, **`nextReceiptSeq` (integer, initialized to `0` on owner signup)** | — | Server. Owner edits profile & UPI details via `/api/owners`; admin edits `accountStatus`, `plan`, limits; `rent.service.ts` increments `nextReceiptSeq` inside confirm transactions |
| `staff/{staffUid}` | `ownerId`, `name`, `email`, `phone`, `role` (`warden`), `accountStatus`, `invitedBy` | `ownerId` | Server (owner request via `/api/staff` or admin suspend). Listed strictly via `GET /api/staff` |
| `beds/{bedId}` | `ownerId`, `roomNumber`, `bedLabel`, `status` (`vacant` \| `occupied` \| `maintenance`), `tenantId`, `rentAmountPaise` | `ownerId` | Server (owner/staff request; occupancy changes run inside atomic transactions) |
| `tenants/{tenantId}` | `ownerId`, `ownerName` (denormalized), `bedId`, `roomNumber`, `bedLabel`, `name`, `phone`, `phoneLast4`, `idProofType`, `accountStatus`, `securityDepositPaise`, `depositPaidPaise`, `moveInDate`, `moveOutDate`, `deletedAt`, `deletedBy` | `ownerId` | Server (owner/staff request). **No `token` field** — see below |
| `deposits/{txId}` | `ownerId`, `tenantId`, `type` (`installment` \| `deduction` \| `refund`), `amountPaise`, `reason`, `reference`, `recordedBy` | all | Server only (append-only ledger; updates `tenants.depositPaidPaise` atomically) |
| `rent_records/{recordId}` | `ownerId`, `tenantId`, `period` (`YYYY-MM`), `roomNumber` *(snapshot)*, `bedLabel` *(snapshot)*, `lineItems` (`[{ label, amountPaise }]`), `prorated`, `amountDuePaise`, `amountPaidPaise`, `status`, `dueDate`, `paymentReference`, `proofPhotoId`, `claimedAt`, `confirmedAt`, `confirmedBy`, `receiptNumber`, **`lastRemindedAt`**, `reversedAt`, `reversalReason` | `ownerId`, `tenantId`, `period`, `roomNumber`, `bedLabel` | Server only. `amountDuePaise` equals sum of `lineItems`. Status moves strictly per §10.1 |
| `utr_claims/{ownerId}_{utrHash}` | `ownerId`, `rentRecordId`, `tenantId`, `claimedAt` | all | Server only, written inside the same transaction as `/api/rent/[id]/claim` to block UTR reuse fraud |
| `movein_photos/{photoId}` | `ownerId`, `tenantId`, `rentRecordId` *(optional)*, `photoType` (`move_in` \| `move_out` \| `payment_proof`), `storageProvider` (`b2`), `objectKey`, `contentType`, `sizeBytes`, `sha256`, `uploadedBy` | all | Server only, created by `/api/uploads/confirm` after verifying bytes + SHA-256 (§11.4). To replace, delete and recreate |
| `portal_tokens/{tokenHash}` | `tenantId`, `ownerId`, `expiresAt`, `singleUse`, `usedAt`, `revokedAt` | all except `usedAt`, `revokedAt` | Server only. Doc ID is SHA-256 hash of the raw token (§6.5) |
| `portal_lockouts/{tokenHash}` *(new)* | `attempts`, `lockedUntil`, `expiresAt` | — | Server only (`portalLockouts.service.ts`). Isolates failed last-4 PIN lockout state from general rate-limiting. TTL policy on `expiresAt` |
| `subscription_requests/{reqId}` | `ownerId`, `requestedPlan`, `billingCycle` (`monthly` \| `yearly`), `amountPaise`, `utrReference`, `status` (`pending` \| `approved` \| `rejected`), `reviewedBy`, `reviewedAt`, `notes` | `ownerId`, `requestedPlan`, `amountPaise`, `utrReference` | Server only (owner submits via `/api/billing/upgrade`; admin approves via `/api/admin/subscriptions`) |
| `audit_logs/{logId}` | `actorUid`, `actorRole`, `action`, `targetType`, `targetId`, `reason` | all | Server only |
| `admin_notifications/{id}` | `type`, `severity`, `relatedOwnerId`, `relatedTenantId`, `message`, `status`, `resolvedBy`, `resolvedAt` | all except `status`, `resolvedBy`, `resolvedAt` | Server only; written inside the same transaction/batch as triggering event |
| `support_flags/{flagId}` | `reportedBy`, `targetType`, `targetId`, `reason`, `status`, `resolvedBy`, `resolvedAt` | all except `status`, `resolvedBy`, `resolvedAt` | Server only (submitted via `/api/flags`; admin resolves via API) |
| `metrics/{date}` | aggregated nightly counters | all | Server only (cron job §12.2) |
| `rate_limits/{key}` | `tokens`, `windowStart`, `expiresAt` | — | Server only (sensitive routes only — §8.9; namespaced keys e.g. `rl:{route}:{ipHash}`). TTL policy on `expiresAt` |
| `idempotency_keys/{key}` | `uid`, `route`, `resultRef`, `createdAt`, `expiresAt` | all | Server only. TTL policy on `expiresAt` |

**Why `portal_tokens` and not a `token` field on `tenants`:** Putting a `token` field on `tenants` and checking `resource.data.token != null` in Firestore rules allows *anyone* who knows or guesses a document ID to read the tenant's PII, because Firestore rules cannot prove the caller supplied the secret token. Token lookup must live exclusively behind `/api/portal/[token]` (§18, finding `F-1`).

**Validation (Defense in Depth):**
- Client forms and API routes share `zod` schemas in `/lib/validation/` (including initializing `nextReceiptSeq: 0` in the owner onboarding schema).
- Service layer independently enforces state transitions, immutability, plan quotas, and `ownerId` ownership.
- No unbounded list queries: rules enforce `request.query.limit <= MAX_LIST_LIMIT` (100), and API endpoints default to cursor pagination (`PAGE_SIZE_DEFAULT = 25`).

**Composite Indexes (`firestore.indexes.json`):** Define ahead of time for:
- `rent_records`: `(ownerId, period, status)`, `(ownerId, status, dueDate)`, `(tenantId, period DESC)`
- `tenants`: `(ownerId, deletedAt, createdAt DESC)`
- `beds`: `(ownerId, status, roomNumber)`
- `deposits`: `(ownerId, tenantId, createdAt DESC)`
- `subscription_requests`: `(status, createdAt DESC)`

**TTL Policies:** Configure Firestore TTL on `rate_limits.expiresAt`, `portal_lockouts.expiresAt`, `idempotency_keys.expiresAt`, and `portal_tokens.expiresAt` (tokens remain `PORTAL_TOKEN_RETENTION_DAYS` post-expiry for audit before TTL purges them).

**Soft-Delete & Undo:** Tenants are never hard-deleted from the UI. Deleting sets `deletedAt` and frees the bed inside a transaction. Owners can **undo/restore** a soft-deleted tenant within `SOFT_DELETE_UNDO_DAYS` (7 days) provided the bed (or a new bed) is vacant. Permanent purge happens only via the retention cleanup job (§15).

---

## 6. Authentication & Session Rules *(updated)*

1. **Owner & Staff Login (Zero-Card Spark Auth — Decision D1):**
   - **Primary:** Firebase Auth **Google Sign-In** (1-tap on Indian Android devices, 50,000 MAUs free on Spark, zero SMS cost, zero DLT delays). Collect the owner's phone number and UPI ID during onboarding.
   - **Fallback:** Firebase Auth **Email + Password** (for desktop users or non-Google accounts).
   - **Rejected:** Do **not** enable Firebase Phone Auth SMS OTP (requires Blaze card + ~₹6/SMS + SMS-pumping exposure) or Firebase Email-Link (5 emails/day cap on Spark).
   - **Optional Phone Verification (Phase 2, ₹0):** If phone-ownership verification is ever desired, use DIY **WhatsApp Click-to-Verify** (`wa.me/<businessNumber>?text=VERIFY-<shortCode>`) where user-initiated messages fall inside Meta's free 24-hour service window.
2. **Custom Claims are the Only Source of Elevated Roles:**
   - Admin rights come exclusively from `request.auth.token.admin == true`. No literal phone number or email may ever appear in rules or code.
   - Bootstrap the very first Super Admin once via `scripts/bootstrapAdmin.ts <uid>` (documented in `scripts/README.md`). Subsequent admins are granted only via `/api/admin/claims` with an automatic `audit_logs` entry.
   - Staff accounts receive `{ role: 'staff', ownerId: '<ownerUid>' }` via `/api/staff`.
3. **Sessions (`httpOnly` Cookies):**
   - On login, the client posts its Firebase ID token to `POST /api/auth/session`, which verifies the token, confirms `accountStatus == 'active'`, and issues an `httpOnly`, `Secure`, `SameSite=Lax` session cookie via `admin.auth().createSessionCookie(...)`.
   - `proxy.ts` performs an optimistic cookie presence check only.
   - `withAuth` runs on every API route and Server Action: calls `verifySessionCookie(cookie, true)` (revocation checked), validates `accountStatus == 'active'` (and owning PG's `accountStatus == 'active'` for `staff`), and attaches `{ uid, role, ownerId }` to context.
   - Server Components loading protected data call the exact same server session verifier, never trusting `proxy.ts`.
4. **Account Suspension:**
   - Suspending an owner or staff member updates `accountStatus = 'suspended'`, sets custom claim `suspended: true`, and calls `auth.revokeRefreshTokens(uid)`.
   - Suspending a tenant sets `accountStatus = 'suspended'` and revokes all active `portal_tokens` for that tenant.
5. **Tenant Portal (`/portal/[token]` + Last-4-Digit Phone PIN):**
   - Pass link format: `/portal/[token]`. Tokens are 32 bytes from `crypto.randomBytes`, base64url-encoded; **only the SHA-256 hash** is stored in `portal_tokens/{tokenHash}` so a DB leak never exposes live links.
   - To prevent casual link-forwarding or screenshot snooping on WhatsApp, opening `/portal/[token]` prompts for the **last 4 digits of the tenant's registered phone number** (`POST /api/portal/[token]/unlock`).
   - The Route Handler hashes the token, checks `portal_lockouts/{tokenHash}` (locks out for `PORTAL_PIN_LOCKOUT_MINUTES = 15` after `PORTAL_PIN_MAX_ATTEMPTS = 5` failed PIN attempts; clears attempts on success), checks `expiresAt` (`PORTAL_TOKEN_TTL_DAYS = 90`, renewable/reusable), `revokedAt`, and (if `singleUse`) `usedAt`, verifies `phoneLast4` in constant time, and returns **only whitelisted display fields** (tenant first name, PG name, owner UPI ID/Merchant name, room/bed, deposit summary, rent history) — never the raw tenant document or full phone number.
   - Rate-limited **outermost** by IP (`rl:portal_unlock:{ipHash}`). Returns a uniform generic `404` for unknown, expired, or revoked tokens so tokens cannot be probed.
   - Portal pages always emit `Referrer-Policy: no-referrer`, `Cache-Control: private, no-store`, and `X-Robots-Tag: noindex, nofollow`.
6. **Local QR Code Generation:**
   - Both the Tenant Pass QR and Owner UPI Payment QR are generated **100% client-side** using the `qrcode` npm package. Never send portal URLs or UPI data to an external QR API (`api.qrserver.com` is banned — §18, finding `F-7`).

---

## 7. Security, Every Surface *(updated)*

### 7.1 Target Firestore Rules (Quota-Safe & Server-Write-Only) *(updated)*

All client writes are denied; every mutation runs through `/app/api/**` via the Admin SDK. To protect Spark's 50,000 reads/day quota, rules verify suspension via the `suspended` custom claim (0 extra billed reads) instead of executing a `get()` on every query; `withAuth` additionally enforces live `accountStatus` on every API call.

*(If the API layer does not exist yet, deploy the interim hardened rules in §18.4 first.)*

```
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    // Mirrors lib/constants/status.ts and limits.ts — keep in sync (§3.4).
    function isSignedIn() { return request.auth != null; }
    function notSuspended() { return isSignedIn() && request.auth.token.suspended != true; }
    function isAdmin() { return notSuspended() && request.auth.token.admin == true; }
    function isOwnerUid(ownerId) { return notSuspended() && request.auth.uid == ownerId; }
    function isStaffFor(ownerId) {
      return notSuspended()
        && request.auth.token.role == 'staff'
        && request.auth.token.ownerId == ownerId;
    }
    function canReadOwnerScope(ownerId) { return isOwnerUid(ownerId) || isStaffFor(ownerId) || isAdmin(); }
    function boundedList() { return request.query.limit <= 100; } // MAX_LIST_LIMIT

    match /owners/{ownerId} {
      allow get:   if isOwnerUid(ownerId) || isStaffFor(ownerId) || isAdmin();
      allow list:  if isAdmin() && boundedList();
      allow write: if false;
    }

    match /staff/{staffUid} {
      // Staff lists are served strictly via GET /api/staff (Admin SDK) to avoid client query-filter failures.
      allow get:   if notSuspended() && (request.auth.uid == staffUid || isOwnerUid(resource.data.ownerId) || isAdmin());
      allow list:  if false;
      allow write: if false;
    }

    match /beds/{bedId} {
      allow get:   if canReadOwnerScope(resource.data.ownerId);
      allow list:  if canReadOwnerScope(resource.data.ownerId) && boundedList();
      allow write: if false;
    }

    match /tenants/{tenantId} {
      allow get:   if canReadOwnerScope(resource.data.ownerId);
      allow list:  if canReadOwnerScope(resource.data.ownerId) && boundedList();
      allow write: if false;
    }

    match /deposits/{txId} {
      allow get:   if canReadOwnerScope(resource.data.ownerId);
      allow list:  if canReadOwnerScope(resource.data.ownerId) && boundedList();
      allow write: if false;
    }

    match /rent_records/{recordId} {
      allow get:   if canReadOwnerScope(resource.data.ownerId);
      allow list:  if canReadOwnerScope(resource.data.ownerId) && boundedList();
      allow write: if false; // transitions happen strictly in rent.service.ts (§10.1)
    }

    match /movein_photos/{photoId} {
      allow get:   if canReadOwnerScope(resource.data.ownerId); // metadata only; image bytes come from B2 via /api (§11)
      allow list:  if canReadOwnerScope(resource.data.ownerId) && boundedList();
      allow write: if false;
    }

    match /subscription_requests/{reqId} {
      allow get:   if isOwnerUid(resource.data.ownerId) || isAdmin();
      allow list:  if (isOwnerUid(resource.data.ownerId) || isAdmin()) && boundedList();
      allow write: if false;
    }

    match /audit_logs/{logId}           { allow get, list: if isAdmin() && boundedList(); allow write: if false; }
    match /admin_notifications/{id}     { allow get, list: if isAdmin() && boundedList(); allow write: if false; }
    match /support_flags/{flagId}       { allow get, list: if isAdmin() && boundedList(); allow write: if false; }
    match /metrics/{date}               { allow get: if isAdmin(); allow list, write: if false; }

    // Strictly server-only internal collections
    match /portal_tokens/{token}        { allow read, write: if false; }
    match /portal_lockouts/{token}      { allow read, write: if false; }
    match /utr_claims/{claimId}         { allow read, write: if false; }
    match /rate_limits/{key}            { allow read, write: if false; }
    match /idempotency_keys/{key}       { allow read, write: if false; }

    match /{document=**}                { allow read, write: if false; }
  }
}
```

**Important Firestore Query Contract ("Rules Are Not Filters"):**
In Cloud Firestore, security rules validate queries rather than filtering results. Any client-side `list` query against `beds`, `tenants`, `deposits`, `rent_records`, `movein_photos`, or `subscription_requests` **must explicitly include both `.where('ownerId', '==', ownerId)` and `.limit(<= 100)`** — otherwise Firestore rejects the entire query with `Missing or insufficient permissions`. For `staff`, client `list` queries are disabled completely (`allow list: if false;`) and served strictly through `GET /api/staff`.

- **Mandatory rules tests (`tests/rules`):** signed-out read/write denied everywhere; Owner A cannot read Owner B; Staff of Owner A cannot read Owner B; `staff` client list denied; `suspended: true` claim denied; every client write denied; unbounded list (`limit > 100` or missing `limit` or missing `ownerId` filter) denied; internal collections (`portal_tokens`, `portal_lockouts`, `utr_claims`, `rate_limits`, `idempotency_keys`) denied to all clients.

### 7.2 Object Storage Access Control *(updated)*
There is no Firebase Storage and no `storage.rules`. All files live in **private Backblaze B2 buckets** (§11): zero public access, restricted per-bucket Application Keys, short-lived server-minted S3 presigned PUT/GET URLs after ownership verification, client-side WebP compression + EXIF stripping, and server-side HeadObject + magic-byte + SHA-256 verification before any database record is created.

### 7.3 API Route Security — Single Wrapper Chain
Every Route Handler under `/app/api/**` and every Server Action uses this exact wrapper order (all wrappers live in `lib/server/api/`):

```ts
export const POST = withErrorHandler(
  withAuth(
    withRateLimit(
      withValidation(createTenantSchema)(handler),
      { tier: 'standard' }
    ),
    { roles: ['owner', 'staff'] }
  )
);
```

- **`withErrorHandler`:** Assigns a `requestId`, logs structured JSON via `lib/server/monitoring/logger.ts`, returns a safe generic error body (`{ error, requestId }`) — never raw Firestore errors or stack traces.
- **`withAuth`:** Verifies session cookie (`checkRevoked = true`), checks `role` allowlist, verifies `accountStatus == 'active'` (and owning PG's status for `staff`), attaches `{ uid, role, ownerId }`.
- **`withRateLimit`:** Two-tier quota-safe limiter (§8.9).
- **`withValidation`:** Rejects payloads failing the shared `zod` schema before touching services.
- **Public routes** (`/api/portal/[token]/**`, `/api/rent/[id]/claim`, `/api/auth/session`, `/api/health`): Place `withRateLimit` **outermost** (`{ key: 'ip', tier: 'sensitive' }`) so unauthenticated floods are dropped before Firestore lookups.
- **Idempotent routes** (tenant create, rent claim, rent confirm, upload confirm, billing upgrade): Require `Idempotency-Key` header verified via `idempotency.service.ts` (§8.7).
- **Cron routes** (`/api/cron/*`): Require `Authorization: Bearer ${CRON_SECRET}` compared in constant time (`crypto.timingSafeEqual`).

### 7.4 Security Headers & Nonce CSP *(updated)*
Static headers live in `next.config.ts`; the per-request nonce CSP is built in `proxy.ts` via `lib/server/security/csp.ts`. Hosts come strictly from `env` (never hardcoded).

```ts
// next.config.ts — static headers
async headers() {
  return [
    {
      source: '/(.*)',
      headers: [
        { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
      ],
    },
    {
      source: '/portal/:path*', // token is in URL — prevent leaks, caching, and indexing
      headers: [
        { key: 'Referrer-Policy', value: 'no-referrer' },
        { key: 'Cache-Control', value: 'private, no-store' },
        { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
      ],
    },
  ];
}
```

```
// lib/server/security/csp.ts — directive set
// B2_HOST = env.B2_S3_HOST (e.g. s3.eu-central-003.backblazeb2.com or localhost:9000 in dev)
// AUTH_DOMAIN = env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
default-src 'self';
script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://apis.google.com;
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob: https://${B2_HOST};
connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://${B2_HOST};
frame-src https://${AUTH_DOMAIN} https://accounts.google.com;
frame-ancestors 'none';
base-uri 'self';
form-action 'self';
object-src 'none';
```

- Ship CSP in `Content-Security-Policy-Report-Only` first during staging/post-pilot soak; verify Google Sign-In popup/redirect, local QR generation, PDF receipts, and Backblaze B2 upload/view before switching to enforcing.
- Display B2 photos with plain `<img src={presignedUrl} referrerPolicy="no-referrer" />`, never `next/image` (short-lived presigned URLs should not pass through the image optimizer).

### 7.5 Secrets *(updated)*
- Firebase Admin SDK credentials (`FIREBASE_ADMIN_CREDENTIALS_B64`) live only in `lib/server/firebase-admin.ts` guarded by `import 'server-only'`.
- Only `NEXT_PUBLIC_*` vars may enter client bundles.
- **Backblaze B2 credentials:** Create **two separate restricted Application Keys** — one limited strictly to `B2_BUCKET` (photos), and a second limited strictly to `B2_BACKUP_BUCKET` (backups). Never use a Master Application Key in application code.
- Rotate B2 keys, `CRON_SECRET`, and `BACKUP_ENCRYPTION_KEY` on a defined schedule; never log secrets.
- The repository is **public**: enable GitHub secret scanning and push protection, run `gitleaks` in CI (§13), and treat any previously committed secret in git history as compromised.
- `.gitignore` must ignore `*-firebase-adminsdk-*.json`, `serviceAccount*.json`, `.firebase/`, and `.env*` while explicitly allowing `!.env.example`.

### 7.6 Dependencies
Enable Dependabot and `npm audit --audit-level=high` as a required CI check. Pin exact versions for security-sensitive libraries (`firebase-admin`, `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`).
Dependencies to add to `package.json`: `firebase-admin`, `zod`, `qrcode`, `@types/qrcode`, `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, `server-only`; devDependencies: `vitest`, `@playwright/test`, `@firebase/rules-unit-testing`, `firebase-tools`. (`jspdf` is already present.)

---

## 8. Scaling & Spark-Quota Protection Rules *(updated)*

1. **Stateless, Host-Agnostic Backend:** Every API route is stateless so the app scales horizontally whether deployed on a Docker VPS, Cloudflare Workers/Pages, Render/Railway, or Vercel.
2. **No Unbounded Reads, Ever:** Every list view uses cursor pagination (`startAfter`, `limit`) defaulting to `25`. Rules enforce `request.query.limit <= 100`.
3. **Real-Time Listeners Are a Budget:** Never attach `onSnapshot` to owner tenant lists, rent tables, or admin dashboards (every re-emitted document counts as a Firestore read). Use paginated `get` requests with explicit refresh after mutations. Reserve `onSnapshot` strictly for tiny single-doc subscriptions if truly needed.
4. **Avoid Hot Documents:** Never increment a global counter on every write (caps at ~1 write/sec). Platform totals are computed nightly in `metrics/{date}`. Per-owner counters (`nextReceiptSeq`) live on `owners/{ownerId}` and increment inside transactions.
5. **Denormalize & Snapshot for Reads and History:**
   - Store `ownerName` on `tenants` to avoid read-time joins.
   - **Snapshot `roomNumber` and `bedLabel` onto `rent_records` at creation time** so mid-month bed swaps never corrupt historical receipts.
6. **Atomic Transactions for Concurrency:**
   - **Bed assignment race condition:** Assigning a bed to a tenant runs inside a Firestore Transaction that asserts `bed.status === 'vacant'` atomically before updating both `beds` and `tenants`. This stops an owner and caretaker from double-booking the same bed simultaneously.
   - **Move-out settlement:** Freeing the bed, recording final deposit deductions/refund, closing active rent, and revoking portal tokens run in one atomic transaction/batch.
   - **Event notifications:** Writing an `admin_notifications` doc happens inside the same batch as the triggering event.
7. **Idempotency (Basement 4G Reality):** PG ground floors and basements have weak mobile data, causing users to double-tap "I Paid" or "Add Tenant". Every retryable mutation requires an `Idempotency-Key` header verified against `idempotency_keys/{key}` so network retries never create duplicate records or double-confirm rent.
8. **Caching:** Static marketing/legal pages use static rendering/ISR. Dashboard summary cards read lightweight pre-computed counters or short-lived server caches rather than scanning full collections. Tenant portal responses always carry `Cache-Control: private, no-store` at the browser/CDN layer because the URL carries a bearer token.
9. **Two-Tier Quota-Safe Rate Limiting & Dedicated Lockouts *(updated)*:**
   - **Avoid burning Spark's 20K writes/day on routine rate-limit writes.**
   - **Layer 1 (Edge — ₹0):** Put free Cloudflare DNS/WAF rate-limiting rules in front of your domain once live to drop IP floods before they reach your app.
   - **Layer 2 (Standard Routes — 0 DB writes):** Use a lightweight in-memory token bucket per instance for normal authenticated owner/staff reads and writes.
   - **Layer 3 (Sensitive Routes — Firestore TTL):**
     - General request throttling uses `rate_limits/{key}` (`{ tokens, windowStart, expiresAt }`) with strictly namespaced keys (`rl:session:{ipHash}`, `rl:portal:{ipHash}`, `rl:claim:{ipHash}`, `rl:upload:{uid}`).
     - Failed PIN brute-force protection uses dedicated `portal_lockouts/{tokenHash}` (`{ attempts, lockedUntil, expiresAt }`) so lockout state never collides with token-bucket counters.
10. **Quota Monitoring & Graduation Path:** Track daily Firestore reads/writes and Backblaze B2 storage/downloads on the Admin Dashboard. Spark comfortably supports a multi-PG launch; graduate Firestore to Blaze with a **50% / 80% / 100% budget alert and emergency shutdown runbook** once paying subscribers justify it.
11. **Object Storage Scaling:** Never call `ListObjects` on any request path. Address objects strictly via `objectKey` stored in Firestore. Client-side WebP compression (~100–150 KB) fits **~80,000+ photos inside Backblaze B2's 10 GB free tier**. Beyond free limits, B2 bills ~$6.95/TB (~₹0.58/GB) with 3× free egress — and if downloads ever grow massive, Cloudflare Bandwidth Alliance enables **$0 egress** in front of B2 without migrating a single file.
12. **Load Testing (Post-Pilot Scale Gate):** Run k6 or Artillery against staging before broad commercial scaling to confirm p95 latency and zero race-condition errors on concurrent bed assignment and rent claim flows.

---

## 9. Admin Panel & Flat-Fee SaaS Controls *(updated)*

### 9.1 Access Control
`/app/(admin)/**` is gated by `proxy.ts` (optimistic) and every `/api/admin/**` route requires `{ roles: ['admin'] }` inside `withAuth`.

### 9.2 Dashboard (Reads Nightly `metrics/{date}` Only)
- Active owners, active staff/wardens, and active residents counts
- Paid subscribers by tier (`free` / `growth` / `pro`) and pending `subscription_requests` count
- Total rent collected vs. outstanding this period (sum of `amountPaidPaise` vs `amountDuePaise`, displayed in ₹)
- Stale rent claims (`status == 'verify'`) unconfirmed for > N days
- Open `support_flags` and unread `admin_notifications` by severity
- 24-hour API error rate
- Free-tier quota meter: Firestore reads/writes trend and Backblaze B2 storage/egress usage

### 9.3 Owner, Staff, Resident & Plan Limit Controls
- **Allow / Stop Toggles:** Suspend or reactivate any Owner, Staff member, or Resident via `/api/admin/accounts`. Sets `accountStatus`, updates `suspended` custom claim, revokes refresh tokens, and (for tenants) revokes portal tokens.
- **Flat-Fee SaaS Plan Tiers (Monetization Model — Decision D5):**
  PG owners keep **100% of tenant rent (0% gateway fee)** and pay PG-Pass a simple flat monthly/yearly subscription:

  | Plan Tier | Suggested Price | `maxBeds` | `maxPhotos` | `maxStaff` | Key Capabilities |
  | --- | --- | --- | --- | --- | --- |
  | **`free`** | **₹0 forever** | 20 | 40 | 0 | 1 PG, Tenant Pass QR, 0% UPI rent tracking, PDF receipts |
  | **`growth`** | **₹399/mo** *(₹3,999/yr)* | 100 | 500 | 1 | Move-in/out photo archive, electricity line items, 1 Warden account, CSV export |
  | **`pro`** | **₹899/mo** *(₹8,999/yr)* | 500 | 2,500 | 5 | Multi-PG / large buildings, multiple wardens, deposit & expense ledgers, priority WhatsApp support |

- **Zero-Gateway SaaS Upgrade Flow (Launch):** Owners view PG-Pass's own UPI QR inside `/billing`, pay their plan fee directly, and submit the UTR via `POST /api/billing/upgrade`. Super Admin verifies the UTR in `/admin/subscriptions` and clicks **Approve** — server atomically updates `owners/{ownerId}` (`plan`, `subscriptionExpiresAt`, `maxBeds`, `maxTenants`, `maxPhotos`, `maxStaff`) and writes an `audit_logs` entry. Because client writes are denied (§7.1), owners can never self-upgrade or bypass bed/photo limits. *(Once past 30–50 paying PGs, optional UPI AutoPay can be added strictly for PG-Pass subscription renewals.)*

### 9.4 Event-Driven Admin Notifications (No Cloud Functions Required)
Whenever an important event occurs, the service function calls `notifications.service.notify()` inside the **same Firestore batch/transaction**:
- New owner signup (`pending_review` if manual vetting enabled)
- New owner `subscription_requests` UTR submitted
- New `support_flags` entry created (abuse, photo, or dispute report)
- Repeated PIN/login lockout spikes
- Nightly metrics job detecting stale `verify` claims or approaching Spark/B2 free-tier limits

### 9.5 In-App Inbox & Mandatory Audit Trail
- Admin UI lists `admin_notifications` and `support_flags` with filter, acknowledge, and resolve actions.
- **Every** admin action — account suspension, plan upgrade, claim grant, or viewing a tenant photo (§11.5) — automatically writes an immutable `audit_logs` record on the server.

---

## 10. Rent Collection, Deposits & 0%-Fee Direct UPI *(updated)*

PG-Pass **never charges a 2% payment gateway fee on tenant rent**. Rent settles directly into the PG owner's bank account via UPI while PG-Pass automates tracking, anti-fraud checks, receipts, and reminders.

### 10.1 Rent Record Lifecycle (`pending → verify → paid`)

```
          owner/cron creates record (with lineItems & room/bed snapshot)
                              │
                              ▼
                         [ pending ] ◄────────── owner/staff rejects claim (reason logged; UTR lock released)
                              │  tenant pays via UPI & submits 12-digit UTR (portal token + PIN)
                              ▼
                         [ verify ]
                              │  owner/staff confirms receipt
                              ▼
                          [ paid ]  ──► increments owners.nextReceiptSeq → jspdf receipt + WhatsApp share
                              │
                              ▼  (rare correction only)
                      [ reversed/pending ]  (owner-only audited reversal with mandatory reason)
```

Rules:
- Allowed state transitions live in `lib/constants/status.ts` and are enforced strictly inside `lib/server/services/rent.service.ts`.
- **Direct UPI Payment UX (India 2026 Compliant):** Because NPCI sunset manual P2P UPI Collect requests and unsigned `upi://pay` browser deep links often hit GPay/PhonePe risk blocks above ₹2,000, the Tenant Portal payment card displays:
  1. Exact itemized due breakdown (`Base Rent` + `Electricity/Extras` = `amountDuePaise`).
  2. A **client-side QR code** (`qrcode` package) generated from the owner's UPI ID / Business Merchant QR (PhonePe Business / Paytm Business / GPay Business QRs carry **0% MDR** and zero gallery-scan caps).
  3. **1-tap "Copy UPI ID"** and **"Copy Exact Amount"** buttons for guaranteed payment across GPay, PhonePe, Paytm, and BHIM.
- **Claim (`pending → verify`):** `POST /api/rent/[id]/claim` (portal token + verified PIN, rate-limited outermost, idempotent). Accepts `paymentReference` (validated 12-digit UTR/reference string) and optional `proofPhotoId` (compressed screenshot uploaded to B2 under `payment_proof/`).
- **UTR Reuse Anti-Fraud:** Inside the exact same Firestore Transaction as `claim`, the server creates `utr_claims/{ownerId}_{sha256(normalizedUtr)}`. If that document already exists, the transaction fails and rejects the duplicate UTR immediately — stopping tenants from pasting last month's UTR number. If an owner rejects a mistyped claim, the transaction deletes the rejected `utr_claims` doc so the tenant can correct it.
- **Confirm (`verify → paid`):** `POST /api/rent/[id]/confirm` (owner or authorized staff). Server sets `amountPaidPaise = amountDuePaise`, assigns `receiptNumber` by atomically incrementing `owners/{ownerId}.nextReceiptSeq` (initialized to `0` at owner creation), and records `confirmedAt` & `confirmedBy`. Client never sends the paid amount.
- **Audited Reversal:** If an owner accidentally marks the wrong tenant `paid`, `POST /api/rent/[id]/reverse` (owner-only, never staff) logs a mandatory `reversalReason` + `audit_logs` entry and reopens the record cleanly so accounting stays reconciled.
- **Overdue Status:** Always **derived** (`status == 'pending' && dueDate < today`), never stored as a separate mutable enum.
- **Auto-Monthly Rent Generation:** Nightly cron (`/api/cron/metrics` or dedicated route) generates next-period `pending` records for all active tenants using deterministic doc IDs (`${tenantId}_${period}`) so reruns are 100% idempotent.

### 10.2 Real-World Billing: Proration, Electricity Line Items & Deposits
- **Money Format:** Integer paise (`*Paise`) everywhere; formatted to `₹` only in UI via one shared formatter. Currency is constant `INR`.
- **Proration & Variable Add-Ons:** Mid-month move-ins calculate prorated first-month rent (`prorated: true`). Owners can add monthly variable items (`lineItems: [{ label: 'Base Rent', amountPaise: 800000 }, { label: 'Electricity (38 units)', amountPaise: 34200 }]`); server computes and stores `amountDuePaise = sum(lineItems)`.
- **Security Deposits Ledger (`deposits`):** Track refundable security deposits separately from monthly rent. Supports split deposit installments at move-in, itemized damage/notice deductions at move-out, and final refund recording.

### 10.3 Zero-Cost Automation (Receipts, "Send & Next" WhatsApp Queue & Phase 2 CSV Matching)
- **PDF Receipts:** Generated client-side via `jspdf` exclusively from `status == 'paid'` records using the server-assigned `receiptNumber` and snapshotted `roomNumber`/`bedLabel`.
- **1-Tap WhatsApp Sharing & "Remind Pending Queue" (`Send & Next`) *(updated)*:**
  - Owner dashboard generates pre-filled click-to-WhatsApp deep links (`https://wa.me/91<phone>?text=...`) for sharing new Portal Pass links, payment confirmations, and overdue rent reminders.
  - Because mobile browsers block launching 60 `wa.me` tabs simultaneously, `/rent` includes a **"Remind Pending Queue"** modal for unpaid tenants: each tap on **"Send & Next"** opens `wa.me` for the current tenant, calls `POST /api/rent/[id]/reminded` to stamp `lastRemindedAt` on the rent record (preventing accidental double-messaging), and immediately advances the queue button to the next unpaid tenant.
- **Phase 2 Bulk Reconciliation (Still ₹0, No Bank APIs):** Owners of 50+ bed PGs can drop their monthly bank/UPI CSV export into the browser; a local client-side parser matches UTR numbers against `verify` records and lets the owner bulk-approve verified tenants in one click.

---

## 11. File Storage — Backblaze B2 *(updated; permanent card-free storage)*

**Why Backblaze B2 (and never migrate again):**
- **₹0 & zero credit card to start:** 10 GB free storage forever + free daily API caps + free downloads up to 3× stored data.
- **No pricing cliff:** Beyond 10 GB (~80,000+ compressed photos), storage costs ~$6.95/TB (~₹0.58/GB) pay-as-you-go — avoiding Cloudinary's $89/mo jump and ImageKit's bandwidth overages.
- **Standard S3 API:** Uses `@aws-sdk/client-s3` directly, meaning zero vendor lock-in and seamless offline development with local **MinIO**.
- **Single account for both photos and encrypted DB backups.**

### 11.1 Buckets & Key Layout

| Bucket (name from env) | Purpose | Region | Public Access |
| --- | --- | --- | --- |
| `B2_BUCKET` | Tenant move-in/move-out photos & optional UPI proof screenshots | **EU Central (`eu-central-003`)** | **None (Private)** |
| `B2_BACKUP_BUCKET` | AES-256-GCM encrypted nightly Firestore backups (§12.3) | **EU Central (`eu-central-003`)** | **None (Private)** |

*(EU Central — Amsterdam gives ~130–150 ms latency from India; a ~120 KB WebP photo loads in < 0.5 s.)*

- **Server-generated key layout** (prefixes in `lib/constants/storage.ts`; user filenames are **never** used; `{ext}` derived from validated MIME type):
  - `pending/{ownerId}/{tenantId}/{uuid}.{ext}` — uploaded, unverified
  - `movein/{ownerId}/{tenantId}/{uuid}.{ext}` — verified move-in evidence
  - `moveout/{ownerId}/{tenantId}/{uuid}.{ext}` — verified move-out evidence
  - `payment_proof/{ownerId}/{tenantId}/{uuid}.{ext}` — verified optional UPI screenshot

### 11.2 Server Client (`lib/server/storage/b2.ts`, server-only)

```ts
import 'server-only';
import { S3Client } from '@aws-sdk/client-s3';
import { env } from '@/lib/env';

export const b2 = new S3Client({
  region: env.B2_REGION,                               // e.g. 'eu-central-003' (or 'us-east-1' for local MinIO)
  endpoint: env.B2_ENDPOINT,                           // e.g. 'https://s3.eu-central-003.backblazeb2.com' (or 'http://localhost:9000')
  forcePathStyle: env.STORAGE_FORCE_PATH_STYLE,        // false for Backblaze B2, true for local MinIO
  credentials: {
    accessKeyId: env.B2_KEY_ID,
    secretAccessKey: env.B2_APP_KEY,
  },
  requestChecksumCalculation: 'WHEN_REQUIRED',         // prevents SDK from adding extra checksum query params to presigned PUTs
  responseChecksumValidation: 'WHEN_REQUIRED',
});
```

All presign, `HeadObject`, `GetObject`, `CopyObject`, SHA-256 hashing, and `DeleteObject` helpers live exclusively in `lib/server/storage/b2.ts` (exposed via `lib/server/storage/provider.ts`) and are called only by `photos.service.ts` and the backup cron.

### 11.3 Bucket Configuration (Do Once Per Bucket, Track in `infra/`)
- **CORS (`infra/b2-cors.json`):** Apply S3-compatible CORS rules allowing **only** `env.APP_ALLOWED_ORIGINS`, methods `PUT` and `GET`, headers `Content-Type`, expose `ETag`, `MaxAgeSeconds: 3600`.
- **Lifecycle Rules (`infra/b2-lifecycle.md`):**
  - On `B2_BUCKET`: auto-delete objects under `pending/` after 1 day (`daysFromUploadingToHiding: 1`, `daysFromHidingToDeleting: 1`); keep only 1 version (clean hidden versions so deleted photos stop consuming free quota).
  - On `B2_BACKUP_BUCKET`: expire backup files after `BACKUP_RETENTION_DAYS` (default 30 days).
- **Scoped Application Keys:** One key restricted strictly to `B2_BUCKET` (read/write/delete); a second key restricted strictly to `B2_BACKUP_BUCKET`.
- **Caps & Alerts:** Configure Backblaze B2 daily caps and usage alerts well inside the 10 GB free tier (and raise caps intentionally only after adding billing post-revenue).

### 11.4 Upload Flow (Tamper-Evident & Quota-Safe)
1. **Browser Compression & EXIF Stripping (`lib/client/imageCompress.ts`):** Before requesting upload intent, the browser re-encodes the photo on a `<canvas>` to WebP (fallback JPEG), downscaling to target **~100–150 KB** (`PHOTO_TARGET_BYTES = 150_000`). Re-encoding automatically strips private EXIF metadata (including GPS coordinates). Hard server cap: `PHOTO_MAX_BYTES = 5 MB`.
2. **`POST /api/uploads/intent`** `{ tenantId, photoType, contentType, sizeBytes }`:
   - Auth: `owner` or `staff` (for `move_in` / `move_out`), or verified Portal Token + PIN (for `payment_proof`).
   - Service verifies: tenant belongs to `ownerId` and is active, `contentType` in `['image/webp', 'image/jpeg']`, `sizeBytes <= PHOTO_MAX_BYTES`, owner is under `maxPhotos`.
   - Returns presigned **PUT** URL for `pending/{ownerId}/{tenantId}/{uuid}.{ext}` valid `UPLOAD_URL_TTL_SECONDS` (300 s), with `ContentType` locked in the signature.
3. **Browser PUTs** compressed image bytes directly to Backblaze B2 (or local MinIO in dev).
4. **`POST /api/uploads/confirm`** `{ objectKey, photoType, rentRecordId? }` (idempotent):
   - Verifies `objectKey` begins with `pending/{ownerId}/{tenantId}/` and caller owns that scope.
   - `HeadObject`: verifies `ContentLength <= PHOTO_MAX_BYTES` and allowed `ContentType`.
   - Streams the object (small ~120 KB WebP) to verify **magic bytes** (WebP `RIFF....WEBP` or JPEG `FF D8 FF`) AND compute its **SHA-256 checksum** (`sha256` tamper-evident proof for deposit disputes).
   - `CopyObject` from `pending/...` to final prefix (`movein/...`, `moveout/...`, or `payment_proof/...`), writes `movein_photos` metadata doc in Firestore, and deletes the `pending/` object.
   - If any check fails: deletes the `pending/` object and returns generic `422`.

### 11.5 Viewing & Sharing Photos
- `GET /api/photos/[photoId]/url` — `withAuth` (owning active `owner`, scoped `staff`, or `admin`).
- Service loads `movein_photos/{photoId}` from Firestore (never trusts an `objectKey` from the client) and mints a short-lived presigned **GET** URL valid `PHOTO_URL_TTL_SECONDS` (300 s) with `Cache-Control: private, no-store`.
- Every **admin** view writes an `audit_logs` record (`actorUid`, `photoId`, `reason`).
- Never create permanent public links; never log presigned URLs.

### 11.6 Deletion & Orphans
- Deleting a photo removes the Firestore doc first, then deletes the B2 object. If B2 delete fails, the key is queued for `/api/cron/cleanup` so orphans never leak storage quota.
- Unconfirmed `pending/` uploads are automatically purged after 1 day by the B2 lifecycle rule.
- Tenant move-out + retention expiry deletes all associated B2 objects (§15).

### 11.7 What Not to Do
- Never make `B2_BUCKET` public. Never use the Master Application Key. Never accept a raw `objectKey` from the browser for reads. Never proxy photos through `next/image`. Never hardcode B2 endpoints in code (always read from `env`).

### 11.8 Migration from Legacy Cloudinary *(updated)*
`next.config.ts` currently allowlists `res.cloudinary.com` (§18, finding `F-9`). Migration steps:
1. Implement §11 (Backblaze B2) and route all **new** uploads to B2.
2. Run `scripts/migrateCloudinaryToB2.ts` (staging first, then prod): for each `movein_photos` doc containing a Cloudinary URL, download bytes, verify magic bytes & compute `sha256`, upload to `movein/...` on B2, update doc with `storageProvider: 'b2'`, `objectKey`, `sha256`, and remove the legacy URL field.
3. Verify in staging/prod, delete old assets from Cloudinary, and permanently remove `res.cloudinary.com` from `next.config.ts`, CSP, and §14.

---

## 12. Observability, Scheduled Jobs, Backups & Recovery *(updated)*

### 12.1 Logging & Monitoring
- `lib/server/monitoring/logger.ts` emits structured JSON (`level`, `requestId`, `route`, `uid`, `role`, `durationMs`) to stdout.
- **Redaction rule — never log:** full phone numbers (mask all except last 2 digits), portal tokens, PINs, session cookies, presigned URLs, auth request bodies, or secrets.
- `GET /api/health` returns shallow `200` (zero DB reads) for free uptime monitors (e.g., UptimeRobot). `GET /api/health?deep=1` requires `CRON_SECRET` and verifies Firestore + Backblaze B2 connectivity.

### 12.2 Scheduled Jobs (₹0, No Cloud Functions)

| Job | Route | Schedule | Responsibility |
| --- | --- | --- | --- |
| **metrics & rent-gen** | `/api/cron/metrics` | Nightly (00:30 IST) | Writes `metrics/{date}`; generates next-period `pending` rent records (idempotent by `${tenantId}_${period}`); flags stale `verify` claims; checks Spark/B2 quota thresholds |
| **backup** | `/api/cron/backup` | Nightly (02:00 IST) | Paginated AES-256-GCM encrypted NDJSON export to `B2_BACKUP_BUCKET` (§12.3) |
| **cleanup** | `/api/cron/cleanup` | Nightly (03:00 IST) | Deletes failed-delete B2 keys, purges soft-deleted tenants/photos past retention (§15), clears expired token leftovers |

- **Scheduler:** `.github/workflows/cron.yml` (`on: schedule`) invokes each route with `Authorization: Bearer ${CRON_SECRET}`. Completely free and host-independent. (If deployed on a VPS later, host crontab or Coolify scheduled tasks can call the exact same endpoints.)
- Every cron job is **idempotent**, logs a one-line summary, writes an `admin_notifications` alert on failure, and paginates with cursors to stay inside request time limits.

### 12.3 Encrypted Backups (Backblaze B2 — Post-Pilot Hardening)
- `/api/cron/backup` pages through every collection via the service layer, compresses as gzipped NDJSON (`zlib`), encrypts with **AES-256-GCM** using `BACKUP_ENCRYPTION_KEY`, and uploads `backups/{YYYY-MM-DD}/{collection}.ndjson.gz.enc` to `B2_BACKUP_BUCKET` using the backup-only B2 key.
- Monitor backup read counts against Spark's 50K reads/day quota as data grows; switch to incremental/updated-since backups or managed Firestore backups once on Blaze.
- Retention: `BACKUP_RETENTION_DAYS = 30` enforced by B2 lifecycle rule. Store `BACKUP_ENCRYPTION_KEY` offline and separately from B2 keys.
- Recovery targets: **RPO 24 hours, RTO 4 hours.**
- Maintain `scripts/restoreFromBackup.ts` and execute a **quarterly restore drill into staging** once post-pilot scale is reached, logging the verification date here.

### 12.4 Incident Response (`docs/runbook.md`)
Contain (disable compromised keys/routes, suspend affected accounts, flip Firestore rules to deny-all if active breach suspected) → rotate all secrets (§7.5) → revoke sessions (`revokeRefreshTokens`) and portal tokens → preserve structured logs → assess personal data impact → notify per §15 → write post-mortem and update this spec.

---

## 13. CI/CD, Local Zero-Cost Dev & Testing *(updated)*

### 13.1 Environments & 100% Free Local Development
Four environments: **`local`**, `dev`, `staging`, `prod`. Staging and prod use separate Firebase projects and separate Backblaze B2 buckets (zero production data in staging/dev).

**Local Offline Dev Stack (₹0, zero cloud reads, zero card):**
- **Auth & Firestore:** `firebase emulators:start` configured via `firebase.json` (Auth + Firestore emulators).
- **Object Storage:** `docker-compose.yml` runs a local **MinIO** container on `http://localhost:9000` with `STORAGE_FORCE_PATH_STYLE=true`, speaking the exact same `@aws-sdk/client-s3` protocol as Backblaze B2.
- Every feature — login, RBAC, atomic bed booking, UTR anti-fraud, presigned photo upload/SHA-256 verification, receipts, and security rules — is built and tested locally before touching any cloud quota or choosing a host (D2).

### 13.2 Required `package.json` Scripts
Add: `typecheck` (`tsc --noEmit`), `test` (`vitest run`), `test:rules` (emulator-backed Firestore rules tests), `test:e2e` (Playwright), `audit` (`npm audit --audit-level=high`), `emulators` (`firebase emulators:start`).

### 13.3 Required CI Checks on Every PR (`.github/workflows/ci.yml`)
1. `npm ci` (committed lockfile in sync)
2. `npm run lint` and `npm run typecheck`
3. Unit & service tests (`vitest`)
4. Firestore **rules tests** against the Firebase Emulator
5. `npm run build` (`next build`)
6. `npm audit --audit-level=high`
7. Secret scan (`gitleaks`)
8. E2E smoke tests (`Playwright`) on staging/preview *(Post-Pilot Gate)*

### 13.4 Repository Protection & Deployment
- Protect `master`: require PR + CI checks green, disallow force-push and direct commits.
- Enable GitHub secret scanning, push protection, and weekly Dependabot (`.github/dependabot.yml`); pin third-party GitHub Actions to commit SHAs.
- Deploy Firestore rules and indexes via CI (`firebase deploy --only firestore:rules,firestore:indexes`) using a narrowly scoped GitHub secret — never manually from a laptop to production.

### 13.5 Minimum Test Inventory
- **Rules tests (Pilot Gate):** Signed-out denied everywhere; Owner A blocked from Owner B; Staff of Owner A scoped strictly to Owner A and denied writes; `staff` client list denied; `suspended: true` claim denied; all direct client writes denied; unbounded list queries or missing `ownerId` filter denied; internal collections (`portal_tokens`, `portal_lockouts`, `utr_claims`, `rate_limits`, `idempotency_keys`) denied; no hardcoded admin shortcut works.
- **Service & unit tests (Pilot Gate):** `ownerId`/`tenantId` immutability; `nextReceiptSeq` initializes to `0` and increments atomically; atomic bed assignment rejects concurrent double-booking; rent transitions follow §10.1 strictly; duplicate UTR claim in `utr_claims` is rejected; `lineItems` sum matches `amountDuePaise`; bed swap leaves old `rent_records` room/bed snapshots untouched; plan limits (`maxBeds`, `maxTenants`, `maxPhotos`, `maxStaff`) enforced; staff cannot delete tenants or edit base rent; 7-day soft-delete undo works; idempotency replay is a no-op; portal token expiry, revocation, and `portal_lockouts` 5-attempt PIN lockout work; `lastRemindedAt` updates cleanly.
- **Upload tests (mocked S3 / MinIO):** Rejects wrong MIME type, oversize file, cross-owner `objectKey`, spoofed magic bytes, and replayed confirm; computes and persists `sha256`.
- **E2E flow (Post-Pilot Gate):** Owner signs in (emulator) → sets UPI ID → adds bed & tenant (with deposit) → uploads compressed move-in photo (MinIO) → tenant opens `/portal/[token]` → unlocks with last-4 PIN → submits UTR → duplicate UTR rejected → owner approves (`verify → paid`) & generates numbered PDF receipt → uses `Send & Next` reminder queue → admin approves plan upgrade / suspends owner and access terminates immediately.

---

## 14. Third-Party Dependency Allowlist *(updated)*

No vendor, hosted API, or CDN may be added without updating this table first (data shared, free limits, exit plan).

| Vendor / Package | Used For | Data It Receives | Plan / Limits | Status |
| --- | --- | --- | --- | --- |
| **Firebase Auth** (Google + Email/Password) | Owner, Staff, Admin login | Email, Google profile ID | 50,000 MAUs free on Spark (no card) | **Approved** |
| **Cloud Firestore** | Primary database | Application records | Spark free: 1 GiB, 50K reads/day, 20K writes/day (no card) | **Approved** |
| **Backblaze B2** | Private move-in/out/proof photos & encrypted DB backups | Private compressed WebP photos & AES-256-GCM backups | **10 GB free forever (no card)**, 3× free egress, ~$6.95/TB after | **Approved (Permanent)** |
| **MinIO** (Docker) | Local S3-compatible dev storage | Local dummy data only | 100% free open-source | **Approved (Dev only)** |
| **GitHub** (Actions, Dependabot, Secret Scanning) | CI/CD & nightly cron triggers | Source code | Free for public repos | **Approved** |
| **Cloudflare DNS / WAF** | Optional free edge rate-limiting & DDoS shield | Traffic metadata | Free plan | **Optional (Recommended at launch)** |
| **App Host (Decision D2)** | Hosting Next.js app | HTTP requests | Commercial-safe host chosen post-dev (VPS/Docker, Cloudflare OpenNext, Render/Railway, or Vercel Pro) | **Deferred until build complete** |
| **`qrcode` (npm)** | Client-side Pass QR & UPI QR | Nothing leaves device | Open-source | **Approved** |
| **`jspdf` (npm)** | Client-side numbered rent receipts | Nothing leaves device | Open-source (already installed) | **Approved** |
| **Google Fonts via `next/font`** | Typography | None at runtime (self-hosted at build) | Free | **Approved** |
| ~~Firebase Storage~~ | Legacy spec storage | — | Requires Blaze card | **Rejected / Removed** |
| ~~Firebase Phone Auth (SMS)~~ | Legacy OTP login | — | Requires Blaze card + ~₹6/SMS India | **Rejected / Removed** |
| ~~2% Rent Payment Gateways~~ | Legacy Phase 2 rent | — | 2% + GST loss to PG owners | **Rejected for tenant rent** |
| ~~Cloudinary (`res.cloudinary.com`)~~ | Legacy image host in repo | Photos | $89/mo cliff | **Remove after §11.8 migration** |
| ~~`api.qrserver.com`~~ | Legacy QR API in repo | **Portal bearer token URL** | Security leak | **Banned — remove immediately** |

---

## 15. Privacy, Compliance & Data Retention *(updated)*

PG-Pass processes personal data of tenants (name, phone, ID-proof type, move-in dates, deposit/rent history, move-in/out photos) and owners/staff (name, email, phone, PG address, UPI ID). This section is an engineering checklist, **not legal advice** — India's Digital Personal Data Protection (DPDP) Act, 2023 and its Rules apply; review data-fiduciary vs. data-processor roles with legal counsel before broad commercial scaling.

1. **Data Inventory (`docs/data-inventory.md`):** List every personal-data field, storage location (Firestore / Backblaze B2 / backups / logs), purpose, viewer roles, and retention duration. Update in the same PR as any schema change.
2. **Strict Minimization (No ID Scans):** Store only `idProofType` (e.g., "Aadhaar verified offline", "PAN", "Passport"). **Never store Aadhaar numbers, PAN numbers, or photos of government ID cards.**
3. **Notice & Consent:** Publish `/privacy` and `/terms` as public routes. Display a concise notice during tenant onboarding and on `/portal/[token]` explaining what is collected, why, who accesses it, retention timelines, cross-border storage disclosure (see #8), erasure contact, and grievance officer details.
4. **Retention Schedule** (constants in `lib/constants/limits.ts`):
   - **Soft-delete undo buffer:** `SOFT_DELETE_UNDO_DAYS = 7` (owner-reversible accidental delete window).
   - **Tenant profile, deposits & rent records:** retained `RETENTION_TENANT_DAYS` after move-out (accounting/tax needs), then purged or anonymized.
   - **Move-in / move-out / payment-proof photos:** deleted `PHOTO_RETENTION_DAYS` after move-out (long enough to resolve deposit disputes), deleting both Firestore metadata and Backblaze B2 objects.
   - **Portal tokens:** expire at `PORTAL_TOKEN_TTL_DAYS` (90 days), kept `PORTAL_TOKEN_RETENTION_DAYS` for audit, then TTL-deleted.
   - **Encrypted backups:** auto-expired after `BACKUP_RETENTION_DAYS = 30` via B2 lifecycle rule (disclose in privacy notice that erased data ages out of encrypted backups within 30 days).
   - **Logs:** zero personal data (§12.1), short retention.
5. **Individual Rights (Access, Correction, Erasure):** Documented in `docs/runbook.md` — export tenant JSON or delete Firestore records + B2 objects, write a PII-free `audit_logs` entry, fulfill within target SLA.
6. **Breach Handling:** Incident runbook (§12.4) defines breach assessment, authority/user notification triggers, and grievance contact.
7. **Photo Privacy & Integrity:** Client `<canvas>` strips EXIF/GPS before upload (§11.4); `sha256` hash ensures tamper-evident dispute records; zero public URLs ever exist.
8. **Data Location:**
   - Create Cloud Firestore in **Mumbai (`asia-south1`)** — permanent once chosen.
   - Backblaze B2 buckets live in **EU Central (`eu-central-003`)** (storing non-ID move-in/out photos and AES-256-GCM encrypted backups). Disclose this region clearly in `/privacy` and verify permitted cross-border transfer rules under the DPDP Rules before launch.
9. **Third Parties:** Every vendor receiving personal data is disclosed in §14.

---

## 16. Environment Variables & Constants Reference *(updated)*

Validated at startup by `lib/env.ts` (`zod`); the app fails fast if any required variable is missing or invalid. `.env.example` mirrors this table and is committed to git.

| Variable | Scope | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID` | Public | Firebase web SDK config (no storage bucket var — Firebase Storage unused) |
| `NEXT_PUBLIC_APP_URL` | Public | Canonical base URL for Portal links & QR codes |
| `NEXT_PUBLIC_USE_EMULATORS` | Public (dev only) | Connects client SDK to local Firebase Emulators (`true` in local dev, `false` in prod) |
| `NEXT_PUBLIC_SAAS_UPI_ID`, `NEXT_PUBLIC_SAAS_UPI_NAME` | Public | PG-Pass's own UPI ID/Name displayed on `/billing` for flat SaaS upgrades |
| `APP_ALLOWED_ORIGINS` | Server | Comma-separated allowed origins for state-changing requests and B2 CORS |
| `FIREBASE_ADMIN_CREDENTIALS_B64` | Server | Base64 service-account JSON for Firebase Admin SDK (omitted when using local emulators) |
| `B2_ENDPOINT`, `B2_REGION`, `B2_S3_HOST` | Server | Backblaze B2 S3 endpoint (e.g. `https://s3.eu-central-003.backblazeb2.com`) or `http://localhost:9000` for local MinIO; `B2_S3_HOST` feeds CSP |
| `STORAGE_FORCE_PATH_STYLE` | Server | `false` for Backblaze B2; `true` for local MinIO |
| `B2_BUCKET`, `B2_KEY_ID`, `B2_APP_KEY` | Server | Private photos bucket and its bucket-restricted Application Key |
| `B2_BACKUP_BUCKET`, `B2_BACKUP_KEY_ID`, `B2_BACKUP_APP_KEY` | Server | Private backup bucket and its separate bucket-restricted Application Key |
| `BACKUP_ENCRYPTION_KEY` | Server | 32-byte hex/base64 AES-256-GCM key for nightly encrypted backups |
| `CRON_SECRET` | Server | High-entropy bearer secret authorizing `/api/cron/*` |
| `LOG_LEVEL` | Server | Logger verbosity (`info`, `warn`, `error`, `debug`) |

**Centralized Constants (`lib/constants/limits.ts` & `storage.ts`):**
- Pagination: `PAGE_SIZE_DEFAULT = 25`, `MAX_LIST_LIMIT = 100`
- Plan tiers: `FREE_MAX_BEDS = 20`, `FREE_MAX_PHOTOS = 40`, `FREE_MAX_STAFF = 0`; `GROWTH_MAX_BEDS = 100`, `GROWTH_MAX_PHOTOS = 500`, `GROWTH_MAX_STAFF = 1`; `PRO_MAX_BEDS = 500`, `PRO_MAX_PHOTOS = 2500`, `PRO_MAX_STAFF = 5`
- Media: `PHOTO_TARGET_BYTES = 150_000` (~150 KB browser WebP target), `PHOTO_MAX_BYTES = 5_242_880` (5 MB hard cap), `PHOTO_ALLOWED_TYPES = ['image/webp', 'image/jpeg']`, `UPLOAD_URL_TTL_SECONDS = 300`, `PHOTO_URL_TTL_SECONDS = 300`
- Portal & Sessions: `PORTAL_TOKEN_TTL_DAYS = 90`, `PORTAL_TOKEN_RETENTION_DAYS = 30`, `PORTAL_PIN_MAX_ATTEMPTS = 5`, `PORTAL_PIN_LOCKOUT_MINUTES = 15`, `SESSION_MAX_AGE_DAYS = 7`
- Retention & Undo: `SOFT_DELETE_UNDO_DAYS = 7`, `BACKUP_RETENTION_DAYS = 30`, `RETENTION_TENANT_DAYS = 365`, `PHOTO_RETENTION_DAYS = 90`
- B2 Prefixes: `pending/`, `movein/`, `moveout/`, `payment_proof/`

---

## 17. Launch Checklist — Pilot Gate vs. Full Scale Gate *(updated)*

To prevent over-engineering before validating with real PG owners, launch requirements are split into two strict gates: **Pilot Gate** (non-negotiable before onboarding PG #1–#5) and **Post-Pilot Scale Gate** (complete once 3–5 PGs are actively using PG-Pass daily).

### 17.1 Pilot Launch Gate (Non-Negotiable Before Any Real Tenant Data)

**Security (Zero Shortcuts)**
- [ ] Deployed `firestore.rules` is the §7.1 target version (or §18.4 interim) and all emulator rules tests pass
- [ ] Zero hardcoded phone numbers/emails grant admin anywhere; first admin created via `scripts/bootstrapAdmin.ts`
- [ ] Portal works strictly via `/api/portal/[token]/unlock` (hashed token + last-4 PIN + `portal_lockouts`); zero public Firestore reads remain
- [ ] Session cookies (`httpOnly`, `Secure`, `SameSite=Lax`) active; `withAuth` enforces revocation, role, and `accountStatus`; suspended user locked out across all 3 layers
- [ ] Google Sign-In + Email/Password enabled on Spark; Phone SMS OTP & Email-Link disabled
- [ ] Static security headers active; `/portal/*` sends `no-referrer` + `no-store` + `noindex`
- [ ] Backblaze B2 `B2_BUCKET` private, restricted Application Key created, CORS locked to app origins, lifecycle rule purging `pending/` after 1 day
- [ ] `api.qrserver.com` and `res.cloudinary.com` completely removed from code and `next.config.ts`
- [ ] GitHub secret scanning + push protection enabled; any previously exposed secrets rotated

**Core Real-World Product & Data**
- [ ] Firestore created in Mumbai (`asia-south1`); Backblaze B2 in EU Central (`eu-central-003`)
- [ ] All monetary amounts stored as integer paise (`*Paise`) and `owners.nextReceiptSeq` initialized to `0`
- [ ] 0%-fee direct UPI flow working end-to-end (Owner UPI setup → Tenant QR/Copy → `utr_claims` dedup → 1-click approve → numbered `jspdf` receipt → `Send & Next` WhatsApp queue stamping `lastRemindedAt`)
- [ ] Atomic bed-booking transaction, proration/`lineItems`, `deposits` ledger, bed-swap snapshots, and 7-day soft-delete undo working
- [ ] `/privacy` and `/terms` live with onboarding & portal notices; `npm audit --audit-level=high` clean

### 17.2 Post-Pilot Scale Gate (Complete After First 3–5 Active PGs)
- [ ] Hosting decision D2 finalized on a commercial-safe platform and documented in §0.1
- [ ] Warden (`staff`) invite & scoped RBAC flow enabled (or built earlier if pilot PG #1 has a dedicated caretaker)
- [ ] Nonce CSP switched from `Report-Only` soak to enforcing
- [ ] Nightly GitHub Actions `cron.yml` (`metrics` + auto-monthly rent generation, AES-256-GCM encrypted B2 `backup`, retention `cleanup`) running + first staging restore drill completed
- [ ] Full CI pipeline (`gitleaks`, `vitest`, emulator rules tests, Playwright E2E smoke) required on `master`
- [ ] Free Cloudflare WAF edge rate-limiting + `/api/health` uptime monitor + `docs/runbook.md` + `docs/data-inventory.md` + legal review of §15
- [ ] Load test (k6/Artillery) passed on staging; Phase 2 client-side Bank/UPI CSV UTR matcher shipped

---

## 18. Repository Audit & Remediation Backlog *(updated)*

### 18.1 Scope & Limits of Audit
Checked on 23 Nov 2026 against `github.com/Gangadhar-gdvs/PG-Pass` (public, branch `master`, 3 commits at audit time): root file listing, `firestore.rules`, `package.json`, `next.config.ts`, `.gitignore`, `AGENTS.md`, and `README.md`. **Not directly read remotely:** files inside `app/`, `lib/`, `components/`, `hooks/`, `types/`, GitHub Issues, and Actions/Security tabs. Items in §18.5 must be verified locally by searching the repository.

### 18.2 Repository Findings (Spec vs. Current Code)

| ID | Severity | Spec Requirement | What the Repo Currently Has | Required Fix |
| --- | --- | --- | --- | --- |
| **F-1** | **Critical** | Tenant data only via server-verified Portal API + PIN (§5, §6.5) | `tenants` rule: `allow read … \|\| resource.data.token != null`. Anyone (even unauthenticated) can read any tenant document containing PII because rules cannot verify the caller knows the token | Build `/api/portal/[token]/unlock` + remove open clause (§18.4) |
| **F-2** | **Critical** | Rent status changes strictly server-side with UTR dedup (§10.1) | `rent_records` rule: `allow update: … \|\| request.resource.data.status == 'verify'`. Any unauthenticated caller can overwrite **any field** (amounts, `ownerId`, `tenantId`) if resulting status is `verify`; reads also open via `resource.data.tenantId != null` | Build `/api/rent/[id]/claim` + lock down reads/writes |
| **F-3** | **Critical** | Deny by default (§1.3) | `movein_photos`: read allowed if `tenantId != null`; create/update allowed if `request.resource.data.tenantId != null`. Anyone can create/overwrite photo records with arbitrary URLs | Move to `/api/uploads/intent` + `/confirm` + server-only writes |
| **F-4** | **High** | No hardcoded admin values (§1.1, §6.2) | `isSuperAdmin()` grants full admin to hardcoded literal phone number `+919876543210` in a public repo | Remove literal; use `admin: true` custom claim + `scripts/bootstrapAdmin.ts` |
| **F-5** | **High** | `ownerId` immutable (§5) | `beds`/`tenants`/etc. `update` checks existing `ownerId` only, letting an owner reassign `ownerId` to another owner's uid | `unchanged('ownerId')` (interim) → server-only writes (§7.1) |
| **F-6** | **High** | Owner cannot self-escalate status/plan/limits (§9.3) | `owners` rule: `create, update: isOwner(ownerId)` with no field restrictions | Field allowlist (interim) → server-only writes (§7.1) |
| **F-7** | **High** | No third-party QR API (§6.6) | `next.config.ts` allows `api.qrserver.com` — leaks portal bearer token URL to a third party | Replace with local `qrcode` npm package; remove host |
| **F-8** | **High** | Security headers & nonce CSP (§7.4) | `next.config.ts` defines no security headers | Add static headers in `next.config.ts` + nonce CSP in `proxy.ts` |
| **F-9** | **Medium** | Private card-free object storage (§11) | `next.config.ts` allows `res.cloudinary.com` (public/credit-cliff image hosting; no `storage.rules`) | Replace with private **Backblaze B2** (§11) + migrate via §11.8 |
| **F-10** | **Medium** | Backend service layer, validation & tests (§3, §13) | `package.json` lacks `firebase-admin`, `zod`, `qrcode`, `@aws-sdk/client-s3`, `server-only`, and test runners/scripts | Install dependencies & add scripts (§7.6, §13.2) |
| **F-11** | **Medium** | Core infra files (§4, §13) | Missing `proxy.ts`, `firebase.json`, `firestore.indexes.json`, `docker-compose.yml`, `.env.example`, `.github/` workflows | Create all required files |
| **F-12** | **Low** | Commit `.env.example` & block key leaks (§3.3, §7.5) | `.gitignore` has `.env*` (hides `.env.example`) and lacks service-account JSON patterns | Add `!.env.example`, `*-firebase-adminsdk-*.json`, `serviceAccount*.json`, `.firebase/` |
| **F-13** | **Low** | Project setup documentation | Stock `create-next-app` README | Write local emulator + MinIO setup, env, and deploy guide |

### 18.3 Architecture Evolution Summary (Rev 1 → Rev 2 → Rev 3 Final)

| Earlier Draft Issue | Final Rev 3 Resolution |
| --- | --- |
| Firebase Storage (paid Blaze) → Cloudflare R2 (needed payment card) | **Backblaze B2** (10 GB free, **no card**, S3 API, backups included, permanent) |
| Firebase Phone OTP (~₹6/SMS + Blaze) / Email-Link (5/day cap) | **Google Sign-In + Email/Password** (50K MAUs free on Spark) |
| 2% Payment Gateway for tenant rent | **0%-fee direct UPI** + UTR anti-fraud + `jspdf` receipts + `Send & Next` WhatsApp queue + **Flat SaaS Plans** |
| Missing caretaker delegation & client `staff` list rule trap | Added scoped **`staff` (warden)** role + `allow list: if false` (served via `GET /api/staff`) + "rules are not filters" contract |
| `ownerIsActive()` `get()` in rules & mixed rate-limit/lockout schema | Quota-safe `suspended` custom claim + **two-tier rate limiting** + dedicated `portal_lockouts/{tokenHash}` |
| Missing real-world PG billing/dispute realities | Added `nextReceiptSeq = 0`, `lastRemindedAt`, proration, `lineItems`, `deposits` ledger, bed-swap snapshots, atomic bed transactions, SHA-256 photo hashes, 7-day soft-delete undo, audited reversals |
| Cloud Functions assumed everywhere & unclear backend boundary | Clean `lib/server/` backend inside Next.js + pure services + GitHub Actions `cron.yml` |
| Over-engineering risk before first pilot PGs | Deferred Decision D2; offline Emulators + MinIO dev stack; explicit **Pilot Launch Gate vs. Post-Pilot Scale Gate** |

### 18.4 Interim Hardened Firestore Rules (Transitional Only)
Use these rules **only** while transitioning from direct browser writes to the full `/app/api/**` backend. **Do not deploy until `/api/portal/[token]/unlock`, `/api/rent/[id]/claim`, and owner-authenticated photo reads exist**, otherwise the tenant portal and "I Paid" button will stop working.

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isSignedIn() { return request.auth != null; }
    function notSuspended() { return isSignedIn() && request.auth.token.suspended != true; }
    function isAdmin() { return notSuspended() && request.auth.token.admin == true; } // claim only — no phone literals
    function isOwnerUid(ownerId) { return notSuspended() && request.auth.uid == ownerId; }
    function unchanged(field) { return request.resource.data.get(field, null) == resource.data.get(field, null); }

    match /owners/{ownerId} {
      allow read:   if isOwnerUid(ownerId) || isAdmin();
      allow create: if isOwnerUid(ownerId);
      allow update: if (isOwnerUid(ownerId)
                        && unchanged('accountStatus') && unchanged('plan')
                        && unchanged('subscriptionExpiresAt')
                        && unchanged('maxBeds') && unchanged('maxTenants')
                        && unchanged('maxPhotos') && unchanged('maxStaff')
                        && unchanged('nextReceiptSeq')) || isAdmin();
      allow delete: if isAdmin();
    }
    match /beds/{bedId} {
      allow read:   if isOwnerUid(resource.data.ownerId) || isAdmin();
      allow create: if isOwnerUid(request.resource.data.ownerId);
      allow update: if isOwnerUid(resource.data.ownerId) && unchanged('ownerId');
      allow delete: if isOwnerUid(resource.data.ownerId) || isAdmin();
    }
    match /tenants/{tenantId} {
      allow read:   if isOwnerUid(resource.data.ownerId) || isAdmin(); // no token clause
      allow create: if isOwnerUid(request.resource.data.ownerId);
      allow update: if isOwnerUid(resource.data.ownerId) && unchanged('ownerId');
      allow delete: if isOwnerUid(resource.data.ownerId) || isAdmin();
    }
    match /rent_records/{recordId} {
      allow read:   if isOwnerUid(resource.data.ownerId) || isAdmin(); // tenants read via /api/portal
      allow create: if isOwnerUid(request.resource.data.ownerId) && request.resource.data.status == 'pending';
      allow update: if isOwnerUid(resource.data.ownerId) && unchanged('ownerId') && unchanged('tenantId');
      allow delete: if isAdmin();
    }
    match /movein_photos/{photoId} {
      allow read:   if isOwnerUid(resource.data.ownerId) || isAdmin();
      allow create: if isOwnerUid(request.resource.data.ownerId);
      allow update: if false;
      allow delete: if isOwnerUid(resource.data.ownerId) || isAdmin();
    }
    match /{document=**} { allow read, write: if false; }
  }
}
```

Immediately after deploying interim rules: remove the hardcoded admin phone literal, bootstrap your real admin via `scripts/bootstrapAdmin.ts`, and audit existing Firestore docs for tampering (rent stuck in `verify`, altered `ownerId`, suspicious photo URLs).

### 18.5 Local Codebase Verification Checklist
Search your local repo before starting P0 to verify:
1. All references to `cloudinary` and `api.qrserver.com`.
2. How `/portal/[token]` currently fetches tenant & rent documents.
3. Current Firebase Auth login UI (switch Phone OTP UI to Google Sign-In + Email/Password).
4. Whether any secret sits inside a `NEXT_PUBLIC_` variable.
5. Whether existing rent/bed amounts are stored in rupees instead of integer `*Paise` (write one-off migration if so).
6. Any `onSnapshot` calls attached to collection lists (convert to paginated `get` with explicit `ownerId` filter + `limit`).
7. Any `console.log` printing tenant phones, tokens, or PII.

### 18.6 Prioritized Build Backlog (Pilot-First Order)

**P0 — Security Foundation & Local Dev Stack (Build First)**
1. Set up local offline dev: `firebase.json` (Auth + Firestore Emulators), `docker-compose.yml` (MinIO), `lib/env.ts`, `.env.example`, updated `.gitignore`, and `lib/constants/*`.
2. Add `lib/server/` backend foundation: `firebase-admin`, `lib/server/firebase-admin.ts`, `zod`, wrapper chain (`withErrorHandler`, `withAuth`, `withRateLimit`, `withValidation`), and `POST /api/auth/session` (Google + Email/Password session cookies).
3. Close critical holes `F-1`–`F-7`: build `/api/portal/[token]/unlock` (hashed token + last-4 phone PIN + `portal_lockouts`), `/api/rent/[id]/claim` (with `utr_claims` deduplication), local `qrcode` replacement for `api.qrserver.com`, and `scripts/bootstrapAdmin.ts`.
4. Deploy interim hardened rules (§18.4) with automated emulator rules tests; remove hardcoded admin phone literal.

**P1 — Pilot-Ready Core Product & Permanent Storage (Ship to PG #1–#5 Here)**
5. Implement **Backblaze B2** storage (`lib/server/storage/b2.ts`, browser `<canvas>` WebP compressor, `/api/uploads/intent`, `/api/uploads/confirm` with magic bytes + SHA-256, `/api/photos/[photoId]/url`) and migrate away from Cloudinary (§11.8).
6. Move all remaining mutations server-side (`owners` with `nextReceiptSeq = 0`, `beds`, `tenants` with atomic bed booking & 7-day soft-delete undo, `deposits` ledger, `rent` with `lineItems`/proration/room-bed snapshots/`jspdf` receipts/audited reversal/`lastRemindedAt`) and switch to target server-only rules (§7.1).
7. Build the **"Remind Pending Queue" (`Send & Next`)** WhatsApp modal, `/billing` flat-fee SaaS UPI upgrade + Admin approval flow, `/privacy`, `/terms`, static security headers, and `proxy.ts`.
   *(✂️ **Pilot Cutline:** Once Steps 1–7 pass §17.1, onboard your first 3–5 real PG owners before spending weeks on Steps 8–12.)*

**P2 — Post-Pilot Hardening, Host Selection & Scale (After First 3–5 Active PGs)**
8. Add the **Warden/Caretaker (`staff`)** invite & scoped RBAC flow (move into P1 if pilot PG #1 has a dedicated caretaker).
9. Decide **D2 (Hosting Platform)** and deploy dedicated staging + prod environments with separate Firebase projects and B2 buckets; run nonce CSP Report-Only soak → enforcing.
10. Wire GitHub Actions `ci.yml` (`gitleaks`, rules tests, Playwright E2E) and `cron.yml` (`metrics` + auto-monthly rent generation, AES-256-GCM encrypted B2 `backup`, retention `cleanup`), and complete first staging restore drill.
11. Enable free Cloudflare WAF edge rate-limiting, set up `/api/health` uptime monitor, write `docs/runbook.md` & `docs/data-inventory.md`, complete legal review of §15, and run k6 load test on staging.
12. *(Scale features)* Add client-side Bank/UPI CSV UTR auto-matcher for large PGs and (once past 30–50 paying PGs) optional UPI AutoPay strictly for PG-Pass SaaS subscription renewals.

---

*Rev 3 (Final) locked 23 Nov 2026. Re-verify free-tier limits in §0.1 and §14 periodically as provider policies evolve.*