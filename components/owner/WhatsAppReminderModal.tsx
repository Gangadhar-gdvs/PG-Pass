'use client';

import React, { useState } from 'react';
import { Bed, RentRecord, Tenant } from '@/types';
import { Button } from '@/components/ui/button';
import { Drawer } from '@/components/ui/drawer';
import { formatCurrency } from '@/lib/utils';
import { buildWaReminderLink } from '@/lib/client/upi';
import { Send, Check, Copy, ArrowRight, Clock } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { ProgressBar } from '@/components/ui/progress-bar';
import { SectionHeader } from '@/components/ui/dashboard-kit';
import { Illustration } from '@/components/brand/Illustration';
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

  // Rent records key by tenantId (doc id `${tenantId}_${period}`), not bedId.
  const recordByTenant = new Map<string, RentRecord>();
  rentRecords.forEach((r) => {
    if (r.tenantId) recordByTenant.set(r.tenantId, r);
  });
  const recordFor = (b: Bed): RentRecord | undefined =>
    b.tenantId ? recordByTenant.get(b.tenantId) : undefined;

  const tenantMap = new Map<string, Tenant>();
  tenants.forEach((t) => tenantMap.set(t.id, t));

  // Beds to remind: occupied monthly tenants whose rent this period is unpaid.
  // Guests (billed separately) are excluded.
  const pendingItems = beds.filter((b) => {
    if (b.status === 'vacant' || b.status === 'guest') return false;
    const rec = recordFor(b);
    return rec?.status !== 'paid';
  });

  const getRentAmount = (bed: Bed): number => {
    if (bed.rentAmountPaise) return Math.round(bed.rentAmountPaise / 100);
    return bed.monthlyRent || 0;
  };

  const getReminderMessage = (bed: Bed) => {
    const tenant = bed.tenantId ? tenantMap.get(bed.tenantId) : null;
    const amount = getRentAmount(bed);
    const amountFormatted = `₹${amount.toLocaleString('en-IN')}`;
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://pgpass.app';
    const passLink = tenant?.token ? `\n🔗 *Resident Pass & UPI Link:* ${baseUrl}/t/${tenant.token}` : '';

    return `Namaste ${bed.tenantName || 'Resident'} ji 🙏,\n\nFriendly reminder from *${
      pgName || 'PG Accommodation'
    }* that room rent for *Bed ${bed.bedLabel}* is due:\n\n💵 *Amount:* ${amountFormatted}\n💳 *UPI ID:* ${
      ownerUpi || 'owner@upi'
    }${passLink}\n\nThank you,\n${ownerName || 'PG Management'}`;
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
    const rec = recordFor(bed);
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
          <div className="app-card animate-pop">
            <EmptyState
              icon3d="check"
              title="All Clear"
              description="All residents have settled their rent for this billing cycle."
            />
          </div>
        ) : (
          <>
            {/* 1-Tap "Send & Next" Queue Banner */}
            {currentBed && (
              <section className="hero-gradient relative overflow-hidden p-4 sm:p-5 animate-pop">
                <div aria-hidden className="pointer-events-none absolute -right-8 -top-12 h-36 w-36 rounded-full bg-white/20 blur-3xl" />
                <div aria-hidden className="pointer-events-none absolute right-2 top-11 w-[64px] sm:w-[76px]">
                  <Illustration name="bell-cta" width={76} />
                </div>

                <div className="relative flex flex-wrap items-center justify-between gap-2 text-[12px] font-bold text-white/85">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/18 px-2.5 py-1 ring-1 ring-white/25">
                    <Clock className="h-3.5 w-3.5" />
                    <span>
                      Queue Item {currentIndex + 1} of {pendingItems.length}
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/18 px-2.5 py-1 ring-1 ring-white/25">
                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                    {remindedIds.size} Reminded
                  </span>
                </div>

                <div className="relative mt-3 pr-16 sm:pr-20">
                  <h3 className="truncate text-[20px] font-extrabold leading-tight tracking-[-0.02em] text-white">
                    {currentBed.tenantName}
                  </h3>
                  <p className="mt-0.5 text-[13px] font-medium text-white/80">
                    Bed {currentBed.bedLabel} · Due{' '}
                    <span className="font-bold font-mono-numbers text-white">{formatCurrency(getRentAmount(currentBed))}</span>
                  </p>
                </div>

                <ProgressBar
                  value={((currentIndex + 1) / pendingItems.length) * 100}
                  height="sm"
                  className="relative mt-3.5"
                />

                <div className="relative mt-4">
                  <Button variant="success" onClick={handleSendAndNext} className="w-full sm:w-auto">
                    <Send className="h-4 w-4" />
                    <span>Send & Next</span>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </section>
            )}

            {/* Detailed Resident List */}
            <section className="app-card p-3 sm:p-4">
              <SectionHeader
                title="Pending Residents"
                icon="bell"
                className="px-1"
                action={<Badge variant="pending">{pendingItems.length}</Badge>}
              />

              <div className="space-y-2 stagger">
                {pendingItems.map((bed, idx) => {
                  const isReminded = remindedIds.has(bed.id);
                  const isSelected = idx === currentIndex;

                  return (
                    <div
                      key={bed.id}
                      onClick={() => setCurrentIndex(idx)}
                      className={`flex items-center gap-3 rounded-2xl border p-2.5 transition-all cursor-pointer ${
                        isSelected
                          ? 'border-brand-300 bg-brand-50 ring-1 ring-brand-300 shadow-[var(--shadow-tile)]'
                          : isReminded
                          ? 'border-white/70 bg-white/45 opacity-80'
                          : 'border-white bg-white/75 shadow-[var(--shadow-tile)] hover:bg-white'
                      }`}
                    >
                      <Avatar name={bed.tenantName || 'R'} size="md" />
                      <div className="min-w-0 flex-1 text-left">
                        <div className="truncate text-[14px] font-bold text-ink">{bed.tenantName}</div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs font-medium text-muted">
                          <Badge variant="neutral" className="font-mono-numbers">
                            {bed.bedLabel}
                          </Badge>
                          <span className="font-mono-numbers font-bold text-brand-700">
                            {formatCurrency(getRentAmount(bed))}
                          </span>
                          {isReminded && (
                            <Badge variant="paid">
                              <Check className="h-3 w-3" strokeWidth={3} />
                              Sent
                            </Badge>
                          )}
                        </div>
                        <div className="mt-0.5 truncate text-xs font-medium text-muted font-mono-numbers">{bed.tenantPhone}</div>
                      </div>

                      <div className="flex shrink-0 items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          title="Copy text"
                          aria-label="Copy text"
                          onClick={() => handleCopyMessage(bed)}
                          className="grid h-11 w-11 place-items-center rounded-full border border-white bg-white/90 text-ink-2 shadow-[var(--shadow-tile)] transition-colors press hover:text-brand-700"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                        <Button
                          variant="success"
                          onClick={() => sendReminderForBed(bed)}
                          aria-label="Send"
                        >
                          <Send className="h-4 w-4" />
                          <span className="hidden min-[400px]:inline">Send</span>
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        )}
      </div>
    </Drawer>
  );
}
