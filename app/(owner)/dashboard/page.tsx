'use client';

import React, { useState, useEffect } from 'react';
import { useOwnerSession } from '@/hooks/useOwner';
import { useBeds } from '@/hooks/useBeds';
import { useTenants } from '@/hooks/useTenants';
import {
  subscribeToOwnerRentRecords,
} from '@/lib/firestore';
import { getPhotoViewUrl } from '@/lib/client/uploader';
import { getCurrentPeriod, formatCurrency, getWhatsAppLink } from '@/lib/utils';
import { Bed, Owner, RentRecord, Tenant } from '@/types';
import { StatsBar } from '@/components/owner/StatsBar';
import { BedGrid } from '@/components/owner/BedGrid';
import { AddTenantModal } from '@/components/owner/AddTenantModal';
import { CheckInGuestModal } from '@/components/owner/CheckInGuestModal';
import { WhatsAppReminderModal } from '@/components/owner/WhatsAppReminderModal';
import { BankCsvReconciler } from '@/components/owner/BankCsvReconciler';
import { PropertySetupWizard } from '@/components/owner/PropertySetupWizard';
import { DocumentUploader } from '@/components/owner/DocumentUploader';
import { TenantPhotoGallery } from '@/components/owner/TenantPhotoGallery';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Drawer } from '@/components/ui/drawer';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { StatusDot } from '@/components/ui/status-dot';
import { Avatar } from '@/components/ui/avatar';
import { config } from '@/lib/config';
import {
  Building,
  CheckCircle2,
  Eye,
  LogOut,
  Send,
  Phone,
  Copy,
  ExternalLink,
  UserPlus,
  ShieldAlert,
  FileSpreadsheet,
  ArrowLeft,
  Layers,
  IndianRupee,
  BedDouble,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function OwnerDashboardPage() {
  const { ownerId, phoneNumber, properties, selectedPropertyId } = useOwnerSession();

  // IMPORTANT backward-compat rule: only filter by property when the owner
  // actually has >1 property. Legacy single-PG data has no `propertyId` field,
  // so filtering on it would hide everything. With one property we stay
  // owner-wide (undefined), which matches both legacy and new docs.
  const propertyFilter = properties.length > 1 ? selectedPropertyId : undefined;

  const [owner, setOwner] = useState<Owner | null>(null);
  const [loadingOwner, setLoadingOwner] = useState(true);

  // Active Hooks for Beds, Tenants, Records
  const { beds } = useBeds(ownerId, propertyFilter);
  const { tenants } = useTenants(ownerId, propertyFilter);
  const [rentRecords, setRentRecords] = useState<RentRecord[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState(getCurrentPeriod());
  const [defaulters, setDefaulters] = useState<
    Array<RentRecord & { daysOverdue: number; lateFeePaise: number; outstandingPaise: number }>
  >([]);
  const [showDefaulters, setShowDefaulters] = useState(false);
  const [pendingRefunds, setPendingRefunds] = useState<
    Array<{ id: string; tenantName?: string; amountPaise: number }>
  >([]);
  const [refundBusyId, setRefundBusyId] = useState<string | null>(null);

  // Modals & Drawer State
  const [showSetupWizard, setShowSetupWizard] = useState(false);
  const [selectedBedForAdd, setSelectedBedForAdd] = useState<Bed | null>(null);
  const [joinRequests, setJoinRequests] = useState<
    Array<{ id: string; residentName: string; residentPhone: string }>
  >([]);
  const [prefillTenant, setPrefillTenant] = useState<{ name: string; phone: string } | null>(null);
  const [guestBed, setGuestBed] = useState<Bed | null>(null);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [showBankReconciler, setShowBankReconciler] = useState(false);
  const [proofModalRecord, setProofModalRecord] = useState<{ bed: Bed; record: RentRecord } | null>(null);
  const [activeBedDrawer, setActiveBedDrawer] = useState<Bed | null>(null);
  const [confirmVacateBed, setConfirmVacateBed] = useState<Bed | null>(null);
  const [reverseTarget, setReverseTarget] = useState<{ bed: Bed; record: RentRecord } | null>(null);
  const [reverseBusy, setReverseBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState(false); // in-flight guard for paid/approve/vacate

  // Load Owner Profile
  useEffect(() => {
    if (!ownerId) {
      setLoadingOwner(false);
      return;
    }

    async function loadOwner() {
      try {
        const res = await fetch('/api/owners');
        if (res.ok) {
          const profile = await res.json();
          setOwner(profile);
        }
      } catch (e) {
        console.error('Error fetching owner profile:', e);
      } finally {
        setLoadingOwner(false);
      }
    }

    loadOwner();
  }, [ownerId]);

  // Subscribe to real-time Rent Records for the selected billing period.
  // Re-subscribes when the owner navigates to a different month so past-due and
  // future months can be viewed and collected, not just the current month.
  useEffect(() => {
    if (!ownerId) return;
    const unsub = subscribeToOwnerRentRecords(
      ownerId,
      selectedPeriod,
      (records) => {
        setRentRecords(records);
      },
      propertyFilter
    );
    return unsub;
  }, [ownerId, selectedPeriod, propertyFilter]);

  // Load the defaulter / aging report (overdue unpaid rent across all months).
  useEffect(() => {
    if (!ownerId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/rent/defaulters');
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setDefaulters(data.defaulters || []);
      } catch {
        /* non-fatal */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ownerId, rentRecords.length]);

  // Load pending security-deposit refunds (owed to departed/departing tenants).
  const refundsRefreshKey = beds.length; // refresh when bed/tenant set changes
  useEffect(() => {
    if (!ownerId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/deposits/refunds');
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setPendingRefunds(data.refunds || []);
      } catch {
        /* non-fatal */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ownerId, refundsRefreshKey]);

  // Pending resident join-requests (from public PG discovery).
  useEffect(() => {
    if (!ownerId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/owners/join-requests');
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setJoinRequests(data.requests || []);
      } catch {
        /* non-fatal */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ownerId]);

  // Owner accepts a join request: prefill the Add-Tenant flow with the
  // resident's name + phone (phone auto-links the resident account) and mark the
  // request approved. The owner then taps a vacant bed to finish.
  const acceptJoinRequest = async (req: { id: string; residentName: string; residentPhone: string }) => {
    setPrefillTenant({ name: req.residentName, phone: req.residentPhone });
    try {
      await fetch('/api/owners/join-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: req.id, action: 'approved' }),
      });
      setJoinRequests((list) => list.filter((r) => r.id !== req.id));
      toast.success('Approved — now tap a vacant bed to add this resident');
    } catch {
      toast.error('Could not approve request');
    }
  };

  const declineJoinRequest = async (id: string) => {
    try {
      await fetch('/api/owners/join-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: id, action: 'declined' }),
      });
      setJoinRequests((list) => list.filter((r) => r.id !== id));
    } catch {
      toast.error('Could not decline');
    }
  };

  const markRefundIssued = async (depositId: string) => {
    if (refundBusyId) return;
    setRefundBusyId(depositId);
    try {
      const res = await fetch(`/api/deposits/refunds/${depositId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Could not update refund');
      }
      toast.success('Refund marked as paid out');
      setPendingRefunds((list) => list.filter((r) => r.id !== depositId));
    } catch (e: any) {
      toast.error(e.message || 'Could not update refund');
    } finally {
      setRefundBusyId(null);
    }
  };

  // Mark Paid via POST /api/rent/[id]/confirm
  const handleMarkPaid = async (bed: Bed, record?: RentRecord) => {
    if (actionBusy) return; // double-submit guard
    setActionBusy(true);
    try {
      if (record?.id && !record.id.startsWith('temp_')) {
        const res = await fetch(`/api/rent/${record.id}/confirm`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paymentReference: 'Manual confirmation' }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Confirmation failed');
        toast.success(`Bed ${bed.bedLabel} marked Paid! Receipt REC-${String(data.record.receiptNumber).padStart(5, '0')} issued.`);
      } else {
        toast.success(`Bed ${bed.bedLabel} marked as Paid`);
      }
      if (activeBedDrawer?.id === bed.id) {
        setActiveBedDrawer({ ...activeBedDrawer, status: 'paid' });
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to update status');
    } finally {
      setActionBusy(false);
    }
  };

  // Bulk-confirm all pending/verify rent records in the current view.
  const bulkConfirmPending = async () => {
    if (actionBusy) return;
    const ids = rentRecords
      .filter((r) => r.status !== 'paid' && r.id && !r.id.startsWith('temp_'))
      .map((r) => r.id as string);
    if (ids.length === 0) {
      toast('Nothing pending to confirm');
      return;
    }
    setActionBusy(true);
    try {
      const res = await fetch('/api/rent/bulk-confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recordIds: ids }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Bulk confirm failed');
      const okCount = data.confirmed?.length || 0;
      const failCount = data.failed?.length || 0;
      toast.success(
        `Confirmed ${okCount} payment${okCount === 1 ? '' : 's'}${failCount ? ` · ${failCount} skipped` : ''}`
      );
    } catch (e: any) {
      toast.error(e.message || 'Bulk confirm failed');
    } finally {
      setActionBusy(false);
    }
  };

  // Record a partial / advance payment toward the active rent record.
  const [partialAmount, setPartialAmount] = useState('');
  const handleRecordPartial = async (record: RentRecord) => {
    if (actionBusy) return;
    const rupees = Number(partialAmount);
    if (!rupees || rupees <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    setActionBusy(true);
    try {
      const res = await fetch(`/api/rent/${record.id}/partial`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountRupees: rupees }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Could not record payment');
      const paid = (data.record?.amountPaidPaise ?? 0) / 100;
      const due = (data.record?.amountDuePaise ?? 0) / 100;
      if (data.record?.status === 'paid') {
        toast.success('Rent fully paid — receipt issued.');
      } else {
        toast.success(`Recorded ₹${rupees}. Paid ₹${paid} of ₹${due}.`);
      }
      setPartialAmount('');
    } catch (e: any) {
      toast.error(e.message || 'Could not record payment');
    } finally {
      setActionBusy(false);
    }
  };

  // Reverse Paid: open a styled confirm dialog that collects a required reason
  // (replaces a raw window.prompt on a money-mutating action).
  const handleReversePaid = (bed: Bed, record: RentRecord) => {
    setReverseTarget({ bed, record });
  };

  const doReversePaid = async (reason: string) => {
    if (!reverseTarget) return;
    const { bed, record } = reverseTarget;
    setReverseBusy(true);
    try {
      const res = await fetch(`/api/rent/${record.id}/reverse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reversalReason: reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Reversal failed');

      toast.success(`Payment reversed. Bed ${bed.bedLabel} is now pending.`);
      if (activeBedDrawer?.id === bed.id) {
        setActiveBedDrawer({ ...activeBedDrawer, status: 'occupied' });
      }
      setReverseTarget(null);
    } catch (err: any) {
      toast.error(err.message || 'Could not reverse payment');
    } finally {
      setReverseBusy(false);
    }
  };

  // Approve payment from screenshot proof via POST /api/rent/[id]/confirm
  const handleApproveProof = async () => {
    if (!proofModalRecord || actionBusy) return;
    const { bed, record } = proofModalRecord;

    setActionBusy(true);
    try {
      const res = await fetch(`/api/rent/${record.id}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentReference: record.paymentReference }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Could not confirm payment');

      toast.success(`Payment approved for ${bed.tenantName}! Receipt REC-${String(data.record.receiptNumber).padStart(5, '0')} issued.`);
      setProofModalRecord(null);
      if (activeBedDrawer?.id === bed.id) {
        setActiveBedDrawer({ ...activeBedDrawer, status: 'paid' });
      }
    } catch (e: any) {
      toast.error(e.message || 'Could not approve payment');
    } finally {
      setActionBusy(false);
    }
  };

  // Handle Vacate Tenant via POST /api/tenants/[id]/moveout
  const handleConfirmVacate = async () => {
    if (!confirmVacateBed || !confirmVacateBed.tenantId || actionBusy) return;

    setActionBusy(true);
    try {
      const res = await fetch(`/api/tenants/${confirmVacateBed.tenantId}/moveout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          moveOutDate: new Date().toISOString().split('T')[0],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Could not vacate bed');

      toast.success(`Bed ${confirmVacateBed.bedLabel} is now vacant`);
      setConfirmVacateBed(null);
      setActiveBedDrawer(null);
    } catch (e: any) {
      toast.error(e.message || 'Could not vacate bed');
    } finally {
      setActionBusy(false);
    }
  };

  if (loadingOwner) {
    return (
      <div className="py-20 flex flex-col items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#D97706] border-t-transparent rounded-full animate-spin mb-3" />
        <span className="text-xs text-[#64748B] font-medium">Loading PG data...</span>
      </div>
    );
  }

  // ---------------- SETUP WIZARD (FIRST TIME PG ONBOARDING) ----------------
  if (!owner) {
    return (
      <PropertySetupWizard
        initialOwnerPhone={phoneNumber || '9876543210'}
        onComplete={(newOwner) => {
          setOwner(newOwner);
          // First-time onboarding just created the owner profile AND the initial
          // bed inventory in Firestore. The live beds subscription was started at
          // mount while the owner had no beds; a full reload guarantees the fresh
          // profile + generated beds are both reflected, instead of the dashboard
          // showing an empty inventory until something else re-triggers the query.
          if (typeof window !== 'undefined') {
            window.location.reload();
          }
        }}
      />
    );
  }

  // ---------------- MANUAL RE-CONFIGURATION / ADD ROOMS ----------------
  if (showSetupWizard) {
    return (
      <div className="space-y-4 text-left">
        <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
          <div>
            <h1 className="text-xl font-bold text-[#09090B] tracking-tight">
              Property & Room Inventory Setup
            </h1>
            <p className="text-xs text-[#64748B] mt-0.5">
              Configure room sharing formats (Single, 2-share to 6-share), rents, and floor layout matrix for {owner.pgName}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSetupWizard(false)}
            className="text-xs"
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
            <span>Back to Dashboard</span>
          </Button>
        </div>
        <PropertySetupWizard
          initialOwnerPhone={phoneNumber || owner.phone || '9876543210'}
          existingOwner={owner}
          onCancel={() => setShowSetupWizard(false)}
          onComplete={(newOwner) => {
            setOwner(newOwner);
            setShowSetupWizard(false);
            toast.success('Bed inventory successfully generated!');
            // Guarantee the newly generated beds appear even if the live
            // subscription hasn't yet delivered the batch write.
            if (typeof window !== 'undefined') {
              window.location.reload();
            }
          }}
        />
      </div>
    );
  }

  // Period navigation helpers (YYYY-MM)
  const shiftPeriod = (period: string, delta: number): string => {
    const [y, m] = period.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  };
  const labelPeriod = (period: string): string => {
    const [y, m] = period.split('-').map(Number);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[m - 1]} ${y}`;
  };
  const isCurrentPeriod = selectedPeriod === getCurrentPeriod();

  const activeRecord = activeBedDrawer
    ? rentRecords.find((r) => r.bedId === activeBedDrawer.id)
    : null;
  const activeTenant = activeBedDrawer?.tenantId
    ? tenants.find((t) => t.id === activeBedDrawer.tenantId)
    : null;

  return (
    <div className="space-y-6 text-left">
      {/* Top Header Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E2E8F0]">
        <div>
          <h1 className="text-xl font-bold text-[#09090B] tracking-tight">
            {owner.pgName}
          </h1>
          <p className="text-xs text-[#64748B] mt-0.5">
            {owner.pgAddress || 'Live occupancy HUD & automated rent settlement'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Single "Room Setup" entry point. When there are no beds yet, the
              onboarding banner below is the primary call-to-action, so this
              duplicate header button is hidden to avoid two identical actions on
              the same screen. */}
          {beds.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowSetupWizard(true)}
              className="text-xs border-[#CBD5E1] text-[#334155] hover:bg-[#F8FAFC]"
            >
              <Building className="w-3.5 h-3.5 mr-1.5 text-[#D97706]" />
              <span>Room Setup</span>
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowBankReconciler(true)}
            className="text-xs border-[#CBD5E1] text-[#334155] hover:bg-[#F8FAFC]"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
            <span>Bank CSV</span>
          </Button>
          <Button
            size="sm"
            variant="solid"
            onClick={() => {
              if (beds.length === 0) {
                toast.error('No beds configured yet. Please generate your room inventory first.');
                setShowSetupWizard(true);
                return;
              }
              const firstVacant = beds.find((b) => b.status === 'vacant');
              if (firstVacant) {
                setSelectedBedForAdd(firstVacant);
              } else {
                toast.error('All beds are currently occupied. Vacate a bed to add a new resident.');
              }
            }}
            className="text-xs"
          >
            <UserPlus className="w-3.5 h-3.5 mr-1.5" />
            <span>Add Resident</span>
          </Button>
        </div>
      </div>

      {/* Empty Inventory Onboarding Banner */}
      {beds.length === 0 && (
        <div className="bg-[#FEF3C7] border border-[#FDE68A] rounded-[12px] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-[#D97706] text-white rounded-[10px] mt-0.5 shadow-xs">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#92400E]">
                No Rooms or Beds Configured Yet (0 Units)
              </h3>
              <p className="text-xs text-[#B45309] mt-0.5">
                Your PG has 0 beds ready for lease. Configure your floor-by-floor sharing formats (Single, 2-share to 6-share) and pricing to generate your bed units.
              </p>
            </div>
          </div>
          <Button
            variant="solid"
            size="sm"
            className="bg-[#D97706] hover:bg-[#B45309] text-white whitespace-nowrap shadow-sm font-medium"
            onClick={() => setShowSetupWizard(true)}
          >
            <Layers className="w-4 h-4 mr-1.5" />
            <span>Configure Rooms & Generate Beds</span>
          </Button>
        </div>
      )}

      {/* Resident join requests (from public PG discovery) */}
      {joinRequests.length > 0 && (
        <div className="app-card overflow-hidden animate-pop">
          <div className="accent-soft-bg px-4 py-2.5 flex items-center gap-2">
            <UserPlus className="w-4 h-4" />
            <span className="text-sm font-extrabold">
              {joinRequests.length} resident {joinRequests.length === 1 ? 'wants' : 'want'} to join
            </span>
          </div>
          <div className="divide-y divide-slate-100">
            {joinRequests.slice(0, 6).map((r) => (
              <div key={r.id} className="flex items-center justify-between px-4 py-3">
                <div className="min-w-0">
                  <div className="text-sm font-bold text-slate-900 truncate">{r.residentName}</div>
                  <div className="text-[11px] font-mono-numbers text-slate-500">{r.residentPhone}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button size="sm" variant="outline" onClick={() => declineJoinRequest(r.id)}>
                    Decline
                  </Button>
                  <Button size="sm" variant="solid" onClick={() => acceptJoinRequest(r)}>
                    Accept
                  </Button>
                </div>
              </div>
            ))}
          </div>
          {prefillTenant && (
            <div className="px-4 py-2.5 text-[11px] accent-text accent-soft-bg font-semibold">
              Approved “{prefillTenant.name}” — now tap a vacant bed to finish adding them.
            </div>
          )}
        </div>
      )}

      {/* Defaulter / aging report — overdue unpaid rent across all months */}
      {defaulters.length > 0 && (
        <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-[14px] overflow-hidden shadow-[0_2px_8px_-2px_rgba(239,68,68,0.15)] animate-pop">
          <button
            type="button"
            onClick={() => setShowDefaulters((s) => !s)}
            className="w-full flex items-center justify-between px-4 py-3 text-left"
          >
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-[#DC2626]" />
              <span className="text-sm font-bold text-[#991B1B]">
                {defaulters.length} overdue {defaulters.length === 1 ? 'payment' : 'payments'}
              </span>
              <span className="text-xs text-[#B91C1C] font-mono-numbers">
                · {formatCurrency(defaulters.reduce((s, d) => s + d.outstandingPaise, 0) / 100)} outstanding
              </span>
            </div>
            <span className="text-xs text-[#B91C1C] font-semibold">
              {showDefaulters ? 'Hide' : 'View'}
            </span>
          </button>
          {showDefaulters && (
            <div className="divide-y divide-[#FECACA] border-t border-[#FECACA]">
              {defaulters.slice(0, 10).map((d) => (
                <div key={d.id} className="flex items-center justify-between px-4 py-2.5 bg-white/40">
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-[#09090B] truncate">
                      {d.tenantName || 'Resident'}{' '}
                      <span className="font-normal text-[#64748B]">· {d.bedLabel || ''} · {d.period}</span>
                    </div>
                    <div className="text-[11px] text-[#B91C1C]">
                      {d.daysOverdue} days overdue
                      {d.lateFeePaise > 0 && ` · late fee ${formatCurrency(d.lateFeePaise / 100)}`}
                    </div>
                  </div>
                  <span className="text-xs font-bold font-mono-numbers text-[#991B1B] shrink-0">
                    {formatCurrency(d.outstandingPaise / 100)}
                  </span>
                </div>
              ))}
              {defaulters.length > 10 && (
                <div className="px-4 py-2 text-[11px] text-[#B91C1C] bg-white/40">
                  +{defaulters.length - 10} more…
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Pending deposit refunds owed to tenants */}
      {pendingRefunds.length > 0 && (
        <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-[14px] p-3 space-y-2 shadow-[0_2px_8px_-2px_rgba(29,78,216,0.15)] animate-pop">
          <div className="flex items-center gap-2">
            <IndianRupee className="w-4 h-4 text-[#1D4ED8]" />
            <span className="text-sm font-bold text-[#1E3A8A]">
              {pendingRefunds.length} pending deposit {pendingRefunds.length === 1 ? 'refund' : 'refunds'}
            </span>
          </div>
          <div className="divide-y divide-[#BFDBFE]">
            {pendingRefunds.slice(0, 8).map((r) => (
              <div key={r.id} className="flex items-center justify-between py-2">
                <div className="min-w-0">
                  <span className="text-xs font-semibold text-[#09090B] truncate block">
                    {r.tenantName || 'Resident'}
                  </span>
                  <span className="text-[11px] font-mono-numbers text-[#1D4ED8]">
                    {formatCurrency(r.amountPaise / 100)} to refund
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={refundBusyId === r.id}
                  onClick={() => markRefundIssued(r.id)}
                >
                  Mark Paid Out
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Billing period navigator — view/collect rent for any month */}
      <div className="flex items-center justify-between app-card px-3 py-2">
        <button
          type="button"
          onClick={() => setSelectedPeriod((p) => shiftPeriod(p, -1))}
          className="inline-flex items-center justify-center h-11 w-11 rounded-[8px] text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#09090B] transition-colors"
          aria-label="Previous month"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="text-center">
          <div className="text-sm font-bold text-[#09090B]">{labelPeriod(selectedPeriod)}</div>
          {!isCurrentPeriod && (
            <button
              type="button"
              onClick={() => setSelectedPeriod(getCurrentPeriod())}
              className="text-[11px] text-[#D97706] font-semibold"
            >
              Jump to current month
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => setSelectedPeriod((p) => shiftPeriod(p, 1))}
          className="inline-flex items-center justify-center h-11 w-11 rounded-[8px] text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#09090B] transition-colors"
          aria-label="Next month"
        >
          <ArrowLeft className="w-4 h-4 rotate-180" />
        </button>
      </div>

      {/* Bulk confirm — mark every pending/verify record this month paid at once */}
      {(() => {
        const pendingCount = rentRecords.filter(
          (r) => r.status !== 'paid' && r.id && !r.id.startsWith('temp_')
        ).length;
        if (pendingCount < 2) return null;
        return (
          <div className="flex items-center justify-between bg-[#ECFDF5] border border-[#A7F3D0] rounded-[14px] px-3.5 py-2.5 shadow-[0_2px_8px_-2px_rgba(16,185,129,0.15)] animate-pop">
            <span className="text-xs font-bold text-[#065F46]">
              {pendingCount} payments pending this month
            </span>
            <Button
              size="sm"
              variant="solid"
              className="bg-[#10B981] hover:bg-[#059669]"
              disabled={actionBusy}
              onClick={bulkConfirmPending}
            >
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
              Mark All Paid
            </Button>
          </div>
        );
      })()}

      {/* Bento Live HUD Telemetry Strip */}
      <StatsBar
        beds={beds}
        rentRecords={rentRecords}
        onRemindAll={() => setShowReminderModal(true)}
      />

      {/* Bed Bento Grid Section */}
      <BedGrid
        beds={beds}
        rentRecords={rentRecords}
        ownerName={owner.name}
        pgName={owner.pgName}
        ownerUpi={owner.upiId}
        onAddTenant={(bed) => setSelectedBedForAdd(bed)}
        onMarkPaid={(bed, rec) => handleMarkPaid(bed, rec)}
        onVerifyProof={(bed, rec) => setProofModalRecord({ bed, record: rec })}
        onVacate={(bed) => setConfirmVacateBed(bed)}
        onSelectBed={(bed) => setActiveBedDrawer(bed)}
      />

      {/* RIGHT-SIDE BED DETAILS COMMAND DRAWER */}
      <Drawer
        isOpen={!!activeBedDrawer}
        onClose={() => setActiveBedDrawer(null)}
        title={activeBedDrawer ? `Bed ${activeBedDrawer.bedLabel}` : 'Bed Details'}
        description={activeBedDrawer ? `Room ${activeBedDrawer.roomNumber} · Floor ${activeBedDrawer.floor}` : ''}
        width="md"
        footer={
          activeBedDrawer?.status === 'guest' ? (
            <a href="/guests" className="w-full">
              <Button variant="solid" size="sm" className="w-full">
                <BedDouble className="w-3.5 h-3.5 mr-1" />
                <span>Manage Guest · Check out</span>
              </Button>
            </a>
          ) : activeBedDrawer?.status !== 'vacant' ? (
            <div className="flex items-center justify-between w-full">
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setConfirmVacateBed(activeBedDrawer)}
              >
                <LogOut className="w-3.5 h-3.5 mr-1" />
                <span>Vacate Bed</span>
              </Button>

              <div className="flex items-center gap-2">
                {activeRecord?.status === 'verify' && (
                  <Button
                    size="sm"
                    variant="solid"
                    className="bg-[#6366F1] hover:bg-[#4F46E5] text-white"
                    onClick={() => {
                      if (activeRecord) {
                        setProofModalRecord({ bed: activeBedDrawer!, record: activeRecord });
                      }
                    }}
                  >
                    <Eye className="w-3.5 h-3.5 mr-1" />
                    <span>View Proof</span>
                  </Button>
                )}

                {activeBedDrawer?.status !== 'paid' && activeRecord?.status !== 'paid' && (
                  <Button
                    size="sm"
                    variant="solid"
                    className="bg-[#10B981] hover:bg-[#059669]"
                    onClick={() => handleMarkPaid(activeBedDrawer!, activeRecord || undefined)}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                    <span>Mark as Paid</span>
                  </Button>
                )}

                {(activeBedDrawer?.status === 'paid' || activeRecord?.status === 'paid') && activeRecord?.id && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-[#DC2626] border-[#FECACA] hover:bg-[#FEF2F2]"
                    onClick={() => handleReversePaid(activeBedDrawer!, activeRecord)}
                  >
                    <span>Reverse Payment</span>
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 w-full">
              <Button
                size="sm"
                variant="solid"
                className="flex-1"
                onClick={() => {
                  setSelectedBedForAdd(activeBedDrawer);
                  setActiveBedDrawer(null);
                }}
              >
                <UserPlus className="w-3.5 h-3.5 mr-1" />
                <span>Add Resident</span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setGuestBed(activeBedDrawer);
                  setActiveBedDrawer(null);
                }}
              >
                <BedDouble className="w-3.5 h-3.5 mr-1" />
                <span>Check in Guest</span>
              </Button>
            </div>
          )
        }
      >
        {activeBedDrawer && (
          <div className="space-y-5 text-left">
            {activeBedDrawer.status === 'vacant' ? (
              <div className="p-6 text-center rounded-[10px] bg-[#F8FAFC] border border-[#E2E8F0] space-y-2">
                <span className="text-xs text-[#64748B] block">This bed is currently</span>
                <span className="text-base font-bold text-[#09090B] block">Vacant</span>
                <span className="font-mono-numbers text-sm text-[#D97706] font-bold block">
                  {formatCurrency(activeBedDrawer.monthlyRent)}/month
                </span>
              </div>
            ) : (
              <>
                {/* Resident Card */}
                <div className="p-4 rounded-[10px] bg-[#F8FAFC] border border-[#E2E8F0] flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar name={activeBedDrawer.tenantName || 'R'} size="lg" />
                    <div>
                      <h4 className="text-sm font-bold text-[#09090B]">
                        {activeBedDrawer.tenantName}
                      </h4>
                      <p className="text-xs font-mono-numbers text-[#64748B]">
                        {activeBedDrawer.tenantPhone}
                      </p>
                      {activeTenant?.moveInDate && (
                        <p className="text-[11px] text-[#94A3B8] mt-0.5">
                          Since {new Date(activeTenant.moveInDate).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                        </p>
                      )}
                    </div>
                  </div>

                  <StatusDot
                    status={
                      activeBedDrawer.status === 'paid' || activeRecord?.status === 'paid'
                        ? 'paid'
                        : activeRecord?.status === 'verify'
                        ? 'verify'
                        : 'pending'
                    }
                    label={
                      activeBedDrawer.status === 'paid' || activeRecord?.status === 'paid'
                        ? 'Paid'
                        : activeRecord?.status === 'verify'
                        ? 'Verify'
                        : 'Due'
                    }
                  />
                </div>

                {/* Financial Summary */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-[8px] border border-[#E2E8F0] bg-white">
                    <span className="text-[10px] uppercase font-semibold text-[#64748B]">
                      Monthly Rent
                    </span>
                    <span className="text-base font-bold font-mono-numbers text-[#09090B] block mt-0.5">
                      {formatCurrency(activeBedDrawer.monthlyRent)}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-[8px] border border-[#E2E8F0] bg-white">
                    <span className="text-[10px] uppercase font-semibold text-[#64748B]">
                      Security Deposit
                    </span>
                    <span className="text-base font-bold font-mono-numbers text-[#09090B] block mt-0.5">
                      {formatCurrency(activeTenant?.depositPaid || activeBedDrawer.monthlyRent)}
                    </span>
                  </div>
                </div>

                {/* Partial / advance payment — shown while the active record is not fully paid */}
                {activeRecord && activeRecord.status !== 'paid' && (activeRecord.amountDuePaise ?? 0) > 0 && (
                  <div className="p-3.5 rounded-[8px] border border-[#E2E8F0] bg-white space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-[#334155]">Collection Progress</span>
                      <span className="font-mono-numbers text-[#64748B]">
                        {formatCurrency((activeRecord.amountPaidPaise ?? 0) / 100)} / {formatCurrency((activeRecord.amountDuePaise ?? 0) / 100)}
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-[#F1F5F9] overflow-hidden">
                      <div
                        className="h-full bg-[#10B981] rounded-full transition-all"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.round(
                              ((activeRecord.amountPaidPaise ?? 0) / Math.max(1, activeRecord.amountDuePaise ?? 1)) * 100
                            )
                          )}%`,
                        }}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        inputMode="numeric"
                        placeholder="Amount (₹)"
                        value={partialAmount}
                        onChange={(e) => setPartialAmount(e.target.value)}
                        className="flex-1 h-11 px-3 rounded-[8px] border border-[#CBD5E1] text-sm text-[#09090B] focus:border-[#D97706] focus:outline-none"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={actionBusy}
                        onClick={() => handleRecordPartial(activeRecord)}
                      >
                        Record Part Payment
                      </Button>
                    </div>
                  </div>
                )}

                {/* Direct Resident Contact Actions */}
                {activeBedDrawer.tenantPhone && (
                  <div className="space-y-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B] block">
                      Direct Actions
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      <a
                        href={`tel:${activeBedDrawer.tenantPhone}`}
                        className="flex items-center justify-center gap-1.5 h-9 rounded-[8px] border border-[#E2E8F0] text-xs font-semibold text-[#09090B] hover:bg-[#F8FAFC] transition-colors cursor-pointer"
                      >
                        <Phone className="w-3.5 h-3.5 text-[#64748B]" />
                        <span>Call</span>
                      </a>
                      <a
                        href={getWhatsAppLink(
                          activeBedDrawer.tenantPhone,
                          `Namaste ${activeBedDrawer.tenantName} ji 🙏, this is a note regarding Bed ${activeBedDrawer.bedLabel} at ${owner.pgName}.`
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-1.5 h-9 rounded-[8px] bg-[#10B981] hover:bg-[#059669] text-white text-xs font-semibold transition-colors cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>WhatsApp</span>
                      </a>
                    </div>
                  </div>
                )}

                {/* Document capture: ID proof + rental agreement */}
                {activeTenant?.id && (
                  <div className="space-y-2">
                    <DocumentUploader tenantId={activeTenant.id} photoType="id_proof" />
                    <DocumentUploader tenantId={activeTenant.id} photoType="agreement" />
                  </div>
                )}

                {/* Photo gallery (move-in / ID / payment proofs) */}
                {activeTenant?.id && (
                  <div className="space-y-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B] block">
                      Document & Photo Vault
                    </span>
                    <TenantPhotoGallery tenantId={activeTenant.id} />
                  </div>
                )}

                {/* Emergency Contact */}
                {activeTenant?.emergencyContactPhone && (
                  <div className="p-3.5 rounded-[8px] bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-between">
                    <div className="min-w-0">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B] block">
                        Emergency Contact
                      </span>
                      <span className="text-xs text-[#09090B] font-semibold">
                        {activeTenant.emergencyContactName || 'Contact'}
                        {activeTenant.emergencyContactRelation ? ` · ${activeTenant.emergencyContactRelation}` : ''}
                      </span>
                      <span className="text-[11px] font-mono-numbers text-[#64748B] block">
                        {activeTenant.emergencyContactPhone}
                      </span>
                    </div>
                    <a
                      href={`tel:${activeTenant.emergencyContactPhone}`}
                      className="inline-flex items-center justify-center h-11 w-11 rounded-[8px] border border-[#E2E8F0] text-[#64748B] hover:bg-white transition-colors shrink-0"
                      aria-label="Call emergency contact"
                    >
                      <Phone className="w-4 h-4" />
                    </a>
                  </div>
                )}

                {/* Public Link Share */}
                {activeTenant?.token && (
                  <div className="p-3.5 rounded-[8px] bg-[#F8FAFC] border border-[#E2E8F0] space-y-1.5">
                    <span className="text-[11px] font-semibold text-[#475569] block">
                      Resident Private Portal Link
                    </span>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono-numbers text-[11px] text-[#64748B] truncate max-w-[220px]">
                        {typeof window !== 'undefined' ? `${window.location.origin}/t/${activeTenant.token}` : `/t/${activeTenant.token}`}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const url = `${window.location.origin}/t/${activeTenant.token}`;
                          navigator.clipboard.writeText(url);
                          toast.success('Link copied');
                        }}
                        className="text-[#D97706] font-semibold hover:underline inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Copy className="w-3 h-3" />
                        <span>Copy</span>
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </Drawer>

      {/* ADD RESIDENT DRAWER */}
      {selectedBedForAdd && (
        <AddTenantModal
          bed={selectedBedForAdd}
          ownerId={ownerId}
          isOpen={!!selectedBedForAdd}
          prefillName={prefillTenant?.name}
          prefillPhone={prefillTenant?.phone}
          onClose={() => {
            setSelectedBedForAdd(null);
            setPrefillTenant(null);
          }}
          onSuccess={() => {
            setSelectedBedForAdd(null);
            setPrefillTenant(null);
          }}
        />
      )}

      {/* CHECK IN GUEST (short stay) */}
      {guestBed && (
        <CheckInGuestModal
          bed={guestBed}
          isOpen={!!guestBed}
          onClose={() => setGuestBed(null)}
          onSuccess={() => setGuestBed(null)}
        />
      )}

      {/* WHATSAPP REMINDER DRAWER */}
      <WhatsAppReminderModal
        isOpen={showReminderModal}
        onClose={() => setShowReminderModal(false)}
        beds={beds}
        tenants={tenants}
        rentRecords={rentRecords}
        pgName={owner.pgName}
        ownerName={owner.name}
        ownerUpi={owner.upiId}
      />

      {/* VERIFY PROOF MODAL */}
      {proofModalRecord && (
        <Drawer
          isOpen={!!proofModalRecord}
          onClose={() => setProofModalRecord(null)}
          title={`Verify Payment Proof — Bed ${proofModalRecord.bed.bedLabel}`}
          description={`Resident: ${proofModalRecord.bed.tenantName}`}
          width="md"
          footer={
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setProofModalRecord(null)}
              >
                Close
              </Button>
              <Button
                variant="solid"
                size="sm"
                className="bg-[#10B981] hover:bg-[#059669]"
                onClick={handleApproveProof}
              >
                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                <span>Approve & Issue HRA Receipt</span>
              </Button>
            </div>
          }
        >
          <div className="space-y-4 text-left">
            <div className="p-3.5 bg-[#F8FAFC] rounded-[8px] border border-[#E2E8F0] flex items-center justify-between text-xs">
              <span className="text-[#64748B]">Claimed Amount:</span>
              <span className="font-mono-numbers font-bold text-sm text-[#09090B]">
                {formatCurrency(proofModalRecord.record.amount || 0)}
              </span>
            </div>

            {proofModalRecord.record.paymentReference && (
              <div className="p-3 bg-[#EEF2FF] rounded-[8px] border border-[#C7D2FE] flex items-center justify-between text-xs">
                <span className="text-[#4338CA] font-medium">Claimed UPI UTR:</span>
                <span className="font-mono font-bold text-sm text-[#1E1B4B]">
                  {proofModalRecord.record.paymentReference}
                </span>
              </div>
            )}

            {proofModalRecord.record.proofImageUrl ? (
              <div className="border border-[#E2E8F0] rounded-[10px] overflow-hidden bg-black/5 p-2 flex items-center justify-center">
                <img
                  src={proofModalRecord.record.proofImageUrl}
                  alt="Proof screenshot"
                  className="max-h-96 object-contain rounded-[6px]"
                />
              </div>
            ) : (
              <p className="text-xs text-[#64748B] italic text-center py-8">
                No screenshot image was attached.
              </p>
            )}
          </div>
        </Drawer>
      )}

      {/* CONFIRM VACATE MODAL */}
      {confirmVacateBed && (
        <Drawer
          isOpen={!!confirmVacateBed}
          onClose={() => setConfirmVacateBed(null)}
          title="Confirm Checkout & Vacate Bed"
          description={`Bed ${confirmVacateBed.bedLabel} (${confirmVacateBed.tenantName})`}
          width="sm"
          footer={
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmVacateBed(null)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleConfirmVacate}
              >
                Confirm Vacate
              </Button>
            </div>
          }
        >
          <div className="space-y-3 text-left text-xs text-[#475569] leading-relaxed">
            <div className="p-3.5 rounded-[8px] bg-[#FEF2F2] border border-[#FECACA] text-[#991B1B] flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                This will unassign <strong>{confirmVacateBed.tenantName}</strong> from Bed {confirmVacateBed.bedLabel} and archive their active lease. Their private portal URL will be disabled.
              </span>
            </div>
            <p>
              Please verify that all outstanding dues and deposit refunds have been finalized before completing this step.
            </p>
          </div>
        </Drawer>
      )}

      {/* REVERSE PAID — styled confirm with required reason */}
      <ConfirmDialog
        open={!!reverseTarget}
        tone="danger"
        title="Reverse this payment?"
        message={
          reverseTarget
            ? `Bed ${reverseTarget.bed.bedLabel} will return to pending. This is recorded in the audit log.`
            : ''
        }
        reasonLabel="Reason for reversal"
        reasonPlaceholder="e.g. Duplicate entry, wrong tenant, refund issued"
        confirmLabel="Reverse Payment"
        busy={reverseBusy}
        onConfirm={doReversePaid}
        onCancel={() => setReverseTarget(null)}
      />

      {/* BANK CSV STATEMENT RECONCILER */}
      <BankCsvReconciler
        isOpen={showBankReconciler}
        onClose={() => setShowBankReconciler(false)}
        rentRecords={rentRecords}
      />
    </div>
  );
}
