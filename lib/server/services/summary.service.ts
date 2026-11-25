import 'server-only';
import { adminDb } from '../firebase-admin';
import { AggregateField } from 'firebase-admin/firestore';
import { BED_STATUS, RENT_STATUS } from '@/lib/constants/status';
import { getCurrentPeriod } from '@/lib/utils';

/**
 * Lightweight, SCALE-SAFE dashboard summary.
 *
 * The owner dashboard's live bed grid is a bounded `onSnapshot` window (<=100
 * rows per firestore.rules), so computing totals from that client array
 * under-reports for PGs larger than 100 beds. This service instead derives the
 * headline numbers server-side using Firestore COUNT()/SUM() AGGREGATIONS, which
 * run over the whole collection and read ZERO documents — so the figures are
 * correct and cheap no matter how large the PG is.
 */
export interface OwnerSummary {
  totalBeds: number;
  occupiedBeds: number;
  vacantBeds: number;
  occupancyRate: number; // 0–100
  // Monthly rent potential split by occupancy state (rupees).
  monthlyPotential: number;
  occupiedPotential: number;
  // Current billing period rent collection.
  period: string;
  paidRecords: number;
  pendingRecords: number;
}

export class SummaryService {
  async getOwnerSummary(ownerId: string, propertyId?: string): Promise<OwnerSummary> {
    const period = getCurrentPeriod();

    const bedsBase = () => {
      let q = adminDb
        .collection('beds')
        .where('ownerId', '==', ownerId)
        .where('deletedAt', '==', null);
      if (propertyId) q = q.where('propertyId', '==', propertyId);
      return q;
    };

    const rentBase = () => {
      let q = adminDb
        .collection('rent_records')
        .where('ownerId', '==', ownerId)
        .where('period', '==', period);
      if (propertyId) q = q.where('propertyId', '==', propertyId);
      return q;
    };

    // All aggregations run concurrently. Each is a COUNT/SUM aggregation — no
    // document payloads are transferred, so this stays O(1) on the wire.
    // Avoid `!=` in aggregations (special index + semantics): compute the total
    // and the VACANT slice, then derive OCCUPIED by subtraction. Each query is a
    // single-field equality + aggregation — already covered by existing indexes.
    const [
      totalAgg,
      totalPotentialAgg,
      vacantAgg,
      vacantPotentialAgg,
      paidAgg,
      pendingAgg,
    ] = await Promise.all([
      bedsBase().count().get(),
      bedsBase().aggregate({ sum: AggregateField.sum('monthlyRent') }).get(),
      bedsBase().where('status', '==', BED_STATUS.VACANT).count().get(),
      bedsBase()
        .where('status', '==', BED_STATUS.VACANT)
        .aggregate({ sum: AggregateField.sum('monthlyRent') })
        .get(),
      rentBase().where('status', '==', RENT_STATUS.PAID).count().get(),
      rentBase().where('status', '==', RENT_STATUS.PENDING).count().get(),
    ]);

    const totalBeds = totalAgg.data().count;
    const vacantBeds = vacantAgg.data().count;
    const occupiedBeds = Math.max(0, totalBeds - vacantBeds);
    const occupancyRate = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;
    const monthlyPotential = Math.round(totalPotentialAgg.data().sum || 0);
    const vacantPotential = Math.round(vacantPotentialAgg.data().sum || 0);

    return {
      totalBeds,
      occupiedBeds,
      vacantBeds,
      occupancyRate,
      monthlyPotential,
      occupiedPotential: Math.max(0, monthlyPotential - vacantPotential),
      period,
      paidRecords: paidAgg.data().count,
      pendingRecords: pendingAgg.data().count,
    };
  }
}

export const summaryService = new SummaryService();
