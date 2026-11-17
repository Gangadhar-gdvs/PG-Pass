'use client';

import React from 'react';
import { Bed, RentRecord } from '@/types';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, getWhatsAppLink } from '@/lib/utils';
import {
  UserPlus,
  Send,
  CheckCircle,
  Eye,
  LogOut,
  Clock,
  Check,
  User,
  ShieldAlert,
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
}: BedCardProps) {
  const isVacant = bed.status === 'vacant';
  const isPaid = bed.status === 'paid' || rentRecord?.status === 'paid';
  const isVerify = bed.status === 'verify' || rentRecord?.status === 'verify';
  const isPending = !isVacant && !isPaid && !isVerify;

  // Determine border and glow classes based on state
  const getCardStyle = () => {
    if (isVacant) return 'border-dashed border-slate-700/70 bg-slate-900/30 hover:border-slate-500';
    if (isPaid) return 'border-emerald-500/40 bg-emerald-950/20 shadow-emerald-900/10 hover:border-emerald-400';
    if (isVerify) return 'border-amber-500/50 bg-amber-950/20 shadow-amber-900/15 animate-pulse hover:border-amber-400';
    return 'border-rose-500/40 bg-rose-950/20 shadow-rose-900/10 hover:border-rose-400';
  };

  const getStatusBadge = () => {
    if (isVacant) return <Badge variant="vacant">Vacant</Badge>;
    if (isPaid) return <Badge variant="paid">Paid</Badge>;
    if (isVerify) return <Badge variant="verify">Verify Proof</Badge>;
    return <Badge variant="pending">Pending</Badge>;
  };

  const handleSendReminder = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!bed.tenantPhone) return;

    const message = `Namaste ${bed.tenantName || 'Resident'} ji 🙏,\n\nThis is a friendly reminder from ${pgName} that your room rent of ${formatCurrency(
      bed.monthlyRent
    )} for Bed ${bed.bedLabel} is due.\n\nPlease pay to UPI: ${ownerUpi || 'our PG UPI'}.\n\nThank you!\n- ${ownerName || 'PG Management'}`;

    const link = getWhatsAppLink(bed.tenantPhone, message);
    window.open(link, '_blank');
  };

  return (
    <div
      className={`relative rounded-2xl border p-4 transition-all duration-200 flex flex-col justify-between ${getCardStyle()}`}
    >
      {/* Top Header */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="font-extrabold text-sm text-white tracking-wide flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-indigo-400" />
            {bed.bedLabel}
          </span>
          {getStatusBadge()}
        </div>

        {/* Tenant Details / Vacant State */}
        <div className="my-2.5">
          {isVacant ? (
            <div className="py-2 text-center">
              <span className="text-xs font-medium text-slate-500 block mb-1">No resident assigned</span>
              <span className="text-xs font-bold text-slate-300">{formatCurrency(bed.monthlyRent)}/mo</span>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 text-[10px] font-bold">
                  {bed.tenantName ? bed.tenantName.charAt(0).toUpperCase() : <User className="w-3 h-3" />}
                </div>
                <span className="font-bold text-sm text-slate-100 truncate max-w-[140px]">
                  {bed.tenantName || 'Resident'}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Rent: {formatCurrency(bed.monthlyRent)}</span>
                {bed.tenantPhone && <span className="text-[11px] font-mono text-slate-500">{bed.tenantPhone}</span>}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons Footer */}
      <div className="pt-3 border-t border-slate-800/80 mt-2 flex items-center gap-1.5">
        {isVacant ? (
          <button
            onClick={() => onAddTenant(bed)}
            className="w-full py-2 px-3 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Add Resident</span>
          </button>
        ) : (
          <>
            {isVerify && rentRecord && (
              <button
                onClick={() => onVerifyProof(bed, rentRecord)}
                className="flex-1 py-1.5 px-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                title="Inspect uploaded payment screenshot"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Verify</span>
              </button>
            )}

            {isPending && (
              <>
                <button
                  onClick={handleSendReminder}
                  className="flex-1 py-1.5 px-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                  title="Send pre-filled WhatsApp reminder"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Remind</span>
                </button>

                <button
                  onClick={() => onMarkPaid(bed, rentRecord)}
                  className="py-1.5 px-2.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                  title="Mark as paid (Cash / Direct Transfer)"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Paid</span>
                </button>
              </>
            )}

            {isPaid && (
              <div className="flex-1 text-[11px] text-emerald-400 font-semibold flex items-center gap-1 py-1">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                <span>Rent Cleared</span>
              </div>
            )}

            {/* Vacate bed button */}
            <button
              onClick={() => onVacate(bed)}
              className="p-1.5 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
              title="Vacate resident"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
