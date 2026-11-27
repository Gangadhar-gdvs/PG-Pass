# PGPass — Full Exploration Findings (27 Nov 2026)

Direct exploration (no sub-agents) of every role, module, panel, workflow, and
UI/responsive surface, plus a dedicated sweep for the **"forever loading instead
of a proper error/screen"** class of bug.

Context: this is a mature codebase. `docs/ISSUES.md` already logs a large number
of fixed issues. This document records **NEW / still-open** findings only, so the
list is actionable rather than a re-statement of what's already green.

Status legend: 🔴 open · 🟡 needs decision · 🟢 verified-fine (noted for completeness)
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
  with a **Retry** button (`dashboard/page.tsx:611`) and distinguishes
  permission-denied (restricted staff) from outages. Good.
- 🟢 Most pages clear `setLoading(false)` in a `finally` block (safe).

### Still-open items in this class
(see section C for the itemised list)

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
- 🟢 **Tests:** `tests/unit/sharedHelpers.test.ts` (7). Gate: lint 0 · tsc 0 · 197 unit.

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
  contact), + `settings` (earlier). Gate: tsc 0 · lint 0 · 197 tests.
- ⚪ **Deliberately NOT changed (different semantics, would alter data/behaviour):**
  `tenants.service:107/148` + `staff.service:87` store FULL digits (then
  `phoneLast4`), not a 10-digit key; `security.ts`/`upi.ts`/`sms.service` do their
  own country-code-aware slicing; `TenantPortalView:222` is a 4-digit OTP slice.
  Note: tenant phone stores full digits while the resident LINK uses last-10 — a
  pre-existing inconsistency, logged here, left as-is to avoid changing matching.

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

### Remaining rollout (mechanical — not yet done)
- 🔴 Migrate the 105 raw `fetch('/api/…')` sites to `apiGet/apiPost/…` (incremental;
  both styles coexist safely).
- 🔴 Move the ~15 service-bypassing API routes onto their `*.service.ts`.

## C. "Forever loading" & silent-failure — still-open items

- 🔴 **P1 — ~10 owner pages silently swallow load failures (no error, no retry).**
  `tasks`, `expenses`, `notices`, `maintenance`, `staff`, `billing`, `reports`,
  `guests`, `settings`, `visitors` all follow the same shape:
  ```
  try { const res = await fetch(...); if (res.ok) setData(...) }
  catch { /* non-fatal */ }
  finally { setLoading(false) }
  ```
  On a 500 / network error / permission-denied the page does NOT spin forever
  (good — `finally` clears it) but it renders an **empty page with no message
  and no Retry** — the owner can't tell "nothing here" from "load failed."
  This is the inverse of the forever-loading bug and just as confusing.
  Evidence: `tasks/page.tsx:43-59`. Only `dashboard`, `analytics`, `utilities`,
  `profile`, `inventory` have a real error branch.
  **Fix:** a shared `useAsyncData(loader)` hook (see section D) returning
  `{data, loading, error, reload}` + a standard `<LoadError onRetry/>` block,
  adopted by all list pages. Fixes DRY + error UX in one change.

- 🔴 **P1 — Resident home hides server errors.** `resident/home/page.tsx:30-38`
  on a non-ok `/api/resident/me` sets `loading=false` with empty data and renders
  the "discover a PG" empty state. A resident WITH a tenancy who hits a transient
  500 is told (implicitly) they have no PG. No error, no retry. Add an error
  branch distinct from the genuine no-tenancy state.

- 🟡 **P2 — Verify every page's error branch has a Retry.** Dashboard does
  (`:619`). Confirm `analytics`, `utilities`, `inventory`, `profile`,
  `TenantPortalView`, `AdminSupportPanel` error states all offer a reload, not a
  dead-end message. (Spot-checked dashboard = good; others pending a read.)

## D. Code duplication / single-source-of-truth gaps (production-grade DRY)

- 🔴 **P1 — Hand-rolled data-loading in 14 files.** The identical
  `queueMicrotask(() => { if (active) load() })` mount + `setLoading` +
  swallowed-catch + `finally` block is copy-pasted across every owner list page,
  the resident tenancy page, `AdminUsersPanel`, and `GmailConnectCard`. No shared
  abstraction. **Fix: one `useAsyncData`/`useResource` hook** — change loading &
  error behaviour once, it reflects everywhere (exactly the "update in one place"
  goal). This is the highest-leverage refactor.

- 🔴 **P1 — Phone normalization `str.replace(/\D/g,'').slice(-10)` duplicated in
  ~19 files** (client + server) with no `normalizePhone()` / `toE164()` helper in
  `lib/utils`. Risk: one site strips differently → mismatched tenant lookups.
  Centralize into `lib/phone.ts` and import everywhere.

- 🔴 **P1 — Rent/guest/ticket status → {label,color} mapping inlined in ~10 UI
  files** (`BedCard`, `RoomCard`, `StatsBar`, `BedGrid`, `RentStatusCard`,
  `WhatsAppReminderModal`, admin, visitors, maintenance, utilities…). No shared
  `statusBadge(status)` / status token map. Risk: inconsistent colours and a
  label change requires editing 10 files. Centralize into a `statusMeta` map +
  `<StatusBadge>` component.

- 🟡 **P2 — Avatar/initials logic in several places.** There IS `components/ui/avatar.tsx`
  + `lib/utils` initials, but `OwnerShell`, `analytics`, `billing`, `admin` also
  compute initials inline. Route all through the `Avatar`/`initials()` helper.

- 🟢 **Already shared (good):** `getWhatsAppLink`, `errorMessage`/`apiErrorMessage`/
  `readApiError`, `copyText` (clipboard), `todayIST`/`currentPeriodIST`,
  `depositPaidRupees`, `ownerPlanTier`, CSV export, upload/`uploader.ts`. The team
  has been consolidating — these are the remaining gaps, not a greenfield.

## E. Other concrete bugs found

- 🔴 **P1 — Fake placeholder phone can be persisted.** `dashboard/page.tsx:640,673`
  pass `initialOwnerPhone={phoneNumber || '9876543210'}` into `PropertySetupWizard`,
  which writes it as the owner's phone (`PropertySetupWizard.tsx:465`
  `phone: initialOwnerPhone.replace(/\D/g,'').slice(-10)`). For an email-signup
  owner with no phone, the fake `9876543210` is saved — contradicting ISSUES.md's
  "nothing fake is ever persisted." **Fix:** pass `''` and make the wizard require
  a real phone (it already has `PhoneInput`); never default to a fake number.

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

**Gaps (the user is right to probe):**
- 🔴 **P1 — ~15 API routes bypass the service layer and hit `adminDb` directly:**
  `resident/me`, `resident/tenancy/[tenantId]`, `rent/[id]/claim`,
  `rent/send-reminders`, `portal/[token]/unlock`, `flags`, `health`, and most
  `admin/*` routes (`accounts`, `claims`, `features`, `manage`, `subscriptions`).
  This means the "update in one place" guarantee leaks — data logic for these
  lives in the route, not the module's service. **Fix:** move their Firestore
  reads/writes into the matching `*.service.ts` so every module's data logic has
  one home. (cron routes legitimately orchestrate across services — lower priority.)
- 🔴 **P1 — NO client-side API "middle" layer / interceptor.** There are **105
  raw `fetch('/api/...')` calls** across pages/components, each re-implementing
  headers, JSON parsing, and error handling. There's no `apiClient` with request/
  response interceptors (attach headers, normalize errors, handle 401→login,
  retry on token refresh). **Fix (started):** `hooks/useAsyncData.ts` adds
  `fetchJson()` — the seed of that layer (throws usable errors, flags 403). Next:
  promote it to `lib/client/api.ts` with `apiGet/apiPost/apiPatch/apiDelete`
  + a single place for auth-expiry handling, and migrate the 105 call sites.
- 🟡 **P2 — Client Firebase listeners are the intended exception.** `useBeds`/
  `useTenants` + support/admin panels use Firestore `onSnapshot` directly (real-
  time), which is correct — but that means two data paths (REST for mutations,
  Firestore listeners for reads). Keep, but document the boundary so it's a
  deliberate choice, not drift.

**Verdict:** the backend is genuinely well-structured by module; the two real
"single source of truth" gaps are (a) routes that skip their service, and (b) the
missing client API wrapper. Both are now logged with a concrete fix path.

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
