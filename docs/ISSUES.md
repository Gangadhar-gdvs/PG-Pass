# PGPass — Issue & Bug Log

Running log of bugs, defects, and tech-debt found while working the project.
Nothing is left silently "as is" — every item lands here with a status so it
gets fixed deliberately. Update status as items are resolved.

Status legend: 🔴 open · 🟡 in progress · 🟢 fixed · ⚪ deferred (decision logged)

---

## Owner-reported issues (from README.md)

| # | Issue | Status | Notes |
|---|-------|--------|-------|
| 1 | Add-resident "assign" on Enter, no obvious button (mobile) | 🟢 fixed | Footer button no longer relies on the flaky cross-browser `type=submit form=` association — it calls the submit handler directly via `onClick` (Enter still works via form onSubmit). Applied to both `AddTenantModal` and `CheckInGuestModal`; also cleaned both files to 0 lint (set-state-in-effect, impure-clock→lazy initializer, `any`→`errorMessage`) and added a `min={today}` guard on guest check-in. |
| 2 | After adding resident: no record-amount-paid / checkout option | 🟢 fixed | Auto-open bed-detail drawer after add; drawer resolves live bed so tenant/rent populate. `app/(owner)/dashboard/page.tsx` |
| 3 | Free-tier 20-bed limit not enforced; more beds still creatable | 🟢 fixed | Removed first-setup grace + write-back; plan limit is a hard cap. `lib/server/services/beds.service.ts`. Test: `tests/unit/bedQuota.test.ts`. **Decision: hard-cap, no grace.** |
| 4 | Portal link shows `/t/undefined`; copy fails; PIN always invalid | 🟢 fixed | Persist raw token on tenant doc; align portalUrl to `/t/<token>`; clipboard fallback. `tenants.service.ts`, `dashboard/page.tsx`. Test: `tests/unit/portalPin.test.ts` |
| 5 | Tabs sometimes don't open / UI stuck | 🟢 fixed | Added optimistic navigation feedback to the bottom tab bar: the tapped tab highlights IMMEDIATELY (before the route commits) so on a slow network the owner sees the tap registered and doesn't repeat-tap thinking it's stuck. Pending highlight cleared via the render-time "adjust state while rendering" pattern (no setState-in-effect). `components/ui/bottom-tab-bar.tsx` — 0 lint problems. |
| 6 | Want profile icon top-right (with avatar upload) | 🟢 fixed | New sticky mobile top bar (`components/owner/OwnerTopBar.tsx`): PG name left, profile avatar button right → opens a profile sheet (identity + property switch + sign out). Avatar-image upload deferred as a follow-up (noted below). |
| 7 | Stats/analytics tab: "Couldn't load analytics" | 🟢 fixed | Isolated non-core sub-queries (defaulters/expenses) with `.catch` so a missing-index/failure degrades to zeros instead of blanking the whole page; client now surfaces the server `requestId` as a support reference. Also fixed the file's set-state-in-effect. Files: `analytics.service.ts`, `analytics/page.tsx`. Test: `analyticsMath.test.ts` (current-row-always-defined guard). Analytics page now 0 lint problems. |
| 8 | Support page scrolls whole page; want chat-only scroll, dates, ticks | 🟢 fixed | Full-bleed mobile layout (edge-to-edge, fixed height between top bar + tab bar, only the message list scrolls); added Today/Yesterday/date separators, per-message timestamps, and sent (✓) / seen (✓✓, derived honestly from the other side replying later) ticks. Admin panel inherits the same via shared `SupportChat`. Files: `SupportChat.tsx`, `support/page.tsx`. Both now 0 lint problems. |
| 9 | Headers not sticky across pages | 🟢 fixed | Added a sticky (`sticky top-0 z-30`) mobile app top bar in the shell so the header stays fixed on scroll. Per-page sub-headers intentionally left scrolling beneath it (standard app pattern; avoids per-page layout fragility). |
| 10 | Multiple-properties UI at top — poor UX/placement | 🟢 fixed | Property switcher moved out of the awkward above-content slot into the profile sheet opened from the top bar; PG name + chevron in the bar signals multi-property. Desktop sidebar switcher unchanged. |
| 11 | Beds date arrows show SAME data for all dates; want calendar picker | 🟢 fixed | Root cause: cards derived paid status from `bed.status \|\| record` — bed status is month-agnostic so every month looked identical. Now payment status comes ONLY from the selected month's record + distinct "No bill" state. Added native `<input type="month">` calendar picker on the month label. Files: `BedCard.tsx`, `BedGrid.tsx`, `RoomCard.tsx`, `dashboard/page.tsx`. Test: `tests/unit/bedPeriodStatus.test.ts` |

---

## Tech debt / defects found during work

### CI & lint
- 🟢 **Lint debt CLEARED — 328 → 0. CI lint gate is GREEN** (`npm run lint`
  exits 0). Fixed properly in batches, no blanket suppressions. All four gates
  pass: lint 0 · typecheck 0 · 63 tests · build ✓. What was done:
  - 🟢 `no-explicit-any` (196→0) — `types/index.ts` timestamps use a shared
    `FirestoreTimestamp`/`Timestampish` type + `tsToDate`/`tsToMillis` helpers in
    `lib/utils`; services/components use real domain types; `catch` → `unknown` +
    `errorMessage`; API wrappers made generic over their context.
  - 🟢 `no-unused-vars` (94→0) — dead imports/vars removed; eslint config honours
    `^_` prefix for intentionally-unused args (`eslint.config.mjs`).
  - 🟢 `react-hooks/*` (28→0) — set-state-in-effect deferred via `queueMicrotask`
    / render-time adjust; hooks (useBeds/useTenants/useOwner/useAuth) fixed;
    `H` helper in AdminPgManage hoisted to module scope (static-components);
    IdleLogout ref writes moved into effects; admin `loadPlatformData` hoisted to
    a `useCallback` (use-before-declare + exhaustive-deps); scoped, justified
    disables only where re-running would change behavior.
  - 🟢 `no-unescaped-entities`, `no-img-element`, `no-location-assign-*`,
    `ban-ts-comment`: 0.
  - A handful of scoped `eslint-disable-next-line` remain ONLY where the rule
    would otherwise force a behavior change (mount-once effects, dynamic remote
    `<img>`), each with a one-line reason — these are intentional, not debt.

### Files already cleaned (0 lint problems)
- 🟢 `app/(owner)/dashboard/page.tsx` — fixed 10 errors + 6 warnings:
  7× `catch (e: any)` → `catch (e: unknown)` + new `errorMessage()` helper;
  `window as any` → narrowed `Window &` type; 2× `set-state-in-effect`
  (removed redundant `setRentError(false)`; deferred mount `reloadOwner` via
  `queueMicrotask`); removed 5 unused imports; justified `<img>` disable for
  B2 presigned proof screenshot.
- 🟢 `lib/utils.ts` — added `errorMessage(e: unknown, fallback)` helper.

---

## Adversarial review findings (post-fix audit) — all addressed
- 🟢 **C1 (CRITICAL regression):** rent records link to a RESIDENT
  (`${tenantId}_${period}`, store `tenantId`, NOT a reliable `bedId`). The #11
  fix keyed the record map by `bedId` → matched nothing → every occupied bed
  read "No bill" and Mark-Paid/partial/verify controls vanished. **Fixed**:
  resolve bed→record via `bed.tenantId` everywhere — `BedGrid`, `RoomCard`,
  `BedCard`, dashboard `activeRecord`, and also the pre-existing same-bug sites
  `StatsBar` + `WhatsAppReminderModal`. Test: `bedPeriodStatus.test.ts` (join-key).
- 🟢 **M1:** analytics degraded `defaulters`/`expenses` to 0 silently (looked
  "healthy"). **Fixed**: service returns `degraded:{aging?,expenses?}` (null
  sentinel distinguishes failure from genuine zero); page shows an inline amber
  warning.
- 🟢 **M2:** guest beds counted under the "Pending Rent" filter + stats. **Fixed**:
  guests excluded from rent paid/pending/verify in `BedGrid`, `StatsBar`,
  `WhatsAppReminderModal`.
- 🟢 **Bonus (money accuracy):** fallback `StatsBar` now sums the rent record's
  real `amountPaidPaise`/`amountDuePaise` (honouring partial payments + prorating)
  instead of a flat `bed.monthlyRent`, so collected/pending totals are correct
  even before the server summary lands.
- 🟢 **M3:** month picker capped at current but the "next" arrow allowed future
  months. **Fixed**: next arrow disabled at current period (matches picker `max`).
- 🟢 **M4:** support mobile height ignored the bottom safe-area inset. **Fixed**:
  `calc(... - env(safe-area-inset-bottom))`.
- ⚪ **C2 (accepted):** raw portal token now stored plaintext on the tenant doc
  and visible in owner/staff tenant DTOs. Confirmed NOT leaked to residents/public
  (resident/discover DTOs hand-omit it; `firestore.rules` restricts `tenants`
  reads to owner/staff/admin). Portal is still PIN+lockout gated. Accepted as the
  convenience-link trade-off, consistent with the existing staff `manage_tenants`
  role. Revisit only if staff should not see resident portal links.

## UI redesign v4 — "Lavender Glass 3D", strict match to the 4 reference screens (27 Nov 2026)
Supersedes the v3 notes below (v3 kept per-panel teal/indigo accents and only restyled
headline cards). Spec: `docs/design-system.md`.
- 🟢 **Reference assets** — the 3D icons (39) and scene illustrations (7) were extracted
  from `docs/screenshots/*.png` with transparent/feathered edges into `public/brand/`;
  logo redrawn as SVG (`components/brand/Logo.tsx`, `public/icon.svg`).
- 🟢 **One theme for Admin / Owner / Resident** — tokens sampled from the refs in
  `app/globals.css` (`@theme` + `@layer components`); Plus Jakarta Sans; slate/gray/amber
  scales remapped so legacy classes land on-palette; 1,247 hard-coded hex colours
  codemodded to tokens.
- 🟢 **Every screen restyled** — all owner pages + modals/wizard, admin console + login,
  resident home/tenancy/discover, token portal, auth, landing, legal, idle-logout; new
  styled `app/not-found.tsx` + `app/error.tsx` (error boundary reports via the client logger).
- 🟢 **Fixed: drawers/dialogs anchored to the content column** — the shell's
  `animate-fade-up` used fill-mode `both`, leaving `transform` on the wrapper, which made it
  the containing block for `position: fixed` children. Now `backwards` (globals.css).
  Verified: bed drawer stays on the viewport after scrolling 2,600px.
- 🟢 **Fixed: ProofUploader "Upload Different Screenshot" submitted the UTR claim form**
  (button had no `type`). Now `type="button"`.
- 🟢 **Fixed: admin resident table "Monthly Rent" never sorted** — column key `rent` is not
  a Tenant field; now `monthlyRent`.
- 🟢 **Fixed: DataTable mobile rows were `<button disabled>` wrapping links/buttons**
  (invalid nesting, swallowed taps) → `div role="button"` with keyboard support.
- ✅ Gates: typecheck 0 · lint 0 · 86 tests · build ✓. All 24 routes screenshotted at 390px
  (and key ones at 1280px) against a seeded emulator: no horizontal overflow, no console errors.

### Bugs found during the redesign QA (not UI — logged, not changed)
- 🔴 `/tenants` + bed drawer read `tenant.depositPaid`, server writes `depositPaidPaise` → deposits show ₹0.
- 🔴 `/billing` reads `profile.planTier`, server writes `plan` → a Pro owner shows "Free Plan · 30/20 beds".
- 🔴 `/admin` resident table shows `tenant.monthlyRent`, which tenant creation never writes → ₹0/month.
- 🔴 `lib/config.ts isConfigured()` returns false for project id `pgpass-demo`, so the documented
  emulator setup disables every client listener (use `demo-pgpass` locally).
- 🔴 Local emulator session writes fail with "Could not load the default credentials" because the
  Admin SDK uses `preferRest`; workaround: point `GOOGLE_APPLICATION_CREDENTIALS` at a dummy SA key.
- 🔴 RoomCard: guest beds fall through to the "Due" badge and show the WhatsApp reminder button.
- 🔴 Bed tiles/rows are click-only `div`s — not keyboard-operable.
- 🔴 BankCsvReconciler says "drop it here" but has no drag-and-drop handler.
- 🔴 WhatsAppReminderModal doesn't await `navigator.clipboard.writeText` (toast shows even on failure).
- ⚪ `PropertySetupWizard` accepts `onCancel` but never uses it; staff revoke + PG photo delete still use
  `window.confirm()` instead of `ConfirmDialog`.

## UI redesign v3 (superseded by v4 above — match design-ref screenshots: violet gradients, 3D depth, soft/clean)
- 🟢 **Design foundation** — `app/globals.css` v3 tokens: lavender canvas, violet
  accent, pastel tint palette, layered soft "3D" shadows, `.hero-gradient`,
  `.tint-card`, `.icon-chip`, bigger radii. Per-panel accents kept (owner violet /
  resident teal / admin indigo) over one shared canvas + depth.
- 🟢 **Reusable kit** — `components/ui/dashboard-kit.tsx`: `HeroHeader`, `StatTile`,
  `QuickActionGrid`, `DonutChart`, `SectionHeader`, `ActivityRow`. All panels draw
  from these so the look is consistent by construction.
- 🟢 **Owner dashboard** — gradient `HeroHeader` greeting band (full-bleed on
  mobile) + `StatsBar` rebuilt with a donut occupancy chart + pastel collected/
  pending `StatTile`s (replaces the old 4-bento/progress-bar layout).
- 🟢 **Resident home + admin dashboard** — gradient hero greeting; admin platform
  metrics now pastel `StatTile`s (violet/sky/mint/peach); amber→accent across admin.
- 🟢 **Shared primitives** — `card` (rounder, softer shadow), `input` (rounder,
  accent focus), `button` (already accent-pill) updated, so every page lifts.
- 🟢 **All panel pages refreshed** — owner (dashboard, billing, expenses, staff,
  settings, maintenance, guests, tenants, analytics, support), resident (home,
  tenancy, discover, login), admin, auth login, and the public landing. Brand
  amber → `var(--accent)` everywhere; genuine STATUS amber (due/pending/overdue/
  aging/ratings) deliberately kept. Done by parallel agents with status-amber
  guardrails; each verified tsc 0 + lint 0.
- 🟢 **Verified live** — set up `.env.development` + Firebase emulators (Auth/
  Firestore) + dev server; confirmed landing (violet) and admin login (indigo)
  render the new design correctly, per-panel theming works, no compile/runtime
  errors. Authenticated dashboard interiors need seeded data to screenshot — the
  user will do the final visual review with their own data.
- Final gate after redesign: **lint 0 · typecheck 0 · 63 tests · build ✓.**

### Responsive recheck (mobile + tablet + desktop)
- 🟢 **Fixed:** owner dashboard hero had `lg:-mx-8` which re-broke it out of the
  layout past the `md:mx-0` reset → removed, so it's full-bleed on mobile only
  and inline on the md+ sidebar layout.
- 🟢 **Fixed:** resident home hero reset at `md` but the resident layout is a
  phone-column at every width → now `-mx-4 -mt-3` (full-bleed across breakpoints).
- 🟢 **Fixed:** StatsBar donut sized down to 112px + `shrink-0` so the Overview
  card doesn't squeeze the info column on 320px screens.
- 🟢 **Verified no horizontal overflow at 320px** (landing + login): docW==winW,
  zero over-wide elements. Desktop (1280) landing + split-panel login look correct.
- 🟢 Grids are responsive: admin StatTiles `grid-cols-2 sm:grid-cols-4`; StatsBar
  tiles `grid-cols-2`; quick-actions `grid-cols-3`; bed-grid filter bar keeps
  `overflow-x-auto`.
- ⚠️ **Authenticated dashboard interiors (owner/resident/admin) not screenshotted**
  — the local Firestore emulator's gRPC transport won't load default credentials
  for the session-write path (a known emulator/`preferRest` quirk, NOT a prod bug;
  prod has real creds). Those pages compile/typecheck/lint clean and use the same
  responsive kit, but the user should eyeball them once logged in with real data.

## Architecture decisions — auth / deploy / admin tiers

**Context:** requirement is — shared login for Owner/Staff/Resident, separate Admin
login+URL; one super-admin plus multiple sub-admins whose access is managed by the
super-admin; ONE backend for mobile/website/admin.

- ✅ **Shared login, role-based (keep as-is):** one Firebase Auth project + one
  `app/api/**` backend. Entry points stay split: `/login` (owner+staff),
  `/resident/login` (residents), `/admin` (admins). Role resolved server-side from
  custom claims. Do NOT fork auth or backend. Mobile is the PWA of the same app.
- 🟢 **Separate URLs = env-driven hostname routing (BUILT).** `proxy.ts`
  (Next 16 middleware) reads `ADMIN_HOST`:
  - On the admin host → rewrites `/` to `/admin` (URL bar stays clean, no `/admin`
    shown); `/admin` on the MAIN host redirects to `/login` (admin blocked there).
  - `ADMIN_HOST` UNSET → single-host path-based `/admin` (local dev + combined deploy).
  - **No custom domain yet (user is on *.vercel.app):** two ways to get a separate
    admin URL — (A) deploy the SAME repo as a 2nd Vercel project with
    `ADMIN_HOST=<that-project>.vercel.app` → its root opens admin login; or (B)
    keep `/admin` for now and set `ADMIN_HOST=admin.yourdomain.com` later (zero code
    change). Documented in `.env.production.example`.
- 🟢 **Root flow (BUILT):** first-ever visit to `/` → landing (+ sets `pgp_seen`
  cookie, 1yr); returning visitor → redirect to `/login` (which role-routes an
  existing session to the right dashboard). Verified live: 1st=200+cookie, 2nd=307→/login.
- 🟢 **Tiered admin permissions — BUILT.** Super admin (full access + the only
  one who manages admins) + staff admins scoped to granted permissions. Shipped:
  - `ADMIN_ROLE` (super/staff) + `ADMIN_PERMISSIONS` (platform.view, pg.manage,
    subscriptions.manage, support.manage, reviews.moderate, logs.view,
    admins.manage) in `lib/constants/permissions.ts`.
  - `admin_users` collection (server-only in `firestore.rules`) + entitlement
    reads/cache in `entitlements.ts` (`getAdminEntitlements`, `adminHasPermission`,
    `isSuperAdmin`). **Legacy `admin:true`-without-doc = super by default** (no
    existing admin loses access); bootstrap + claims route now write a `super` doc.
  - `withAuth({ adminPermission })` enforces per-route; suspended admins blocked;
    super bypasses. All 12 gates across 9 admin routes set (platform.view / pg.manage
    / subscriptions.manage / support.manage / reviews.moderate / logs.view).
  - `adminUsers.service.ts` + `/api/admin/admins` (+ `[adminUid]`): super-only
    create/list/set-permissions/suspend-reactivate. `/api/admin/me` returns the
    caller's tier+perms. Suspend drops the claim + revokes tokens immediately.
  - Admin console: tabs gated by permission; super-only **Admins** tab with the
    create-admin form + per-admin permission toggles + suspend/reactivate
    (`components/admin/AdminUsersPanel.tsx`). Admin tab accent fixed amber→indigo.
  - Gate: lint 0 · typecheck 0 · 63 tests · build ✓.
  - **Deploy note:** when subdomains go live, `admin.pgpass.com` serves this same
    `/admin` console from the one backend (see URL decision above).

## Blueprint roadmap progress (Phase 3 → 4 → 5, in order)
- 🟢 **Phase 3a — Notices (BUILT).** Owner publishes notices (audience all/
  residents/staff, pin, optional room scope, expiry) → `notices.service` +
  `/api/notices` (+`[id]`, + resident viewer route). Owner Notices page (new nav
  entry) + residents see notices on their tenancy page. Server-only Firestore
  rule + index added.
- 🟢 **Phase 3b — Owner Gmail OAuth + one-button auto rent reminders (BUILT).**
  Owner connects their OWN Gmail (OAuth `gmail.send`, no SDK — raw fetch); refresh
  token stored AES-256-GCM encrypted (`SECRETS_ENCRYPTION_KEY`). One dashboard
  button emails all unpaid residents' rent reminders directly from the owner's
  inbox (Gmail API) — no manual Gmail. Graceful: feature hidden unless
  `GOOGLE_CLIENT_ID/SECRET/SECRETS_ENCRYPTION_KEY` set; falls back to the WhatsApp
  flow; residents without an email are skipped + reported. Files:
  `gmail.service.ts`, `security/secrets.ts`, `/api/owners/gmail/*` (connect/
  callback/status/disconnect), `/api/rent/send-reminders`, `GmailConnectCard`
  (Settings), dashboard "Email from my Gmail" button. Env documented in
  `.env.production.example`. CSRF-protected OAuth (state cookie), invalid-grant →
  auto-disconnect + reconnect prompt.
  - **Owner setup (one-time, free):** Google Cloud → OAuth client (Web) + enable
    Gmail API + redirect URI `.../api/owners/gmail/callback`; set the 3 env vars.
- 🟢 **Phase 3c — staff tasks (BUILT).** Owner assigns tasks (optional assignee +
  due date); staff see tasks assigned to them or general; toggle done. `/tasks`
  page (shared nav, staff-visible). `tasks.service` + `/api/tasks` (+`[id]`).
  Reminder *scheduling* kept as the one-button Gmail send (user's explicit ask);
  full cron auto-send is a Phase-6 optional.
- 🟢 **Phase 4a — Reports + CSV exports (BUILT).** `/reports` page: monthly
  summary (residents/collected/pending/expenses/net) + CSV downloads (residents/
  rent/expenses). `reports.service` + `lib/server/export/csv.ts` with
  **formula-injection protection** (blueprint §14) + RFC-4180 escaping. Replaced
  the old UNSAFE client-side tenants CSV with the safe server endpoint. Test:
  `csvExport.test.ts` (4 tests).
- 🟢 **Phase 4b — Visitors log (BUILT).** Gate check-in/out, minimal data,
  "inside" count + one-tap checkout. `visitors.service` + `/api/visitors`
  (+`[id]/checkout`). `/visitors` page (staff-visible).
- ⚪ **Phase 4 remainder (deferred):** utility/electricity split + inventory/assets
  — lower value; deferred to prioritize Phase 5 hardening (P0-before-real-use).
- 🟡 **Phase 5 — hardening (STARTED).** Done so far:
  - **New security tests (+18):** `adminPermissions` (super/staff rule, admins.manage
    super-only, suspended blocked), `noticeVisibility` (cross-audience/room/expiry
    isolation), `secrets` (AES-GCM round-trip + tamper rejection), `csvExport`
    (injection safety). Total **81 unit tests**.
  - **Security self-review of all new routes:** every new API route has `withAuth`
    + ownerId scoping; services re-check `ownerId` on id-addressed mutations
    (notices/tasks/visitors). Gmail callback is state-cookie CSRF-protected.
  - 🟢 **Tenant-isolation integration tests (+5):** `tenantIsolation.test.ts` mocks
    `adminDb` and proves the service-layer `ownerId !== ownerId → 403` guards
    actually reject cross-tenant access (owner B can't delete owner A's notice,
    toggle their task, or check out their visitor; missing doc → 404). This tests
    the REAL enforcement (Admin SDK bypasses Firestore rules), not just the rules.
  - 🟢 **DPDP resident data-export (BUILT):** `GET /api/resident/export` returns
    ALL the resident's own data (profile + tenancies + rent/deposits/tickets) as a
    JSON download, strictly caller-scoped, rate-limited, no tokens/other-residents.
    "Download my data" button on the resident home (privacy control).
  - ⚪ **Firestore rules-unit tests BLOCKED:** `@firebase/rules-unit-testing@5`
    peer-requires `firebase@^12` but the app uses `firebase@13` → ERESOLVE. Not
    forced (would risk a broken dep). Isolation is instead covered by the
    service-layer integration tests above (the actual enforcement layer).
  - 🟢 **Restore procedure + RPO/RTO documented** in `docs/runbook.md` §3 (decrypt
    → separate project → import → verify → cut over; RPO≈24h, RTO≈hours). Flagged
    as not-yet-exercised end-to-end — must run on synthetic data before a real pilot.
  - Still TODO (needs user/infra): Playwright **E2E** golden paths; actually
    RUNNING the restore on live/synthetic data to confirm RTO.
- Gate after Phase 3+4+5-partial: lint 0 · typecheck 0 · **86 tests** · build ✓.
  New server-only Firestore rules + indexes for notices/staff_tasks/visitors.

## Follow-ups (explicitly deferred, not forgotten)
- 🔴 **#6 avatar image upload** — the top-bar profile currently shows initials
  (`Avatar name=...`). Owner also asked to upload a profile pic. Needs: a B2
  upload intent/confirm for an `owner_avatar` photo type + storing
  `avatarUrl` on the owner doc + rendering it in `Avatar`. Deferred to keep the
  layout change focused; no data model exists for it yet.

## Notes / decisions
- **Stack decision:** keep Next.js 16 + Firebase + B2 (production-grade, ₹0).
  `docs/product-blueprint.md` is treated as principles/scope/test-matrix, NOT a
  stack mandate (its Cloudflare/D1/Vite prescription does not override the working
  repo). Ground-truth stack doc: `docs/architecture-spec.md`.
- **Docs layout:** reference docs live under `docs/`; `README.md` and `AGENTS.md`
  stay in root. `AGENTS.md` MUST be in root — it's the agents.md convention AI
  tools auto-discover, and `next dev` re-creates a root `AGENTS.md` (its managed
  rules block), so keeping the full rules there avoids a split/duplicate file.
