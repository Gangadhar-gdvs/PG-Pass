import 'server-only';
import { adminDb } from '../firebase-admin';
import { RentRecord, LineItem } from '@/types';
import { AppError } from '../api/withErrorHandler';
import { RENT_STATUS, RentStatus } from '@/lib/constants/status';
import { MAX_LIST_LIMIT } from '@/lib/constants/limits';
import { smsService } from './sms.service';
import { emailService } from './email.service';
import { recordEvent } from './systemLogs.service';
import { residentsService } from './residents.service';
import { sendFromOwnerGmail } from './gmail.service';
import { errorMessage, normalizePhone, formatCurrency, getCurrentPeriod } from '@/lib/utils';
import { hashUtr } from '../security/tokens';
import { Timestamp, Transaction, DocumentReference } from 'firebase-admin/firestore';

export interface CreateRentRecordInput {
  tenantId: string;
  period: string; // YYYY-MM
  lineItems: LineItem[];
  dueDate: string;
  prorated?: boolean;
}

export class RentService {
  async listRentRecords(
    ownerId: string,
    period?: string,
    status?: RentStatus,
    limitCount = 50,
    startAfterId?: string
  ): Promise<RentRecord[]> {
    const safeLimit = Math.min(limitCount, MAX_LIST_LIMIT);
    let q = adminDb
      .collection('rent_records')
      .where('ownerId', '==', ownerId);

    if (period) {
      q = q.where('period', '==', period);
    }
    if (status) {
      q = q.where('status', '==', status);
    }

    q = q.orderBy('dueDate', 'asc').limit(safeLimit);

    if (startAfterId) {
      const cursor = await adminDb.collection('rent_records').doc(startAfterId).get();
      if (cursor.exists) {
        q = q.startAfter(cursor);
      }
    }

    const snap = await q.get();
    return snap.docs.map((d) => ({ ...d.data(), id: d.id } as RentRecord));
  }

  /**
   * Defaulter / aging report: unpaid (pending/verify) records for an owner,
   * annotated with days overdue and an accrued late fee based on the owner's
   * configured `lateFeePerDayPaise` / `lateFeeGraceDays`. Ordered by most
   * overdue first. `todayIso` is passed in (YYYY-MM-DD) so the computation is
   * deterministic/testable and avoids `Date.now()` ambiguity.
   */
  async getDefaulters(
    ownerId: string,
    todayIso: string,
    limitCount = 100
  ): Promise<
    Array<
      RentRecord & {
        daysOverdue: number;
        lateFeePaise: number;
        outstandingPaise: number;
      }
    >
  > {
    const safeLimit = Math.min(limitCount, MAX_LIST_LIMIT);

    const ownerDoc = await adminDb.collection('owners').doc(ownerId).get();
    const lateFeePerDayPaise = (ownerDoc.data()?.lateFeePerDayPaise as number) || 0;
    const graceDays = (ownerDoc.data()?.lateFeeGraceDays as number) || 0;

    const snap = await adminDb
      .collection('rent_records')
      .where('ownerId', '==', ownerId)
      .where('status', 'in', [RENT_STATUS.PENDING, RENT_STATUS.VERIFY])
      .limit(safeLimit)
      .get();

    const today = Date.parse(`${todayIso}T00:00:00Z`);

    const rows = snap.docs
      .map((d) => ({ ...d.data(), id: d.id } as RentRecord))
      .map((r) => {
        const dueMs = r.dueDate ? Date.parse(`${r.dueDate}T00:00:00Z`) : today;
        const rawDays = Math.floor((today - dueMs) / (24 * 60 * 60 * 1000));
        const daysOverdue = Math.max(0, rawDays);
        const chargeableDays = Math.max(0, daysOverdue - graceDays);
        const lateFeePaise = chargeableDays * lateFeePerDayPaise;
        const due = r.amountDuePaise ?? 0;
        const paid = r.amountPaidPaise ?? 0;
        const outstandingPaise = Math.max(0, due - paid) + lateFeePaise;
        return { ...r, daysOverdue, lateFeePaise, outstandingPaise };
      })
      .filter((r) => r.daysOverdue > 0 || (r.amountDuePaise ?? 0) > (r.amountPaidPaise ?? 0))
      .sort((a, b) => b.daysOverdue - a.daysOverdue);

    return rows;
  }

  async getRentRecord(recordId: string, ownerId: string): Promise<RentRecord> {
    const doc = await adminDb.collection('rent_records').doc(recordId).get();
    if (!doc.exists) {
      throw new AppError(404, 'Rent record not found');
    }
    const data = doc.data() as RentRecord;
    if (data.ownerId !== ownerId) {
      throw new AppError(403, 'Unauthorized rent record access');
    }
    return { ...data, id: doc.id };
  }

  async createRentRecord(ownerId: string, input: CreateRentRecordInput): Promise<RentRecord> {
    const tenantDoc = await adminDb.collection('tenants').doc(input.tenantId).get();
    if (!tenantDoc.exists) {
      throw new AppError(404, 'Tenant not found');
    }

    const tenantData = tenantDoc.data()!;
    if (tenantData.ownerId !== ownerId) {
      throw new AppError(403, 'Unauthorized tenant access');
    }
    if (tenantData.deletedAt) {
      throw new AppError(400, 'Cannot generate rent for a deleted tenant');
    }

    // Deterministic doc ID prevents duplicate generation
    const docId = `${input.tenantId}_${input.period}`;
    const recordRef = adminDb.collection('rent_records').doc(docId);

    const existing = await recordRef.get();
    if (existing.exists) {
      throw new AppError(409, `Rent record for ${input.period} already exists`);
    }

    const totalAmountPaise = input.lineItems.reduce((acc, item) => acc + item.amountPaise, 0);
    const now = Timestamp.now();

    const newRecord: RentRecord = {
      id: docId,
      ownerId,
      propertyId: tenantData.propertyId || ownerId,
      tenantId: input.tenantId,
      tenantName: tenantData.name,
      period: input.period,
      roomNumber: tenantData.roomNumber || 'Unknown', // Snapshotted
      bedLabel: tenantData.bedLabel || 'Bed',         // Snapshotted
      lineItems: input.lineItems,
      prorated: input.prorated || false,
      amountDuePaise: totalAmountPaise,
      amountPaidPaise: 0,
      status: RENT_STATUS.PENDING,
      dueDate: input.dueDate,
      createdAt: now,
      updatedAt: now,
    };

    await recordRef.set(newRecord);
    return newRecord;
  }

  /**
   * Allocate the next per-property receipt sequence inside a transaction.
   * Uses properties/{propertyId}.nextReceiptSeq when that doc exists; otherwise
   * falls back to the owner doc's nextReceiptSeq (backward compatibility for the
   * primary property before its property doc is materialized).
   *
   * IMPORTANT: all reads happen before any write (Firestore transaction rule).
   */
  private async nextReceiptSeqInTxn(
    transaction: Transaction,
    ownerId: string,
    propertyId: string,
    ownerRef: DocumentReference,
    now: Timestamp
  ): Promise<number> {
    const propertyRef = adminDb.collection('properties').doc(propertyId);
    const propertyDoc = await transaction.get(propertyRef);

    if (propertyDoc.exists) {
      const nextSeq = (propertyDoc.data()?.nextReceiptSeq ?? 0) + 1;
      transaction.update(propertyRef, { nextReceiptSeq: nextSeq, updatedAt: now });
      return nextSeq;
    }

    // Legacy fallback: counter on the owner doc.
    const ownerDoc = await transaction.get(ownerRef);
    if (!ownerDoc.exists) throw new AppError(404, 'Owner profile not found');
    const nextSeq = (ownerDoc.data()?.nextReceiptSeq ?? 0) + 1;
    transaction.update(ownerRef, { nextReceiptSeq: nextSeq, updatedAt: now });
    return nextSeq;
  }

  /**
   * Confirms payment receipt: assigns atomic receiptNumber via nextReceiptSeq,
   * sets amountPaidPaise = amountDuePaise, transitions to 'paid'.
   */
  async confirmRent(
    ownerId: string,
    recordId: string,
    confirmedBy: string,
    params: { paymentReference?: string } = {}
  ): Promise<RentRecord> {
    const recordRef = adminDb.collection('rent_records').doc(recordId);
    const ownerRef = adminDb.collection('owners').doc(ownerId);
    const now = Timestamp.now();

    let updatedRecord: RentRecord;

    await adminDb.runTransaction(async (transaction) => {
      const recordDoc = await transaction.get(recordRef);
      if (!recordDoc.exists) {
        throw new AppError(404, 'Rent record not found');
      }

      const recordData = recordDoc.data() as RentRecord;
      if (recordData.ownerId !== ownerId) {
        throw new AppError(403, 'Unauthorized');
      }

      if (recordData.status === RENT_STATUS.PAID) {
        throw new AppError(400, 'This rent record is already verified and marked paid');
      }

      // Receipt numbers are PER PROPERTY. The counter lives on the
      // properties/{propertyId} doc; for legacy data without a materialized
      // property doc we fall back to the owner's nextReceiptSeq (primary
      // property == ownerId), keeping single-PG owners working unchanged.
      const nextSeq = await this.nextReceiptSeqInTxn(
        transaction,
        ownerId,
        recordData.propertyId || ownerId,
        ownerRef,
        now
      );

      // Update rent record
      const updatePayload: Partial<RentRecord> = {
        status: RENT_STATUS.PAID,
        amountPaidPaise: recordData.amountDuePaise,
        receiptNumber: nextSeq,
        confirmedAt: now,
        confirmedBy,
        updatedAt: now,
      };

      if (params.paymentReference) {
        updatePayload.paymentReference = params.paymentReference;
      }

      transaction.update(recordRef, updatePayload);

      updatedRecord = {
        ...recordData,
        ...updatePayload,
      };
    });

    await recordEvent({
      category: 'payment',
      message: `Rent confirmed for ${updatedRecord!.tenantName || 'tenant'} (${updatedRecord!.period}) · receipt REC-${String(
        updatedRecord!.receiptNumber
      ).padStart(5, '0')}`,
      ownerId,
      actorUid: confirmedBy,
      targetId: recordId,
      amountPaise: updatedRecord!.amountDuePaise,
    });

    return updatedRecord!;
  }

  /**
   * Records a partial (or advance) payment toward a rent record by accumulating
   * `amountPaidPaise`. If the accumulated amount covers `amountDuePaise`, the
   * record is marked `paid` and a receipt number is assigned atomically (same
   * invariant as confirmRent). Otherwise it stays `pending` with progress shown.
   *
   * `amountPaise` is the increment being recorded now (must be > 0).
   */
  async recordPartialPayment(
    ownerId: string,
    recordId: string,
    confirmedBy: string,
    params: { amountPaise: number; paymentReference?: string }
  ): Promise<RentRecord> {
    if (!params.amountPaise || params.amountPaise <= 0) {
      throw new AppError(400, 'Payment amount must be greater than zero');
    }

    const recordRef = adminDb.collection('rent_records').doc(recordId);
    const ownerRef = adminDb.collection('owners').doc(ownerId);
    const now = Timestamp.now();
    let updatedRecord: RentRecord;

    await adminDb.runTransaction(async (transaction) => {
      const recordDoc = await transaction.get(recordRef);
      if (!recordDoc.exists) throw new AppError(404, 'Rent record not found');

      const recordData = recordDoc.data() as RentRecord;
      if (recordData.ownerId !== ownerId) throw new AppError(403, 'Unauthorized');
      if (recordData.status === RENT_STATUS.PAID) {
        throw new AppError(400, 'This rent record is already fully paid');
      }

      const due = recordData.amountDuePaise ?? 0;
      const alreadyPaid = recordData.amountPaidPaise ?? 0;
      const remaining = Math.max(0, due - alreadyPaid);
      // Reject overpayment rather than silently losing the excess.
      if (params.amountPaise > remaining && remaining > 0) {
        throw new AppError(
          400,
          `Amount exceeds what's due. Only ₹${Math.round(remaining / 100)} remains on this rent.`
        );
      }
      const newPaid = Math.min(due, alreadyPaid + params.amountPaise);
      const fullyPaid = newPaid >= due;

      const updatePayload: Partial<RentRecord> = {
        amountPaidPaise: newPaid,
        updatedAt: now,
      };
      if (params.paymentReference) {
        updatePayload.paymentReference = params.paymentReference;
      }

      if (fullyPaid) {
        // Assign a per-property receipt number atomically, mirroring confirmRent.
        const nextSeq = await this.nextReceiptSeqInTxn(
          transaction,
          ownerId,
          recordData.propertyId || ownerId,
          ownerRef,
          now
        );
        updatePayload.status = RENT_STATUS.PAID;
        updatePayload.receiptNumber = nextSeq;
        updatePayload.confirmedAt = now;
        updatePayload.confirmedBy = confirmedBy;
      }

      transaction.update(recordRef, updatePayload);
      updatedRecord = { ...recordData, ...updatePayload };
    });

    await recordEvent({
      category: 'payment',
      message: `Partial payment ₹${Math.round(params.amountPaise / 100)} recorded for ${
        updatedRecord!.tenantName || 'tenant'
      } (${updatedRecord!.period})${updatedRecord!.status === RENT_STATUS.PAID ? ' · now fully paid' : ''}`,
      ownerId,
      actorUid: confirmedBy,
      targetId: recordId,
      amountPaise: params.amountPaise,
    });

    return updatedRecord!;
  }

  /**
   * Confirms multiple rent records in one request. Each record is confirmed in
   * its own transaction (sequentially, to keep the per-owner nextReceiptSeq
   * monotonic); failures are collected rather than aborting the whole batch.
   * Capped to protect against oversized requests.
   */
  async bulkConfirm(
    ownerId: string,
    recordIds: string[],
    confirmedBy: string
  ): Promise<{ confirmed: string[]; failed: Array<{ id: string; reason: string }> }> {
    const unique = Array.from(new Set(recordIds)).slice(0, 100);
    const confirmed: string[] = [];
    const failed: Array<{ id: string; reason: string }> = [];

    for (const id of unique) {
      try {
        await this.confirmRent(ownerId, id, confirmedBy, {
          paymentReference: 'Bulk confirmation',
        });
        confirmed.push(id);
      } catch (err: unknown) {
        failed.push({ id, reason: errorMessage(err, 'Failed') });
      }
    }

    return { confirmed, failed };
  }

  /**
   * Rejects an unverified claim: moves back from 'verify' to 'pending' and releases UTR lock.
   */
  async rejectClaim(ownerId: string, recordId: string, reason: string): Promise<void> {
    const recordRef = adminDb.collection('rent_records').doc(recordId);

    await adminDb.runTransaction(async (transaction) => {
      const recordDoc = await transaction.get(recordRef);
      if (!recordDoc.exists) throw new AppError(404, 'Rent record not found');

      const data = recordDoc.data() as RentRecord;
      if (data.ownerId !== ownerId) throw new AppError(403, 'Unauthorized');
      if (data.status !== RENT_STATUS.VERIFY) {
        throw new AppError(400, 'Can only reject records that are in verify status');
      }

      // Release the UTR lock if a reference was present. MUST use the same
      // hashed key the claim route wrote (`hashUtr`) — a plaintext key here
      // never matched, so rejected claims used to leave the UTR locked forever
      // and the resident could never re-submit that reference.
      if (data.paymentReference) {
        const utrDoc = adminDb.collection('utr_claims').doc(hashUtr(ownerId, data.paymentReference));
        transaction.delete(utrDoc);
      }

      transaction.update(recordRef, {
        status: RENT_STATUS.PENDING,
        paymentReference: null,
        proofPhotoId: null,
        rejectionReason: reason.trim(),
        updatedAt: Timestamp.now(),
      });
    });
  }

  /**
   * Resident-submitted payment claim: atomically dedup the UTR (so the same UPI
   * reference can't be claimed twice) and transition the resident's own rent
   * record from pending → verify. The caller MUST have already verified the
   * portal session + PIN and pass the resolved ownerId/tenantId. Owns the
   * Firestore transaction so the API route stays thin.
   */
  async claimPayment(params: {
    rentRecordId: string;
    ownerId: string;
    tenantId: string;
    normalizedUtr: string;
    proofPhotoId?: string;
  }): Promise<void> {
    const { rentRecordId, ownerId, tenantId, normalizedUtr, proofPhotoId } = params;
    const utrClaimRef = adminDb.collection('utr_claims').doc(hashUtr(ownerId, normalizedUtr));
    const rentRecordRef = adminDb.collection('rent_records').doc(rentRecordId);

    await adminDb.runTransaction(async (transaction) => {
      const existingUtr = await transaction.get(utrClaimRef);
      if (existingUtr.exists) {
        throw new AppError(
          409,
          'This UPI UTR number has already been claimed for another payment. Please verify the 12-digit number.'
        );
      }

      const rentRecordDoc = await transaction.get(rentRecordRef);
      if (!rentRecordDoc.exists) throw new AppError(404, 'Rent record not found');

      const rentData = rentRecordDoc.data()!;
      if (rentData.tenantId !== tenantId) {
        throw new AppError(403, 'Unauthorized rent record access');
      }
      if (rentData.status === RENT_STATUS.PAID) {
        throw new AppError(400, 'This rent record has already been marked as paid');
      }

      transaction.set(utrClaimRef, {
        ownerId,
        rentRecordId,
        tenantId,
        claimedAt: Timestamp.now(),
      });
      transaction.update(rentRecordRef, {
        status: RENT_STATUS.VERIFY,
        paymentReference: normalizedUtr,
        proofPhotoId: proofPhotoId || null,
        claimedAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
    });
  }

  /**
   * Stamps the reminder timestamp AND attempts to auto-send the reminder via
   * SMS (to the tenant's phone) and email (to a linked resident account), if
   * those providers are configured. When neither is configured it's a no-op and
   * the client keeps the free "open WhatsApp" flow. Returns which channels fired
   * so the UI can tell the owner what happened.
   */
  async recordReminded(
    ownerId: string,
    recordId: string
  ): Promise<{ sms: boolean; email: boolean }> {
    const record = await this.getRentRecord(recordId, ownerId);

    await adminDb.collection('rent_records').doc(recordId).update({
      lastRemindedAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    const channels = { sms: false, email: false };
    const due = ((record.amountDuePaise ?? 0) - (record.amountPaidPaise ?? 0)) / 100;
    const msg = `Rent reminder: ₹${Math.max(0, Math.round(due))} is pending for ${
      record.period || 'this month'
    }. Please pay via your PGPass portal. Thank you.`;

    // Tenant phone (for SMS).
    try {
      if (record.tenantId) {
        const tenantSnap = await adminDb.collection('tenants').doc(record.tenantId).get();
        const phone = tenantSnap.data()?.phone;
        if (phone) channels.sms = await smsService.send(phone, msg);

        // Email a linked resident account, if one exists for this phone.
        if (phone) {
          const resSnap = await adminDb
            .collection('residents')
            .where('phone', '==', normalizePhone(String(phone)))
            .limit(1)
            .get();
          const email = resSnap.docs[0]?.data()?.email;
          if (email) {
            channels.email = await emailService.send({
              to: email,
              subject: 'Rent reminder',
              html: `<p>${msg}</p>`,
            });
          }
        }
      }
    } catch {
      /* best-effort; stamping already succeeded */
    }

    // Record the reminder + which auto-channels fired (visible to admin).
    await recordEvent({
      category: 'comms',
      message: `Rent reminder sent (${record.tenantName || 'tenant'}, ${record.period}) · sms:${channels.sms} email:${channels.email}`,
      ownerId,
      targetId: recordId,
    });

    return channels;
  }

  /**
   * Owner-only audited reversal of an accidental 'paid' record.
   */
  async reverseRent(ownerId: string, recordId: string, reversalReason: string, actorUid: string): Promise<void> {
    if (!reversalReason || reversalReason.trim().length < 5) {
      throw new AppError(400, 'A valid explanation is required to reverse a paid record');
    }

    const recordRef = adminDb.collection('rent_records').doc(recordId);
    const now = Timestamp.now();

    await adminDb.runTransaction(async (transaction) => {
      const recordDoc = await transaction.get(recordRef);
      if (!recordDoc.exists) throw new AppError(404, 'Rent record not found');

      const data = recordDoc.data() as RentRecord;
      if (data.ownerId !== ownerId) throw new AppError(403, 'Unauthorized');
      if (data.status !== RENT_STATUS.PAID) {
        throw new AppError(400, 'Only paid records can be reversed');
      }

      // Revert status to pending and stamp reversal
      transaction.update(recordRef, {
        status: RENT_STATUS.PENDING,
        amountPaidPaise: 0,
        reversedAt: now,
        reversalReason: reversalReason.trim(),
        updatedAt: now,
      });

      // Write immutable audit_logs
      const auditRef = adminDb.collection('audit_logs').doc();
      transaction.set(auditRef, {
        actorUid,
        actorRole: 'owner',
        action: 'reverse_rent_paid',
        targetType: 'rent_record',
        targetId: recordId,
        reason: reversalReason.trim(),
        previousReceiptNumber: data.receiptNumber || null,
        createdAt: now,
      });
    });

    await recordEvent({
      category: 'payment',
      level: 'warn',
      message: `Rent payment REVERSED for record ${recordId} · reason: ${reversalReason.trim()}`,
      ownerId,
      actorUid,
      targetId: recordId,
    });
  }

  /**
   * The HTML body for a rent-reminder email. Single source of truth so the
   * bulk "email all unpaid" route and the per-resident reminder send the same
   * message. Pure — no I/O.
   */
  buildReminderEmailHtml(params: {
    tenantName: string;
    pgName: string;
    period: string;
    outstandingPaise: number;
    upiId?: string;
  }): string {
    const amountStr = formatCurrency(Math.max(0, params.outstandingPaise) / 100);
    return `
      <div style="font-family:Arial,sans-serif;font-size:14px;color:#0F172A;line-height:1.6">
        <p>Namaste ${params.tenantName},</p>
        <p>This is a friendly reminder that your rent for <b>${params.period}</b> at <b>${params.pgName}</b> is pending.</p>
        <p><b>Amount due: ${amountStr}</b></p>
        ${params.upiId ? `<p>You can pay directly via UPI: <b>${params.upiId}</b></p>` : ''}
        <p>Thank you,<br/>${params.pgName}</p>
      </div>`;
  }

  /**
   * Email ONE resident their rent reminder from the owner's connected Gmail, and
   * stamp `lastRemindedAt` on success. Resolves the resident email from the
   * tenant's phone. Returns a structured outcome so the API can tell the owner
   * exactly what happened (no-email → WhatsApp instead; sent; failed). Assumes
   * the caller already verified owner Gmail is connected + the record is unpaid.
   */
  async sendEmailReminderForRecord(params: {
    ownerId: string;
    record: RentRecord;
    pgName: string;
    upiId?: string;
  }): Promise<{ outcome: 'sent' | 'no_email' | 'failed'; email?: string; tenantName: string }> {
    const { ownerId, record, pgName, upiId } = params;
    let phone = '';
    let tenantName = record.tenantName || 'Resident';
    if (record.tenantId) {
      const tSnap = await adminDb.collection('tenants').doc(record.tenantId).get();
      phone = (tSnap.data()?.phone as string) || '';
      tenantName = (tSnap.data()?.name as string) || tenantName;
    }

    const email = phone ? await residentsService.emailForPhone(phone) : null;
    if (!email) return { outcome: 'no_email', tenantName };

    const outstandingPaise = Math.max(0, (record.amountDuePaise ?? 0) - (record.amountPaidPaise ?? 0));
    const period = record.period || getCurrentPeriod();
    const ok = await sendFromOwnerGmail(ownerId, {
      to: email,
      subject: `Rent reminder — ${pgName} (${period})`,
      html: this.buildReminderEmailHtml({ tenantName, pgName, period, outstandingPaise, upiId }),
      fromName: pgName,
    }).catch(() => false);

    if (ok && record.id) {
      await adminDb
        .collection('rent_records')
        .doc(record.id)
        .update({ lastRemindedAt: Timestamp.now() })
        .catch(() => {});
    }
    return { outcome: ok ? 'sent' : 'failed', email, tenantName };
  }
}

export const rentService = new RentService();
