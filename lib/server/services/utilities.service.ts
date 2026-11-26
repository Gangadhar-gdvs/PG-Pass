import 'server-only';
import { adminDb } from '../firebase-admin';
import { AppError } from '../api/withErrorHandler';
import { recordEvent } from './systemLogs.service';
import { propertiesService } from './properties.service';
import { RENT_STATUS } from '@/lib/constants/status';
import { MAX_LIST_LIMIT } from '@/lib/constants/limits';
import {
  computeSplit,
  formatPeriodLabel,
  meterUnits,
  rupeeText,
  SplitError,
  utilityLineLabel,
  daysInPeriod,
  occupancyDays,
  type SplitResident,
  type SplitResult,
} from '@/lib/utilitySplit';
import { tsToDate } from '@/lib/utils';
import type {
  LineItem,
  RentRecord,
  Tenant,
  Timestampish,
  UtilityAllocation,
  UtilityAllocationRule,
  UtilityBill,
  UtilityBillHistoryEntry,
  UtilityBillStatus,
  UtilityScope,
  UtilityType,
} from '@/types';
import { Timestamp } from 'firebase-admin/firestore';

/**
 * Utility bills & transparent split.
 *
 * Lifecycle: draft (saved with a frozen allocation) → apply (appends one line
 * item per resident share onto their `${tenantId}_${period}` rent record) →
 * optional void (reverses those charges, soft-deletes the bill).
 *
 * Money rules: integer paise; the allocation is computed by the pure
 * `computeSplit` (largest-remainder rounding, Σshares === total). Apply and void
 * each run in ONE Firestore transaction and are idempotent: an allocation is
 * charged at most once (allocation status + a `utilityBillId` tag on the rent
 * line item), and a bill can only be voided once.
 *
 * Missing rent record: the share is SKIPPED with a reason (never invents a
 * rent bill). Records awaiting payment verification are skipped too, so a
 * later "confirm" can't silently mark the utility share paid. Re-running apply
 * picks up only the skipped/pending shares.
 */

export interface UtilityBillInput {
  propertyId?: string;
  type: UtilityType;
  provider?: string;
  period: string;
  scope: UtilityScope;
  roomNumber?: string;
  totalPaise: number;
  meter?: { previous: number; current: number; reset?: boolean } | null;
  notes?: string;
  rule: UtilityAllocationRule;
  customPaise?: Record<string, number>;
}

/** Stored shape — `dedupeKey` is internal and never leaves the server. */
type StoredUtilityBill = UtilityBill & { dedupeKey: string };

export interface ScopedResident {
  tenantId: string;
  tenantName: string;
  bedLabel: string | null;
  moveInDate: string | null;
  moveOutDate: string | null;
  days: number;
}

export interface UtilityPreview {
  label: string;
  periodLabel: string;
  daysInPeriod: number;
  units: number | null;
  residents: ScopedResident[];
  split: SplitResult | null;
  error: string | null;
  duplicate: { id: string; status: UtilityBillStatus } | null;
  overlaps: Array<{ id: string; label: string }>;
}

export interface ApplyResult {
  charged: Array<{ tenantName: string; sharePaise: number; reopenedPaid: boolean }>;
  alreadyApplied: number;
  skipped: Array<{ tenantName: string; reason: string }>;
}

export interface VoidResult {
  removed: number; // line items removed from unpaid records
  adjusted: number; // negative adjustment lines appended (record had payments)
  credits: Array<{ tenantName: string; paise: number }>; // now overpaid
  covered: string[]; // partially-paid records whose balance is now fully covered
}

const COLLECTION = 'utility_bills';
// Tenant history (incl. moved-out residents) is scanned per scope; bounded.
const TENANT_SCAN_LIMIT = 1000;

const scopeKeyOf = (scope: UtilityScope, roomNumber?: string | null) =>
  scope === 'room' ? `room:${(roomNumber || '').trim().toLowerCase()}` : 'property';

const dedupeKeyOf = (propertyId: string, scopeKey: string, type: UtilityType, period: string) =>
  [propertyId, scopeKey, type, period].join('|');

const lineSum = (items: LineItem[]) => items.reduce((s, li) => s + (li.amountPaise || 0), 0);

function isoOf(v: Timestampish | null | undefined): string | null {
  const d = tsToDate(v ?? null);
  return d ? d.toISOString() : null;
}

/** Explicit client DTO: ISO timestamps, no internal dedupe key. */
export function toUtilityBillDTO(bill: StoredUtilityBill | UtilityBill): UtilityBill {
  return {
    id: bill.id,
    ownerId: bill.ownerId,
    propertyId: bill.propertyId,
    type: bill.type,
    provider: bill.provider ?? null,
    period: bill.period,
    scope: bill.scope,
    roomNumber: bill.roomNumber ?? null,
    label: bill.label,
    totalPaise: bill.totalPaise,
    meter: bill.meter ?? null,
    notes: bill.notes ?? null,
    rule: bill.rule,
    daysInPeriod: bill.daysInPeriod,
    allocations: (bill.allocations || []).map((a) => ({ ...a })),
    status: bill.status,
    createdBy: bill.createdBy,
    appliedAt: isoOf(bill.appliedAt),
    appliedBy: bill.appliedBy ?? null,
    voidedAt: isoOf(bill.voidedAt),
    voidedBy: bill.voidedBy ?? null,
    voidReason: bill.voidReason ?? null,
    history: bill.history || [],
    deletedAt: isoOf(bill.deletedAt),
    createdAt: isoOf(bill.createdAt) ?? undefined,
    updatedAt: isoOf(bill.updatedAt) ?? undefined,
  };
}

/** Bill status from its allocations: every positive share charged → applied. */
export function billStatusFor(allocations: UtilityAllocation[]): UtilityBillStatus {
  const chargeable = allocations.filter((a) => a.sharePaise > 0);
  const applied = chargeable.filter((a) => a.status === 'applied').length;
  if (applied === chargeable.length) return 'applied';
  return applied > 0 ? 'partial' : 'draft';
}

function asBadRequest(e: unknown): never {
  if (e instanceof SplitError) throw new AppError(400, e.message, e.code);
  throw e;
}

export class UtilitiesService {
  /** Primary property === ownerId; any other id must belong to this owner. */
  private async resolvePropertyId(ownerId: string, propertyId?: string): Promise<string> {
    if (!propertyId || propertyId === ownerId) return ownerId;
    const property = await propertiesService.getProperty(ownerId, propertyId);
    return property.id;
  }

  /**
   * Residents linked to the scope (room or whole property), including those who
   * moved out — occupancy days decide who actually shares the bill. Soft-deleted
   * residents are excluded.
   */
  async residentsInScope(
    ownerId: string,
    propertyId: string,
    scope: UtilityScope,
    roomNumber: string | null | undefined,
    period: string
  ): Promise<ScopedResident[]> {
    let q = adminDb.collection('tenants').where('ownerId', '==', ownerId);
    // Requires index tenants(ownerId, roomNumber).
    if (scope === 'room') q = q.where('roomNumber', '==', (roomNumber || '').trim());
    const snap = await q.limit(TENANT_SCAN_LIMIT).get();
    return snap.docs
      .map((d) => ({ ...d.data(), id: d.id }) as Tenant)
      .filter((t) => !t.deletedAt && (t.propertyId || ownerId) === propertyId)
      .map((t) => ({
        tenantId: t.id,
        tenantName: t.name || 'Resident',
        bedLabel: t.bedLabel || null,
        moveInDate: t.moveInDate || null,
        moveOutDate: t.moveOutDate || null,
        days: occupancyDays(period, t.moveInDate, t.moveOutDate),
      }))
      .sort((a, b) => b.days - a.days || a.tenantName.localeCompare(b.tenantName));
  }

  private async listStored(ownerId: string, period: string): Promise<StoredUtilityBill[]> {
    // Requires index utility_bills(ownerId, period, createdAt DESC).
    const snap = await adminDb
      .collection(COLLECTION)
      .where('ownerId', '==', ownerId)
      .where('period', '==', period)
      .orderBy('createdAt', 'desc')
      .limit(MAX_LIST_LIMIT)
      .get();
    return snap.docs.map((d) => ({ ...d.data(), id: d.id }) as StoredUtilityBill);
  }

  /** Bills for a month (incl. voided ones — kept visible for the audit trail). */
  async list(ownerId: string, period: string, propertyId?: string): Promise<UtilityBill[]> {
    const bills = await this.listStored(ownerId, period);
    return bills
      .filter((b) => !propertyId || b.propertyId === propertyId)
      .map(toUtilityBillDTO);
  }

  private async getStored(ownerId: string, billId: string): Promise<StoredUtilityBill> {
    const snap = await adminDb.collection(COLLECTION).doc(billId).get();
    if (!snap.exists) throw new AppError(404, 'Utility bill not found');
    const bill = { ...snap.data(), id: snap.id } as StoredUtilityBill;
    if (bill.ownerId !== ownerId) throw new AppError(403, 'Unauthorized');
    return bill;
  }

  async get(ownerId: string, billId: string): Promise<UtilityBill> {
    return toUtilityBillDTO(await this.getStored(ownerId, billId));
  }

  /**
   * Dry run for the owner UI: residents in scope with their days, the computed
   * split (or the business-rule error to show), and duplicate/overlap warnings.
   * Never writes.
   */
  async preview(ownerId: string, input: UtilityBillInput): Promise<UtilityPreview> {
    const propertyId = await this.resolvePropertyId(ownerId, input.propertyId);
    const roomNumber = input.scope === 'room' ? (input.roomNumber || '').trim() : null;
    const [residents, existing] = await Promise.all([
      this.residentsInScope(ownerId, propertyId, input.scope, roomNumber, input.period),
      this.listStored(ownerId, input.period),
    ]);

    let units: number | null = null;
    let split: SplitResult | null = null;
    let error: string | null = null;
    try {
      units = meterUnits(input.meter);
      split = computeSplit({
        period: input.period,
        totalPaise: input.totalPaise,
        rule: input.rule,
        residents: residents as SplitResident[],
        customPaise: input.rule === 'custom' ? input.customPaise || {} : null,
      });
    } catch (e: unknown) {
      if (!(e instanceof SplitError)) throw e;
      error = e.message;
    }

    const key = dedupeKeyOf(propertyId, scopeKeyOf(input.scope, roomNumber), input.type, input.period);
    const live = existing.filter((b) => !b.deletedAt && b.propertyId === propertyId);
    const dup = live.find((b) => b.dedupeKey === key);
    // A whole-PG bill and a room bill of the same type would charge that room twice.
    const overlaps = live
      .filter(
        (b) =>
          b.dedupeKey !== key &&
          b.type === input.type &&
          (b.scope === 'property' || input.scope === 'property')
      )
      .map((b) => ({ id: b.id, label: b.label }));

    return {
      label: utilityLineLabel(input.type, input.scope, roomNumber, input.period),
      periodLabel: formatPeriodLabel(input.period),
      daysInPeriod: daysInPeriod(input.period),
      units,
      residents,
      split,
      error,
      duplicate: dup ? { id: dup.id, status: dup.status } : null,
      overlaps,
    };
  }

  /** Save a bill as a DRAFT with its frozen allocation. 409 on a live duplicate. */
  async create(ownerId: string, actorUid: string, input: UtilityBillInput): Promise<UtilityBill> {
    const propertyId = await this.resolvePropertyId(ownerId, input.propertyId);
    const roomNumber = input.scope === 'room' ? (input.roomNumber || '').trim() : null;
    if (input.scope === 'room' && !roomNumber) throw new AppError(400, 'Choose the room this bill is for');

    let units: number | null;
    try {
      units = meterUnits(input.meter);
    } catch (e: unknown) {
      asBadRequest(e);
    }

    const residents = await this.residentsInScope(ownerId, propertyId, input.scope, roomNumber, input.period);
    let split: SplitResult;
    try {
      split = computeSplit({
        period: input.period,
        totalPaise: input.totalPaise,
        rule: input.rule,
        residents,
        customPaise: input.rule === 'custom' ? input.customPaise || {} : null,
      });
    } catch (e: unknown) {
      asBadRequest(e);
    }

    const ref = adminDb.collection(COLLECTION).doc();
    const now = Timestamp.now();
    const nowIso = now.toDate().toISOString();
    const label = utilityLineLabel(input.type, input.scope, roomNumber, input.period);
    const dedupeKey = dedupeKeyOf(propertyId, scopeKeyOf(input.scope, roomNumber), input.type, input.period);

    const allocations: UtilityAllocation[] = split.lines.map((l) => ({
      id: `${ref.id}_${l.tenantId}`,
      tenantId: l.tenantId,
      tenantName: l.tenantName,
      bedLabel: l.bedLabel,
      days: l.days,
      weight: l.weight,
      sharePaise: l.sharePaise,
      roundingPaise: l.roundingPaise,
      status: 'pending',
      rentRecordId: null,
      appliedAt: null,
      skipReason: null,
      reopenedPaidRecord: false,
      reversedAt: null,
      reversalMode: null,
    }));

    const history: UtilityBillHistoryEntry[] = [
      { at: nowIso, by: actorUid, action: 'created', note: `${rupeeText(input.totalPaise)} · ${allocations.length} resident(s)` },
    ];

    const bill: StoredUtilityBill = {
      id: ref.id,
      ownerId,
      propertyId,
      type: input.type,
      provider: input.provider?.trim() || null,
      period: input.period,
      scope: input.scope,
      roomNumber,
      label,
      totalPaise: input.totalPaise,
      meter:
        units === null || !input.meter
          ? null
          : { previous: input.meter.previous, current: input.meter.current, units, reset: !!input.meter.reset },
      notes: input.notes?.trim() || null,
      rule: input.rule,
      daysInPeriod: split.daysInPeriod,
      allocations,
      // A bill with nothing to charge (₹0, or every share ₹0) is complete as saved.
      status: allocations.some((a) => a.sharePaise > 0) ? 'draft' : 'applied',
      createdBy: actorUid,
      appliedAt: null,
      appliedBy: null,
      voidedAt: null,
      voidedBy: null,
      voidReason: null,
      history,
      dedupeKey,
      deletedAt: null, // explicit so `where('deletedAt','==',null)` matches
      createdAt: now,
      updatedAt: now,
    };

    await adminDb.runTransaction(async (tx) => {
      // Duplicate guard inside the transaction so two concurrent saves can't
      // both pass. Requires index utility_bills(ownerId, dedupeKey, deletedAt).
      const dup = await tx.get(
        adminDb
          .collection(COLLECTION)
          .where('ownerId', '==', ownerId)
          .where('dedupeKey', '==', dedupeKey)
          .where('deletedAt', '==', null)
          .limit(1)
      );
      if (!dup.empty) {
        throw new AppError(
          409,
          `${label} is already recorded. Void that bill first if you need to correct it.`,
          'DUPLICATE_UTILITY_BILL'
        );
      }
      tx.set(ref, bill);
    });

    return toUtilityBillDTO(bill);
  }

  /**
   * Charge every pending/skipped share onto the resident's rent record for the
   * bill's period. Idempotent: already-applied shares are never charged again.
   */
  async apply(ownerId: string, actorUid: string, billId: string): Promise<{ bill: UtilityBill; result: ApplyResult }> {
    const billRef = adminDb.collection(COLLECTION).doc(billId);
    const now = Timestamp.now();
    const nowIso = now.toDate().toISOString();
    let updatedBill!: StoredUtilityBill;
    const result: ApplyResult = { charged: [], alreadyApplied: 0, skipped: [] };

    await adminDb.runTransaction(async (tx) => {
      // Reset per attempt — Firestore may retry the transaction body.
      result.charged = [];
      result.alreadyApplied = 0;
      result.skipped = [];

      const snap = await tx.get(billRef);
      if (!snap.exists) throw new AppError(404, 'Utility bill not found');
      const bill = { ...snap.data(), id: snap.id } as StoredUtilityBill;
      if (bill.ownerId !== ownerId) throw new AppError(403, 'Unauthorized');
      if (bill.status === 'void' || bill.deletedAt) {
        throw new AppError(409, 'This bill was voided and can no longer be applied', 'UTILITY_BILL_VOID');
      }

      const periodLabel = formatPeriodLabel(bill.period);
      const allocations = (bill.allocations || []).map((a) => ({ ...a }));
      const targets = allocations.filter((a) => a.sharePaise > 0 && a.status !== 'applied');

      // ALL reads before any write (Firestore transaction rule).
      const recordRefs = targets.map((a) => adminDb.collection('rent_records').doc(`${a.tenantId}_${bill.period}`));
      const recordSnaps = recordRefs.length ? await tx.getAll(...recordRefs) : [];
      const snapById = new Map(recordSnaps.map((s) => [s.id, s]));

      for (const a of allocations) {
        if (a.status === 'applied') {
          if (a.sharePaise > 0) result.alreadyApplied++;
          continue;
        }
        if (a.sharePaise <= 0) continue; // ₹0 share — nothing to charge

        const recordId = `${a.tenantId}_${bill.period}`;
        const rs = snapById.get(recordId);
        const skip = (reason: string) => {
          a.status = 'skipped';
          a.skipReason = reason;
          result.skipped.push({ tenantName: a.tenantName, reason });
        };

        if (!rs || !rs.exists) {
          skip(`No rent record for ${periodLabel} yet — create this month's rent, then apply again.`);
          continue;
        }
        const record = rs.data() as RentRecord;
        if (record.ownerId !== ownerId || record.tenantId !== a.tenantId) {
          skip('Rent record does not match this resident');
          continue;
        }
        const items: LineItem[] = record.lineItems || [];
        if (items.some((li) => li.kind === 'utility' && li.utilityBillId === bill.id)) {
          // Defensive idempotency: the charge is already on the record.
          a.status = 'applied';
          a.rentRecordId = recordId;
          a.appliedAt = a.appliedAt || nowIso;
          a.skipReason = null;
          result.alreadyApplied++;
          continue;
        }
        if (record.status === RENT_STATUS.VERIFY) {
          skip('A payment from this resident is awaiting your verification. Confirm or reject it first, then apply again.');
          continue;
        }

        const due = record.amountDuePaise ?? lineSum(items);
        const wasPaid = record.status === RENT_STATUS.PAID;
        const update: Partial<RentRecord> = {
          lineItems: [
            ...items,
            { label: bill.label, amountPaise: a.sharePaise, kind: 'utility', utilityBillId: bill.id },
          ],
          amountDuePaise: due + a.sharePaise,
          updatedAt: now,
        };
        // A fully-paid record now has a balance again → back to pending
        // (amountPaidPaise is kept, so it shows as partially paid).
        if (wasPaid) update.status = RENT_STATUS.PENDING;
        tx.update(rs.ref, update);

        a.status = 'applied';
        a.rentRecordId = recordId;
        a.appliedAt = nowIso;
        a.skipReason = null;
        a.reopenedPaidRecord = wasPaid;
        result.charged.push({ tenantName: a.tenantName, sharePaise: a.sharePaise, reopenedPaid: wasPaid });
      }

      const status = billStatusFor(allocations);
      const historyEntry: UtilityBillHistoryEntry = {
        at: nowIso,
        by: actorUid,
        action: 'applied',
        note: `${result.charged.length} charged · ${result.skipped.length} skipped · ${result.alreadyApplied} already applied`,
      };
      const patch: Partial<StoredUtilityBill> = {
        allocations,
        status,
        appliedAt: bill.appliedAt || now,
        appliedBy: actorUid,
        updatedAt: now,
        history: [...(bill.history || []), historyEntry],
      };
      // Pure re-apply with nothing new → no write at all.
      if (result.charged.length > 0 || result.skipped.length > 0 || status !== bill.status) {
        tx.update(billRef, patch);
      }
      updatedBill = { ...bill, ...patch } as StoredUtilityBill;
    });

    if (result.charged.length > 0) {
      const sum = result.charged.reduce((s, c) => s + c.sharePaise, 0);
      await recordEvent({
        category: 'payment',
        message: `Utility charges applied: ${updatedBill.label} · ${result.charged.length} resident(s) · ${rupeeText(sum)}${
          result.skipped.length ? ` · ${result.skipped.length} skipped` : ''
        }`,
        ownerId,
        actorUid,
        targetId: billId,
        amountPaise: sum,
      });
    }

    return { bill: toUtilityBillDTO(updatedBill), result };
  }

  /**
   * Void a bill: reverse every applied share and soft-delete the bill (a new,
   * corrected bill for the same scope can then be recorded). Unpaid records lose
   * the line item; records with any payment get a NEGATIVE adjustment line so
   * history is preserved. Never auto-marks anything paid.
   */
  async void(
    ownerId: string,
    actorUid: string,
    billId: string,
    reason: string
  ): Promise<{ bill: UtilityBill; result: VoidResult }> {
    const trimmed = (reason || '').trim();
    if (trimmed.length < 3) throw new AppError(400, 'Please give a short reason for voiding this bill');

    const billRef = adminDb.collection(COLLECTION).doc(billId);
    const now = Timestamp.now();
    const nowIso = now.toDate().toISOString();
    let updatedBill!: StoredUtilityBill;
    const result: VoidResult = { removed: 0, adjusted: 0, credits: [], covered: [] };

    await adminDb.runTransaction(async (tx) => {
      result.removed = 0;
      result.adjusted = 0;
      result.credits = [];
      result.covered = [];

      const snap = await tx.get(billRef);
      if (!snap.exists) throw new AppError(404, 'Utility bill not found');
      const bill = { ...snap.data(), id: snap.id } as StoredUtilityBill;
      if (bill.ownerId !== ownerId) throw new AppError(403, 'Unauthorized');
      if (bill.status === 'void' || bill.deletedAt) {
        throw new AppError(409, 'This bill is already voided', 'UTILITY_BILL_VOID');
      }

      const allocations = (bill.allocations || []).map((a) => ({ ...a }));
      const applied = allocations.filter((a) => a.status === 'applied' && a.sharePaise > 0);
      const refs = applied.map((a) => adminDb.collection('rent_records').doc(a.rentRecordId || `${a.tenantId}_${bill.period}`));
      const snaps = refs.length ? await tx.getAll(...refs) : [];

      applied.forEach((a, i) => {
        const rs = snaps[i];
        a.status = 'reversed';
        a.reversedAt = nowIso;
        if (!rs || !rs.exists) {
          a.reversalMode = 'none';
          return;
        }
        const record = rs.data() as RentRecord;
        if (record.ownerId !== ownerId) {
          a.reversalMode = 'none';
          return;
        }
        const items: LineItem[] = record.lineItems || [];
        const idx = items.findIndex((li) => li.kind === 'utility' && li.utilityBillId === bill.id);
        const alreadyReversed = items.some((li) => li.kind === 'utility_reversal' && li.utilityBillId === bill.id);
        if (idx < 0 || alreadyReversed) {
          a.reversalMode = 'none';
          return;
        }

        const charged = items[idx].amountPaise;
        const due = record.amountDuePaise ?? lineSum(items);
        const paid = record.amountPaidPaise ?? 0;
        const newDue = Math.max(0, due - charged);
        let lineItems: LineItem[];
        if (record.status === RENT_STATUS.PENDING && paid === 0) {
          lineItems = items.filter((_, j) => j !== idx);
          a.reversalMode = 'removed';
          result.removed++;
        } else {
          lineItems = [
            ...items,
            {
              label: `Reversal · ${items[idx].label}`,
              amountPaise: -charged,
              kind: 'utility_reversal',
              utilityBillId: bill.id,
            },
          ];
          a.reversalMode = 'adjusted';
          result.adjusted++;
        }
        tx.update(rs.ref, { lineItems, amountDuePaise: newDue, updatedAt: now });

        if (paid > newDue) result.credits.push({ tenantName: a.tenantName, paise: paid - newDue });
        else if (paid > 0 && paid === newDue && record.status !== RENT_STATUS.PAID) result.covered.push(a.tenantName);
      });

      const historyEntry: UtilityBillHistoryEntry = { at: nowIso, by: actorUid, action: 'voided', note: trimmed };
      const patch: Partial<StoredUtilityBill> = {
        allocations,
        status: 'void',
        deletedAt: now,
        voidedAt: now,
        voidedBy: actorUid,
        voidReason: trimmed,
        updatedAt: now,
        history: [...(bill.history || []), historyEntry],
      };
      tx.update(billRef, patch);

      // Immutable audit record, same convention as rent reversal.
      tx.set(adminDb.collection('audit_logs').doc(), {
        actorUid,
        actorRole: 'owner',
        action: 'void_utility_bill',
        targetType: 'utility_bill',
        targetId: billId,
        reason: trimmed,
        totalPaise: bill.totalPaise,
        reversedShares: applied.length,
        createdAt: now,
      });

      updatedBill = { ...bill, ...patch } as StoredUtilityBill;
    });

    await recordEvent({
      category: 'payment',
      level: 'warn',
      message: `Utility bill VOIDED: ${updatedBill.label} · ${result.removed + result.adjusted} charge(s) reversed · reason: ${trimmed}`,
      ownerId,
      actorUid,
      targetId: billId,
      amountPaise: updatedBill.totalPaise,
    });

    return { bill: toUtilityBillDTO(updatedBill), result };
  }
}

export const utilitiesService = new UtilitiesService();
