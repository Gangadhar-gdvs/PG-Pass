'use client';

import React from 'react';
import { Bed, RentRecord, Tenant } from '@/types';
import { Button } from '@/components/ui/button';
import { getWhatsAppLink, formatCurrency } from '@/lib/utils';
import { config } from '@/lib/config';
import { X, Send, CheckCircle2, MessageSquare, Copy, ExternalLink } from 'lucide-react';
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
  if (!isOpen) return null;

  const recordMap = new Map<string, RentRecord>();
  rentRecords.forEach((r) => recordMap.set(r.bedId, r));

  const tenantMap = new Map<string, Tenant>();
  tenants.forEach((t) => tenantMap.set(t.id, t));

  // Find all occupied beds with pending rent
  const pendingItems = beds.filter((b) => {
    if (b.status === 'vacant') return false;
    const rec = recordMap.get(b.id);
    return rec?.status !== 'paid' && b.status !== 'paid';
  });

  const handleSendReminder = (bed: Bed) => {
    if (!bed.tenantPhone) {
      toast.error('No phone number recorded for this resident');
      return;
    }

    const tenant = bed.tenantId ? tenantMap.get(bed.tenantId) : null;
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : config.app.url;
    const portalUrl = tenant?.token
      ? `${baseUrl}/t/${tenant.token}`
      : `${baseUrl}/t/demo`;

    const message = `Namaste ${bed.tenantName || 'Resident'} ji 🙏,\n\nFriendly reminder from *${pgName || 'Our PG'}* that room rent for *Bed ${bed.bedLabel}* is due:\n\n💵 *Amount:* ${formatCurrency(bed.monthlyRent)}\n💳 *UPI ID:* ${ownerUpi || 'owner@upi'}\n\n📎 *Upload screenshot & download HRA receipt here:* ${portalUrl}\n\nThank you!\n- ${ownerName || 'PG Management'}`;

    const link = getWhatsAppLink(bed.tenantPhone, message);
    window.open(link, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative max-h-[85vh] flex flex-col">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-full hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="mb-4 pr-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-bold mb-2">
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Zero-Cost WhatsApp Reminders</span>
          </div>
          <h2 className="text-xl font-black text-white">Remind All Pending Residents</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Tap send to open WhatsApp on your phone with the pre-filled reminder and portal link.
          </p>
        </div>

        {/* List of Pending Residents */}
        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 my-2">
          {pendingItems.length === 0 ? (
            <div className="text-center py-10 bg-slate-950/60 rounded-2xl border border-slate-800 p-6">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
              <h4 className="text-sm font-bold text-white mb-1">All Caught Up!</h4>
              <p className="text-xs text-slate-400">Every resident has cleared their rent for this month.</p>
            </div>
          ) : (
            pendingItems.map((bed) => (
              <div
                key={bed.id}
                className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800/80 hover:border-slate-700 transition-colors"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-white">{bed.tenantName || 'Resident'}</span>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-slate-800 text-slate-300">
                      {bed.bedLabel}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                    <span>Due: {formatCurrency(bed.monthlyRent)}</span>
                    <span>•</span>
                    <span className="font-mono text-slate-500">{bed.tenantPhone || 'No Phone'}</span>
                  </div>
                </div>

                <Button
                  size="sm"
                  onClick={() => handleSendReminder(bed)}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-3.5 py-1.5"
                >
                  <Send className="w-3.5 h-3.5 mr-1" />
                  <span>Send</span>
                </Button>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-slate-800 flex justify-between items-center text-xs text-slate-500">
          <span>{pendingItems.length} residents pending</span>
          <Button variant="ghost" size="sm" onClick={onClose} className="text-slate-400 hover:text-white">
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
