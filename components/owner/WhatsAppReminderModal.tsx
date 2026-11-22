'use client';

import React from 'react';
import { Bed, RentRecord, Tenant } from '@/types';
import { Button } from '@/components/ui/button';
import { Drawer } from '@/components/ui/drawer';
import { getWhatsAppLink, formatCurrency } from '@/lib/utils';
import { config } from '@/lib/config';
import { Send, CheckCircle2, MessageSquare, Copy } from 'lucide-react';
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
  const recordMap = new Map<string, RentRecord>();
  rentRecords.forEach((r) => recordMap.set(r.bedId, r));

  const tenantMap = new Map<string, Tenant>();
  tenants.forEach((t) => tenantMap.set(t.id, t));

  const pendingItems = beds.filter((b) => {
    if (b.status === 'vacant') return false;
    const rec = recordMap.get(b.id);
    return rec?.status !== 'paid' && b.status !== 'paid';
  });

  const getReminderMessage = (bed: Bed) => {
    const tenant = bed.tenantId ? tenantMap.get(bed.tenantId) : null;
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : config.app.url;
    const portalUrl = tenant?.token ? `${baseUrl}/t/${tenant.token}` : baseUrl;

    return `Namaste ${bed.tenantName || 'Resident'} ji 🙏,\n\nFriendly reminder from *${
      pgName || 'Our PG'
    }* that room rent for *Bed ${bed.bedLabel}* is due:\n\n💵 *Amount:* ${formatCurrency(
      bed.monthlyRent
    )}\n💳 *UPI ID:* ${ownerUpi || 'owner@upi'}\n\n📎 *Upload screenshot & download HRA receipt here:* ${portalUrl}\n\nThank you,\n${
      ownerName || 'PG Management'
    }`;
  };

  const handleSendReminder = (bed: Bed) => {
    if (!bed.tenantPhone) {
      toast.error('No phone number recorded for this resident');
      return;
    }

    const message = getReminderMessage(bed);
    const link = getWhatsAppLink(bed.tenantPhone, message);
    window.open(link, '_blank');
  };

  const handleCopyMessage = (bed: Bed) => {
    const message = getReminderMessage(bed);
    navigator.clipboard.writeText(message);
    toast.success('Reminder message copied to clipboard');
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Send WhatsApp Rent Reminders"
      description="Direct 1-click reminders to residents with their personalized portal links."
      width="md"
    >
      <div className="space-y-3">
        {pendingItems.length === 0 ? (
          <div className="p-8 text-center rounded-[10px] border border-dashed border-[#E2E8F0] bg-[#F8FAFC]">
            <CheckCircle2 className="w-8 h-8 text-[#10B981] mx-auto mb-2" />
            <h4 className="text-sm font-bold text-[#09090B]">All Clear</h4>
            <p className="text-xs text-[#64748B] mt-1">
              All residents have settled their rent for the current billing cycle.
            </p>
          </div>
        ) : (
          pendingItems.map((bed) => (
            <div
              key={bed.id}
              className="flex items-center justify-between p-3.5 rounded-[10px] bg-white border border-[#E2E8F0] hover:border-[#CBD5E1] transition-colors"
            >
              <div className="flex items-center gap-3">
                <Avatar name={bed.tenantName || 'R'} size="md" />
                <div className="text-left">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-[#09090B]">
                      {bed.tenantName}
                    </span>
                    <span className="text-[10px] font-mono-numbers font-semibold text-[#64748B] bg-[#F1F5F9] px-1.5 py-0.2 rounded-[4px]">
                      {bed.bedLabel}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-[11px] text-[#64748B]">
                    <span className="font-mono-numbers text-[#D97706] font-bold">
                      {formatCurrency(bed.monthlyRent)}
                    </span>
                    <span>·</span>
                    <span className="font-mono-numbers">{bed.tenantPhone}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
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
                  onClick={() => handleSendReminder(bed)}
                  className="bg-[#10B981] hover:bg-[#059669] text-white text-xs gap-1"
                >
                  <Send className="w-3 h-3" />
                  <span>Send</span>
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </Drawer>
  );
}
