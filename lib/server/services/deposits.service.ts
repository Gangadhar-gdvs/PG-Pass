import 'server-only';
import { adminDb } from '../firebase-admin';
import { DepositRecord } from '@/types';
import { AppError } from '../api/withErrorHandler';
import { recordEvent } from './systemLogs.service';
import { tsToMillis } from '@/lib/utils';
import { Timestamp } from 'firebase-admin/firestore';

export interface RecordDepositInput {
  type: 'installment' | 'deduction' | 'refund';
  amountPaise: number;
  reason: string;
  reference?: string;
  recordedBy: string;
  // Optional client-supplied key to make a retried call a no-op instead of
  // double-counting the deposit ledger + tenant balance.
  idempotencyKey?: string;
}

export class DepositsService {
  async listDeposits(ownerId: string, tenantId: string): Promise<DepositRecord[]> {
    const snap = await adminDb
      .collection('deposits')
      .where('ownerId', '==', ownerId)
      .where('tenantId', '==', tenantId)
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get();

    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as DepositRecord));
  }

  async recordEntry(ownerId: string, tenantId: string, input: RecordDepositInput): Promise<DepositRecord> {
    const tenantRef = adminDb.collection('tenants').doc(tenantId);
    const depositRef = adminDb.collection('deposits').doc();
    // Scope the idempotency key to this owner+tenant so keys can't collide or be
    // replayed across accounts.
    const idemRef = input.idempotencyKey
      ? adminDb.collection('idempotency_keys').doc(`deposit_${ownerId}_${tenantId}_${input.idempotencyKey}`)
      : null;
    const now = Timestamp.now();

    let newEntry: DepositRecord;

    await adminDb.runTransaction(async (transaction) => {
      // Idempotency guard (reads first, per Firestore txn rules). A retried call
      // with the same key finds the marker and returns the stored result instead
      // of applying the ledger + balance change twice.
      if (idemRef) {
        const idemDoc = await transaction.get(idemRef);
        if (idemDoc.exists) {
          newEntry = idemDoc.data()!.result as DepositRecord;
          return;
        }
      }

      const tenantDoc = await transaction.get(tenantRef);
      if (!tenantDoc.exists) {
        throw new AppError(404, 'Tenant not found');
      }

      const tenantData = tenantDoc.data()!;
      if (tenantData.ownerId !== ownerId) {
        throw new AppError(403, 'Unauthorized tenant access');
      }

      let currentDepositPaid = tenantData.depositPaidPaise || 0;

      if (input.type === 'installment') {
        currentDepositPaid += input.amountPaise;
      } else if (input.type === 'refund' || input.type === 'deduction') {
        currentDepositPaid = Math.max(0, currentDepositPaid - input.amountPaise);
      }

      newEntry = {
        id: depositRef.id,
        ownerId,
        propertyId: tenantData.propertyId || ownerId,
        tenantId,
        type: input.type,
        amountPaise: input.amountPaise,
        reason: input.reason.trim(),
        reference: input.reference?.trim(),
        recordedBy: input.recordedBy,
        tenantName: tenantData.name,
        // Refunds start as a pending obligation until the owner pays out.
        ...(input.type === 'refund' ? { refundStatus: 'pending' as const } : {}),
        createdAt: now,
      };

      transaction.set(depositRef, newEntry);
      transaction.update(tenantRef, {
        depositPaidPaise: currentDepositPaid,
        updatedAt: now,
      });

      // Persist the idempotency marker (with the result) in the SAME transaction,
      // and an expiry so TTL can reap it. A retry now short-circuits above.
      if (idemRef) {
        transaction.set(idemRef, {
          result: newEntry,
          createdAt: now,
          expiresAt: Timestamp.fromMillis(now.toMillis() + 7 * 24 * 60 * 60 * 1000),
        });
      }
    });

    return newEntry!;
  }

  /** Owner marks a pending refund as actually paid out to the tenant. */
  async markRefundIssued(
    ownerId: string,
    depositId: string,
    actorUid: string,
    reference?: string
  ): Promise<DepositRecord> {
    const ref = adminDb.collection('deposits').doc(depositId);
    const snap = await ref.get();
    if (!snap.exists) throw new AppError(404, 'Deposit entry not found');
    const data = snap.data() as DepositRecord;
    if (data.ownerId !== ownerId) throw new AppError(403, 'Unauthorized');
    if (data.type !== 'refund') throw new AppError(400, 'Only refund entries can be marked issued');
    if (data.refundStatus === 'issued') throw new AppError(400, 'Refund already marked issued');

    const now = Timestamp.now();
    const update: Record<string, unknown> = {
      refundStatus: 'issued',
      issuedBy: actorUid,
      issuedAt: now,
    };
    if (reference) update.reference = reference.trim();

    await ref.update(update);

    await recordEvent({
      category: 'refund',
      message: `Deposit refund ₹${Math.round((data.amountPaise || 0) / 100)} marked issued for ${
        data.tenantName || 'tenant'
      }`,
      ownerId,
      actorUid,
      targetId: depositId,
      amountPaise: data.amountPaise,
    });

    return { ...data, ...update, id: depositId };
  }

  /** Pending (not-yet-paid-out) refunds across the owner's residents. */
  async listPendingRefunds(ownerId: string, limitCount = 50): Promise<DepositRecord[]> {
    const snap = await adminDb
      .collection('deposits')
      .where('ownerId', '==', ownerId)
      .where('type', '==', 'refund')
      .where('refundStatus', '==', 'pending')
      .limit(Math.min(limitCount, 100))
      .get();
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as DepositRecord))
      .sort((a, b) => tsToMillis(b.createdAt) - tsToMillis(a.createdAt));
  }
}

export const depositsService = new DepositsService();
