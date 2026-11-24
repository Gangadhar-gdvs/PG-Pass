# PG-Pass — Architecture & Project Reference

**What it is:** a mobile-first web app for Indian PG / hostel owners to manage beds,
residents, rent, deposits, expenses, and property documents — with a token + PIN
portal for tenants. Built to run at **₹0 / no credit card** using free tiers.

**Who this doc is for:** any developer, operator, or AI agent who needs to
understand the whole system quickly. It describes **what exists today**.

---

## 1. Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 16** (App Router) + **React 19** | One repo for UI + API; server components |
| Language | **TypeScript** | Type safety end to end |
| Styling | **Tailwind CSS v4** | Utility-first, mobile-first |
| Auth | **Firebase Auth** (Google + Email/Password) | 50k MAU free, no card |
| Database | **Cloud Firestore** | Free Spark tier, real-time listeners |
| Server admin | **firebase-admin** | All writes go through the Admin SDK |
| File storage | **Backblaze B2** (S3 API via `@aws-sdk/client-s3`) | 10 GB free, no card, private photos |
| Validation | **Zod** | Request body validation |
| Client libs | `qrcode`, `jspdf`, `canvas-confetti`, `react-hot-toast`, `lucide-react` (all lazy-loaded where heavy) |
| Email (optional) | **Resend HTTP API** | No-op unless `RESEND_API_KEY` is set |
| Hosting | Host-agnostic (any Next.js host) | Decision deferred |
| SMS (optional) | Generic HTTP provider | No-op unless keyed; auto-sends rent reminders |

**UI design system ("bold & vibrant mobile-app"):** per-panel theming via CSS
vars in `globals.css` (resident **teal** / owner **amber** / admin **indigo**) —
each panel layout sets a `theme-*` class and all primitives read `var(--accent)`.
Shared bold utilities: gradient headers (`app-gradient`), floating card stacks
(`app-card`), pill buttons, and motion (`animate-pop`, `stagger`, `press`).
Navigation on mobile/tablet is a **floating bottom tab bar** (`components/ui/bottom-tab-bar.tsx`):
2–4 essential tabs + a prominent center action + a **"More"** button that opens a
full-menu sheet with every destination; desktop keeps the sidebar.

---

## 2. Architecture Rules

1. **One repo, clean backend isolation.** All server-only code lives under
   `lib/server/` (`import 'server-only'`). Services never import
   `NextRequest`/`NextResponse` — they take plain args and return plain data.
2. **Server is the only writer.** `firestore.rules` denies **all client writes**
   (`allow write: if false`). The browser may only *read* (owner-scoped,
   real-time) and must go through `app/api/**` for every change.
3. **Config & constants are centralized** — `lib/env.ts` (validated env),
   `lib/config.ts`, `lib/constants/*`. No magic values or secrets in code.
4. **Money is stored in integer paise**, never floats.
5. **Secrets stay server-side.** No `NEXT_PUBLIC_` secret. Admin access is a
   Firebase custom claim (`{admin:true}`), verified server-side.

### Request flow

```
Browser ──fetch──▶ app/api/**/route.ts
                      │  wrapper chain (compose in this order):
                      │  withErrorHandler( withAuth( withRateLimit( handler )))
                      ▼
                   lib/server/services/*.service.ts   (business logic, transactions)
                      ▼
                   Firestore (Admin SDK)  +  Backblaze B2  +  email (optional)

Browser ──onSnapshot──▶ Firestore   (read-only, owner-scoped, real-time)
```

---

## 3. Folder Hierarchy

```
app/
  (auth)/login/            Sign-in (Google + email)
  (owner)/                 Owner console (server-gated layout)
    layout.tsx             Server Component: verifies __session cookie, redirects
    OwnerShell.tsx         Client chrome: nav + property switcher + sign-out
    dashboard/ tenants/ analytics/ expenses/ maintenance/ staff/
    billing/ settings/
  admin/                   Super-admin platform console
  portal/[token]/          Tenant portal (hashed token + PIN)
  t/[token]/               Short tenant portal link
  privacy/ terms/          Legal pages
  api/**/route.ts          All server endpoints (see §6)

lib/
  firestore.ts             CLIENT read-only real-time subscriptions (beds/tenants/rent)
  config.ts env.ts         Config + validated env
  constants/               limits, status, routes, storage, amenities
  validation/              Zod schemas
  client/                  Browser helpers: uploader, imageCompress, qrcode,
                           receiptPdf, upi, bankCsv, logger
  server/                  SERVER-ONLY
    firebase-admin.ts      Admin SDK init (emulator-aware)
    auth/session.ts        getServerUser() — resolves user from cookie in RSC
    api/                   withAuth, withRateLimit, withErrorHandler,
                           withValidation, withCronAuth
    security/              portalAuth (PIN + lockout), tokens, csp
    storage/               b2.ts (S3 ops), provider.ts
    monitoring/            logger (PII redaction), metrics
    services/              16 services (see §5)

components/
  ui/                      Design system: button, input, card, drawer, modal,
                           data-table, status-dot, badge, avatar, skeleton,
                           confirm-dialog, tab-bar, phone-input, otp-input, …
  owner/                   BedGrid, BedCard, RoomCard, StatsBar, AddTenantModal,
                           PropertySetupWizard, PropertySwitcher, AddPropertyCard,
                           DocumentUploader, TenantPhotoGallery,
                           WhatsAppReminderModal, BankCsvReconciler
  tenant/                  TenantPortalView, RentStatusCard, DepositVault,
                           ProofUploader, RaiseIssue

hooks/                     useAuth, useOwner (session + selected property),
                           useBeds, useTenants
proxy.ts                   Next middleware: CSP (+ nonce) + optimistic auth redirect
firestore.rules            Server-write-only, owner-scoped reads
firestore.indexes.json     Composite indexes
infra/                     B2 CORS + lifecycle config
docs/                      runbook, data-inventory, multi-property-plan
scripts/                   bootstrapAdmin, smokeAdminSdk
tests/unit/                Vitest unit tests
```

---

## 4. Roles & Access

| Role | Who | Access |
|---|---|---|
| **Owner** | PG proprietor | Full control of their own account + properties |
| **Staff (Warden)** | Caretaker invited by an owner | Scoped to that owner (custom claim `role:staff, ownerId`) |
| **Resident** | Logged-in resident account | Own panel (`/resident/*`): my PGs, payment history, issues, PG discovery. Phone + password / Google; claim `role:resident`; **linked to tenant records by phone**. |
| **Tenant (portal)** | Resident without an account | Quick portal via hashed token + last-4-phone PIN (no login) — still supported alongside resident accounts |
| **Admin** | Platform operator | Cross-PG oversight (custom claim `admin:true`) |

**Resident experience:** residents sign up (phone + name + Google/email) → account
links to any tenant records a PG owner created for that phone. They can browse a
**public PG directory** (`/api/discover`, only owner-listed PGs, public-safe
fields), request to join (owner approves, then creates the tenancy), and manage
everything from `/resident/*`. Collections: `residents`, `join_requests`;
properties gain `city`/`area`/`isListed` for discovery.

**Session:** Firebase ID token → `POST /api/auth/session` mints a httpOnly
`__session` cookie (7-day). `withAuth` verifies it on every API call; the
`(owner)` layout verifies it server-side before rendering (no client auth spinner).

---

## 5. Services (`lib/server/services/`)

| Service | Responsibility |
|---|---|
| `owners` | Owner profile upsert; plan quotas; due-day / late-fee config |
| `properties` | Multi-property. Primary property id == ownerId (lazy-materialized); create/list |
| `beds` | Create (single/batch), list, update; property-scoped bed IDs |
| `tenants` | Atomic create (bed + portal token + initial rent), soft-delete (7-day undo), restore, move-out settlement |
| `rent` | List, create, **confirm** (per-property receipt #), **partial/advance** payment, reverse (audited), reject claim, reminders, **defaulter aging**, **bulk confirm** |
| `deposits` | Ledger (installment/deduction/refund); **refund lifecycle** (pending→issued) |
| `expenses` | Record/list/delete operating costs; monthly totals |
| `maintenance` | Tenant-raised tickets; owner triage (open→in_progress→resolved) |
| `photos` | B2 upload intent/confirm (magic-byte + SHA-256), presigned view URLs, per-tenant gallery list |
| `analytics` | Per-owner occupancy, collection %, 6-month trend, aging, net-of-expenses |
| `staff` | Invite (sets custom claims + setup link), suspend/revoke |
| `subscriptions` | Plan upgrade request + admin approval (idempotent) |
| `notifications` | Admin + owner notifications |
| `email` | Optional transactional email (no-op unless configured) |
| `adminOverview` | Platform-wide totals for the admin console |
| `systemLogs` | Persist errors for the admin log viewer |

---

## 6. API Routes (`app/api/`)

**Auth:** `POST/DELETE /auth/session` (session cookie).

**Owner data (session-auth, owner/staff):**
- `/owners` `GET PUT`
- `/properties` `GET POST`
- `/beds` `GET POST` · `/beds/[id]` `GET PATCH DELETE` · `/beds/batch` `POST`
- `/tenants` `GET POST` · `/tenants/[id]` `GET DELETE` · `/tenants/[id]/moveout` · `/tenants/[id]/restore`
- `/rent` `GET POST` · `/rent/[id]/confirm` · `/rent/[id]/partial` · `/rent/[id]/reverse` · `/rent/[id]/reminded` · `/rent/bulk-confirm` · `/rent/defaulters`
- `/deposits/[tenantId]` `GET POST` · `/deposits/refunds` `GET` · `/deposits/refunds/[depositId]` `PATCH`
- `/expenses` `GET POST` · `/expenses/[id]` `DELETE`
- `/maintenance` `GET POST` · `/maintenance/[id]` `PATCH`
- `/analytics` `GET` · `/staff` `GET POST` · `/staff/[staffUid]` `PATCH DELETE`
- `/billing/upgrade` `POST` · `/flags` `POST`
- `/photos` `GET` · `/photos/[photoId]/url` `GET` · `/uploads/intent` `POST` · `/uploads/confirm` `POST`

**Tenant portal (token + PIN):** `/portal/[token]/unlock` · `/rent/[id]/claim` · `/maintenance` (POST) · `/uploads/*` · `/photos/[photoId]/url`.

**Admin (admin claim):** `/admin/overview` · `/admin/accounts` · `/admin/claims` · `/admin/subscriptions` · `/admin/logs`.

**Cron (Bearer `CRON_SECRET`):** `/cron/metrics` (nightly metrics + auto-generate next month's rent) · `/cron/cleanup` (purge expired) · `/cron/backup` (AES-256-GCM encrypted backup → B2).

**Public:** `/health` · `/logs` (rate-limited error ingest).

### API wrapper chain

`withErrorHandler` (sanitizes errors, logs to `system_logs`) → `withAuth`
(verifies cookie, role, account status) → `withRateLimit` (sensitive tier =
Firestore-backed & distributed; standard tier = in-memory best-effort) →
`withValidation` (Zod) → handler. Cron routes use `withCronAuth` (timing-safe).

---

## 7. Data Model (Firestore)

**Multi-tenant rule:** every business doc carries `ownerId`; reads are scoped to
it. Multi-property adds an optional `propertyId` (defaults to `ownerId` for the
owner's **primary** property, so legacy single-PG data needs no migration).

| Collection | Key fields |
|---|---|
| `owners` | account: name, email, phone, upiId, panNumber, plan, max* quotas, `nextReceiptSeq` (legacy) |
| `properties` | `id`(==ownerId for primary), pgName, address, floors, rent config, `rentDueDay`, late-fee, **per-property `nextReceiptSeq`** |
| `beds` | ownerId, propertyId, room/bed label, `rentAmountPaise`, status, denormalized tenant snapshot |
| `tenants` | ownerId, propertyId, bedId, name, phone, `phoneLast4`, idProofType, emergency contact, deposit, `deletedAt`, portal `token` |
| `rent_records` | id=`{tenantId}_{period}`, ownerId, propertyId, period(YYYY-MM), lineItems, `amountDuePaise`/`amountPaidPaise`, status(pending/verify/paid), dueDate, `receiptNumber` |
| `deposits` | ownerId, propertyId, tenantId, type(installment/deduction/refund), amountPaise, `refundStatus` |
| `expenses` | ownerId, propertyId, category, amountPaise, period, vendor |
| `maintenance_tickets` | ownerId, propertyId, tenantId, category, description, status |
| `movein_photos` | ownerId, propertyId, tenantId, photoType, objectKey, sha256 (metadata only; bytes in B2) |
| `staff` | ownerId (immutable), role, accountStatus |
| `subscription_requests` | ownerId, requestedPlan, utrReference, status |
| **Server-only** | `portal_tokens`, `portal_lockouts`, `utr_claims`, `rate_limits`, `idempotency_keys`, `audit_logs`, `metrics`, `admin_notifications`, `owner_notifications`, `support_flags` |

**Rent status lifecycle:** `pending → verify → paid`. Tenant claims with a UPI UTR
(deduped in `utr_claims`) → `verify`; owner confirms → `paid` + atomic
per-property receipt number. Paid can be reversed (audited).

---

## 8. Features

**Owner dashboard** — bed grid (room/floor view, windowed for large PGs), live
occupancy & collection stats, add tenant, mark paid / record partial payment,
verify payment proof, reverse payment (confirm dialog), vacate, WhatsApp reminder
queue, bank-CSV UTR reconciliation, **month navigator** (view/collect any month),
**overdue banner**, **pending-refunds banner**, **bulk "Mark All Paid"**,
per-tenant document vault (ID proof + agreement) & photo gallery, emergency
contact.

**Rent & money** — 0%-fee direct UPI (QR + copy), proration & line items,
partial/advance payments, configurable due-day, **late-fee + defaulter aging**,
sequential HRA PDF receipts (per property), deposit ledger with refund workflow.

**Reminders** — tapping "remind" **auto-sends via SMS (tenant) + email (linked
resident)** when a provider is configured (`SMS_API_URL`/`RESEND_API_KEY`);
otherwise falls back to the free "open WhatsApp with prefilled message" flow.
Both channels are no-op/best-effort by default, so the app stays ₹0 out of the box.

**Guests (short stay)** — a lightweight flow separate from full-time tenants, for
people staying a day to a few days: **"Check in Guest"** picks a vacant bed, sets
dates, and charges **per-night (rate × nights) or a flat total** up front. The bed
is held as `guest` and **auto-frees on checkout**. A **Guests page** lists
"staying now" (with checkout) + history. No monthly rent cycle, deposit ledger, or
portal — it's deliberately quick. (`guest_stays` collection, `guests.service`,
`/api/guests` + `/api/guests/[id]/checkout`.)

**Join requests** — residents who discover a PG publicly request to join; the owner
sees a dashboard banner and **Accept** pre-fills the Add-Tenant form with the
resident's name + phone (phone auto-links the resident account) — then taps a
vacant bed to finish. (`/api/owners/join-requests`.)

**Residents** — searchable + paginated directory, CSV export, portal links,
soft-delete with 7-day undo, atomic move-out settlement (deductions/refund,
token revocation, summary).

**Properties** — one owner, many PGs. Property switcher in the shell; views and
receipts scope to the selected property; "add property" in Settings.

**Analytics** — collection %, occupancy, revenue potential, **net of expenses**,
6-month trend, defaulter aging (dependency-free charts).

**Expenses** — log staff salary / utilities / maintenance / vendor bills; feeds
net-revenue analytics.

**Maintenance** — tenants raise issues from the portal; owner triages to resolved.

**Staff** — invite warden (scoped custom claims + shareable setup link), suspend/revoke.

**Tenant portal** — PIN unlock (with lockout), view dues, pay via UPI, submit
UTR + proof, download receipt, view deposit, raise maintenance issue.

**Admin** — platform overview, suspend/reactivate accounts, approve plan upgrades,
system log viewer.

**Billing** — Free / Growth / Pro plans via UPI + admin approval (account-wide quotas).

---

## 9. Security

- **Server-only writes** (Firestore rules deny all client writes).
- **Multi-tenant isolation** enforced in rules (owner-scoped) + service layer.
- **Portal auth:** 256-bit `crypto.randomBytes` tokens (hashed at rest),
  constant-time 4-digit PIN check, Firestore lockout after N attempts.
- **Storage:** private B2 bucket, 5-min presigned URLs, magic-byte + SHA-256
  validation, EXIF-stripped client compression, locked CORS.
- **Headers:** enforced CSP (nonce; Report-Only only in dev), HSTS,
  X-Frame-Options DENY, nosniff.
- **Rate limiting:** Firestore-backed for sensitive/public endpoints.
- **Admin:** custom-claim only (`scripts/bootstrapAdmin.ts`); no client secret.
- **Logging:** PII-redacted; errors persisted to `system_logs` for the admin viewer.
- **Backups:** nightly AES-256-GCM encrypted export to B2 (verified on upload).

---

## 10. Operations

- **Cron (GitHub Actions or any scheduler, Bearer `CRON_SECRET`):** nightly
  `metrics` (+ auto-generate next month's rent), `cleanup` (purge expired
  tokens/lockouts/soft-deletes), `backup`.
- **Local dev:** Firebase Emulator Suite (Auth + Firestore) + MinIO for B2;
  `NEXT_PUBLIC_USE_EMULATORS=true`.
- **Env:** `.env.{development,staging,production}` from the `*.example` templates;
  validated by `lib/env.ts`.
- **Quality gates:** `npm run typecheck` (tsc), `npm run build` (next),
  `npm test` (vitest), `npm run test:rules` (emulator), `npm audit` (0 known vulns).
- **Docs:** `docs/runbook.md` (incident response), `docs/data-inventory.md`
  (DPDP data map), `docs/multi-property-plan.md` (migration design).

---

## 11. Conventions for Contributors / Agents

- New mutation? Add a **service method** + an **API route** in the wrapper chain.
  Never write to Firestore from the browser.
- New collection/field queried by more than `ownerId` equality? Add a
  **composite index** to `firestore.indexes.json` and a **rule** to
  `firestore.rules`.
- Money in **paise** (integers). Dates: store `YYYY-MM-DD`; display DD/MM/YYYY
  (`formatDateIN`). Rent period: `YYYY-MM` (`getCurrentPeriod`).
- Heavy client libs (`jspdf`, `qrcode`) must be **dynamically imported** at point
  of use.
- Keep user-facing errors human and actionable; never leak infra details.
- After changes, run typecheck + build + tests before considering it done.
