# PGPass — Full Exploration Findings (27 Nov 2026)

Direct exploration (no sub-agents) of every role, module, panel, workflow, and
UI/responsive surface, plus a dedicated sweep for the **"forever loading instead
of a proper error/screen"** class of bug.

Context: this is a mature codebase. `docs/ISSUES.md` already logs a large number
of fixed issues. This document recorded the NEW findings from a full exploration
and has since been worked to completion.

**STATUS (final): every actionable finding below is 🟢 DONE or ⚪ deliberately
deferred with a logged reason. Nothing is 🔴 open.** Gate at last update:
tsc 0 · lint 0 · 198 unit tests · build ✓. The only things left are external /
manual (a production-sized restore drill on real infra, and an on-device visual
eyeball of the UI changes) — neither is code-side.

Status legend: 🔴 open · 🟡 accepted-decision · 🟢 done / verified-fine · ⚪ deferred (reason logged)
Priority: P0 (broken/data) · P1 (bad UX) · P2 (polish) · P3 (nice-to-have)

---

## A. "Forever loading instead of error" — the architecture (mostly GOOD)

The team already engineered against this. Documented here so it's not re-audited:

- 🟢 **Owner & resident shells are SERVER-gated** (`app/(owner)/layout.tsx`,
  `app/(resident)/layout.tsx`). Session verified server-side before HTML — no
  client "Loading dashboard…" spinner at the shell level. Good.
- 🟢 **`useAuth`** clears `loading=false` in every branch incl. `catch` and a
  sync-throw `queueMicrotask`. Cannot hang.
- 🟢 **`useBeds` / `useTenants`** have a **12s first-load timeout** that forces
  `loading=false` + `error='timeout'` if no snapshot arrives, plus an error
  callback. This is the core "never spin forever" guard. Good.
- 🟢 **Dashboard** explicitly renders a "Couldn't load your dashboard" screen
  with a **Retry** button and distinguishes permission-denied (restricted staff)
  from outages. Good.
- 🟢 Most pages clear `setLoading(false)` in a `finally` block (safe).

### Status
All silent-failure / error-branch items in this class are now resolved —
see section C.

---

## B. What was BUILT this session (DRY refactors + client API layer)

- 🟢 **`lib/client/api.ts`** — client-side API "middle layer" / interceptor.
  `apiGet/apiPost/apiPatch/apiPut/apiDelete` + `addResponseInterceptor`. One place
  for headers, JSON, non-ok → usable error, 401 → `SessionExpiredError`, 403 →
  `PermissionDeniedError`.
- 🟢 **`hooks/useAsyncData.ts`** — shared loader returning `{data, loading, error,
  denied, reload}`. Fixes the silent-failure class: a failed load has a real error
  + retry, not a blank page. Guards stale/superseded loads + unmount.
- 🟢 **`lib/statusMeta.ts` + `components/ui/status-badge.tsx`** — single source of
  truth for `status → {variant,label}` (rent/bed/maintenance/guest/account/sub).
- 🟢 **`lib/utils.ts: normalizePhone()/toIndiaMsisdn()`** — one canonical phone
  normalizer; `getWhatsAppLink` uses it.
- 🟢 **`components/ui/load-error.tsx`** — shared `<LoadError onRetry>` + `<NoAccess>`.
- 🟢 **`app/(owner)/tasks/page.tsx`** — reference adoption (silent-failure fixed).
- 🟢 **Tests:** `tests/unit/sharedHelpers.test.ts` (7). Gate at this step: lint 0 ·
  tsc 0 · 197 unit (the suite later grew to 198 with the UTR regression test).

### Silent-failure rollout — DONE (11 pages)
- 🟢 All migrated to `useAsyncData`/`fetchJson` + `LoadError` (or an equivalent
  error state), so a failed load shows a message + Retry instead of a blank page:
  `tasks`, `expenses`, `notices`, `maintenance`, `guests`, `visitors`, `reports`,
  `staff`, `billing`, `settings`, and resident `home`. Optimistic mutations
  preserved via per-page overlays. Gate after each page: tsc 0 · lint 0.
- 🟢 Fake-phone onboarding bug fixed (`PropertySetupWizard` + dashboard).
- 🟢 `settings` phone read now uses `normalizePhone` (one duplicate removed).

### normalizePhone rollout — DONE (canonical last-10 key sites)
- 🟢 Replaced the 6 exact `replace(/\D/g,'').slice(-10)` sites with `normalizePhone`:
  `rent.service` (resident lookup), `visitors.service`, `guests.service`,
  `residents.service` (`cleanPhone` now delegates), `AddTenantModal` (emergency
  contact), + `settings` (earlier). Gate at this step: tsc 0 · lint 0 · 197 tests
  (later 198).
- 🟢 **FIXED (adversarial-audit follow-up): tenant.phone now stores the 10-digit key.**
  `tenants.service` previously stored FULL digits (`replace(/\D/g,'')`, no slice)
  while `resident.phone` stores last-10, and `myTenancies` matches them with an
  EXACT Firestore `where('phone','==',…)` — so a tenant entered with a country
  code (12 digits) would never match a 10-digit resident → the resident saw NONE
  of their tenancies. Now `tenant.phone = normalizePhone(input.phone)`. The normal
  UI already sent 10 digits (so no active bug), but this hardens non-UI/legacy/admin
  callers. `staff.service:87` left (staff aren't matched to resident accounts);
  `emergencyContactPhone` left full-digit (a dial-only field, not a lookup key).
- ⚪ **Deliberately NOT changed (different semantics):** `security.ts`/`upi.ts`/
  `sms.service` do their own country-code-aware slicing; `TenantPortalView:222` is a
  4-digit OTP slice.

### Adversarial re-audit of this session's work (hardening)
- 🟢 **401 handling was dead code → now wired.** `apiClient` defined
  `SessionExpiredError` + `addResponseInterceptor` but nothing used them, so an
  expired/revoked session only showed "session expired" toasts and left the user
  stuck. New `useSessionExpiryRedirect` (wired into Owner + Resident shells) reloads
  once on a 401 → the server-gated layout redirects to the correct role login.
  Guarded against loops (one-shot flag cleared on the next 2xx); 403 is NOT treated
  as expiry; `useAuth`'s session refresh stays raw `fetch` so there's no conflict.
- 🟢 **Phone input capped to 10 digits everywhere.** `CheckInGuestModal` + `visitors`
  used a raw `<Input type="tel">` with no cap (a user could type a country code /
  >10 digits); both now use the shared `PhoneInput` (strips to 10, fixed `+91`
  prefix). Storage stays 10-digit; `+91` is added only at point of use (WhatsApp/
  SMS/display) — matching the "enter 10, backend owns +91" model.
- 🟢 **Verified sound (no fix needed):** `useAsyncData` run-id guard prevents stale
  overwrites; optimistic overlays stay correct even when the post-mutation reload
  fails (deleted item stays hidden, only a server-computed total can briefly lag);
  the drawer/dialog focus trap is compatible with the portaled `Dropdown` (its
  options are arrow-navigated / `tabIndex=-1`, Tab closes it); bodyless `apiPost`
  (guest/visitor checkout) matches routes that don't read a body.

### StatusBadge adoption — DONE where it's a CLEAN refactor
- 🟢 **maintenance** — deleted the local `STATUS_META` map; ticket badge + step-
  tracker labels now come from `statusMeta('maintenance', …)` / `<StatusBadge>`.
  Shared map's maintenance variants were aligned to the existing palette (open =
  pending-amber, in_progress = verify) so there's NO visual change.
- 🟢 **staff** — account-status pill → `<StatusBadge domain="account">`.
- ⚪ **Deliberately NOT swapped (composite/derived — would risk regressions):**
  `BedCard`/`RoomCard`/`StatsBar`/`RentStatusCard` badges are a COMPUTED composite
  (bed.status + rentRecord.status + "no bill"), tint-coupled, and were the site of
  ISSUES.md's critical C1/M2 fixes — not a single-field status. `guests`/`visitors`
  use custom labels ("Staying"/"Left") with a `vacant` off-state. Admin status
  badges carry extra flags (`deleted`→"Revoked", `setupPending`). Left as-is;
  forcing them through StatusBadge would change labels/colours, not simplify.

### fetch → apiClient migration — DONE (110 → 27 calls)
- 🟢 All eligible `fetch('/api/…')` calls now go through `lib/client/api.ts`
  (`apiGet/apiPost/apiPatch/apiPut/apiDelete`) across ~30 files (owner/resident
  pages, dashboard, admin console + admin components, and the owner/tenant
  components). ~15 now-dead `readApiError`/`apiErrorMessage` imports removed.
- ⚪ The **27 remaining raw `fetch` calls are deliberately raw** (migrating would
  change behaviour): auth/session (login×2, useAuth, IdleLogout, admin+dashboard
  session POSTs — 409 SESSION_SUPERSEDED, no redirect-on-401); uploads
  (uploader, ownerAvatar — presigned PUTs); logger beacon; analytics (reads
  403 + FEATURE_DISABLED + requestId header); TenantPortalView (429 lockout);
  useOwner background reload; dashboard send-reminders (reads body code on
  non-ok); support/AdminSupportPanel markRead + WhatsAppReminderModal (best-effort).

### Service-layer refactor — DONE (6 routes + 2 bugs fixed)
- 🟢 Moved Firestore access out of routes into services: `resident/me` →
  `residentsService.myTenanciesEnriched()`; `rent/[id]/claim` →
  `rentService.claimPayment()`; `admin/features` → new `adminPgService`;
  `admin/manage` (updateOwner) → `ownersService.adminMergeUpdate()`;
  `admin/accounts` → new `adminAccountsService` (+ added the missing PATCH handler
  that the PG-panel suspend button needs); `admin/claims` →
  `adminUsersService.grantSuperAdmin()`. All 6 now 0 direct `adminDb`.
- 🟢 **Bug fixed: UTR lock never released on rejection** — claim locked under
  `hashUtr()` (SHA-256) but `rejectClaim` deleted a plaintext key → rejected
  claims stayed locked forever. Now both use `hashUtr`. Regression test in
  `tokens.test.ts`.
- 🟢 **Bug fixed: admin suspend-from-PG-panel was 405** — client PATCHed a route
  that had only POST with a different schema. Added the matching PATCH handler.
- ⚪ **Deliberately left route-level:** cron (metrics/cleanup/backup — cross-
  collection batch jobs), auth/session + health + flags (infra), and the already-
  thin portal/unlock, send-reminders, subscriptions, resident/tenancy routes.

## C. "Forever loading" & silent-failure — ALL RESOLVED

- 🟢 **~10 owner pages that silently swallowed load failures — FIXED.** `tasks`,
  `expenses`, `notices`, `maintenance`, `staff`, `billing`, `reports`, `guests`,
  `settings`, `visitors` previously rendered a blank page (no message, no retry)
  on a 500 / network / permission error. All now use `useAsyncData` + `LoadError`
  (or an equivalent error state) and show a message + Retry.

- 🟢 **Resident home hiding server errors — FIXED.** `resident/home` now
  distinguishes a real load error (error + Retry) from the genuine no-tenancy
  "discover a PG" empty state.

- 🟢 **Every error branch has a Retry — VERIFIED.** `dashboard`, `analytics`,
  `utilities`, `inventory`, `profile`, `staff`, `billing`, `settings` all offer a
  reload. The two without one are by-design: `TenantPortalView` has its own PIN-
  unlock error flow (incl. 429 lockout), and `AdminSupportPanel` is a chat where
  errors surface as per-message toasts.

## D. Code duplication / single-source-of-truth gaps — ALL RESOLVED

- 🟢 **Hand-rolled data-loading in 14 files — FIXED.** The copy-pasted
  `queueMicrotask(() => { if (active) load() })` + `setLoading` + swallowed-catch +
  `finally` block is replaced by the shared `useAsyncData` hook (change loading &
  error behaviour once → reflects everywhere).

- 🟢 **Phone normalization — FIXED.** `normalizePhone()`/`toIndiaMsisdn()` added to
  `lib/utils`; the 6 canonical last-10-digit sites now use it (rent/visitors/guests/
  residents services, AddTenantModal, settings). Country-code-aware and OTP sites
  are deliberately left (they have different semantics — see note below).

- 🟢 **Status → {label,color} mapping — FIXED where clean.** `lib/statusMeta.ts` +
  `<StatusBadge>` is the single source of truth; maintenance (deleted its local
  `STATUS_META`) and staff adopted it. The composite rent/bed badges
  (`BedCard`/`RoomCard`/`StatsBar`/`RentStatusCard`) are deliberately left — they're
  a computed composite and were the site of ISSUES.md's C1/M2 fixes (see note below).

- 🟢 **Avatar/initials — NON-ISSUE (verified).** The original finding was imprecise:
  the `charAt(0)`/`toUpperCase()`/`slice` hits in `OwnerShell`/`analytics`/`billing`/
  `admin` are for error labels, UTR normalization, plan names and PG-name truncation
  — NOT avatar initials. Avatar rendering already routes through `components/ui/avatar.tsx`.

- 🟢 **Already shared (good):** `getWhatsAppLink`, `errorMessage`/`apiErrorMessage`/
  `readApiError`, `copyText` (clipboard), `todayIST`/`currentPeriodIST`,
  `depositPaidRupees`, `ownerPlanTier`, CSV export, upload/`uploader.ts`, plus the
  new `apiClient` + `useAsyncData` + `statusMeta` + `normalizePhone` + `LoadError`.

## E. Other concrete bugs found — ALL FIXED

- 🟢 **Fake placeholder phone could be persisted — FIXED.** The onboarding wizard
  used to take `initialOwnerPhone={phoneNumber || '9876543210'}` and write the fake
  number as the owner's phone for email-signup owners. The wizard now has a required,
  pre-filled, editable `PhoneInput` (validated `^[6-9]\d{9}$` before submit) and the
  dashboard passes `''`, never a fake number. (Dashboard now has 0 occurrences of
  `9876543210`.)

- 🟢 **UTR lock never released on claim rejection — FIXED.** (Found during the
  service-layer refactor; see section B.) Claim locked under `hashUtr()` but reject
  deleted a plaintext key → rejected claims stayed locked forever. Both use `hashUtr`
  now; regression test in `tokens.test.ts`.

- 🟢 **Admin suspend-from-PG-panel returned 405 — FIXED.** (Section B.) The client
  PATCHed `/api/admin/accounts` which only had a POST with a different schema. Added
  the matching PATCH handler.

## G. Architecture: middle layer, interceptors, module organization

**Server side — GOOD, already layered:**
- 🟢 **Service "middle" layer exists:** `lib/server/services/*.service.ts` — 33
  services, one per module (beds, tenants, rent, expenses, …). Routes are meant
  to call services, services own Firestore access. This IS the middleware the
  user is asking about.
- 🟢 **Route "interceptors" exist:** `lib/server/api/` provides composable
  wrappers — `withAuth` (session verify + role/permission/feature gates, with a
  60s account-status cache), `withErrorHandler` (`{error,code,requestId}`),
  `withRateLimit`, `withValidation` (zod), `withCronAuth`. These are the
  equivalent of interceptors and are applied per route.

**Gaps found — BOTH RESOLVED:**
- 🟢 **Service-bypassing routes — FIXED (business/admin routes).** The 6
  business/admin routes that hit `adminDb` directly now delegate to services
  (`resident/me`, `rent/[id]/claim`, `admin/features`, `admin/manage`,
  `admin/accounts`, `admin/claims` — all 0 direct `adminDb`). Cron jobs + infra
  (session/health/flags) + already-thin routes are intentionally route-level.
  See section B "Service-layer refactor".
- 🟢 **Client-side API "middle" layer / interceptor — BUILT + ADOPTED.**
  `lib/client/api.ts` (`apiGet/apiPost/apiPatch/apiPut/apiDelete` +
  `addResponseInterceptor`, 401 → SessionExpired, 403 → PermissionDenied) is the
  single client→`/api` layer. The `fetch` migration took the call sites from 110
  → 27 (the 27 left are intentionally raw). See section B "fetch → apiClient".
- 🟡 **P2 (accepted, by-design) — two data paths.** `useBeds`/`useTenants` + support/
  admin panels use Firestore `onSnapshot` directly (real-time reads) while mutations
  go through the REST API. This is a deliberate choice (real-time where it matters),
  not drift — documented here so it stays intentional.

**Verdict:** the backend was already well-structured by module; the two real
"single source of truth" gaps (routes skipping their service, and the missing
client API wrapper) are now both closed.

## F. Visual / responsive audit — DONE
Worked each item by auditing the component source (static CSS review):
- 🟢 **z-index stacking** — documented the full scale as a comment block in
  `globals.css` (10→30→40→50→60/61→70→100→toast). Verified the order is sound:
  confirm-dialog (60) sits above drawers (50); toast (~9999) is intentionally
  always-on-top so action feedback is never hidden.
- 🟢 **Focus trap in drawers** — the Drawer docstring CLAIMED a focus trap but only
  did focus *entry*; Tab could escape to the page behind. Added a real Tab/Shift+Tab
  trap. `ConfirmDialog` had NO focus entry/trap/restore at all — added all three
  (it's an `alertdialog`, often destructive). `components/ui/drawer.tsx`,
  `components/ui/confirm-dialog.tsx`.
- 🟢 **Modal/drawer height on short landscape** — `ConfirmDialog` + `IdleLogout` had
  no max-height, so on a short landscape phone a dialog with a reason textarea could
  push its action buttons off-screen. Added `max-h-[calc(100dvh-1.5rem)]
  overflow-y-auto overflow-x-hidden`. Drawer already uses `dvh` + scrollable body.
- 🟢 **Admin bottom-nav overflow at narrow width** — the admin nav forced
  `min-w-[56px]` per tab; 4 side tabs + the centre FAB could exceed a 320px viewport.
  Changed to `min-w-0` (the `flex-1` button already gives the tap area) + truncating
  label. `app/admin/page.tsx`.
- 🟢 **Tablet (768px) data tables & bed grid** — verified fine: `DataTable` switches
  to a scrollable `<table>` at `sm`; the bed grid's `md:grid-cols-2` (fewer cols at
  `md` than `sm`) is INTENTIONAL — the sidebar appears at `md` and eats content width.
- 🟢 **`t/[token]` & `portal/[token]`** — both just render `TenantPortalView`, which
  is already well-built: `max-w-2xl` centred, `break-all`/`truncate`/`line-clamp` on
  all dynamic text, responsive stat tiles. No overflow. No change needed.
- 🟢 **reports/analytics chart overflow at 320px** — verified fine: the analytics bar
  chart is `flex-1 min-w-0` columns with `max-w-[18px]` bars + truncated labels; the
  StatsBar donut is `size={120}` + `shrink-0`. Both fit at 320px. No change needed.
- ✅ Gate: tsc 0 · lint 0 · 198 tests · build ✓.
