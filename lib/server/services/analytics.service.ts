import 'server-only';
import { adminDb } from '../firebase-admin';
import { Bed, RentRecord } from '@/types';
import { rentService } from './rent.service';
import { recentPeriods, aggregateTrend, PeriodStat } from '@/lib/analytics-math';
import { expensesService } from './expenses.service';

export type { PeriodStat };

export interface AgingBuckets {
  due0to30Paise: number;
  due31to60Paise: number;
  due61to90Paise: number;
  due90PlusPaise: number;
  count0to30: number;
  count31to60: number;
  count61to90: number;
  count90Plus: number;
}

export interface OwnerAnalytics {
  totalBeds: number;
  occupiedBeds: number;
  vacantBeds: number;
  occupancyRate: number; // 0–100
  currentPeriod: string;
  currentCollectionRate: number; // 0–100
  currentCollectedPaise: number;
  currentDuePaise: number;
  monthlyRevenuePotentialPaise: number;
  trend: PeriodStat[]; // oldest → newest
  aging: AgingBuckets;
  totalOutstandingPaise: number;
  defaulterCount: number;
  currentExpensePaise: number;
  currentNetPaise: number; // collected − expenses this period
}

export class AnalyticsService {
  async getOwnerAnalytics(ownerId: string, todayIso: string): Promise<OwnerAnalytics> {
    const currentPeriod = todayIso.slice(0, 7);
    const periods = recentPeriods(currentPeriod, 6);
    const earliest = periods[0];

    // Beds (occupancy) + recent rent records (trend) + current-period expenses.
    const [bedsSnap, recordsSnap, defaulters, currentExpensePaise] = await Promise.all([
      adminDb.collection('beds').where('ownerId', '==', ownerId).limit(1000).get(),
      adminDb
        .collection('rent_records')
        .where('ownerId', '==', ownerId)
        .where('period', '>=', earliest)
        .orderBy('period', 'asc')
        .limit(1000)
        .get(),
      rentService.getDefaulters(ownerId, todayIso, 500),
      expensesService.totalForPeriod(ownerId, currentPeriod),
    ]);

    const beds = bedsSnap.docs.map((d) => ({ ...d.data(), id: d.id } as Bed));
    const totalBeds = beds.length;
    const occupiedBeds = beds.filter((b) => b.status !== 'vacant').length;
    const vacantBeds = totalBeds - occupiedBeds;
    const occupancyRate = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;
    const monthlyRevenuePotentialPaise = beds.reduce(
      (s, b) => s + Math.round((b.monthlyRent || 0) * 100),
      0
    );

    const records = recordsSnap.docs.map((d) => ({ ...d.data(), id: d.id } as RentRecord));
    const trend = aggregateTrend(records, periods);
    const current = trend[trend.length - 1];

    // Aging buckets from the defaulter report.
    const aging: AgingBuckets = {
      due0to30Paise: 0,
      due31to60Paise: 0,
      due61to90Paise: 0,
      due90PlusPaise: 0,
      count0to30: 0,
      count31to60: 0,
      count61to90: 0,
      count90Plus: 0,
    };
    let totalOutstandingPaise = 0;
    for (const d of defaulters) {
      totalOutstandingPaise += d.outstandingPaise;
      if (d.daysOverdue <= 30) {
        aging.due0to30Paise += d.outstandingPaise;
        aging.count0to30++;
      } else if (d.daysOverdue <= 60) {
        aging.due31to60Paise += d.outstandingPaise;
        aging.count31to60++;
      } else if (d.daysOverdue <= 90) {
        aging.due61to90Paise += d.outstandingPaise;
        aging.count61to90++;
      } else {
        aging.due90PlusPaise += d.outstandingPaise;
        aging.count90Plus++;
      }
    }

    return {
      totalBeds,
      occupiedBeds,
      vacantBeds,
      occupancyRate,
      currentPeriod,
      currentCollectionRate: current.collectionRate,
      currentCollectedPaise: current.collectedPaise,
      currentDuePaise: current.duePaise,
      monthlyRevenuePotentialPaise,
      trend,
      aging,
      totalOutstandingPaise,
      defaulterCount: defaulters.length,
      currentExpensePaise,
      currentNetPaise: current.collectedPaise - currentExpensePaise,
    };
  }
}

export const analyticsService = new AnalyticsService();
