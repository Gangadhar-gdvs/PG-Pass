# PG-Pass — Architecture & Project Reference

**What it is:** a mobile-first web app for Indian PG / hostel owners to manage beds,
residents, rent, deposits, expenses, guests, staff, and property documents — plus
a public PG discovery directory with photos & reviews, resident self-service
accounts, and a token + PIN portal for tenants. Built to run at **₹0 / no credit
card** using free tiers.

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
  (auth)/login/            Owner/staff sign-in (idle + kicked banners)
  (owner)/                 Owner console (server-gated layout)
    layout.tsx             Server Component: verifies __session cookie, redirects
    OwnerShell.tsx         Client chrome: nav + property switcher + idle logout;
                           owner-only tabs hidden for staff
    dashboard/ tenants/ guests/ analytics/ expenses/ maintenance/ staff/
    billing/ settings/ support/        (settings hosts the PG photo gallery)
  (resident)/resident/     Resident self-service (home, tenancy, discover)
  resident/login/          Resident sign-in (ungrouped, no auth gate)
  admin/                   Super-admin platform console (overview, per-PG manage,
                           features, support chat, reviews, logs)
  portal/[token]/ t/[token]/   Tenant portal (hashed token + PIN)
  privacy/ terms/          Legal pages
  api/**/route.ts          All server endpoints (see §6)

lib/
  firestore.ts             CLIENT read-only real-time subscriptions (beds/tenants/rent)
  config.ts env.ts         Config + validated env
  constants/               limits (incl. session/idle), status, routes, storage,
                           amenities, permissions (staff perms + PG feature flags)
  validation/              Zod schemas
  client/                  Browser helpers: uploader, imageCompress, qrcode,
                           receiptPdf, upi, bankCsv, logger
  server/                  SERVER-ONLY
    firebase-admin.ts      Admin SDK init (emulator-aware)
    auth/                  session (getServerUser), sessionRegistry (single
                           active session), entitlements (perms + feature flags)
    api/                   withAuth (+ permission/feature gates), withRateLimit,
                           withErrorHandler (ZodError→400), withValidation, withCronAuth
    security/              portalAuth (PIN + lockout), tokens, csp
    storage/               b2.ts (S3 ops incl. public-read + publicObjectUrl), provider.ts
    monitoring/            logger (PII redaction), metrics
    services/              owners, properties, beds, tenants, rent, deposits,
                           expenses, maintenance, photos, reviews, support,
                           analytics, staff, subscriptions, notifications, email,
                           adminOverview, systemLogs, discovery, residents, guests

components/
  ui/                      Design system: button, input, card, drawer, modal,
                           data-table, status-dot, badge, avatar, skeleton,
                           confirm-dialog, bottom-tab-bar, phone-input, otp-input, …
  auth/                    IdleLogout (tiered idle auto-logout + warning)
  owner/                   BedGrid, BedCard, RoomCard, StatsBar, AddTenantModal,
                           PropertySetupWizard, PropertySwitcher, AddPropertyCard,
                           DocumentUploader, TenantPhotoGallery, PgPhotoGallery,
                           StaffPermissionsEditor, OwnerOnlyGuard,
                           WhatsAppReminderModal, BankCsvReconciler
  resident/                PgDetailDrawer, RateStaffSection
  admin/                   AdminPgFeatures, AdminPgManage
  support/                 SupportChat, AdminSupportPanel
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
| **Staff (Warden)** | Caretaker invited by an owner | Scoped to that owner (custom claim `role:staff, ownerId`). **Per-staff granular permissions** (each staff member independent) decide which actions they can perform — see below. Owner-only pages (Billing, Settings, Staff mgmt) are hidden from staff and blocked server-side. |
| **Resident** | Logged-in resident account | Own panel (`/resident/*`): my PGs, payment history, issues, PG discovery, reviews. Phone + password / Google; claim `role:resident`; **linked to tenant records by phone**. |
| **Tenant (portal)** | Resident without an account | Quick portal via hashed token + last-4-phone PIN (no login) — still supported alongside resident accounts |
| **Admin** | Platform operator | Cross-PG oversight (custom claim `admin:true`). **Super-access:** sees every PG's full details + history (owner, staff + permissions + ratings, rent/deposits/expenses/maintenance/reviews/logs) and can **act on an owner's behalf** — edit owner settings, set any staff member's permissions, suspend/reactivate/soft-revoke staff, and toggle per-PG feature access. Every admin action is logged. |

**Per-staff permissions (`lib/constants/permissions.ts`).** Each staff doc carries
an independent `permissions[]` (no merging between staff): `collect_rent`,
`manage_tenants`, `manage_beds`, `manage_guests`, `manage_maintenance`,
`manage_expenses`, `manage_photos`, `view_analytics`. Owners set them per staff
member in the Staff page; admins can set them too. **Enforced server-side** in
`withAuth({ permission })` — owner/admin bypass. A fresh warden gets a sensible
default (day-to-day ops, not expenses/analytics).

**Admin per-PG feature flags (`PG_FEATURES`).** The admin can enable/disable whole
features for one PG: `discovery`, `reviews`, `photo_gallery`, `guests`, `staff`,
`analytics`, `maintenance`, `expenses`. Stored on the owner doc (`features` map),
**fail-open** (enabled unless explicitly `false`), **enforced server-side** via
`withAuth({ feature })` and in the relevant services (reviews/discovery check it
directly since residents have no `ownerId` claim). A short-TTL cache
(`lib/server/auth/entitlements.ts`) keeps these reads off the hot path; writes
invalidate it.

**Resident experience:** residents sign up (phone + name + Google/email) → account
links to any tenant records a PG owner created for that phone. They can browse a
**public PG directory** (`/api/discover` — only owner-listed PGs, public-safe
fields, with cover photo + rating), open a **PG detail page** (gallery, reviews,
amenities, contact), request to join (owner approves, then creates the tenancy),
**review their PG** and **rate individual staff/wardens**, and manage everything
from `/resident/*`. Collections: `residents`, `join_requests`; properties gain
`city`/`area`/`isListed` for discovery.

**Session (single active login, Jio/Hotstar-style).** Firebase ID token →
`POST /api/auth/session` mints a httpOnly `__session` cookie (7-day) **plus** a
`__pgp_sid` session-id cookie registered on the user doc (`currentSessionId`).
Only one device is active per account: a new explicit login supersedes older
devices (the client first asks "log in here and sign out there?" — shown only
**after** successful authentication). A superseded device's next call /
page-load is rejected (`SESSION_SUPERSEDED`) and it signs out to
`/login?kicked=1`. Explicit logout revokes refresh tokens + clears the
registration (logs out everywhere). Admins are exempt (multi-screen consoles).
`withAuth` and the `(owner)` layout enforce this on every call/render.
Implementation: `lib/server/auth/sessionRegistry.ts`.

**Idle auto-logout.** After inactivity the session ends for safety, tiered by
privilege: **admin 15 min · owner/staff 30 min · resident 60 min**
(`IDLE_TIMEOUT_MINUTES`), with a 60-second "Stay signed in" warning. On logout
(manual or idle) all app-owned **local** storage is cleared (`clearLocalData()` —
`pgpass_*` keys + sessionStorage); never DB/server data. Component:
`components/auth/IdleLogout.tsx`, mounted by each shell.

---

## 5. Services (`lib/server/services/`)

| Service | Responsibility |
|---|---|
| `owners` | Owner profile upsert (bounds-clamped, authoritative); plan quotas; due-day / late-fee config; per-PG `features` map |
| `properties` | Multi-property. Primary property id == ownerId (lazy-materialized); create/list |
| `beds` | Create (single/batch), list, update; property-scoped bed IDs; **soft-delete** (`deletedAt`; revive-on-recreate; quota counts active only) |
| `tenants` | Atomic create (bed + portal token + initial rent), soft-delete (7-day undo), restore, move-out settlement |
| `rent` | List, create, **confirm** (per-property receipt #), **partial/advance** payment, reverse (audited), reject claim, reminders, **defaulter aging**, **bulk confirm** |
| `deposits` | Ledger (installment/deduction/refund); **refund lifecycle** (pending→issued) |
| `expenses` | Record/list operating costs; monthly totals; **soft-delete** (kept for audit, excluded from lists + totals) |
| `maintenance` | Tenant-raised tickets; owner triage (open→in_progress→resolved) |
| `utilities` | Utility bills: dry-run **preview**, draft with frozen per-resident allocation (pure maths in `lib/utilitySplit.ts`), **apply to rent** (one txn, idempotent), **void** (reverses charges, audit log). Owner-only |
| `assets` | Room/common-area inventory: create, edit (append-only `history`), soft-delete; summary via `lib/assets.ts` |
| `photos` | **Private** tenant photos: B2 upload intent/confirm (magic-byte + SHA-256), presigned view URLs, per-tenant gallery. **Public PG gallery:** categorized public-read photos (`property_photos`), count-capped, cover-photo denormalized onto the property for search |
| `reviews` | **PG reviews** (verified tenant/guest/staff only, 1–5★ + text, auto-public, admin-hideable) + **staff ratings** (resident → individual warden); aggregates (`reviewAgg`/`ratingAgg`) maintained transactionally; eligibility + feature-gate enforced |
| `support` | Owner↔admin live chat (`support_threads` + `messages`), unread counters, per-owner threads (never merged) |
| `analytics` | Per-owner occupancy, collection %, 6-month trend, aging, net-of-expenses |
| `staff` | Invite (sets custom claims + setup link), suspend/reactivate, **per-staff permissions**, **soft-revoke** (record kept, claims wiped, tokens revoked). Owner- or admin-actioned |
| `subscriptions` | Plan upgrade request + admin approval (idempotent) |
| `notifications` | Admin + owner notifications |
| `email` | Optional transactional email (no-op unless configured) |
| `adminOverview` | Platform-wide totals + per-PG overview (incl. staff + permissions + ratings); `getPgAdminDetail` on-demand per-PG history |
| `systemLogs` | Persist errors + business/security events for the admin log viewer |

Server auth helpers (`lib/server/auth/`): `sessionRegistry` (single active
session), `entitlements` (cached per-staff permissions + per-PG feature flags),
`session` (`getServerUser` for RSC).

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
- `/utilities` `GET POST` · `/utilities/preview` `POST` · `/utilities/[id]` `GET` · `/utilities/[id]/apply` `POST` · `/utilities/[id]/void` `POST` (**owner-only**)
- `/assets` `GET POST` · `/assets/[id]` `GET PATCH DELETE` (read: owner/staff; write: staff need `manage_beds`)
- `/analytics` `GET` · `/staff` `GET POST` · `/staff/[staffUid]` `PATCH DELETE PUT` (PUT = set permissions)
- `/billing/upgrade` `POST` · `/flags` `POST`
- `/photos` `GET` · `/photos/[photoId]/url` `GET` · `/uploads/intent` `POST` · `/uploads/confirm` `POST`
- `/properties/photos` `GET POST PUT` (PG gallery: intent/confirm) · `/properties/photos/[photoId]` `DELETE`
- `/support/messages` `POST PATCH` (owner↔admin chat: send / mark-read)

Owner/staff write routes carry a staff `permission` gate and (where applicable) a
per-PG `feature` gate in `withAuth`; destructive ops (tenant/bed delete, restore,
rent reverse) stay owner-only.

**Resident (session-auth, resident/tenant):**
- `/resident/me` `GET` · `/resident/tenancy/[tenantId]` `GET` · `/resident/tenancy/[tenantId]/issue` `POST` · `/resident/register` `POST`
- `/reviews` `POST` (submit PG review) · `/reviews/staff` `GET POST` (staff ratings)
- `/discover/[propertyId]/join` `POST`

**Tenant portal (token + PIN):** `/portal/[token]/unlock` · `/rent/[id]/claim` · `/maintenance` (POST) · `/uploads/*` · `/photos/[photoId]/url`.

**Admin (admin claim):** `/admin/overview` · `/admin/accounts` · `/admin/claims` · `/admin/subscriptions` · `/admin/logs` · `/admin/support` `GET POST` (chat) · `/admin/reviews` `PATCH` (hide/unhide) · `/admin/features` `GET PATCH` (per-PG feature flags) · `/admin/manage` `POST` (act-as-owner: edit owner, set staff perms/status, revoke staff) · `/admin/pg-detail` `GET` (full per-PG history).

**Public (no auth, rate-limited):** `/discover` `GET` (PG search) · `/discover/[propertyId]` `GET` (PG detail: gallery + reviews + contact) · `/reviews` `GET` (visible PG reviews).

**Cron (Bearer `CRON_SECRET`):** `/cron/metrics` (nightly metrics + auto-generate next month's rent) · `/cron/cleanup` (purge expired) · `/cron/backup` (AES-256-GCM encrypted backup → B2).

**Public:** `/health` · `/logs` (rate-limited error ingest).

### API wrapper chain

`withErrorHandler` (sanitizes errors, logs to `system_logs`; maps `ZodError` → clean
400) → `withAuth` (verifies cookie, role, account status, **single-active-session**,
optional staff **`permission`** + per-PG **`feature`** gate) → `withRateLimit`
(sensitive tier = Firestore-backed & distributed; standard tier = in-memory
best-effort) → `withValidation` (Zod) → handler. Cron routes use `withCronAuth`
(timing-safe). Validation is two-layer: thin route guards (presence/type) +
**authoritative service-layer** enforcement (clamp/whitelist/trim) — services never
trust client input even when a schema ran upstream.

---

## 7. Data Model (Firestore)

**Multi-tenant rule:** every business doc carries `ownerId`; reads are scoped to
it. Multi-property adds an optional `propertyId` (defaults to `ownerId` for the
owner's **primary** property, so legacy single-PG data needs no migration).

| Collection | Key fields |
|---|---|
| `owners` | account: name, email, phone, upiId, plan, max* quotas, `nextReceiptSeq` (legacy), **`features`** map (admin per-PG flags), **`currentSessionId`** (single active session), `coverPhotoUrl` (denormalized), `reviewAgg` on primary property |
| `properties` | `id`(==ownerId for primary), pgName, address, floors, rent config, `rentDueDay`, late-fee, **per-property `nextReceiptSeq`**, `city`/`area`/`isListed` (discovery), mirrored `features`, `coverPhotoUrl`, `reviewAgg` |
| `beds` | ownerId, propertyId, room/bed label, `rentAmountPaise`, status, denormalized tenant snapshot, **`deletedAt`** (soft-delete; `null` = active) |
| `tenants` | ownerId, propertyId, bedId, name, phone, `phoneLast4`, idProofType, emergency contact, deposit, `deletedAt`, portal `token` |
| `rent_records` | id=`{tenantId}_{period}`, ownerId, propertyId, period(YYYY-MM), lineItems, `amountDuePaise`/`amountPaidPaise`, status(pending/verify/paid), dueDate, `receiptNumber` |
| `deposits` | ownerId, propertyId, tenantId, type(installment/deduction/refund), amountPaise, `refundStatus` |
| `expenses` | ownerId, propertyId, category, amountPaise, period, vendor, **`deletedAt`** (soft-delete) |
| `maintenance_tickets` | ownerId, propertyId, tenantId, category, description, status |
| `utility_bills` | ownerId, propertyId, type, provider, period, scope(room/property), roomNumber, `label`, `totalPaise`, `meter`{previous,current,units,reset}, rule(equal/occupancy_days/custom), **`allocations[]`** (per resident: days, weight, `sharePaise`, `roundingPaise`, status pending/applied/skipped/reversed, skipReason, rentRecordId), status(draft/partial/applied/void), `history[]`, `dedupeKey` (server-only), **`deletedAt`** (set on void) |
| `assets` | ownerId, propertyId, location(room/common), roomNumber, name, category, quantity, condition(good/fair/damaged/missing), purchaseDate, warrantyUntil, notes, **`history[]`** (append-only), **`deletedAt`** |
| `movein_photos` | ownerId, propertyId, tenantId, photoType, objectKey, sha256 (**private**; metadata only, bytes in B2) |
| `property_photos` | ownerId, propertyId, category, caption, sharingType, `publicUrl` (**public-read**), objectKey — PG gallery for discovery |
| `pg_reviews` | id=`{propertyId}_{reviewerUid}`, ownerId, propertyId, reviewerRole, rating(1–5), text, `hidden` (admin). **Public get** |
| `staff_ratings` | id=`{staffUid}_{reviewerUid}`, staffUid, ownerId, rating, note (resident→warden; owner/admin read) |
| `support_threads` / `.../messages` | one thread per owner (id==ownerId): lastMessage, unread counters; messages (sender owner/admin, text) |
| `staff` | ownerId (immutable), role, accountStatus (active/suspended/**revoked**), **`permissions[]`**, `ratingAgg`, **`deletedAt`** (soft-revoke) |
| `residents` | uid, name, phone (links to tenants by phone), `currentSessionId` |
| `join_requests` | propertyId, ownerId, residentId, residentPhone, status (server-only R/W) |
| `subscription_requests` | ownerId, requestedPlan, utrReference, status |
| **Server-only** | `portal_tokens`, `portal_lockouts`, `utr_claims`, `rate_limits`, `idempotency_keys`, `audit_logs`, `metrics`, `admin_notifications`, `owner_notifications`, `support_flags`, `system_logs` |

**Soft-delete everywhere:** business-data deletions are soft (`deletedAt` + status)
— staff (revoke), beds, expenses, tenants — never hard-deleted. Reads/queries
exclude `deletedAt`; records are kept for history/audit. (The only hard removals
are the nightly retention sweep of already-soft-deleted tenants past the 7-day
undo window, expired ephemeral tokens/lockouts, and PG gallery photo deletes.)

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

**Utilities & transparent split** (`/utilities`, owner-only) — record an
electricity/water/gas/internet bill for a month, for one room or the whole PG,
with optional meter readings (a lower current reading is rejected unless the
meter is flagged reset). Split **equally**, **by days stayed** (move-in and
move-out day both count) or by **custom** amounts that must add up exactly. The
sheet shows a live per-resident preview (days, share, +1-paisa rounding) before
saving. Rounding: floor each exact share, then hand the leftover paise 1 each to
the largest remainders (ties → name order), so the total always equals the bill.
Duplicates (same property + room/whole-PG + type + month) are rejected with 409
unless the earlier bill was voided. **Apply to rent** appends a line item
(`Electricity · Room 101 · Nov 2026`, `kind:'utility'`, `utilityBillId`) to each
resident's `{tenantId}_{period}` rent record and raises `amountDuePaise`; a paid
record goes back to `pending` with its payments kept. Residents with **no rent
record** for that month, or with a payment **awaiting verification**, are skipped
with a reason and picked up by re-applying (never double-charged). **Void**
removes the line from untouched records, appends a negative
`utility_reversal` line where payments exist, soft-deletes the bill, writes
`audit_logs` + a system event, and reports any overpayment (never auto-marks paid).

**Room inventory** (`/inventory`, staff-visible) — per-room and common-area
checklist: name, category, quantity, condition, purchase/warranty dates, notes.
Every condition/quantity/detail change and delete appends to the item's history.
Summary: counts by condition, damaged/missing "needs attention", warranties
ending within 30 days. Staff edits require the `manage_beds` permission
(labelled "Manage beds & room inventory").

**Staff** — invite warden (scoped custom claims + shareable setup link),
suspend/reactivate, **soft-revoke** (record kept), and **per-staff permission
toggles** (each warden independent; enforced server-side). Staff share the owner
console with owner-only pages hidden + blocked. Owner also sees each warden's
average resident rating.

**PG photo gallery** — owners upload **public**, categorized photos (exterior,
room + sharing type, bathroom, common, food, amenity) from Settings; shown on the
public PG search card (cover) + detail page. Public-read on B2, count-capped,
magic-byte verified.

**Reviews** — verified tenants/guests/staff review the PG (1–5★ + text, one per
person, auto-public, admin can hide); residents separately **rate individual
staff/wardens**. Aggregate ratings surface on discovery cards + the PG detail
page; per-staff averages show to owner + admin. Gated by the per-PG `reviews`
feature flag.

**Owner↔admin support chat** — owners contact the platform admin via a **live**
chat (Firestore `onSnapshot`, not polling); admin replies from a per-owner thread
list in the admin console. (Residents contact their owner via existing
maintenance/issue flows.)

**Tenant portal** — PIN unlock (with lockout), view dues, pay via UPI, submit
UTR + proof, download receipt, view deposit, raise maintenance issue.

**Admin** — platform overview; **per-PG deep view** (owner, staff + permissions +
ratings, and full history: rent/deposits/expenses/maintenance/reviews/logs);
**act-as-owner** (edit owner settings, set staff permissions, suspend/reactivate/
soft-revoke staff); **per-PG feature flags**; suspend/reactivate accounts; approve
plan upgrades; owner support chat; review moderation; system log viewer.

**Billing** — Free / Growth / Pro plans via UPI + admin approval (account-wide quotas).

**Session & safety** — single active login per account (new login supersedes old
devices after a confirm prompt; "log out everywhere" on explicit logout) + tiered
**idle auto-logout** (admin 15 / owner·staff 30 / resident 60 min) with a 60s
warning; local storage wiped on logout.

---

## 9. Security

- **Server-only writes** (Firestore rules deny all client writes).
- **Multi-tenant isolation** enforced in rules (owner-scoped) + service layer;
  services re-check `ownerId` ownership on every id-addressed read/mutate (never
  trust a client-supplied id).
- **Layered authorization:** role gate → single-active-session → per-staff
  `permission` → admin per-PG `feature` flag — all server-side in `withAuth`;
  admin bypasses scoping by design.
- **Single active session** per account (`currentSessionId` + `__pgp_sid`
  cookie); **idle auto-logout** (tiered) with local-data wipe on logout.
- **Portal auth:** 256-bit `crypto.randomBytes` tokens (hashed at rest),
  constant-time 4-digit PIN check, Firestore lockout after N attempts.
- **Data minimization:** no owner PAN or tenant Aadhaar/PAN numbers are collected
  or stored (ID proof is an offline-sighted *type* only).
- **Storage:** tenant evidence photos stay **private** (B2, 5-min presigned URLs);
  PG gallery photos are **public-read** by design (discovery). Both: magic-byte +
  SHA-256 validation, EXIF-stripped client compression, locked CORS.
- **Public endpoints** (`/discover*`, `/reviews` GET) expose only public-safe
  fields (name/area/city/category/rating/photos + opted-in phone+address); never
  UPI, email, or internal data.
- **Headers:** enforced CSP (nonce; Report-Only only in dev), HSTS,
  X-Frame-Options DENY, nosniff.
- **Rate limiting:** Firestore-backed for sensitive/public endpoints.
- **Admin:** custom-claim only (`scripts/bootstrapAdmin.ts`); no client secret.
- **Logging:** PII-redacted. Both technical errors AND business/security **events**
  go to one `system_logs` stream the admin reads (via `recordEvent`, category-tagged:
  payment / refund / security / account / tenant / guest / discovery / quota / comms /
  cron). So the admin sees rent confirmations, reversals, deposit refunds, portal
  lockouts, account suspensions, guest check-in/out, join decisions, reminder
  delivery, and nightly-backup results in one filterable place — not scattered or
  hidden. Query: `GET /api/admin/logs?level=&category=&limit=`.
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
