'use client';

import React, { useState } from 'react';
import { Bed, RentRecord, Tenant } from '@/types';
import { Button } from '@/components/ui/button';
import { Drawer } from '@/components/ui/drawer';
import { formatCurrency } from '@/lib/utils';
import { buildWaReminderLink } from '@/lib/client/upi';
import { Send, CheckCircle2, Copy, ArrowRight, Clock, RefreshCw } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import toast from 'react-hot-toast';

interface WhatsAppReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  beds: Bed[];
  tenants: Tenant[];
  rentRecords: RentRecord[];
  pgName: string;
  ownerName: string;
  ownerUpi: string;
}

export function WhatsAppReminderModal({
  isOpen,
  onClose,
  beds,
  tenants,
  rentRecords,
  pgName,
  ownerName,
  ownerUpi,
}: WhatsAppReminderModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [remindedIds, setRemindedIds] = useState<Set<string>>(new Set());

  const recordMap = new Map<string, RentRecord>();
  rentRecords.forEach((r) => recordMap.set(r.bedId || '', r));

  const tenantMap = new Map<string, Tenant>();
  tenants.forEach((t) => tenantMap.set(t.id, t));

  // Filter beds that are occupied and whose rent is not marked paid
  const pendingItems = beds.filter((b) => {
    if (b.status === 'vacant') return false;
    const rec = recordMap.get(b.id);
    return rec?.status !== 'paid' && b.status !== 'paid';
  });

  const getRentAmount = (bed: Bed): number => {
    if (bed.rentAmountPaise) return Math.round(bed.rentAmountPaise / 100);
    return bed.monthlyRent || 0;
  };

  const getReminderMessage = (bed: Bed) => {
    const tenant = bed.tenantId ? tenantMap.get(bed.tenantId) : null;
    const amount = getRentAmount(bed);
    const amountFormatted = `₹${amount.toLocaleString('en-IN')}`;

    return `Namaste ${bed.tenantName || 'Resident'} ji 🙏,\n\nFriendly reminder from *${
      pgName || 'PG Accommodation'
    }* that room rent for *Bed ${bed.bedLabel}* is due:\n\n💵 *Amount:* ${amountFormatted}\n💳 *UPI ID:* ${
      ownerUpi || 'owner@upi'
    }\n\nThank you,\n${ownerName || 'PG Management'}`;
  };

  const sendReminderForBed = async (bed: Bed) => {
    if (!bed.tenantPhone) {
      toast.error('No phone number recorded for this resident');
      return false;
    }

    const message = getReminderMessage(bed);
    const waUrl = buildWaReminderLink(bed.tenantPhone, message);
    window.open(waUrl, '_blank');

    // Call server to stamp lastRemindedAt
    const rec = recordMap.get(bed.id);
    if (rec?.id) {
      try {
        await fetch(`/api/rent/${rec.id}/reminded`, { method: 'POST' });
        setRemindedIds((prev) => new Set(prev).add(bed.id));
      } catch (e) {
        console.warn('Failed to stamp reminded timestamp', e);
      }
    } else {
      setRemindedIds((prev) => new Set(prev).add(bed.id));
    }

    return true;
  };

  const handleSendAndNext = async () => {
    if (pendingItems.length === 0) return;
    const activeBed = pendingItems[currentIndex] || pendingItems[0];
    const sent = await sendReminderForBed(activeBed);
    if (sent) {
      toast.success(`Sent reminder to ${activeBed.tenantName}`);
      // Advance to next in queue
      if (currentIndex < pendingItems.length - 1) {
        setCurrentIndex((i) => i + 1);
      }
    }
  };

  const handleCopyMessage = (bed: Bed) => {
    const message = getReminderMessage(bed);
    navigator.clipboard.writeText(message);
    toast.success('Reminder message copied to clipboard');
  };

  const currentBed = pendingItems[currentIndex] || pendingItems[0];

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="WhatsApp Rent Reminders Queue"
      description="1-tap Send & Next sequence to remind unpaid residents without launching 50 tabs."
      width="md"
    >
      <div className="space-y-4">
        {pendingItems.length === 0 ? (
          <div className="p-8 text-center rounded-[10px] border border-dashed border-[#E2E8F0] bg-[#F8FAFC]">
            <CheckCircle2 className="w-8 h-8 text-[#10B981] mx-auto mb-2" />
            <h4 className="text-sm font-bold text-[#09090B]">All Clear</h4>
            <p className="text-xs text-[#64748B] mt-1">
              All residents have settled their rent for this billing cycle.
            </p>
          </div>
        ) : (
          <>
            {/* 1-Tap "Send & Next" Queue Banner */}
            {currentBed && (
              <div className="p-4 rounded-[12px] bg-[#0F172A] text-white space-y-3 shadow-md">
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-300">
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-[#F59E0B]" />
                    <span>
                      Queue Item {currentIndex + 1} of {pendingItems.length}
                    </span>
                  </span>
                  <span>{remindedIds.size} Reminded</span>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-white">
                      {currentBed.tenantName}
                    </h3>
                    <p className="text-xs text-slate-300">
                      Bed {currentBed.bedLabel} · Due {formatCurrency(getRentAmount(currentBed))}
                    </p>
                  </div>

                  <Button
                    size="md"
                    onClick={handleSendAndNext}
                    className="bg-[#10B981] hover:bg-[#059669] text-white text-xs font-bold gap-1.5 shadow-sm"
                  >
                    <span>Send & Next</span>
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Detailed Resident List */}
            <div className="space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">
                Pending Residents ({pendingItems.length})
              </span>

              {pendingItems.map((bed, idx) => {
                const isReminded = remindedIds.has(bed.id);
                const isSelected = idx === currentIndex;

                return (
                  <div
                    key={bed.id}
                    onClick={() => setCurrentIndex(idx)}
                    className={`flex items-center justify-between p-3 rounded-[10px] border transition-colors cursor-pointer ${
                      isSelected
                        ? 'border-[#D97706] bg-[#FFFBEB]'
                        : isReminded
                        ? 'border-[#E2E8F0] bg-[#F8FAFC] opacity-75'
                        : 'border-[#E2E8F0] bg-white hover:border-[#CBD5E1]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar name={bed.tenantName || 'R'} size="sm" />
                      <div className="text-left">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-[#09090B]">
                            {bed.tenantName}
                          </span>
                          <span className="text-[10px] font-mono-numbers font-semibold text-[#64748B] bg-[#F1F5F9] px-1.5 py-0.5 rounded-[4px]">
                            {bed.bedLabel}
                          </span>
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-[#64748B]">
                          <span className="font-mono-numbers text-[#D97706] font-bold">
                            {formatCurrency(getRentAmount(bed))}
                          </span>
                          <span>·</span>
                          <span className="font-mono-numbers">{bed.tenantPhone}</span>
                          {isReminded && (
                            <span className="text-[#10B981] font-semibold text-[10px]">
                              ✓ Sent
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        title="Copy text"
                        onClick={() => handleCopyMessage(bed)}
                        className="p-1.5 rounded-[6px] border border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#09090B] transition-colors cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <Button
                        size="sm"
                        variant="solid"
                        onClick={() => sendReminderForBed(bed)}
                        className="bg-[#10B981] hover:bg-[#059669] text-white text-xs gap-1"
                      >
                        <Send className="w-3 h-3" />
                        <span>Send</span>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </Drawer>
  );
}
