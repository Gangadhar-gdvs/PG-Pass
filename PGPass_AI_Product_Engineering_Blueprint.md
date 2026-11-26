# PGPass — AI Agent Product & Engineering Blueprint

**Purpose:** Single source of truth for AI coding agents and developers building PGPass into a reliable, production-minded, mobile-first PG/hostel management platform for India.

**Document status:** Product baseline / implementation guide. Read this file before planning or changing code. Keep this document updated as decisions evolve.

**Core product promise:** PGPass helps PG/hostel owners manage properties, rooms, beds, residents, staff, rent, dues, expenses, utilities, maintenance, notices and day-to-day operations in one place—without forcing owners/residents to pay platform transaction fees.

**Primary constraint:** Build and operate with a ₹0 budget wherever possible. Use free/open-source tools and free-tier infrastructure, design for quotas and portability, and never silently introduce a paid service. Free tiers can change, pause projects, impose limits, or be unsuitable for production. No architecture can honestly promise permanent zero-cost hosting, backups, SMS, email, storage, or payment processing.

---

## 0. Instructions for AI Agents (Read First)

1. Read this document completely before coding. Inspect the existing repository before proposing or changing architecture.
2. Do not rewrite, delete, migrate, or replace working code/data without understanding it and creating a recovery plan.
3. Work in small vertical slices: database → validation → service/domain logic → API → UI → tests → docs.
4. Before each task, state: goal, files likely to change, acceptance criteria, risks, and tests. Then implement; do not stop at a plan unless asked.
5. Do not fabricate working functionality, fake analytics, pretend payment success, placeholder links that look real, or silently omit failed operations.
6. No TODO-only implementation for a feature marked P0/P1. If blocked, explain the blocker and provide the safest partial implementation.
7. Never add paid APIs, paid hosting, payment gateway fees, SMS/WhatsApp provider, premium package, or external service without explicit user approval. Avoid even trial plans that require payment details unless approved.
8. Do not store secrets in source code, commit `.env`, use real personal data in test fixtures, or expose secrets in logs.
9. Backend authorization is mandatory. UI hiding is not authorization. Enforce role, tenant, PG/property scope, record ownership and permission on every sensitive endpoint.
10. Never use hard delete for financial, tenancy, audit, payment, assignment, or other records needed for history. Prefer state transitions, archival, reversals and append-only audit events.
11. For money use integer paise (`amountPaise`) or integer rupees where the smallest unit is not needed. Never use floating-point arithmetic. Document rounding and currency.
12. Time handling: store UTC timestamps; display in `Asia/Kolkata`; store date-only values as date strings and do not convert them through timezone offsets.
13. Build for low-end Android phones, slow networks, keyboard-only users, small screens, and limited data. Mobile usability is a release blocker.
14. Never claim a test passed unless it was run and its result was observed. Separate implemented, tested, and verified status.
15. Run relevant tests, type checks, lint, and build after changes. Do not suppress errors merely to get a green build.
16. Avoid overengineering: no microservices, event-broker infrastructure, complex AI, or paid observability in the MVP. Keep modular boundaries so extraction is possible later.
17. Preserve backward compatibility when possible. Any schema/API breaking change requires migration, rollback plan, and tests.
18. If the user asks for a feature outside this scope, place it in `OPTIONAL / FUTURE` unless it is necessary for correctness, security, legal compliance, or core operation.

### Agent workflow

- **Explore:** inspect files, package versions, architecture, tests, git status, and relevant code.
- **Plan:** list the smallest complete implementation slice, assumptions, acceptance criteria, risks, and tests.
- **Implement:** change only relevant files; use existing conventions where sound.
- **Validate:** run tests, typecheck, lint, build, inspect logs and diff.
- **Review:** check auth, tenant isolation, data leakage, performance, accessibility, mobile UI, empty/error states, and edge cases.
- **Report:** summarize files changed, commands/results, remaining risks, and manual test steps.
- **Update docs:** record important decisions and changes in this file or linked project docs.

---

## 1. Product Principles

- PGPass is a **multi-tenant** system. One owner/organization cannot see or alter another tenant's data.
- **Mobile-first PWA** is the primary experience; desktop web is responsive and optimized for management tasks. Do not start with native Android/iOS apps.
- Keep the free core useful. Owners should not need a paid plan, gateway, subscription, or per-transaction charge to manage their PG.
- **Manual/offline-friendly payment tracking first:** Cash, direct UPI to the owner's UPI ID/QR, bank transfer. Gateway integration is optional and off by default. PGPass does not collect or route funds in the MVP.
- The system must work for one small PG and scale logically to multiple PGs/properties per owner.
- Simple language, local context (India), ₹ INR, Indian phone numbers, UPI references, GST fields only when applicable, and Asia/Kolkata timezone.
- Accessibility and clarity over decorative complexity. Soft elevation, gradients and animation are allowed but must not reduce contrast, speed or readability.
- Use progressive enhancement: essential workflows remain usable without animation, realtime, push notifications, or external integrations.
- User-entered financial values and tenant data must be treated as untrusted input.

## 2. Scope, Roles and Access Model

### 2.1 Roles

1. **Platform Super Admin:** PGPass platform-wide accounts, PGs, platform settings, abuse/security, support, and audit. Restricted staff roles may be added later.
2. **PG Owner:** manages their organization, PGs, finances, staff, residents, rooms, settings, and reports.
3. **PG Manager:** owner-configured operational role with scoped permissions; cannot automatically access owner-only finances or security settings.
4. **Staff:** permissions vary by job: reception, caretaker, maintenance technician, housekeeping, security, accountant/mess staff. Staff can be scoped to one or more PGs and tasks.
5. **Resident:** sees only their own profile, stay, invoices, payments, requests, notices, documents and permitted roommate details.

A user can hold multiple authorized role assignments (e.g., owner and resident) but must explicitly select/operate within a role context when ambiguity exists.

### 2.2 Permission rules

Implement permission-based authorization, not role-name checks scattered throughout code. Example permission keys:

- `pg.view`, `pg.create`, `pg.update`, `pg.archive`, `pg.settings.manage`
- `building.manage`, `floor.manage`, `room.view`, `room.manage`, `bed.manage`, `bed.assign`
- `resident.view`, `resident.create`, `resident.update`, `resident.archive`, `resident.checkin`, `resident.checkout`, `resident.documents.view`, `resident.documents.manage`
- `staff.view`, `staff.create`, `staff.update`, `staff.archive`, `staff.assign`, `staff.permissions.manage`
- `booking.view`, `booking.create`, `booking.approve`, `booking.cancel`
- `invoice.view`, `invoice.create`, `invoice.adjust`, `invoice.cancel`
- `payment.view`, `payment.record`, `payment.verify`, `payment.refund`, `payment.reconcile`
- `expense.view`, `expense.create`, `expense.approve`, `expense.export`
- `maintenance.view`, `maintenance.create`, `maintenance.assign`, `maintenance.update`, `maintenance.close`
- `notice.create`, `notice.publish`, `notice.archive`
- `visitor.view`, `visitor.create`, `visitor.checkout`
- `report.view`, `report.export`, `audit.view`

Owner controls which permissions a staff member gets, within a hard maximum. Staff cannot grant permissions beyond their own grant authority. Super Admin must not casually impersonate users; any support-access/impersonation feature must be time-bound, reason-required, visible/audited and preferably read-only by default.

### 2.3 Access matrix baseline

| Resource/action | Super Admin | Owner | Manager | Staff (scoped) | Resident |
|---|---|---|---|---|
| Platform settings | Full | No | No | No |
| Own PG settings | Support/controlled | Full | Explicit | No |
| PG/room/bed | Platform oversight | Own PG | Assigned PG | Own stay only |
| Resident records | Platform oversight, privacy-limited | Own PG | Minimum required | Own data |
| Identity documents | Restricted need-to-know | Owner | Explicit, minimal | Own docs |
| Staff & roles | Platform admins | Own PG | No role escalation | No |
| Rent invoices | Platform oversight | Own PG | Explicit | Own invoices |
| Payment record | Platform oversight | Own PG | Explicit | Own payment history |
| Delete/adjust payment | Audited/restricted | Reversal/adjustment flow | No | No |
| Maintenance | Platform support | Own PG | Assigned/authorized | Own tickets |
| Reports/export | Platform scope | Own PG | Limited | Own records |
| Audit log | Platform | Own PG, restricted | Own activity where needed | No |

---
## 3. Full Feature Scope by Panel

### 3.1 Super Admin

**Dashboard:** total/active/pending/suspended PGs, owners, residents, staff, new registrations, activity, support tickets, platform health, quota warnings (no fake metrics).

**PG management:** search/filter, create record when needed, verification queue, approve/reject with reason, view property/owner/rooms/beds/residents/staff at privacy-minimal level, status controls, suspension reason, reactivation, ownership change workflow, archived PGs.

**Accounts:** owners, staff and resident accounts; verification status; status; account recovery controls; support notes; duplicate account review; suspend/reactivate; deletion requests workflow. Never view password or secret credentials.

**Support:** ticket categories, ticket status, assignment, priority, reply history, attachments, SLA, escalation, resolution and feedback.

**Platform configuration:** brand/name/logo, legal pages, feature flags, safe global settings, maintenance banner, allowed upload types/limits, notification templates, admin role permissions.

**Security/audit:** admin users, roles, access history, failed login summary, sessions/revoke, audit search, security alerts, critical-action confirmation, export controls.

**Platform analytics:** aggregated registrations, activation, usage, PG growth, retention, feature usage, errors. Avoid inspecting tenant personal data without a support/legal need.

**Subscription/billing:** optional future module only. PGPass core must not depend on subscriptions or paid tiers.

### 3.2 Owner

**Dashboard:** properties, residents, rooms/beds, occupancy, vacant beds, check-ins/check-outs, expected rent, collected, outstanding, overdue, deposits held, expenses, maintenance, recent activity, upcoming reminders. Metrics must be derived from actual records and clearly define periods.

**Organization & property:** owner profile, organization, PG/property profile, property type (boys/girls/co-ed only as appropriate), address, map link (no paid map API required), contacts, photos, amenities, rules, facilities, food, check-in/out rules, property-specific configuration, property status.

**Building hierarchy:** optional buildings → floors → rooms → beds. Support a single building/floor setup without forcing complex hierarchy. Room capacity, sharing type, rent/pricing policy, facilities, gender/occupancy constraints where PG chooses, room/bed state, photos/notes.

**Bed inventory:** stable bed ID/label, room, current occupant, availability, blocked/reserved/maintenance state. Enforce no double assignment and capacity constraints.

**Resident lifecycle:** enquiries/leads (optional MVP), reservations (optional MVP), admission, profile, emergency contact, guardian contact, KYC/documents (minimal/optional according to owner policy and lawful need), joining, stay agreement, rent, deposit/advance, room/bed allocation, roommate info, transfers, renewal, leave/outing (optional), vacating notice, check-out, final settlement, deposit refund/adjustment, archive with history.

**Residents list:** active, upcoming, notice period, vacating, moved out; search/filter by PG, room, status, joining/due date; bulk actions must be safe and auditable.

**Billing:** configurable monthly rent, billing date, due date, grace days, prorated first/last month (configurable), discounts, other charges, late fee rules (opt-in and transparent), electricity/water/mess/laundry/custom charges, invoice items, invoice status, credit/adjustment notes, partial payments, receipts, reminders. Never automatically add undisclosed charges.

**Payment recording:** cash, direct UPI, bank transfer, other manual mode. Record amount, paid date, reference/UTR (optional), proof (optional), payer, recorded by, verification state. Direct QR/UPI should send money to owner/merchant directly; PGPass is not the intermediary. Payment must be manually verified by owner or trusted authorized staff in MVP. No fake auto-confirmation.

**Deposits & settlement:** security deposit, refundable advance, deposit ledger, deductions with reason/proof, final dues, refund status, settlement statement, resident acknowledgement (optional). Deposits are liabilities, not rent revenue.

**Finance:** income ledger, expenses (utilities, groceries, salaries, repairs, cleaning, rent/lease, internet, equipment, other), vendor, receipts, PG/property assignment, cashflow summary, outstanding dues, export. Do not label net cashflow as audited profit or GST accounting.

**Utilities:** utility bill periods, provider, meter readings, total bill, units, room/bed/resident allocation rules (equal, occupancy-days, custom), calculations visible, evidence upload, dispute/adjustment. Avoid hidden arbitrary splits.

**Maintenance:** tickets, categories, priority, requester, property/room/bed, description, photos, assignment, comments, status, timestamps, parts/cost, resolution, reopen, resident feedback. Ticket states: new → triage → assigned → in progress → waiting → resolved → closed; allow cancellation and reopen with history.

**Staff:** invite/create, phone/contact, role, assigned properties, shift, active/inactive, tasks, attendance/leave (optional), permissions, activity; revoke access promptly when employment ends.

**Tasks & inspections:** daily/recurring tasks, checklists, assignments, due date, completion, evidence, overdue, handover; housekeeping, water/electricity checks, room inspections.

**Visitor/security:** visitor name, purpose, resident, phone only if needed, entry/exit, approval, incident log. Collect minimal data; retention period configurable.

**Inventory/assets:** asset type, PG/room, quantity, purchase/condition/warranty, assigned to, maintenance, damage, missing, replacement, stock alerts. MVP can begin with room inventory checklist.

**Food/mess (optional after core):** menu, meals, timings, food plan, meal opt-out, attendance, grocery expense, feedback.

**Notices/reminders:** notice creation, audience (PG/room/residents/staff), publish/schedule, expiry, read status; rent reminders, maintenance alerts, renewals, agreement expiry, checkout reminders. In-app first; external messaging optional.

**Reports:** occupancy/vacancy, residents/stays, check-in/out, billing, collection, dues/aging, deposits, expenses, utility split, maintenance, staff/tasks, bookings, export. Reports must be scoped to the owner’s organization and property.

**Settings:** property, billing, payment methods, resident policies, notification preferences, staff roles, data export, security, account, privacy, support.

### 3.3 Staff

Staff UI must only show assigned properties and permitted tasks.

- Dashboard: assigned tasks, overdue, today check-in/out, assigned tickets, notice, shift summary.
- Resident lookup: minimum necessary fields; phone/documents hidden unless permission.
- Room/bed: availability, assignment/transfer only if authorized.
- Admission/check-in checklist: confirm identity if policy requires, assignment, keys/access, inventory, resident welcome and receipt.
- Checkout checklist: room inspection, inventory, pending dues indicator (not authority to waive/adjust), key return, issue report.
- Maintenance: assigned ticket queue, status updates, notes, parts/evidence, resolution.
- Housekeeping: recurring checklist, room/common area, completion evidence, overdue.
- Visitor log: check-in/out if assigned.
- Collection: only when permission; record cash/UPI reference and receipt; no deleting/adjusting ledger.
- Tasks, shift handover, attendance/leave (if enabled), notices, profile, emergency contact.
- No global owner dashboard, unrelated resident documents, full finance reports, staff role management, or permission elevation.

### 3.4 Resident

- Home: property, room/bed/sharing, rent status, next due date, current balance, active request, notices, reminders.
- Profile: contact info, emergency contact, editable fields with verification for sensitive changes, documents and privacy controls.
- Stay: PG info, location/map link, facilities/rules, room/bed, roommate details only as approved, agreement, check-in, stay history, room-transfer request, renewal, vacating notice, deposit status.
- Payments: bills/invoice breakdown, due date, amount paid/due, direct owner UPI instructions/QR, mark payment submitted with reference (clearly **pending owner verification**), history, receipts. Do not show gateway/transaction processing claims.
- Maintenance/complaints: category, issue, room/bed, text, photo, priority (resident-selected, owner triages), preferred time, status timeline, comments, reopen, feedback.
- Notices: property/targeted notices, read status, emergency messages, rules, outages.
- Requests: room change, renewal, vacating, visitor, laundry/cleaning (if enabled), leave/outing (if enabled), lost-and-found, help/support.
- Food/mess: menu, timings, plan, opt-out/feedback (if enabled).
- Notification preferences, password/session, privacy, account/data request, support, logout.

### 3.5 Public / marketing pages (lightweight)
Landing page, product overview, feature pages, FAQ, contact/support, privacy, terms, login/register. Avoid public resident data, publicly exposing PG listings unless owner opts in and separate marketplace scope is approved.

---
## 4. Must-Have Real-World Workflows

### 4.1 Create PG and configure inventory
1. Owner creates organization/account and verifies contact.
2. Create PG/property and required address/contact fields.
3. Create floors/rooms and room capacities.
4. Create bed records; choose sharing/rent policy.
5. Confirm bed availability is accurate before admission.
6. Add staff and permission scope as needed.

### 4.2 Resident admission/check-in
1. Create resident with required minimal data; avoid duplicate account/profile.
2. Create or confirm resident account/claim invitation.
3. Confirm stay start/end or expected duration, rent, deposit and transparent charges.
4. Assign one available bed atomically.
5. Create stay/assignment history.
6. Create deposit ledger entry and initial invoice as applicable.
7. Generate receipt/agreement or checklist.
8. Notify resident and owner/staff.
9. Record audit event.

### 4.3 Rent invoice generation
1. Scheduler or owner action selects billing period.
2. Identify eligible active stays and billing rules.
3. Calculate prorating/charges consistently.
4. Check unique invoice key for resident/stay/period to prevent duplicates.
5. Create invoice and item breakdown transactionally.
6. Notify resident in-app.
7. Retry notification safely without duplicate invoice.

### 4.4 Record direct payment
1. Resident sees invoice and owner's QR/UPI details; payment is made outside PGPass.
2. Resident may submit amount/reference/proof; status is **Submitted / Unverified**.
3. Owner or permitted staff checks bank/UPI received amount and confirms.
4. Create immutable payment record and allocation to invoice(s) in a DB transaction.
5. Update balances from ledger/allocation; do not overwrite invoice totals.
6. Generate receipt and notify resident.
7. Duplicate references and repeated confirmation requests must not double-count.

### 4.5 Partial / multiple payments
- One invoice can have multiple payment allocations.
- One payment may be allocated across invoices only if explicitly supported.
- Unallocated amount remains clearly visible as credit; never silently allocate.
- Paid status means balance is zero under currency rounding rules; partial status otherwise.
- Payment reversal/void is an append-only adjustment, never delete.

### 4.6 Room/bed transfer
1. Verify resident is active, target bed is available and permitted.
2. Lock/check current and target assignment in transaction.
3. Close old assignment and create new assignment at effective time.
4. Update current assignment without destroying history.
5. Handle rent/pricing change with effective date and explicit confirmation.
6. Recalculate only future or specified charges; do not silently rewrite issued invoices.
7. Notify resident, staff and owner; audit.

### 4.7 Maintenance request
1. Resident submits request; validate ownership/stay and upload.
2. Ticket receives unique ID, timestamps and initial status.
3. Owner/manager triages and assigns.
4. Staff updates status/comments/parts/evidence.
5. Resident receives status updates.
6. Resolution recorded; resident may confirm/rate/reopen.
7. SLA breach alerts/escalation are optional and based on configured rules.

### 4.8 Checkout and settlement
1. Resident requests vacating and notice date.
2. Owner approves/records actual checkout date.
3. Stop future rent generation for correct effective period.
4. Close bed assignment; bed becomes vacant only after inspection/availability decision.
5. Calculate rent, utility, approved charges, unpaid invoices, deposit, refunds/credits.
6. Show itemized settlement and reasons/evidence for deductions.
7. Record refund or amount owed; confirm no-dues only when reconciled.
8. Archive stay; preserve account, ledger, documents and history according to retention policy.

---
## 5. Architecture — Zero-Cost First, Portable, Modular Monolith

### 5.1 Architecture choice
Use a **modular monolith** with one frontend/PWA, one API and one relational database. Do not start with microservices, queues or separate databases per module.

**Preferred baseline (cost-conscious):**
- Frontend: React + TypeScript + Vite; mobile-first PWA, installable, static asset deployment.
- UI: Tailwind CSS; accessible component primitives (choose one maintained library, avoid multiple competing UI systems); Lucide icons.
- Server/API: Cloudflare Workers (TypeScript) using REST endpoints and runtime validation.
- Database: Cloudflare D1 (SQLite) with migrations and indexes; use a typed query layer such as Drizzle if it remains compatible and adds value. Design repositories to allow migration to PostgreSQL later.
- File storage: Cloudflare R2 only if its current free quota/terms fit; otherwise store no documents in DB and use a provider abstraction with a local/dev adapter. Verify current pricing before enabling.
- Realtime: initially polling or SSE for lightweight updates; avoid paid realtime. Use realtime only where it improves operations. Keep normal API reads reliable.
- Background jobs: scheduled Worker cron for invoices/reminders. Jobs must be idempotent and have run records. Use DB job/outbox table rather than adding a paid queue.
- Auth: secure cookie-based session if supported by chosen architecture; server-validated session, rotation, expiry, revocation. Use established libraries and secure settings; do not invent cryptography.
- Deployment: static frontend on Cloudflare Pages or Workers static assets; API on Workers. Keep build/deploy config versioned.
- CI: GitHub Actions free usage where available for lint, typecheck, unit tests, migrations checks and build. Free limits can change.

**Alternative database path:** If PostgreSQL features/complex transactions or team familiarity make D1 unsuitable, use Supabase Postgres free tier for development/early pilots. Its free project can pause after inactivity and has quotas; do not treat it as guaranteed production hosting or reliable backup. Evaluate a self-hosted Postgres/VPS only when there is budget and someone can maintain security, backups and uptime.

### 5.2 Cost policy
- ₹0 mandatory cost to PG owners/residents for core PGPass features.
- No platform payment processing in MVP. Direct UPI QR/UPI ID, cash, bank transfer are recorded manually.
- Do not charge users a “PGPass convenience fee” or add payment charges without explicit product decision and clear disclosure.
- Avoid paid SMS, WhatsApp Business API, email services, AI APIs, maps APIs, analytics, image processing APIs, or hosting plans in core workflows.
- In-app notifications are free by default. Email/SMS/WhatsApp can be optional provider adapters later; never make rent/payment status depend on a message delivery service.
- No mandatory subscription tiers, ads, or paywalls in core features. Future optional monetization must be approved and must not compromise resident data.
- Zero-cost UPI policy is not a legal guarantee: bank, merchant, app, payment-provider terms and current MDR rules may change. Do not promise all merchant UPI transactions are free. Owners must confirm their bank/merchant terms. PGPass does not provide tax/legal advice.
- GST is not a PGPass app fee. Do not evade taxes. Display GST only where applicable and configured/validated by the owner/accountant. The app must not automatically add GST without correct basis and approved configuration.
- If a free tier reaches quota, gracefully limit noncritical functions, notify admin, and preserve data. Never silently start paid billing.

### 5.3 Architecture diagram

```text
Mobile Browser / Desktop Browser / Installable PWA
                |
        React + TypeScript UI
                |
       API client (typed contracts)
                |
      Cloudflare Worker API
  Auth -> RBAC -> Tenant Scope -> Validation
                |
     Domain services / repositories
                |
     D1 SQLite relational database
      |          |          |
   Audit     Outbox/Jobs   File metadata
      |          |
Scheduled Worker / Cron -> invoices, due reminders, cleanup

Optional: R2 storage adapter, push/email provider adapter,
          future PostgreSQL migration, payment provider adapter
```

### 5.4 Rules for modular boundaries
- UI components must not query database or external provider directly.
- Route handlers must be thin: authenticate, validate, authorize, call service, serialize.
- Domain services own business rules and transactions.
- Repositories own database reads/writes; no SQL scattered in UI or route files.
- Shared schema validation is reused at request boundaries, but server must always validate.
- Use typed DTOs; never return database rows wholesale.
- Integrations must be adapters behind interfaces and disabled by default.
- Feature modules communicate through domain service calls or events, not circular imports.
- Keep core rent/payment/stay logic independent of the hosting provider.

---
## 6. Recommended Folder Structure

Use this structure as the baseline; adapt if the repository already has a sound layout. For a monorepo:

```text
pgpass/
├── apps/
│   ├── web/                         # React + Vite PWA
│   │   ├── public/                  # icons, manifest, static assets
│   │   ├── src/
│   │   │   ├── app/                 # routes, providers, app shell
│   │   │   ├── assets/
│   │   │   ├── components/          # reusable UI; no business logic
│   │   │   │   ├── ui/             # buttons, cards, inputs, sheets
│   │   │   │   ├── layout/        # nav, headers, mobile bottom bar
│   │   │   │   └── feedback/       # toast, empty, loading, error
│   │   │   ├── features/
│   │   │   │   ├── auth/
│   │   │   │   ├── admin/
│   │   │   │   ├── owner-dashboard/
│   │   │   │   ├── properties/
│   │   │   │   ├── rooms-beds/
│   │   │   │   ├── residents/
│   │   │   │   ├── staff/
│   │   │   │   ├── bookings/
│   │   │   │   ├── billing/
│   │   │   │   ├── payments/
│   │   │   │   ├── expenses/
│   │   │   │   ├── maintenance/
│   │   │   │   ├── utilities/
│   │   │   │   ├── notices/
│   │   │   │   ├── tasks/
│   │   │   │   ├── visitors/
│   │   │   │   ├── inventory/
│   │   │   │   ├── mess/
│   │   │   │   ├── reports/
│   │   │   │   └── settings/
│   │   │   ├── hooks/
│   │   │   ├── lib/                  # client utilities, formatters
│   │   │   ├── api/                 # API client only
│   │   │   ├── state/               # minimal client state
│   │   │   ├── styles/
│   │   │   └── types/
│   │   └── tests/                   # UI/component tests
│   └── api/                          # Cloudflare Worker API
│       ├── src/
│       │   ├── index.ts               # entry/router
│       │   ├── middleware/            # auth, tenant, rate-limit, errors
│       │   ├── modules/
│       │   │   ├── auth/
│       │   │   ├── admin/
│       │   │   ├── organizations/
│       │   │   ├── properties/
│       │   │   ├── rooms/
│       │   │   ├── beds/
│       │   │   ├── residents/
│       │   │   ├── stays/
│       │   │   ├── staff/
│       │   │   ├── bookings/
│       │   │   ├── invoices/
│       │   │   ├── payments/
│       │   │   ├── deposits/
│       │   │   ├── expenses/
│       │   │   ├── utilities/
│       │   │   ├── maintenance/
│       │   │   ├── notices/
│       │   │   ├── tasks/
│       │   │   ├── visitors/
│       │   │   ├── inventory/
│       │   │   ├── reports/
│       │   │   ├── notifications/
│       │   │   └── audit/
│       │   ├── services/               # cross-module orchestration
│       │   ├── repositories/           # DB access
│       │   ├── db/
│       │   │   ├── schema/
│       │   │   ├── migrations/
│       │   │   ├── seed/
│       │   │   └── connection.ts
│       │   ├── jobs/                  # scheduled jobs and handlers
│       │   ├── adapters/              # storage, notifications, payments
│       │   ├── validation/
│       │   ├── errors/
│       │   ├── utils/
│       │   └── tests/
├── packages/
│   ├── contracts/                     # DTOs, API types, shared validators
│   ├── domain/                         # money, statuses, business rules
│   ├── config/                         # shared config/schema
│   └── eslint-config/ (optional)
├── docs/
│   ├── architecture.md
│   ├── decisions/                      # ADRs
│   ├── data-model.md
│   ├── api.md
│   ├── security.md
│   ├── workflows.md
│   ├── testing.md
│   └── deployment.md
├── scripts/
├── .github/workflows/
├── .env.example                         # keys only, fake values
├── .gitignore
├── package.json
├── pnpm-workspace.yaml
└── README.md
```

**Module file pattern:**

```text
feature/
├── routes.ts             # endpoints only
├── schemas.ts            # input validation
├── service.ts            # business logic
├── repository.ts          # persistence queries
├── types.ts              # module types
├── permissions.ts         # permissions/constants
└── tests/
    ├── service.test.ts
    ├── api.test.ts
    └── edge-cases.test.ts
```

Do not create a file for every tiny function. Keep modules cohesive and avoid giant files.

---
## 7. Data Model & Database Rules

### 7.1 Core tables/entities

- `users`, `user_profiles`, `sessions`, `login_events`
- `organizations`, `organization_members`, `role_assignments`, `roles`, `permissions`
- `properties`, `buildings`, `floors`, `rooms`, `beds`, `room_types`, `sharing_types`, `amenities`
- `residents`, `resident_documents`, `resident_emergency_contacts`
- `stays`, `bed_assignments`, `room_transfer_history`, `checkout_records`
- `staff_profiles`, `staff_property_assignments`, `staff_attendance`, `staff_leave`
- `enquiries`, `bookings`, `booking_deposits` (when booking module enabled)
- `billing_rules`, `invoices`, `invoice_items`, `payment_records`, `payment_allocations`, `payment_submissions`, `refunds`, `deposit_ledger`, `resident_ledger_entries`
- `expenses`, `vendors`, `utility_bills`, `meter_readings`, `utility_allocations`
- `maintenance_tickets`, `ticket_comments`, `ticket_attachments`, `maintenance_parts`, `maintenance_costs`
- `tasks`, `task_assignments`, `checklists`, `checklist_runs`, `inspections`
- `visitors`, `visitor_logs`, `incidents`
- `assets`, `inventory_items`, `inventory_movements`
- `notices`, `notice_audience`, `notice_reads`, `notifications`, `notification_preferences`, `reminders`
- `support_tickets`, `support_messages`
- `audit_logs`, `activity_events`, `outbox_events`, `scheduled_job_runs`, `system_settings`, `feature_flags`

Avoid creating every optional table in the first migration. Start with the core modules and add migrations as features are implemented.

### 7.2 Data invariants

- All tenant-owned records have organization/tenant ID and property scope where appropriate.
- Server obtains tenant scope from authenticated membership, not user-submitted `tenantId` alone.
- Tenant scope is applied to every query, join, mutation, export, attachment lookup and realtime subscription.
- Unique constraints enforce no duplicate active bed assignment, invoice-period duplicate, duplicate payment reference where appropriate, and unique user identifiers.
- Foreign keys enabled and used. Cascading deletion must be carefully avoided for ledgers/history.
- Index frequently filtered fields: tenant, property, status, resident, room, bed, due date, created/updated date.
- Prefer normalized core data. JSON columns only for flexible metadata—not core billing, status, permissions, or relationships.
- Use migration files; never edit an already applied migration in place.
- Every migration must be tested against an empty DB and a representative prior schema.
- Record created/updated timestamps and actor where relevant; use consistent IDs (UUID/ULID) and documented format.
- Soft-delete/archive only where restore/history requirements exist; prevent archived entities from being used in new active operations.
- Use transaction for multi-step critical operations; if runtime limitations exist, design atomic operation and verify behavior.

### 7.3 Ledger model

Maintain traceable invoices, invoice line items, payments, allocations and adjustments. A payment is not the same as invoice balance. Invoice balance is derived from issued invoice total, allocations and valid adjustments. Deposits must be tracked separately from rent income. Payment corrections must be reversible and auditable. Avoid duplicating a balance in multiple places unless a carefully maintained materialized summary is needed.

### 7.4 Time and period edge cases

- Billing period start/end, due dates, checkout dates and stay dates are date-only where appropriate.
- Use India timezone for scheduled jobs and user-facing dates.
- Handle month boundaries (Jan 31 → Feb), leap years, daylight saving irrelevant for India but UTC storage still applies.
- Avoid date comparisons that accidentally include/exclude checkout day; document inclusive/exclusive policy.
- Define prorating formula and rounding rules, and test them.

---
## 8. API & Backend Rules

- REST API with version prefix `/api/v1`.
- Use consistent response/error format and HTTP status codes.
- Validate path, query, body, headers and files server-side.
- Use DTOs; never return raw database objects or internal columns.
- Use pagination on lists (cursor-based preferred for large lists; stable sort required).
- Add search/filter limits and allow-listed sort fields.
- Do not accept arbitrary SQL sort strings or unbounded page size.
- Mutations should support idempotency where duplicate requests can cause harm (payments, invoice generation, bed assignment, booking).
- Use optimistic concurrency/version field for high-conflict updates where useful.
- Rate limit login, OTP, document access, exports and expensive search.
- API error codes must be stable and human-readable; avoid leaking stack traces, SQL or secrets.
- API docs/OpenAPI should be generated or maintained; update with every endpoint.
- Health endpoints: liveness and readiness; readiness checks DB availability but must not leak secrets.
- Avoid N+1 query patterns. Select only fields required; use batched queries/joins.
- Add request ID/correlation ID for support/debugging, but avoid storing sensitive request bodies.
- Use idempotency key or unique constraints for retryable operations.

### API response envelope (example)

```json
{
  "data": {},
  "meta": { "requestId": "..." },
  "error": null
}
```

Error example:

```json
{
  "data": null,
  "meta": { "requestId": "..." },
  "error": { "code": "BED_ALREADY_OCCUPIED", "message": "This bed is no longer available." }
}
```
Do not expose sensitive internals in error messages. Return field-level validation errors when safe.

---
## 9. Security Rules (Production Gate)

### Authentication
- Use a maintained password hashing algorithm/library (Argon2id preferred if supported; otherwise a well-reviewed alternative).
- Never store plaintext passwords, OTPs, reset tokens or reusable secrets.
- OTP/reset tokens are random, short-lived, single-use, rate-limited and stored hashed where feasible.
- Secure, HttpOnly, SameSite cookies; use Secure in production; avoid localStorage for session secrets.
- Rotate/revoke sessions on password change, account suspension, logout and suspected compromise.
- Require re-authentication for sensitive actions.
- Lockout/rate-limit with safe anti-enumeration behavior; do not reveal whether a phone/email exists.

### Authorization / multi-tenancy
- Deny by default.
- Check permissions on every request and on every object; ID guessing must never expose another tenant.
- Verify organization membership and property scope server-side.
- Validate actor, record, target tenant and permitted transition before mutation.
- Residents may access only their own active/archived records according to retention policy.
- Staff scope to assigned PG(s), permissions and minimum necessary data.
- Super Admin access to tenant data is audited and privacy-minimized.
- Test cross-tenant access on every module.

### Input/output security
- Schema validation, max lengths, enum validation, normalization and allow-lists.
- Escape output; use safe rendering; never trust user HTML.
- Prevent SQL injection using parameterized queries.
- Upload allow-list (content type AND file signature), size limit, generated file names, no executable files, safe download headers, private storage and access checks.
- Protect against SSRF if URLs are fetched; preferably do not fetch arbitrary user URLs.
- Avoid exposing IDs/documents/phone numbers in logs, analytics or URLs where possible.
- Never include personal data in public search or error responses.

### Operational security
- `.env` is ignored; `.env.example` has no real secrets.
- Production secrets are managed by platform secrets, not plain config.
- CORS is restrictive; only approved origins.
- CSRF defense for cookie-authenticated state-changing endpoints.
- Security headers: CSP, frame protection, content type protection, referrer policy, appropriate permissions policy.
- Rate limit and abuse controls.
- Dependency pinning/lockfile; review security advisories.
- Backups encrypted where supported; test restoration.
- Audit security-critical actions: role change, account suspend, payment verify/adjust, invoice edit/cancel, bed transfer, document access, exports, property ownership change.
- Audit logs are append-only for app users; do not let tenant admins erase them.
- Avoid overly detailed errors, secrets, access tokens, document contents, OTPs, bank details in logs.
- Have incident response steps: contain, revoke sessions, preserve logs, notify affected parties as required, recover, review.

### Privacy
- Purpose limitation, data minimization, transparent notices, access/correction/deletion workflows, retention schedule and secure disposal.
- Collect ID/KYC only when necessary and lawful; don't make full document upload mandatory without justification.
- Restrict identity documents and emergency contacts.
- Do not expose roommate phone numbers, private payment records or complaint details by default.
- Allow data export/request deletion while preserving legally required accounting/operational records.
- Review current Indian DPDP Act and Rules applicability/commencement, notices, consent/other lawful basis, breach response and retention with qualified counsel before launch. This blueprint is not legal advice.

---
## 10. Mobile-First UI/UX & Accessibility

### Priority order
1. Android mobile web/PWA, common screen widths 320–430 CSS px, low-end hardware.
2. Tablet responsive layout.
3. Desktop web dashboard for owners/admins with tables and bulk operations.
4. Native Android/iOS apps only if future requirements justify separate maintenance.

### Design system
- Soft premium visual language: warm neutral background, subtle lavender/blue/teal gradients, card elevation, restrained blur, rounded corners; no excessive glass effects.
- Strong text contrast, legible font sizes, clear hierarchy, avoid tiny labels.
- Design tokens for color, spacing, radius, shadows, typography, motion.
- Semantic HTML and accessible labels; keyboard focus; screen-reader support.
- Do not use color alone to communicate status.
- Reduce/disable animation for reduced-motion setting.
- Touch controls target approximately 44×44 CSS px where practical.
- Sticky bottom navigation on mobile; center quick action only if it is useful, never obstruct forms.
- Owner bottom nav: Home, PGs, Add, Finance, More (adapt to role and screen).
- Resident bottom nav: Home, Payments, Request, Notices, Profile.
- Staff bottom nav: Home, Tasks, Requests, PG/Rooms, Profile (permissions may alter tabs).
- Admin mobile nav: Home, PGs, Users, Activity, More; use drawer/bottom sheet for secondary modules.
- Desktop: sidebar, header, breadcrumbs, search, filterable tables, keyboard-accessible menus.
- Avoid huge dashboard charts; prioritize action items and summary numbers.

### UX states on every page
Loading/skeleton, empty, success, error, offline, unauthorized, expired session, no search results, partial failure, retry. Forms preserve user input when a safe retry is possible. Confirm destructive/irreversible actions and explain consequences.

### Performance targets (budget goals; measure on representative low-end Android)
- Initial route should render quickly with minimal JS; aim for a small initial bundle (document and monitor; do not chase arbitrary numbers at cost of function).
- Use route/module code splitting, lazy-load charts and non-core screens.
- Avoid heavy animation, giant libraries, excessive DOM, background polling on inactive screens.
- Images: resize/compress, WebP/AVIF where supported, lazy-load, responsive sizes; do not upload original huge images by default.
- API: indexes, pagination, bounded queries, selected columns, caching safe non-sensitive data.
- Debounce search; cancel stale requests; avoid duplicate fetches.
- Offline: PWA shell and safe read-only cached pages where feasible; do not cache sensitive resident documents, payment pages or privileged responses without explicit secure design. Queue offline mutations only if conflict/retry semantics are safe; show pending state clearly.
- Avoid rendering full resident lists; virtualize large lists if measured necessary.
- Test with throttled network, low CPU, small viewport and reduced memory.

---
## 11. Cost & Payments Policy (India, PG Owners)

### MVP payment philosophy
- PGPass core is free to use.
- Do not integrate a payment gateway initially.
- Owner can display their own UPI ID and/or static QR code (owner-supplied, validated/previewed; not dynamically generated through a paid provider).
- Resident pays directly to owner through their UPI app/bank. PGPass records payment only after owner verification.
- Cash/bank transfer are supported as manual payment modes.
- Resident's “payment submitted” action must not mark invoice paid. It creates an unverified submission; owner verifies receipt and confirms.
- Payment reference/UTR is optional but useful; avoid duplicate reference/amount/date checks and manual confirmation safeguards.
- PGPass does not custody, route, escrow or settle money in MVP.
- Payment gateway is an optional future adapter; compare current merchant charges, taxes on service fees, settlement, refunds, webhook support and terms before implementation. Never promise zero gateway fees.
- UPI merchant rules can change. Do not present P2P UPI as a substitute for permitted merchant collection or encourage misclassification. Owners should confirm bank/payment app merchant terms and current rules.
- GST is a tax/legal question, not a platform transaction surcharge. Do not add arbitrary GST line items or help evade taxes. Provide configurable invoice fields only where applicable and advise owner to verify with an accountant.

### Manual payment states
`submitted_by_resident → awaiting_verification → verified/allocated`
Alternative: `rejected` (reason required) / `duplicate` / `cancelled`.
Payment ledger state must not be altered by resident.

### Free-tier operation policy
- Establish usage/quota monitoring and data export before pilot.
- Avoid storing high-resolution images/video by default.
- Add per-tenant limits only when needed for abuse/quotas; limits must be transparent and not create paid lock-in.
- If provider limits are reached, stop/queue non-critical jobs, warn admins, and allow export; do not silently bill.
- Free infrastructure is suitable for development/early pilot only after its limits, backup, inactivity behavior and privacy suitability are verified. A real business needs an uptime and backup plan.

---
## 12. Notifications & Scheduled Jobs

### In-app first
- Rent due/overdue; invoice issued; payment submitted/verified/rejected; receipt.
- Maintenance created/assigned/updated/resolved.
- Check-in/check-out/room transfer.
- Notice published.
- Staff task assigned/overdue.
- Booking/reservation update if enabled.
- Deposit/final settlement update.

### Optional providers (later, disabled by default)
Email, SMS, WhatsApp Business, push notifications. Must use adapters; no core workflow depends on provider delivery.

### Scheduled jobs
- Generate invoices once per resident/stay/billing period.
- Due reminders according to configurable schedule.
- Overdue state calculation.
- Agreement/renewal/checkout reminders.
- Maintenance/task escalation (optional).
- Retry notification delivery safely.
- Cleanup expired OTPs/session tokens/temp files.
- Backup/export health checks if provider allows.

**Job rules:** idempotency keys, DB uniqueness, run status, start/end, errors, bounded retries, exponential backoff, dead-letter/error record, alert on repeated failure. Do not use a job's success as proof that a payment was received.

---
## 13. Audit, Logging, Monitoring & Backup

### Audit events
Record actor, tenant/property, action, entity type/id, timestamp, request/correlation ID, and sanitized before/after or diff for critical actions. Do not log secrets or full personal documents.

Audit critical events include:
- Login/logout/security changes (avoid token content)
- Role/permission grant/revoke
- Owner/property creation, transfer, suspension
- Resident admission, check-in, transfer, checkout, archive
- Bed assignment/unassignment
- Invoice issue/adjust/cancel
- Payment submit/verify/reject/reverse/refund
- Deposit/settlement changes
- Staff access changes
- Document upload/download (metadata only)
- Export
- Admin access/impersonation

### Monitoring
- Error rate and API failures
- DB failures and latency
- Job failures/retries
- Storage quota/usage
- Rate-limit events
- Login anomalies
- Health/readiness
- Deploy version

Do not introduce a paid monitoring service in MVP. Start with structured logs, health endpoints, provider dashboard, and free-tier monitoring only after terms/limits are checked.

### Backup/recovery
- Establish scheduled export/backup appropriate to the database provider.
- Keep at least one backup independent of the primary provider when feasible and free; if not, explicitly disclose the limitation.
- Test restore to a separate environment, not just backup creation.
- Document recovery point objective (RPO) and recovery time objective (RTO) for pilot.
- Never claim production-safe backups until restore has been tested.
- Export tenant data to CSV/JSON and attachments manifest; support owner-requested export where privacy rules allow.

---
## 14. Test Strategy — Required Layers

Use automated tests wherever possible. Suggested stack: Vitest for unit/component tests, API integration tests using test DB/runtime, Playwright for end-to-end browser tests, and accessibility checks. Avoid tests dependent on paid APIs or live messaging.

### Test levels
1. Unit: money calculations, prorating, statuses, permission rules, utility splitting, date logic.
2. Component: forms, dialogs, navigation, empty/loading/error states, responsive controls.
3. API integration: DB constraints, auth, tenant isolation, transactions, validation.
4. End-to-end: real user flows across role portals.
5. Security: authorization matrix, IDOR/cross-tenant, file access, rate limits, injection.
6. Performance: low-end/mobile, slow network, large list, query budgets.
7. Regression: bug reproduction tests before fixes.
8. Migration: empty DB and upgrade from previous version.

### Minimum release test matrix

#### Authentication / accounts
- Signup with valid and invalid phone/email.
- Duplicate account detection; concurrent signup.
- OTP incorrect, expired, replayed, throttled, brute-force attempts.
- Password policy, hashing, reset token invalid/expired/reused.
- Logout invalidates session; revoke all sessions.
- Suspended account cannot log in or use existing session.
- Expired session redirects safely; no loop.
- Login error does not reveal account existence.
- Cookie flags in production.

#### Tenant isolation / permissions
- Owner A cannot access Owner B PG via guessed ID.
- Staff A cannot access unassigned property.
- Resident A cannot view Resident B profile, invoice, document, payment or ticket.
- Resident cannot update rent, paid status, role or room assignment.
- Staff cannot grant owner/admin permission.
- Owner cannot access platform admin routes.
- Super Admin access is audited.
- API, export, search, attachment, notification and realtime all enforce scope.
- Removed staff membership immediately loses access.

#### Property / room / bed
- Create/edit/archive PG; required fields and invalid address values.
- Room capacity 0/negative/over capacity rejected.
- Duplicate room number within intended scope rejected or explicitly allowed by policy.
- Duplicate bed label within room rejected.
- Bed states transition only through allowed rules.
- Cannot assign maintenance/reserved/archived bed without override permission.
- Concurrent two-resident assignment to same bed: exactly one succeeds.
- Resident active in two beds simultaneously: blocked unless explicit multi-stay policy.
- Bed transfer creates history and does not erase previous assignment.
- Room/property archive blocked if active stays/occupied beds unless safe workflow.
- Room vacancy calculation matches assignments.
- Sharing/capacity changes with occupants cannot silently invalidate occupancy.

#### Resident lifecycle
- Required fields and invalid phone/date values.
- Duplicate resident with same phone; same person may belong to different stays over time.
- Resident invitation/account linking; invite expiry/reissue.
- Admission with missing deposit/rent config.
- Check-in on future date; backdated check-in with permission.
- Check-out before joining; invalid checkout date; double checkout.
- Room transfer at effective date; rent changes correctly.
- Vacating notice withdrawn/changed.
- Resident archive retains financial and stay history.
- Sensitive document access denied to unauthorized staff.

#### Billing / invoices / money
- Monthly invoice generation idempotent on retry and concurrent job.
- Invoice for inactive/moved-out stay not generated after correct cutoff.
- Joining mid-month and leaving mid-month prorating.
- Feb, leap year, 28/29/30/31-day periods, Jan 31 boundary.
- Due date in past; grace period; late fee disabled/enabled; no repeated late-fee duplication.
- Discount, extra charge, zero charge, negative amount rejection, rounding.
- Invoice total equals sum of line items after discount/fee policy.
- Partial payment; multiple partial payments; overpayment; zero payment; duplicate request.
- Allocation across multiple invoices if supported; unallocated credit behavior.
- Payment submitted by resident remains unverified.
- Owner verifies once; repeated verification is idempotent.
- Incorrect payment rejected with reason; resubmission allowed safely.
- Duplicate UTR/reference collision; blank reference allowed according to policy.
- Cash payment recorded; receipt generated.
- Invoice paid/partially paid/overdue states match ledger.
- Reversal/adjustment leaves audit trail; no destructive delete.
- Refund amount cannot exceed eligible payment/deposit balance.
- Deposit is not counted as rental revenue.
- Payment and invoice display consistent after refresh and realtime update.
- No floating-point precision bugs.

#### Expense / utilities
- Expense with missing PG/category/amount rejected.
- Negative expense rejected unless adjustment workflow.
- Receipt upload access control.
- Monthly bill duplicate detection.
- Meter reading lower than previous rejected or flagged reset/rollover flow.
- Shared utility allocation totals equal bill within documented rounding.
- Resident count changes during utility period; occupancy-day split validated.
- Empty/zero bill; custom allocation; resident dispute; correction history.
- Expense edit/delete only allowed with audit/approval policy.

#### Maintenance / tasks
- Resident creates valid ticket; unauthorized property ID rejected.
- Image type spoofing, oversized upload, multiple uploads, upload failure.
- Priority/status invalid transition blocked.
- Ticket assignment to unassigned staff blocked.
- Waiting/resolved/closed/reopened states retain history.
- Duplicate submission from retry doesn't create duplicate tickets when idempotency is used.
- Staff cannot see unassigned PG tickets outside scope.
- Resolution and cost edits audited.
- SLA overdue computed correctly; timezone boundary.
- Resident can only comment/reopen their permitted ticket.

#### Notices / reminders / notifications
- Notice audience scope correct; no cross-PG leakage.
- Publish/schedule/expiry; invalid dates; schedule in past.
- Read status; mark-read idempotent.
- Quiet hours; optional provider unavailable.
- Duplicate job/retry doesn't send duplicate notification where idempotency can be enforced.
- Notification failure doesn't roll back resident/payment/maintenance operation.
- Notification links require authorization after navigation.

#### Staff / visitors / inventory
- Staff assigned only to permitted PG.
- Permission changes immediately apply.
- Staff inactive/revoked cannot access.
- Attendance duplicate, shift overnight, late, missing checkout, leave overlap.
- Visitor duplicate check-in; missing checkout; resident not active; expiry/retention.
- Asset issue/return; damage; negative inventory prevented; duplicate movements idempotent.

#### Reports / exports
- Date filters include/exclude boundaries correctly.
- Tenant/property filter enforced.
- Totals reconcile to source ledger.
- Empty report; huge dataset; export rate limits.
- CSV formula injection (`=`, `+`, `-`, `@`) escaped safely.
- Export excludes unauthorized documents and personal fields.
- Pagination doesn't duplicate/skip rows under stable ordering.

#### Admin / support
- PG approve/reject with reason.
- Suspend PG/account blocks future actions and sessions as designed.
- Ownership transfer preserves history and scope.
- Support ticket assignment/escalation and attachments.
- Admin actions audited; admin cannot erase audit records.
- Impersonation if enabled expires, requires reason, logs, cannot perform prohibited actions.

#### UI / mobile / accessibility
- 320px width and 360px width; no horizontal overflow.
- Android Chrome; installable PWA; safe areas; keyboard open.
- Bottom navigation not hidden behind keyboard or OS bar.
- Touch targets, labels, focus states, contrast, screen-reader names.
- Loading/empty/error/offline states.
- Slow 3G/4G and request timeout.
- Refresh while form pending; duplicate taps.
- Browser back navigation; deep links; session expired.
- Reduced-motion; no animation dependence.
- Large list memory/performance; image loading.

#### Security / abuse
- SQL injection strings, XSS payloads, path traversal, malicious file names.
- CSRF, origin checks, insecure cookie, token replay.
- IDOR / cross-tenant ID guessing.
- Rate limit login, OTP, search, exports and upload.
- Sensitive data not in logs, query strings, errors, analytics.
- User can’t forge role, tenant, paid status, invoice total, allocation or audit actor.
- File download authorization checks each time; expired/revoked access denied.
- Webhook signatures/replay/idempotency if gateway integration is later added.
- Dependency audit; secret scanning; no committed credentials.

### E2E golden paths
1. Super Admin login → approve PG → owner login.
2. Owner creates PG → floors/rooms/beds → sees vacancies.
3. Owner admits resident → assigns bed → resident gets account access.
4. Resident sees correct stay/bed/rent and no other resident data.
5. Owner issues monthly invoice → resident sees breakdown.
6. Resident submits direct UPI payment reference → pending verification.
7. Owner verifies → invoice balance updates → receipt available.
8. Staff assigned maintenance → resident tracks → staff resolves → resident confirms.
9. Owner transfers resident to another bed → old bed vacancy/new bed occupancy and history correct.
10. Resident requests checkout → owner records checkout → settlement/deposit → bed state set correctly.
11. Owner exports reports → tenant-scoped totals match ledger.
12. Owner disables staff → staff session/API access revoked.

---
## 15. Edge Case Catalogue (Do Not Ignore)

### Accounts and identity
- Same phone reused after account deletion/deactivation.
- Resident account exists before owner adds resident record.
- Resident invited to wrong PG; invitation corrected.
- Owner account has multiple PGs; user switches property.
- Staff belongs to two PGs with different permissions.
- Account phone number changed; OTP fails or old number unavailable.
- User removed from organization while session active.

### Occupancy
- Bed marked vacant but active assignment exists.
- Resident checkout is backdated and overlaps another assignment.
- Bed unavailable due repair during an active stay.
- PG/room capacity reduced while occupants remain.
- Two staff assign same bed simultaneously.
- Resident transfer partially fails after old assignment closes—must be transactionally prevented.
- Resident stays across billing period; room rent changes mid-period.
- Resident moves to a different PG owned by same organization.
- Reserved bed expires; reservation and assignment race.

### Money
- UPI payment made but resident entered wrong UTR.
- Owner verifies wrong resident/payment; reversal required.
- Payment sent twice; duplicate or overpayment.
- Payment received without invoice; unallocated credit.
- Invoice generated after resident has paid in advance.
- Rent due date adjusted after invoice issuance.
- Late fee applied twice by scheduler.
- Refund partially completed or delayed outside PGPass.
- Deposit deductions disputed.
- Cash receipt recorded by staff but not handed over; reconciliation process.
- Month-end calculation with leap year/partial month.
- Invoice/receipt downloaded after account archived.

### Files
- Upload interrupted; upload succeeds but DB record fails; DB record exists but file missing.
- Resident changes access after document uploaded.
- Document replaced—old version/history policy.
- File name contains path traversal/Unicode spoofing.
- MIME type lies; huge file; malware concern.
- Storage quota reached; deleted file recovery/retention.

### Operations
- Maintenance reported repeatedly for same issue.
- Urgent ticket without photo or staff available.
- Staff goes on leave while tasks assigned.
- Task overdue during PG closure.
- Visitor fails to check out.
- Notice targeted to room that has since changed residents.
- Notification provider unavailable or duplicate delivery.
- Scheduler runs late, twice, or never.

### System
- DB unavailable, slow, busy, or quota exhausted.
- Deployment fails; migration partially applies.
- Browser offline while payment submission or resident transfer form is open.
- Client retries after timeout but server already succeeded.
- Two admins update same record.
- Timezone/date mismatch between device and server.
- Cached data after logout or role change.
- Free hosting plan pauses or limits are reached.
- Data export interrupted.
- Backup exists but restore fails.

For every edge case that could cause money, occupancy, access, privacy, or irreversible data loss, define expected behavior and create a regression test.

---
## 16. Data Validation & Business Rules

- Phone numbers normalize to E.164 where possible; India UI may display +91. Do not use phone number as public ID.
- Names allow Indian languages, punctuation, spaces and reasonable lengths; reject control characters, not valid names.
- Amounts: nonnegative, within configured maximum; only negative amounts in explicit adjustment/reversal flows.
- Dates must be valid; start/end order enforced; future/past rules documented per workflow.
- Room/bed labels unique within intended scope.
- Residents/staff/property records cannot be referenced across tenant scope.
- Status transitions use explicit state machine; invalid transitions rejected.
- Required fields depend on workflow; don't overcollect.
- Search trims input, normalizes safely, bounded length, debounced client-side.
- File types and sizes documented and enforced server-side.
- Utility allocations and invoice line sums must reconcile.
- Payment amount and paid state are server-controlled.
- Export field lists explicitly approved; no full DB dump through ordinary UI.

---
## 17. Quality, Reliability & Maintainability Rules

- Strict TypeScript; avoid `any`. If unavoidable, document and narrow it at boundaries.
- Keep functions small and explicit; avoid hidden side effects.
- Prefer readable code over clever abstractions.
- Use centralized error handling and typed domain errors.
- Validate env variables at startup; fail fast on missing required secrets/config.
- Use dependency injection or adapters for storage, DB, clock, notifications and payment integrations to test without live services.
- Use deterministic test clock for billing, reminders and expiry.
- Avoid unnecessary dependencies; check bundle size, maintenance, license and security.
- Lock dependency versions and commit lockfile.
- No console logging personal data; use structured, sanitized logs.
- Avoid global state for tenant-specific context.
- Don't cache sensitive data across users/roles/tenants.
- Use database indexes, query explain/performance checks, bounded list APIs.
- Avoid premature microservices, complex state management, custom crypto, and giant generic CRUD engines.
- Use feature flags only for genuinely staged features; don't leave dead flags.
- Document architecture decisions (ADRs) for DB, auth, payments, storage, and hosting.

---
## 18. Definition of Done (Feature Acceptance Gate)
A feature is not “complete” until:

- [ ] Requirements and acceptance criteria implemented.
- [ ] Permission and tenant scope verified server-side.
- [ ] Validation on client and server; server is authoritative.
- [ ] Correct database constraints/indexes/migration.
- [ ] Unit tests for business rules and edge cases.
- [ ] API integration tests.
- [ ] E2E test for key user path where appropriate.
- [ ] Loading/empty/error/offline/unauthorized states.
- [ ] Mobile 320–430px reviewed; desktop reviewed.
- [ ] Accessibility labels, focus and contrast checked.
- [ ] No duplicate actions on retry/double tap.
- [ ] Audit events for critical mutation.
- [ ] No sensitive data in logs or URLs.
- [ ] Performance reviewed; no unbounded query.
- [ ] Docs/API contract updated.
- [ ] Lint, typecheck, tests and build pass.
- [ ] Manual QA steps documented and executed where required.
- [ ] Rollback/migration plan exists for schema changes.

---
## 19. Build Roadmap & Priority (Strict)

### Phase 0 — Repository and design foundation (P0)
- Inspect repo, establish architecture, package manager, environment and CI.
- Design system, logo/brand assets, responsive app shell, routing, role layouts.
- Auth, session, tenant model, permission engine, DB migrations, error handling, audit foundation.
- Health/readiness, config validation, tests and deployment preview.

**Exit gate:** architecture works; auth and tenant isolation tests pass; mobile shell navigates all roles.

### Phase 1 — Core PG operations (P0)
- Owner PG/property setup.
- Building/floor/room/bed setup and sharing types.
- Resident create/profile/admission/stay/check-in.
- Bed allocation, transfer history, checkout/archival.
- Staff accounts, property scope and basic roles.
- Resident portal: stay/profile/room.
- Owner dashboard derived from actual DB data.

**Exit gate:** occupancy invariant holds; complete resident admission and transfer flow works.

### Phase 2 — Core rent & ledger (P0)
- Rent settings, invoices, invoice items, partial payments, manual payment modes.
- Resident submits UPI reference, owner verifies.
- Receipts, dues, deposit ledger, adjustments/reversals.
- Expenses, collection dashboard, basic finance reports.

**Exit gate:** all payment/invoice tests pass; no double invoice/payment allocation; reconciliation is possible.

### Phase 3 — Maintenance & communication (P0/P1)
- Resident maintenance requests, photo uploads (secure), staff assignment, status timeline.
- Notices, in-app notifications, reminders, tasks.
- Owner/staff dashboards and role-based navigation.

**Exit gate:** ticket and notification failures cannot corrupt core records; scope/security tests pass.

### Phase 4 — Real operational completeness (P1)
- Check-in/out checklists, booking/enquiries, vacating settlement.
- Utility bill and electricity splitting.
- Visitors, room inspection, housekeeping, staff shifts/leave.
- Inventory/assets, vendor and repair expense linkage.
- Reports and exports.

**Exit gate:** operations and financial workflows are reconciled; export privacy checks pass.

### Phase 5 — Pilot hardening (P0 before real use)
- Security review, cross-tenant tests, backups/restoration, performance, accessibility, mobile offline/slow network.
- Data export, retention, privacy/legal pages, support workflow.
- Production secrets, domains, monitoring, quotas, incident/rollback documentation.
- Pilot with fake/synthetic data first, then opt-in small real PG with informed consent and data migration plan.

**Exit gate:** owner/resident can use core features; restore tested; known risks documented; no critical/high security issues open.

### Phase 6 — Optional future features (only after core is complete)
- Online payment gateway (fee transparency and gateway costs).
- SMS/WhatsApp/email provider integrations.
- Push notifications.
- Public PG discovery/marketplace.
- Advanced analytics and AI assistant.
- Mess/meal subscription.
- Visitor QR check-in.
- Advanced inventory/vendor purchase workflows.
- Native Android/iOS applications.
- Subscription billing for PGPass (only if product decision changes; core free policy must be explicit).
- Multi-language support beyond initial English/Telugu-ready structure.
- Integrations with accounting, e-sign, KYC/DigiLocker, calendar.

Optional items must not be pulled ahead of P0/P1 without a clear user requirement and impact analysis.

---
## 20. Free / Low-Cost Tooling Policy

Prefer maintained free/open-source tools; verify current plan limits before deploying.

- TypeScript, React, Vite, Tailwind CSS: open-source.
- Cloudflare Pages/Workers/D1: free-tier option with quotas and provider limits; verify current terms.
- GitHub: source control and CI; free limits may apply.
- Vitest, Playwright, ESLint, Prettier, TypeScript: open-source testing/quality.
- Drizzle (optional): typed DB schema/query tooling; verify compatibility.
- Zod or equivalent: input validation.
- Lucide: icons.
- PWA manifest/service worker: installable web app.
- Local development: SQLite/D1 local emulator where feasible; synthetic data.
- PDF generation: choose a lightweight open-source library and test mobile download/printing.
- Image processing: local build or browser-native compression where possible.

Do not assume a service is free because a blog says so. Check official pricing/limits, inactivity policy, commercial-use terms, backup and data-export options, region, privacy, and quota before adoption. Avoid requiring a credit card for optional services whenever possible.

---
## 21. Release & Deployment Checklist

### Before pilot
- [ ] Repository reviewed; no leaked secrets; `.gitignore` correct.
- [ ] Separate development/staging/production environment.
- [ ] Production config/secrets configured securely.
- [ ] Migrations reviewed and tested.
- [ ] Tenant isolation and role tests pass.
- [ ] Authentication/session security reviewed.
- [ ] Payment ledger/invoice tests pass.
- [ ] Upload/download permissions tested.
- [ ] Rate limits enabled.
- [ ] HTTPS enabled.
- [ ] CORS allow-list correct.
- [ ] Security headers configured.
- [ ] Backup and restore tested.
- [ ] Export tested.
- [ ] Health/readiness endpoints work.
- [ ] Logs sanitized.
- [ ] Error/empty/offline UI tested.
- [ ] Mobile 320px/360px/390px/430px checked.
- [ ] Slow network and low-end device tested.
- [ ] Accessibility basics checked.
- [ ] Privacy notice, terms, data retention and contact/support information reviewed.
- [ ] Owner/resident training guide prepared.
- [ ] Rollback plan ready.
- [ ] Quotas and free-tier limits monitored.
- [ ] No paid service activates without approval.

### Pilot operation
- Start with 1–3 PGs and synthetic data, then limited real data with consent.
- Collect issues, but prioritize correctness/security over feature count.
- Never use a real resident’s identity documents in demo/test environments.
- Track: successful admission, invoice correctness, payment reconciliation, maintenance response, errors, time-to-task, mobile usability.
- Make regular encrypted exports and restore-test schedule.

---
## 22. Product Metrics (No Vanity Metrics)

Measure only what helps product decisions, and avoid collecting unnecessary personal data.

- PG setup completion rate.
- Resident admission completion time.
- Occupancy data accuracy.
- Invoice generation success/duplicate rate.
- Payment reconciliation mismatch rate.
- Maintenance request time to assignment and resolution.
- Notification failure rate (in-app delivery first).
- Mobile performance and error rate.
- Weekly active owner/staff/resident accounts (aggregated).
- Support issues by category.
- Data export and backup health.

Metrics must come from actual event/data, have clear definitions, and avoid exposing resident identities unnecessarily.

---
## 23. Project Rules / Decision Log Template

For any important architecture or product change, record:

```text
Decision ID:
Date:
Context/problem:
Options considered:
Decision:
Reasons:
Cost/operational impact:
Security/privacy impact:
Migration/rollback:
Tests required:
Status (proposed/accepted/rejected/superseded):
```

Do not change foundational decisions (database, auth, payment flow, tenant model, free-cost policy) casually. Present tradeoffs before replacing them.

---
## 24. Definition of Product Success

PGPass is ready for a limited pilot when:

- Owners can configure their PG and accurately see rooms, beds and residents.
- Admission, assignment, transfer and checkout preserve history and occupancy integrity.
- Rent invoices, partial payments, direct UPI/cash records and outstanding balances reconcile.
- Residents can view their own stay and bills and raise maintenance requests.
- Staff can perform assigned tasks without seeing unauthorized data.
- Admin can safely oversee platform accounts/PGs.
- All critical operations are tenant-scoped, permission checked, validated and audited.
- App is usable on low-end Android/mobile, slow networks and desktop.
- No core workflow requires a paid gateway, SMS or third-party service.
- Backup/export and restoration are tested and limitations are documented.
- No critical/high security or correctness defect remains open.
- The product is understandable to a PG owner who is not technically skilled.

**The product must be dependable before it is beautiful, and useful before it is monetized.**

---
## 25. Reference Links (Verify Before Use)

These references are for implementation and market/compliance review; they are not instructions to copy a competitor UI. Check current official documentation because pricing, quotas and rules can change.

- Cloudflare Workers limits: https://developers.cloudflare.com/workers/platform/limits/
- Cloudflare Workers pricing: https://developers.cloudflare.com/workers/platform/pricing/
- Cloudflare Pages limits: https://developers.cloudflare.com/pages/platform/limits/
- Supabase pricing (alternative database/provider; free project behavior/limits must be checked): https://supabase.com/pricing
- India DPDP Rules 2025 (Gazette PDF): https://upload.indiacode.nic.in/showfile?actid=AC_CEN_45_0_00003_2023-22_1763464807080&filename=dpdprules2025.pdf&type=rule
- PIB DPDP Rules overview: https://www.pib.gov.in/PressReleasePage.aspx?PRID=2190655&lang=1&reg=3
- NPCI UPI merchant charges FAQ (verify latest): https://www.npci.org.in/uploads/FA_Qs_Merchant_Discount_Rate_MDR_on_Select_UPI_P2_M_Transactions_58dba1d39e.pdf
- Example low-cost/low-bandwidth product engineering inspiration (not a PGPass design template): https://github.com/divyamohan1993/gharsetu

---
## 26. AI Agent Task Prompt (Copy for Each Build Session)

```text
You are a senior product engineer working on PGPass, a free/zero-mandatory-cost,
mobile-first multi-tenant PG/hostel management PWA for India.

Read PGPass_AI_Product_Engineering_Blueprint.md first and obey it.

Before changing code:
1. Inspect the repository, current git status, architecture, migrations, tests and relevant files.
2. Identify existing behavior and avoid breaking it.
3. Propose a small complete implementation slice with acceptance criteria, risks and tests.

Implement production-minded code, not mock UI. Enforce tenant isolation and permissions
on the server, validate all inputs, use transactions for critical workflows,
append audit records for sensitive mutations, preserve financial/history data,
handle loading/empty/error/offline states, and design mobile-first for low-end devices.
Do not introduce paid services, gateway fees, paid APIs or subscriptions without
explicit approval. Core PGPass functionality must work with manual cash/direct-UPI
recording and in-app notifications.

Run tests, lint, typecheck and build that are relevant. Add tests for normal,
permission-denied, tenant-isolation, duplicate/retry, concurrency and edge cases.
Report exactly what was changed, tests actually run and passed/failed, remaining
risks, and manual verification steps. Never claim untested functionality is complete.
```


## 27. Non-Negotiable Principles (Short Checklist)

- Free core product; no mandatory transaction processing.
- Mobile-first PWA; responsive desktop.
- Low-end device and slow-network support.
- Modular monolith; no microservices at MVP.
- Server-side authorization, tenant isolation and data minimization.
- Transaction-safe bed allocation, invoices, payments and transfers.
- Immutable financial history; correction by reversal/adjustment.
- Actual data only; no fake dashboard values.
- In-app notifications first; external messaging optional.
- Open/free tools; no surprise billing.
- Backup, export and tested restore.
- Real automated tests plus documented manual QA.
- Security/privacy/legal review before real resident data and public production launch.
- Finish core workflows before optional features.

**End of blueprint. Treat this file as the project baseline.**
