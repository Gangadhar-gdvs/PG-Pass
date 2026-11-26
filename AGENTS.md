<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# PGPass — Agent Rules & Engineering Principles

**Mandatory reading for every AI agent / model and developer before changing code.**
PGPass is a mobile-first, multi-tenant PG/hostel management PWA for India that runs at **₹0**
on free tiers. Read this file first; it is the project baseline.

- **Stack (source of truth):** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 ·
  Firebase Auth · Cloud Firestore · Backblaze B2 · Zod.
- **Deep reference:** `docs/architecture-spec.md` (what exists today) and
  `docs/product-blueprint.md` (principles, scope, test matrix). The blueprint is
  **principles only** — it does NOT override this stack with its Cloudflare/D1/Vite prescription.
- **Open issue log:** `docs/ISSUES.md` — check it before starting; log every new bug you find.

---

## 1. Git Command Restriction
- **DO NOT run git commands** (`git add/commit/push/checkout/reset`, etc.) unless the user
  explicitly asks for a specific git command in their prompt. The repository owner manages git.

## 2. Direct Problem Solving — Lean, No Overengineering
- Pinpoint the exact root cause first, then apply the simplest correct fix.
- No redundant abstraction layers, no microservices, no speculative generality in the MVP.
- Keep communication concise — focused on the solution, no filler.

## 3. Human-Friendly User Error Messages
- End-users (owners, residents, staff) must **NEVER** see infra/developer errors they can't act on
  (e.g. "Enable in Firebase Console", stack traces, "missing service account").
- User-facing messages are polite, clear, actionable — e.g. *"Google sign-in is currently
  unavailable. Please sign in with email or contact the PG administrator."*

## 4. Centralized Logging & Admin Error Dashboard
- All technical errors, auth failures, API errors and exceptions are persisted to the
  `system_logs` Firestore collection (via `recordSystemLog` / `recordEvent`).
- They surface in the `/admin` Super Admin portal (code, stack, timestamp, route, requestId) so
  the owner can monitor and resolve issues. `withErrorHandler` already does this — don't bypass it.

---

## 5. Architecture Rules (non-negotiable)
- **Server is the only writer.** `firestore.rules` denies ALL client writes. The browser only
  *reads* (owner-scoped, real-time `onSnapshot`); every mutation goes through `app/api/**`.
- **Wrapper chain, in order:** `withErrorHandler( withAuth( withRateLimit( withValidation( handler ))))`.
  Cron routes use `withCronAuth`.
- **Services** (`lib/server/services/*`) hold business logic + transactions. They take plain args,
  return plain data, and **never** import `NextRequest`/`NextResponse`.
- **Server-only code** lives under `lib/server/` with `import 'server-only'`. No secrets in
  `NEXT_PUBLIC_*`. Admin is a Firebase custom claim (`{admin:true}`), verified server-side.
- **Never return raw DB rows** to clients — build explicit DTOs (especially on resident/public
  routes: never leak `token`, `upiId`, phone, email, or internal fields).

## 6. Data & Money Rules
- **Money is integer paise** (`amountPaise`), never floats. Display with `formatCurrency`.
- **Soft-delete** business data (`deletedAt`), never hard-delete financial/tenancy/audit history.
  Corrections are reversals/adjustments (append-only), never destructive edits.
- **Tenant isolation:** every query/mutation/export is scoped to `ownerId`, obtained from the
  authenticated session — never trust a client-supplied `ownerId`/`tenantId`/`propertyId`.
  Services re-check ownership on every id-addressed read/write.
- **Rent records link to a RESIDENT**, not a bed: doc id is `${tenantId}_${period}`, they store
  `tenantId` (not a reliable `bedId`). Resolve a bed's record via `bed.tenantId`.
- **Dates:** store `YYYY-MM-DD`; display DD/MM/YYYY (`formatDateIN`); rent period is `YYYY-MM`
  (`getCurrentPeriod`). Store UTC timestamps, display Asia/Kolkata. Handle month boundaries & leap years.
- New collection/field queried by more than `ownerId` equality → add a composite index to
  `firestore.indexes.json` AND a rule to `firestore.rules`.

## 7. Security & Privacy
- Deny by default. Role gate → single-active-session → per-staff `permission` → per-PG `feature`
  flag, all server-side in `withAuth`. ID guessing must never expose another tenant (test IDOR).
- Portal tokens: 256-bit, hashed at rest; last-4-phone PIN with lockout. Private photos use
  short-lived B2 presigned URLs + magic-byte + SHA-256 validation.
- No PII in logs/URLs/analytics/errors. Don't collect Aadhaar/PAN numbers (ID proof is a sighted
  *type* only). `.env` is git-ignored; `.env.example` has no real secrets.

## 8. Cost Policy (₹0 core)
- Core PGPass is free. **No payment gateway** in MVP — direct owner UPI (QR + copy), cash, bank
  transfer, recorded manually. A resident "payment submitted" is **unverified** until the owner confirms.
- Never add paid APIs/SMS/WhatsApp/email/maps/hosting without explicit user approval — not even
  trials needing a card. In-app notifications are the free default; external channels are optional,
  disabled-by-default adapters. If a free tier hits quota: degrade non-critical functions, warn
  admin, preserve data — never silently start paid billing.
- Free-plan limits (`lib/constants/limits.ts`): **20 beds / 40 photos / 0 staff**. Enforce server-side.

## 9. UI / UX
- **Mobile-first is a release blocker.** Design for low-end Android, 320–430px, slow networks,
  keyboard users. Touch targets ~44px.
- Every page handles: loading/skeleton, empty, error, offline, unauthorized, expired session.
  Preserve form input on safe retry; confirm destructive actions.
- Strong contrast; don't signal status by color alone; respect reduced-motion.
- Heavy client libs (`jspdf`, `qrcode`) must be dynamically imported at point of use.

## 10. Code Quality & Definition of Done
- **Strict TypeScript — avoid `any`.** For `catch`, use `catch (e: unknown)` + `errorMessage(e, fallback)`.
- Don't call setState synchronously in an effect body or read the clock (`Date.now()`/`new Date()`)
  during render — use lazy `useState` initializers, `useMemo`, or the "adjust state during render"
  pattern. Prefer deriving over syncing with effects.
- **A change is not done until** these pass — run them after every change:
  ```bash
  npm run typecheck   # tsc --noEmit
  npm run lint        # eslint  (keep files you touch at 0 new problems)
  npm test            # vitest
  npm run build       # next build
  ```
  Add tests for business rules and edge cases (normal, permission-denied, tenant-isolation,
  duplicate/retry, concurrency). Never claim a test passed unless you ran it and saw the result.
- Don't introduce new lint errors in files you edit. The project has pre-existing lint debt
  (tracked in `docs/ISSUES.md`) — a full sweep is deferred; don't make it worse.

## 11. Workflow for any task
1. **Explore** — inspect the relevant files, services, indexes, tests, and `docs/ISSUES.md`.
2. **Plan** — smallest complete vertical slice (DB → validation → service → API → UI → tests),
   with acceptance criteria, risks, and tests.
3. **Implement** — follow existing conventions; new mutation = service method + API route in the
   wrapper chain. Never write to Firestore from the browser.
4. **Validate** — typecheck, lint, test, build; review auth, tenant isolation, mobile, edge cases.
5. **Report** — files changed, commands run + results, residual risks, manual verification steps.
   Log any bug you find in `docs/ISSUES.md` — never leave it silently unfixed.

---

**The product must be dependable before it is beautiful, and useful before it is monetized.**
