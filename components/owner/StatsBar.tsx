'use client';

import React from 'react';
import { Bed, RentRecord } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { Send, CheckCircle2 } from 'lucide-react';
import { DonutChart, StatTile } from '@/components/ui/dashboard-kit';

export interface DashboardSummary {
  totalBeds: number;
  occupiedBeds: number;
  vacantBeds: number;
  occupancyRate: number;
  monthlyPotential: number;
  occupiedPotential: number;
}

interface StatsBarProps {
  beds: Bed[];
  rentRecords: RentRecord[];
  onRemindAll: () => void;
  // Accurate server-computed totals (via Firestore aggregations). When present,
  // the occupancy/potential figures come from here instead of the live bed
  // window, so they're correct for PGs larger than the 100-row cap.
  summary?: DashboardSummary | null;
}

export function StatsBar({ beds, rentRecords, onRemindAll, summary }: StatsBarProps) {
  // Prefer the server summary for whole-PG totals; fall back to the live window
  // (correct for PGs ≤100 beds, and used while the summary is still loading).
  const totalBeds = summary?.totalBeds ?? beds.length;
  const occupiedBeds = summary?.occupiedBeds ?? beds.filter((b) => b.status !== 'vacant').length;
  const vacantBeds = summary?.vacantBeds ?? totalBeds - occupiedBeds;
  const occupancyRate =
    summary?.occupancyRate ?? (totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0);

  // Rent records key by tenantId (doc id `${tenantId}_${period}`), not bedId.
  const recordByTenant = new Map<string, RentRecord>();
  rentRecords.forEach((r) => {
    if (r.tenantId) recordByTenant.set(r.tenantId, r);
  });

  let totalCollected = 0;
  let totalPending = 0;
  let paidCount = 0;
  let pendingCount = 0;
  let verifyCount = 0;

  beds.forEach((bed) => {
    // Skip vacant and guests (guests are billed separately, no monthly record).
    if (bed.status === 'vacant' || bed.status === 'guest') return;

    // Status from the selected month's record (via tenant), not bed.status.
    const record = bed.tenantId ? recordByTenant.get(bed.tenantId) : undefined;
    const isPaid = record?.status === 'paid';
    const isVerify = record?.status === 'verify';

    // Prefer the record's real amounts (honours partial payments + prorating) and
    // fall back to the bed's configured monthly rent when no record exists yet.
    const paidRupees = record ? Math.round((record.amountPaidPaise ?? 0) / 100) : 0;
    const dueRupees = record
      ? Math.round((record.amountDuePaise ?? 0) / 100)
      : bed.monthlyRent || 0;

    if (isPaid) {
      paidCount++;
      totalCollected += dueRupees;
    } else if (isVerify) {
      verifyCount++;
      // A payment awaiting verification is partly collected in reality.
      totalCollected += paidRupees;
      totalPending += Math.max(0, dueRupees - paidRupees);
    } else {
      pendingCount++;
      // Count any partial already paid toward collected; the rest is pending.
      totalCollected += paidRupees;
      totalPending += Math.max(0, dueRupees - paidRupees);
    }
  });

  const totalProjected = totalCollected + totalPending;

  const collectRate = totalProjected > 0 ? Math.round((totalCollected / totalProjected) * 100) : 0;

  return (
    <div className="space-y-3.5 text-left">
      {/* Overview card: donut occupancy + collected / pending (matches design ref) */}
      <section className="app-card p-4">
        <h2 className="mb-3 text-sm font-bold text-[#0F172A]">Overview</h2>
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="shrink-0">
            <DonutChart percent={occupancyRate} size={112} stroke={12} sublabel="Occupancy" />
          </div>
          <div className="min-w-0 flex-1 space-y-2.5">
            <div className="flex items-center justify-between rounded-[12px] bg-[#E7F9F1] px-3 py-2">
              <span className="text-xs font-semibold text-[#0F766E]">Occupied</span>
              <span className="font-mono-numbers text-sm font-extrabold text-[#0F766E]">
                {occupiedBeds}<span className="text-[#5EC7A8]"> / {totalBeds}</span>
              </span>
            </div>
            <div className="flex items-center justify-between rounded-[12px] bg-[#F1EDFF] px-3 py-2">
              <span className="text-xs font-semibold text-[#6D28D9]">Vacant</span>
              <span className="font-mono-numbers text-sm font-extrabold text-[#6D28D9]">{vacantBeds}</span>
            </div>
            {verifyCount > 0 && (
              <div className="flex items-center justify-between rounded-[12px] bg-[#E8F1FF] px-3 py-2">
                <span className="text-xs font-semibold text-[#1D4ED8]">Proofs to verify</span>
                <span className="font-mono-numbers text-sm font-extrabold text-[#1D4ED8]">{verifyCount}</span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Collected / pending pastel stat tiles */}
      <div className="grid grid-cols-2 gap-3">
        <StatTile
          icon={<CheckCircle2 className="h-5 w-5 text-[#0F766E]" />}
          tint="mint"
          label={`Collected · ${paidCount} paid`}
          value={formatCurrency(totalCollected)}
          delta={`${collectRate}%`}
        />
        <StatTile
          icon={<Send className="h-5 w-5 text-[#C2410C]" />}
          tint="peach"
          label={`Pending · ${pendingCount} due`}
          value={formatCurrency(totalPending)}
        />
      </div>

      {pendingCount > 0 && (
        <button
          type="button"
          onClick={onRemindAll}
          className="flex w-full items-center justify-center gap-1.5 rounded-[14px] accent-bg py-2.5 text-xs font-bold text-white shadow-[var(--shadow-sm)] press"
        >
          <Send className="h-3.5 w-3.5" />
          <span>Send 1-Tap Rent Reminders</span>
        </button>
      )}
    </div>
  );
}
