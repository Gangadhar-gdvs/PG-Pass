import 'server-only';
import { adminDb } from '../firebase-admin';
import { RentRecord, LineItem } from '@/types';
import { AppError } from '../api/withErrorHandler';
import { RENT_STATUS, RentStatus } from '@/lib/constants/status';
import { MAX_LIST_LIMIT } from '@/lib/constants/limits';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';

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

      // Fetch owner to increment receipt sequence
      const ownerDoc = await transaction.get(ownerRef);
      if (!ownerDoc.exists) {
        throw new AppError(404, 'Owner profile not found');
      }

      const nextSeq = (ownerDoc.data()?.nextReceiptSeq ?? 0) + 1;

      // Update owner nextReceiptSeq
      transaction.update(ownerRef, {
        nextReceiptSeq: nextSeq,
        updatedAt: now,
      });

      // Update rent record
      const updatePayload: any = {
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

    return updatedRecord!;
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

      // Release UTR lock if reference was present
      if (data.paymentReference) {
        const utrHash = `${ownerId}_${data.paymentReference.trim().toUpperCase()}`;
        const utrDoc = adminDb.collection('utr_claims').doc(utrHash);
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
   * Records WhatsApp reminder timestamp for "Send & Next" queue.
   */
  async recordReminded(ownerId: string, recordId: string): Promise<void> {
    const record = await this.getRentRecord(recordId, ownerId);
    await adminDb.collection('rent_records').doc(recordId).update({
      lastRemindedAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
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
  }
}

export const rentService = new RentService();
