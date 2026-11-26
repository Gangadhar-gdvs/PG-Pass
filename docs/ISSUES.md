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

## UI redesign (in progress — match design-ref screenshots: violet gradients, 3D depth, soft/clean)
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
