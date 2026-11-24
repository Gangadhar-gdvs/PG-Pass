'use client';

import React from 'react';
import { Bed, RentRecord } from '@/types';
import { formatCurrency, getWhatsAppLink } from '@/lib/utils';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  UserPlus,
  Send,
  Check,
  Eye,
  CheckCircle2,
  Clock,
  Sparkles,
  Users,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';

export interface RoomData {
  roomNumber: string;
  floor: number;
  sharingType: '1' | '2' | '3' | '4' | '5' | '6';
  acType: 'ac' | 'non-ac';
  beds: Bed[];
  monthlyRent: number;
  vacantCount: number;
  occupiedCount: number;
  totalCapacity: number;
}

const SHARING_CONFIG: Record<
  string,
  { label: string; bg: string; text: string; border: string }
> = {
  '1': {
    label: 'Single Private',
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200',
  },
  '2': {
    label: '2-Share (Double)',
    bg: 'bg-sky-50',
    text: 'text-sky-700',
    border: 'border-sky-200',
  },
  '3': {
    label: '3-Share (Triple)',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
  },
  '4': {
    label: '4-Share (Quad)',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
  },
  '5': {
    label: '5-Share',
    bg: 'bg-indigo-50',
    text: 'text-indigo-700',
    border: 'border-indigo-200',
  },
  '6': {
    label: '6-Share (Dorm)',
    bg: 'bg-orange-50',
    text: 'text-orange-700',
    border: 'border-orange-200',
  },
};

interface RoomCardProps {
  room: RoomData;
  recordMap: Map<string, RentRecord>;
  ownerName: string;
  pgName: string;
  ownerUpi: string;
  onAddTenant: (bed: Bed) => void;
  onMarkPaid: (bed: Bed, record?: RentRecord) => void;
  onVerifyProof: (bed: Bed, record: RentRecord) => void;
  onVacate: (bed: Bed) => void;
  onSelectBed?: (bed: Bed) => void;
}

export function RoomCard({
  room,
  recordMap,
  ownerName,
  pgName,
  ownerUpi,
  onAddTenant,
  onMarkPaid,
  onVerifyProof,
  onVacate,
  onSelectBed,
}: RoomCardProps) {
  const shareCfg = SHARING_CONFIG[room.sharingType] || {
    label: `${room.sharingType}-Share`,
    bg: 'bg-slate-50',
    text: 'text-slate-700',
    border: 'border-slate-200',
  };

  const isAllVacant = room.occupiedCount === 0;
  const isFull = room.vacantCount === 0;

  const handleSendReminder = (e: React.MouseEvent, bed: Bed) => {
    e.stopPropagation();
    if (!bed.tenantPhone) return;

    const message = `Namaste ${bed.tenantName || 'Resident'} ji 🙏,\n\nFriendly reminder from ${pgName}: rent of ${formatCurrency(
      bed.monthlyRent
    )} for Bed ${bed.bedLabel} (Room ${room.roomNumber}) is due.\n\nPlease pay to UPI: ${ownerUpi || 'our PG UPI'}.\n\nThank you,\n${ownerName || 'PG Management'}`;

    const link = getWhatsAppLink(bed.tenantPhone, message);
    window.open(link, '_blank');
  };

  return (
    <div className="bg-white border border-[#E2E8F0] hover:border-[#CBD5E1] rounded-[14px] p-4 sm:p-5 shadow-xs transition-all duration-150 flex flex-col justify-between text-left">
      {/* ROOM HEADER */}
      <div>
        <div className="flex items-start justify-between gap-2 pb-3 border-b border-[#F1F5F9]">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-base font-extrabold text-[#09090B] tracking-tight">
                Room {room.roomNumber}
              </span>

              {/* Distinct Sharing Format Badge */}
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-[6px] border ${shareCfg.bg} ${shareCfg.text} ${shareCfg.border} inline-flex items-center gap-1`}
              >
                <Users className="w-3 h-3" />
                <span>{shareCfg.label}</span>
              </span>

              {/* Climate Badge */}
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded-[5px] border ${
                  room.acType === 'ac'
                    ? 'bg-[#E0F2FE] text-[#0369A1] border-[#BAE6FD]'
                    : 'bg-[#F8FAFC] text-[#64748B] border-[#E2E8F0]'
                }`}
              >
                {room.acType === 'ac' ? '❄️ AC' : 'Non-AC'}
              </span>
            </div>

            <span className="text-[11px] text-[#64748B] block">
              Floor {room.floor} · {formatCurrency(room.monthlyRent)}/bed/mo
            </span>
          </div>

          {/* Occupancy Status Pill */}
          <div className="text-right flex flex-col items-end">
            <span
              className={`text-[11px] font-bold px-2.5 py-1 rounded-[8px] border shadow-2xs inline-block ${
                isAllVacant
                  ? 'bg-[#ECFDF5] text-[#059669] border-[#A7F3D0]'
                  : isFull
                  ? 'bg-[#FEF2F2] text-[#DC2626] border-[#FECACA]'
                  : 'bg-[#FEF3C7] text-[#D97706] border-[#FDE68A]'
              }`}
            >
              {isAllVacant
                ? `🟢 All ${room.totalCapacity} Vacant`
                : isFull
                ? `🔴 Full (${room.totalCapacity}/${room.totalCapacity})`
                : `🟡 ${room.vacantCount}/${room.totalCapacity} Available`}
            </span>
          </div>
        </div>

        {/* Visual Occupancy Progress Bar */}
        <div className="pt-2.5 pb-2">
          <div className="flex items-center gap-1 w-full">
            {room.beds.map((bed) => {
              const isOccupied = bed.status !== 'vacant';
              return (
                <div
                  key={bed.id}
                  className={`h-2 flex-1 rounded-full transition-all ${
                    isOccupied ? 'bg-[#10B981]' : 'bg-[#E2E8F0]'
                  }`}
                  title={`${bed.bedLabel}: ${isOccupied ? bed.tenantName || 'Occupied' : 'Vacant'}`}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* BEDS LIST INSIDE THE ROOM */}
      <div className="mt-2 space-y-2">
        {room.beds.map((bed) => {
          const record = recordMap.get(bed.id);
          const isVacant = bed.status === 'vacant';
          const isPaid = bed.status === 'paid' || record?.status === 'paid';
          const isVerify = bed.status === 'verify' || record?.status === 'verify';

          return (
            <div
              key={bed.id}
              onClick={() => (onSelectBed ? onSelectBed(bed) : isVacant ? onAddTenant(bed) : undefined)}
              className={`group/bed relative rounded-[10px] p-2.5 border transition-all duration-150 cursor-pointer flex items-center justify-between gap-2 ${
                isVacant
                  ? 'bg-[#F8FAFC] border-dashed border-[#CBD5E1] hover:border-[#D97706] hover:bg-amber-50/30'
                  : isPaid
                  ? 'bg-emerald-50/30 border-[#A7F3D0] hover:border-[#059669]'
                  : isVerify
                  ? 'bg-indigo-50/30 border-[#C7D2FE] hover:border-[#6366F1]'
                  : 'bg-amber-50/30 border-[#FDE68A] hover:border-[#D97706]'
              }`}
            >
              {/* Bed Label & Resident Info */}
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="w-7 h-7 rounded-[7px] bg-white border border-[#E2E8F0] font-mono font-bold text-xs text-[#09090B] flex items-center justify-center shrink-0 shadow-2xs">
                  {bed.bedLabel.split('-')[1] || bed.bedLabel}
                </span>

                <div className="min-w-0">
                  {isVacant ? (
                    <div>
                      <span className="text-xs font-semibold text-[#64748B] block truncate">
                        Available Bed
                      </span>
                      <span className="text-[10px] text-[#94A3B8] font-mono-numbers">
                        {formatCurrency(bed.monthlyRent)}/mo
                      </span>
                    </div>
                  ) : (
                    <div>
                      <span className="text-xs font-bold text-[#09090B] block truncate">
                        {bed.tenantName || 'Resident'}
                      </span>
                      <span className="text-[10px] text-[#64748B] font-mono-numbers block truncate">
                        {bed.tenantPhone || 'No Phone'}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Status Badge & Actions */}
              <div className="flex items-center gap-1.5 shrink-0">
                {isVacant ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2.5 text-[11px] bg-white border-[#CBD5E1] text-[#D97706] hover:bg-[#FEF3C7] hover:border-[#D97706]"
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddTenant(bed);
                    }}
                  >
                    <UserPlus className="w-3 h-3 mr-1" />
                    <span>Assign</span>
                  </Button>
                ) : (
                  <div className="flex items-center gap-1">
                    {/* Status Pill */}
                    {isPaid ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-[5px] bg-[#D1FAE5] text-[#065F46] border border-[#A7F3D0]">
                        Paid
                      </span>
                    ) : isVerify ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-[5px] bg-[#E0E7FF] text-[#3730A3] border border-[#C7D2FE]">
                        Verify
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-[5px] bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]">
                        Due
                      </span>
                    )}

                    {/* Quick WhatsApp Reminder if Due */}
                    {!isPaid && !isVerify && bed.tenantPhone && (
                      <button
                        title="Send WhatsApp Reminder"
                        onClick={(e) => handleSendReminder(e, bed)}
                        className="w-6 h-6 rounded-[5px] flex items-center justify-center text-[#16A34A] hover:bg-[#DCFCE7] transition-colors"
                      >
                        <Send className="w-3 h-3" />
                      </button>
                    )}

                    <ChevronRight className="w-3.5 h-3.5 text-[#94A3B8] group-hover/bed:text-[#09090B]" />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
