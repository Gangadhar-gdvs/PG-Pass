import 'server-only';
import { adminDb } from '../firebase-admin';
import { Tenant, RentRecord, Expense } from '@/types';
import { formatCurrency } from '@/lib/utils';

/**
 * Exportable datasets for the owner's Reports page. Each returns {headers, rows}
 * ready for `toCsv`. All scoped to the owner; money shown in rupees. Only
 * owner-safe fields are exported (no tokens, no internal ids beyond labels).
 */
export class ReportsService {
  async residentsExport(ownerId: string): Promise<{ headers: string[]; rows: unknown[][] }> {
    const snap = await adminDb
      .collection('tenants')
      .where('ownerId', '==', ownerId)
      .where('deletedAt', '==', null)
      .limit(1000)
      .get();
    const headers = ['Name', 'Phone', 'Room', 'Bed', 'Move-in', 'Deposit (₹)', 'Status'];
    const rows = snap.docs.map((d) => {
      const t = d.data() as Tenant;
      return [
        t.name,
        t.phone,
        t.roomNumber || '',
        t.bedLabel || '',
        t.moveInDate || '',
        Math.round((t.depositPaidPaise ?? 0) / 100),
        t.moveOutDate ? 'Moved out' : 'Active',
      ];
    });
    return { headers, rows };
  }

  async rentExport(ownerId: string, period?: string): Promise<{ headers: string[]; rows: unknown[][] }> {
    let q = adminDb.collection('rent_records').where('ownerId', '==', ownerId);
    if (period) q = q.where('period', '==', period);
    const snap = await q.limit(2000).get();
    const headers = ['Period', 'Resident', 'Room', 'Bed', 'Due (₹)', 'Paid (₹)', 'Status', 'Receipt #'];
    const rows = snap.docs.map((d) => {
      const r = d.data() as RentRecord;
      return [
        r.period || '',
        r.tenantName || '',
        r.roomNumber || '',
        r.bedLabel || '',
        Math.round((r.amountDuePaise ?? 0) / 100),
        Math.round((r.amountPaidPaise ?? 0) / 100),
        r.status,
        r.receiptNumber ?? '',
      ];
    });
    return { headers, rows };
  }

  async expensesExport(ownerId: string, period?: string): Promise<{ headers: string[]; rows: unknown[][] }> {
    let q = adminDb.collection('expenses').where('ownerId', '==', ownerId).where('deletedAt', '==', null);
    if (period) q = q.where('period', '==', period);
    const snap = await q.limit(2000).get();
    const headers = ['Date', 'Category', 'Amount (₹)', 'Vendor', 'Note'];
    const rows = snap.docs.map((d) => {
      const e = d.data() as Expense;
      return [e.date || '', e.category, Math.round((e.amountPaise ?? 0) / 100), e.vendor || '', e.note || ''];
    });
    return { headers, rows };
  }

  /** Human-readable summary numbers for the Reports page header cards. */
  async summary(ownerId: string, period: string): Promise<{
    residents: number;
    collectedStr: string;
    pendingStr: string;
    expensesStr: string;
    netStr: string;
  }> {
    const [tenantsSnap, rentSnap, expSnap] = await Promise.all([
      adminDb.collection('tenants').where('ownerId', '==', ownerId).where('deletedAt', '==', null).count().get(),
      adminDb.collection('rent_records').where('ownerId', '==', ownerId).where('period', '==', period).limit(1000).get(),
      adminDb.collection('expenses').where('ownerId', '==', ownerId).where('deletedAt', '==', null).where('period', '==', period).limit(1000).get(),
    ]);
    let collected = 0;
    let pending = 0;
    rentSnap.docs.forEach((d) => {
      const r = d.data() as RentRecord;
      const due = r.amountDuePaise ?? 0;
      const paid = r.amountPaidPaise ?? 0;
      collected += paid;
      pending += Math.max(0, due - paid);
    });
    let expenses = 0;
    expSnap.docs.forEach((d) => (expenses += (d.data() as Expense).amountPaise ?? 0));
    return {
      residents: tenantsSnap.data().count,
      collectedStr: formatCurrency(collected / 100),
      pendingStr: formatCurrency(pending / 100),
      expensesStr: formatCurrency(expenses / 100),
      netStr: formatCurrency((collected - expenses) / 100),
    };
  }
}

export const reportsService = new ReportsService();
