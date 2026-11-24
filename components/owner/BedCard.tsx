'use client';

import React from 'react';
import { Bed, RentRecord } from '@/types';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, getWhatsAppLink } from '@/lib/utils';
import { Avatar } from '@/components/ui/avatar';
import {
  UserPlus,
  Send,
  Check,
  Eye,
  ChevronRight,
} from 'lucide-react';

interface BedCardProps {
  bed: Bed;
  rentRecord?: RentRecord;
  ownerName: string;
  pgName: string;
  ownerUpi: string;
  onAddTenant: (bed: Bed) => void;
  onMarkPaid: (bed: Bed, record?: RentRecord) => void;
  onVerifyProof: (bed: Bed, record: RentRecord) => void;
  onVacate: (bed: Bed) => void;
  onSelectBed?: (bed: Bed) => void;
}

export function BedCard({
  bed,
  rentRecord,
  ownerName,
  pgName,
  ownerUpi,
  onAddTenant,
  onMarkPaid,
  onVerifyProof,
  onVacate,
  onSelectBed,
}: BedCardProps) {
  const isVacant = bed.status === 'vacant';
  const isGuest = bed.status === 'guest';
  const isPaid = bed.status === 'paid' || rentRecord?.status === 'paid';
  const isVerify = bed.status === 'verify' || rentRecord?.status === 'verify';

  // Left status bar color (guest = violet, distinct from monthly tenants)
  const statusColor = isVacant
    ? 'bg-[#CBD5E1]'
    : isGuest
    ? 'bg-[#8B5CF6]'
    : isPaid
    ? 'bg-[#10B981]'
    : isVerify
    ? 'bg-[#6366F1]'
    : 'bg-[#F59E0B]';

  const handleSendReminder = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!bed.tenantPhone) return;

    const message = `Namaste ${bed.tenantName || 'Resident'} ji 🙏,\n\nFriendly reminder from ${pgName}: rent of ${formatCurrency(
      bed.monthlyRent
    )} for Bed ${bed.bedLabel} is due.\n\nPlease pay to UPI: ${ownerUpi || 'our PG UPI'}.\n\nThank you,\n${ownerName || 'PG Management'}`;

    const link = getWhatsAppLink(bed.tenantPhone, message);
    window.open(link, '_blank');
  };

  return (
    <div
      onClick={() => onSelectBed ? onSelectBed(bed) : isVacant ? onAddTenant(bed) : undefined}
      className="group relative bg-white border border-[#E2E8F0] hover:border-[#D97706] rounded-[10px] p-3.5 shadow-xs hover:shadow-[0_4px_16px_rgba(217,119,6,0.08)] transition-all duration-150 flex flex-col justify-between cursor-pointer overflow-hidden text-left"
    >
      {/* 3.5px Left Status Bar Indicator */}
      <div className={`absolute top-0 bottom-0 left-0 w-1 ${statusColor}`} />

      {/* Top Details */}
      <div>
        <div className="flex items-center justify-between pl-1">
          <div className="flex items-center gap-1.5">
            <span className="font-mono-numbers font-bold text-xs text-[#09090B] tracking-tight">
              {bed.bedLabel}
            </span>
            {bed.sharingType && (
              <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-[4px] bg-[#F1F5F9] text-[#475569] border border-[#E2E8F0]">
                {bed.sharingType === '1' ? 'Single' : `${bed.sharingType}-Share`}
              </span>
            )}
            {bed.acType === 'ac' && (
              <span className="text-[9px] font-extrabold uppercase px-1 py-0.5 rounded-[3px] bg-[#E0F2FE] text-[#0369A1]">
                AC
              </span>
            )}
          </div>
          {isVacant ? (
            <Badge variant="vacant">Vacant</Badge>
          ) : isGuest ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-[#F5F3FF] text-[#6D28D9] border border-[#DDD6FE]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#8B5CF6]" />
              Guest
            </span>
          ) : isPaid ? (
            <Badge variant="paid" dot>Paid</Badge>
          ) : isVerify ? (
            <Badge variant="verify" dot>Verify</Badge>
          ) : (
            <Badge variant="amber" dot>Due</Badge>
          )}
        </div>

        {/* Middle: Resident or Vacant Info */}
        <div className="mt-2.5 mb-2 pl-1">
          {isVacant ? (
            <div className="py-1.5">
              <span className="text-[11px] text-[#94A3B8] block">Available Unit</span>
              <span className="text-xs font-bold font-mono-numbers text-[#09090B]">
                {formatCurrency(bed.monthlyRent)}/mo
              </span>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <Avatar name={bed.tenantName || 'R'} size="sm" />
                <span className="text-xs font-semibold text-[#09090B] truncate max-w-[110px]">
                  {bed.tenantName}
                </span>
              </div>
              <div className="text-[11px] font-mono-numbers text-[#64748B]">
                {formatCurrency(bed.monthlyRent)}/mo
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Action Footer */}
      <div className="pt-2 border-t border-[#E2E8F0] pl-1 flex items-center justify-between">
        {isVacant ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAddTenant(bed);
            }}
            className="w-full flex items-center justify-center gap-1 py-1 rounded-[6px] bg-[#F8FAFC] hover:bg-[#FEF3C7] text-[#D97706] text-[11px] font-semibold transition-colors cursor-pointer"
          >
            <UserPlus className="w-3 h-3" />
            <span>Assign Resident</span>
          </button>
        ) : (
          <div className="w-full flex items-center justify-between text-xs">
            <div className="flex items-center gap-1">
              {isVerify && rentRecord && (
                <button
                  type="button"
                  title="Verify Proof"
                  onClick={(e) => {
                    e.stopPropagation();
                    onVerifyProof(bed, rentRecord);
                  }}
                  className="p-1 rounded-[4px] text-[#6366F1] hover:bg-[#EEF2FF] transition-colors cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                </button>
              )}

              {!isPaid && (
                <>
                  <button
                    type="button"
                    title="Send WhatsApp Reminder"
                    onClick={handleSendReminder}
                    className="p-1 rounded-[4px] text-[#10B981] hover:bg-[#ECFDF5] transition-colors cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    title="Mark Rent as Paid"
                    onClick={(e) => {
                      e.stopPropagation();
                      onMarkPaid(bed, rentRecord);
                    }}
                    className="p-1 rounded-[4px] text-[#D97706] hover:bg-[#FEF3C7] transition-colors cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>

            <ChevronRight className="w-3.5 h-3.5 text-[#94A3B8] group-hover:text-[#D97706] transition-colors" />
          </div>
        )}
      </div>
    </div>
  );
}
