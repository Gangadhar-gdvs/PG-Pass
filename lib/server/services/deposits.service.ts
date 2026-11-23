import 'server-only';
import { adminDb } from '../firebase-admin';
import { DepositRecord } from '@/types';
import { AppError } from '../api/withErrorHandler';
import { Timestamp } from 'firebase-admin/firestore';

export interface RecordDepositInput {
  type: 'installment' | 'deduction' | 'refund';
  amountPaise: number;
  reason: string;
  reference?: string;
  recordedBy: string;
}

export class DepositsService {
  async listDeposits(ownerId: string, tenantId: string): Promise<DepositRecord[]> {
    const snap = await adminDb
      .collection('deposits')
      .where('ownerId', '==', ownerId)
      .where('tenantId', '==', tenantId)
      .orderBy('createdAt', 'desc')
      .get();

    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as DepositRecord));
  }

  async recordEntry(ownerId: string, tenantId: string, input: RecordDepositInput): Promise<DepositRecord> {
    const tenantRef = adminDb.collection('tenants').doc(tenantId);
    const depositRef = adminDb.collection('deposits').doc();
    const now = Timestamp.now();

    let newEntry: DepositRecord;

    await adminDb.runTransaction(async (transaction) => {
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
        tenantId,
        type: input.type,
        amountPaise: input.amountPaise,
        reason: input.reason.trim(),
        reference: input.reference?.trim(),
        recordedBy: input.recordedBy,
        createdAt: now,
      };

      transaction.set(depositRef, newEntry);
      transaction.update(tenantRef, {
        depositPaidPaise: currentDepositPaid,
        updatedAt: now,
      });
    });

    return newEntry!;
  }
}

export const depositsService = new DepositsService();
