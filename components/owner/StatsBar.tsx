'use client';

import React from 'react';
import { Bed, RentRecord } from '@/types';
import { formatCurrency } from '@/lib/utils';
import {
  Users,
  CheckCircle2,
  Clock,
  IndianRupee,
  AlertCircle,
  Send,
  BedDouble,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface StatsBarProps {
  beds: Bed[];
  rentRecords: RentRecord[];
  onRemindAll: () => void;
}

export function StatsBar({ beds, rentRecords, onRemindAll }: StatsBarProps) {
  const totalBeds = beds.length;
  const occupiedBeds = beds.filter((b) => b.status !== 'vacant').length;
  const occupancyRate = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

  // Rent status calculations
  const recordMap = new Map<string, RentRecord>();
  rentRecords.forEach((r) => recordMap.set(r.bedId, r));

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
      totalCollected += bed.monthlyRent;
    } else if (isVerify) {
      verifyCount++;
    } else {
      pendingCount++;
      totalPending += bed.monthlyRent;
    }
  });

  return (
    <div className="space-y-4">
      {/* Top Banner with Quick Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Occupancy Card */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 shadow-md backdrop-blur-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400">Total Occupancy</span>
            <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
              <BedDouble className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-white">{occupiedBeds}</span>
            <span className="text-xs text-slate-500 font-medium">/ {totalBeds} Beds</span>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2.5 overflow-hidden">
            <div
              className="bg-indigo-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${occupancyRate}%` }}
            />
          </div>
        </div>

        {/* Collected Rent Card */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 shadow-md backdrop-blur-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400">Collected Rent</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-400">{formatCurrency(totalCollected)}</span>
          </div>
          <span className="text-[11px] text-slate-400 mt-2 block">
            {paidCount} {paidCount === 1 ? 'bed' : 'beds'} paid this month
          </span>
        </div>

        {/* Pending Rent Card */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 shadow-md backdrop-blur-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400">Pending Dues</span>
            <div className="w-7 h-7 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-rose-400">{formatCurrency(totalPending)}</span>
          </div>
          <span className="text-[11px] text-slate-400 mt-2 block">
            {pendingCount} {pendingCount === 1 ? 'bed' : 'beds'} yet to pay
          </span>
        </div>

        {/* Verification / Quick Remind Action */}
        <div className="bg-gradient-to-br from-indigo-950/40 to-slate-900/60 border border-indigo-500/30 rounded-2xl p-4 shadow-md backdrop-blur-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-indigo-300">Fast Collection</span>
              {verifyCount > 0 && (
                <span className="text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full animate-pulse">
                  {verifyCount} to verify
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 leading-snug">
              {pendingCount > 0
                ? `${pendingCount} tenants pending rent for this month.`
                : 'All occupied beds have cleared rent! 🎉'}
            </p>
          </div>

          <Button
            size="sm"
            onClick={onRemindAll}
            disabled={pendingCount === 0}
            className="w-full mt-2 text-xs py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
          >
            <Send className="w-3.5 h-3.5 mr-1" />
            <span>Remind All Pending</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
