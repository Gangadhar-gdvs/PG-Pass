'use client';

import React from 'react';
import { Bed, RentRecord } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { Send, CheckCircle2, AlertCircle, Building2, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProgressBar } from '@/components/ui/progress-bar';

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

  const recordMap = new Map<string, RentRecord>();
  rentRecords.forEach((r) => {
    if (r.bedId) recordMap.set(r.bedId, r);
  });

  let totalCollected = 0;
  let totalPending = 0;
  let paidCount = 0;
  let pendingCount = 0;
  let verifyCount = 0;

  beds.forEach((bed) => {
    if (bed.status === 'vacant') return;

    const record = recordMap.get(bed.id);
    const isPaid = bed.status === 'paid' || record?.status === 'paid';
    const isVerify = bed.status === 'verify' || record?.status === 'verify';

    if (isPaid) {
      paidCount++;
      totalCollected += bed.monthlyRent || 0;
    } else if (isVerify) {
      verifyCount++;
    } else {
      pendingCount++;
      totalPending += bed.monthlyRent || 0;
    }
  });

  const totalProjected = totalCollected + totalPending;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 text-left stagger">
      {/* Bento Widget 1: Occupancy HUD */}
      <div className="app-card p-4.5 flex flex-col justify-between space-y-3 press">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">
            Occupancy Rate
          </span>
          <span className="inline-flex items-center font-mono-numbers text-xs font-bold text-[#D97706] bg-[#FEF3C7] px-2 py-0.5 rounded-[6px]">
            {occupancyRate}%
          </span>
        </div>

        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono-numbers text-[#09090B]">
              {occupiedBeds}
            </span>
            <span className="text-xs text-[#94A3B8] font-mono-numbers">
              / {totalBeds} Units Occupied
            </span>
          </div>
          <p className="text-[11px] text-[#64748B] mt-0.5">
            {vacantBeds} bed{vacantBeds === 1 ? '' : 's'} ready for lease
          </p>
        </div>

        <ProgressBar value={occupancyRate} color="amber" height="sm" />
      </div>

      {/* Bento Widget 2: Collected Rent Revenue */}
      <div className="app-card p-4.5 flex flex-col justify-between space-y-3 press">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">
            Collected MTD
          </span>
          <span className="text-[11px] font-semibold text-[#10B981] flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{paidCount} Settled</span>
          </span>
        </div>

        <div>
          <span className="text-2xl font-bold font-mono-numbers text-[#10B981] block">
            {formatCurrency(totalCollected)}
          </span>
          <p className="text-[11px] text-[#64748B] mt-0.5">
            Target: {formatCurrency(totalProjected)}
          </p>
        </div>

        <ProgressBar
          value={totalProjected > 0 ? (totalCollected / totalProjected) * 100 : 0}
          color="emerald"
          height="sm"
        />
      </div>

      {/* Bento Widget 3: Pending Dues */}
      <div className="app-card p-4.5 flex flex-col justify-between space-y-3 press">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">
            Pending Collection
          </span>
          <span className="text-[11px] font-semibold text-[#F59E0B] font-mono-numbers">
            {pendingCount} Due
          </span>
        </div>

        <div>
          <span className="text-2xl font-bold font-mono-numbers text-[#D97706] block">
            {formatCurrency(totalPending)}
          </span>
          <p className="text-[11px] text-[#64748B] mt-0.5">
            Across {pendingCount} active resident{pendingCount === 1 ? '' : 's'}
          </p>
        </div>

        {pendingCount > 0 ? (
          <button
            type="button"
            onClick={onRemindAll}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-[6px] bg-[#FEF3C7] hover:bg-[#FDE68A] text-[#92400E] text-xs font-semibold transition-colors cursor-pointer"
          >
            <Send className="w-3 h-3" />
            <span>Send 1-Tap Reminders</span>
          </button>
        ) : (
          <div className="text-[11px] text-[#10B981] font-medium py-1">
            ✓ All monthly rents settled
          </div>
        )}
      </div>

      {/* Bento Widget 4: Proof Queue / Live System Status */}
      <div className="app-card p-4.5 flex flex-col justify-between space-y-3 press">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">
            Live Proof Queue
          </span>
          <span className="h-2 w-2 rounded-full bg-[#10B981] animate-pulse" />
        </div>

        <div>
          {verifyCount > 0 ? (
            <div className="space-y-1">
              <span className="text-2xl font-bold font-mono-numbers text-[#6366F1] block">
                {verifyCount}
              </span>
              <p className="text-[11px] text-[#475569]">
                Screenshot{verifyCount > 1 ? 's' : ''} awaiting approval
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              <span className="text-2xl font-bold font-mono-numbers text-[#09090B] block">
                0
              </span>
              <p className="text-[11px] text-[#64748B]">
                Verification queue is empty
              </p>
            </div>
          )}
        </div>

        <div className="pt-2 border-t border-[#E2E8F0] text-[11px] text-[#64748B] flex items-center justify-between">
          <span>HRA Automation</span>
          <span className="font-semibold text-[#10B981]">Active</span>
        </div>
      </div>
    </div>
  );
}
