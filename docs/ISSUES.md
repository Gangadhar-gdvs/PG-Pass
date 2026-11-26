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
- 🔴 **CI lint gate is RED.** `npm run lint` exits 1 → the `Lint` step in
  `.github/workflows/ci.yml` fails on every push/PR. Pre-existing, not from
  current work.
- ⚪ **Project-wide lint debt: 335 problems (233 errors) across 87 files.**
  **Decision: deferred** — keep the active dashboard file clean, fix the rest in
  a dedicated later pass. Breakdown:
  - 196 `@typescript-eslint/no-explicit-any` (worst: `types/index.ts` with many
    `any` timestamp fields)
  - 94 `@typescript-eslint/no-unused-vars`
  - 22 `react-hooks/set-state-in-effect`
  - 6 `react/no-unescaped-entities`
  - 4 `react-hooks/exhaustive-deps`, 4 `@next/next`, misc react-hooks rules
  - Top files: `types/index.ts` (42e), `app/admin/page.tsx` (9e/14w),
    `components/admin/AdminPgManage.tsx` (11e), `discovery.service.ts` (11e),
    `beds.service.ts` (8e), `adminOverview.service.ts` (7e)
  - **When tackled:** `types/index.ts` `any` → `Timestamp | FieldValue` style
    types will clear the single biggest chunk; many are the `createdAt?: any`
    Firestore timestamp pattern.

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
