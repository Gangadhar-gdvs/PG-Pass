# Multi-Property Migration Plan

**Goal:** let one owner manage multiple PGs (properties) instead of exactly one.
**Constraints:** zero-downtime, backward-compatible, no data backfill required, keep
the existing security model (owner/staff scoping) intact.

## Core design decision — the "primary property" trick

Existing data has no `propertyId`. Instead of backfilling every doc, we define:

> **An owner's primary property id == the owner's uid.**

So any document whose `propertyId` is missing is treated as belonging to the
property `ownerId`. New properties get fresh random ids. This means:

- Existing beds/tenants/rent_records/etc. need **no migration** — reads default
  `propertyId` to `ownerId`.
- A `properties/{propertyId}` doc is lazily created for the primary property from
  the existing Owner fields the first time properties are listed.

## Receipt numbering — per property

`nextReceiptSeq` moves from the Owner doc to the `properties/{propertyId}` doc.
Each property numbers its own receipts REC-00001, REC-00002… The primary
property seeds its counter from the owner's existing `nextReceiptSeq`.

## Owner vs Property attributes

**Stay on Owner (account):** name, email, phone, upiId, upiMerchantName,
panNumber, plan, accountStatus, subscriptionExpiresAt, max* quotas (account-wide).

**Move to Property:** pgName, pgAddress/address, totalFloors, roomsPerFloor,
bedsPerRoom, monthlyRent, pgCategory, foodPlan, foodCuisine, pgAmenities,
rentDueDay, lateFeePerDayPaise, lateFeeGraceDays, nextReceiptSeq.

(The Owner doc keeps copies of the property fields for the primary property for
backward compatibility; new properties live only in `properties/`.)

## Quotas

Plan quotas (maxBeds/maxTenants/maxStaff/maxPhotos) stay **account-wide** — the
sum across all properties counts against the plan. This keeps billing simple and
avoids per-property quota math.

## Phased rollout (each phase ships independently, fully verified)

**Phase 1 — Property model (this is additive, nothing else changes):**
- `Property` type + `properties/{propertyId}` collection.
- `properties.service.ts`: `listProperties(ownerId)` (lazily materializes the
  primary property from the Owner doc), `createProperty`, `getProperty`.
- Rules + index for `properties`.
- `GET/POST /api/properties`.

**Phase 2 — propertyId on child collections (default = ownerId):**
- Add optional `propertyId` to Bed, Tenant, RentRecord, Deposit, Expense,
  MaintenanceTicket, MoveInPhoto types.
- Writers stamp `propertyId` (defaulting to `ownerId` for the primary property).
- Composite indexes `(ownerId, propertyId, …)` added alongside existing ones so
  old `(ownerId, …)` queries keep working.

**Phase 3 — services/API accept an optional propertyId filter:**
- Each list/service method gains an optional `propertyId`; when present it adds
  `.where('propertyId','==',propertyId)`; when absent it behaves exactly as today
  (owner-wide) — so single-property owners are unaffected.
- `nextReceiptSeq` reads/writes move to the property doc (seeded from owner).

**Phase 4 — UI property selector:**
- `OwnerSessionProvider` carries the selected `propertyId` (default = primary).
- A property switcher in the shell; pages pass `?propertyId=` to their fetches.
- Settings/PropertySetupWizard gain "add property".

## Why this is safe

- No query changes are mandatory until Phase 3, and even then `propertyId` is an
  **optional** filter — omitting it preserves today's owner-wide behavior.
- No rule change is required (property access derives from owner access; staff
  stay owner-scoped). Per-property staff scoping is a future option.
- No data backfill: the primary-property = ownerId convention makes existing docs
  valid as-is.

## Rollback

Each phase is additive. Reverting = stop writing/reading `propertyId` (the field
is ignored by old code). The `properties` collection can be left in place harmlessly.
