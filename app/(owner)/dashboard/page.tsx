'use client';

import React, { useState, useEffect } from 'react';
import { useOwnerSession } from '@/hooks/useOwner';
import { useBeds } from '@/hooks/useBeds';
import { useTenants } from '@/hooks/useTenants';
import {
  subscribeToOwnerRentRecords,
} from '@/lib/firestore';
import { getCurrentPeriod, formatCurrency, getWhatsAppLink, errorMessage, depositPaidRupees, todayIST, telHref } from '@/lib/utils';
import { apiGet, apiPost, apiPatch } from '@/lib/client/api';
import { Bed, Owner, RentRecord } from '@/types';
import { StatsBar, StatsRow } from '@/components/owner/StatsBar';
import {
  HeroHeader,
  HeroAction,
  InfoBanner,
  KeyValue,
  PageHeader,
  QuickActionGrid,
  StatTile,
  type QuickAction,
} from '@/components/ui/dashboard-kit';
import { BedGrid } from '@/components/owner/BedGrid';
import { AddTenantModal } from '@/components/owner/AddTenantModal';
import { CheckInGuestModal } from '@/components/owner/CheckInGuestModal';
import { WhatsAppReminderModal } from '@/components/owner/WhatsAppReminderModal';
import { emailRentReminder } from '@/lib/client/rentReminders';
import { BankCsvReconciler } from '@/components/owner/BankCsvReconciler';
import { PropertySetupWizard } from '@/components/owner/PropertySetupWizard';
import { DocumentUploader } from '@/components/owner/DocumentUploader';
import { TenantPhotoGallery } from '@/components/owner/TenantPhotoGallery';
import { Button } from '@/components/ui/button';
import { Drawer } from '@/components/ui/drawer';
import { Skeleton } from '@/components/ui/skeleton';
import { StatGridSkeleton, PanelSkeleton, CardListSkeleton } from '@/components/ui/skeletons';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Icon3D, IconBubble } from '@/components/brand/Icon3D';
import {
  Building,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  LogOut,
  Send,
  Phone,
  Mail,
  Copy,
  UserPlus,
  FileSpreadsheet,
  ArrowLeft,
  Layers,
  BedDouble,
  CalendarDays,
  MapPin,
  ShieldCheck,
  RefreshCw,
  Undo2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { copyText } from '@/lib/client/clipboard';
import { canAccessPage, hasAnyPermission } from '@/lib/constants/navAccess';
import { STAFF_PERMISSIONS } from '@/lib/constants/permissions';

/** Loading state shaped like the owner home (hero · stats · period · panels · rooms). */
function OwnerHomeSkeleton() {
  return (
    <div className="space-y-5" role="status">
      <span className="sr-only">Loading your dashboard…</span>
      <Skeleton className="h-44 w-full rounded-3xl" />
      <StatGridSkeleton count={4} />
      <Skeleton className="h-14 w-full rounded-full" />
      <div className="grid gap-5 lg:grid-cols-2">
        <PanelSkeleton height="h-60" />
        <PanelSkeleton height="h-60" />
      </div>
      <CardListSkeleton rows={4} height="h-28" cols={2} />
    </div>
  );
}

export default function OwnerDashboardPage() {
  const { ownerId, phoneNumber, properties, selectedPropertyId, role, permissions } = useOwnerSession();
  // Staff only see actions their permissions allow (the API enforces the same).
  const canPage = (href: string) => canAccessPage(href, role, permissions);
  const canTenants = hasAnyPermission(role, permissions, [STAFF_PERMISSIONS.MANAGE_TENANTS]);
  const canBeds = hasAnyPermission(role, permissions, [STAFF_PERMISSIONS.MANAGE_BEDS]);
  const canRent = hasAnyPermission(role, permissions, [STAFF_PERMISSIONS.COLLECT_RENT]);

  // IMPORTANT backward-compat rule: only filter by property when the owner
  // actually has >1 property. Legacy single-PG data has no `propertyId` field,
  // so filtering on it would hide everything. With one property we stay
  // owner-wide (undefined), which matches both legacy and new docs.
  const propertyFilter = properties.length > 1 ? selectedPropertyId : undefined;

  const [owner, setOwner] = useState<Owner | null>(null);
  const [loadingOwner, setLoadingOwner] = useState(true);
  const [ownerError, setOwnerError] = useState(false);
  // Gate for NON-CRITICAL background loads (defaulter badge, pending refunds,
  // join-request banner). These only render notification banners below the fold,
  // so we hold them until the critical content (profile) is in and the browser
  // is idle — they must never contend with first paint.
  const [secondaryReady, setSecondaryReady] = useState(false);

  // Active Hooks for Beds, Tenants, Records
  const { beds, error: bedsError } = useBeds(ownerId, propertyFilter);
  const { tenants, error: tenantsError } = useTenants(ownerId, propertyFilter);

  // Once the owner profile has loaded, defer secondary loads to browser idle
  // time so the main dashboard paints and becomes interactive first.
  useEffect(() => {
    if (!owner) return;
    // requestIdleCallback isn't in every TS DOM lib target — narrow it instead
    // of casting to `any`. Falls back to setTimeout where unsupported (Safari).
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    const schedule: (cb: () => void) => number =
      typeof w.requestIdleCallback === 'function'
        ? (cb) => w.requestIdleCallback!(cb, { timeout: 2000 })
        : (cb) => window.setTimeout(cb, 300);
    const cancel: (id: number) => void =
      typeof w.cancelIdleCallback === 'function' ? w.cancelIdleCallback : window.clearTimeout;
    const id = schedule(() => setSecondaryReady(true));
    return () => cancel(id);
  }, [owner]);
  const [rentRecords, setRentRecords] = useState<RentRecord[]>([]);
  const [rentError, setRentError] = useState(false);
  // Staff without resident/rent permission: listeners are denied by the rules —
  // that's expected, not a connection failure.
  const [rentDenied, setRentDenied] = useState(false);
  // Accurate whole-PG totals (server aggregation) — correct even when the live
  // bed window is capped at 100. Refreshed when beds/payments change.
  const [summary, setSummary] = useState<import('@/components/owner/StatsBar').DashboardSummary | null>(null);
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
  const [emailReminding, setEmailReminding] = useState(false);

  // One-button "send rent reminders from the owner's own Gmail". Falls back
  // gracefully: if Gmail isn't connected, nudge to the WhatsApp flow / Settings.
  const handleEmailReminders = async () => {
    if (emailReminding) return;
    setEmailReminding(true);
    try {
      const res = await fetch('/api/rent/send-reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period: selectedPeriod }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === 'GMAIL_NOT_CONNECTED') {
          toast.error('Connect your Gmail in Settings to send email reminders.');
        } else if (data.code === 'GMAIL_UNAVAILABLE') {
          toast('Email reminders aren’t enabled — use WhatsApp reminders instead.');
          setShowReminderModal(true);
        } else {
          throw new Error(data.error || 'Could not send reminders');
        }
        return;
      }
      const { sent, skippedCount } = data;
      if (sent === 0 && skippedCount === 0) {
        toast('No unpaid residents to remind this month.');
      } else {
        toast.success(`Emailed ${sent} reminder${sent === 1 ? '' : 's'}${skippedCount ? ` · ${skippedCount} without email skipped` : ''}`);
      }
    } catch (e: unknown) {
      toast.error(errorMessage(e, 'Could not send email reminders'));
    } finally {
      setEmailReminding(false);
    }
  };

  // Email ONE resident (from the bed drawer) from the owner's Gmail; falls back
  // to WhatsApp for that resident if they have no email / Gmail isn't connected.
  const [emailingRecordId, setEmailingRecordId] = useState<string | null>(null);
  const emailOneReminder = async (bed: Bed, record: RentRecord) => {
    if (!record.id || emailingRecordId) return;
    setEmailingRecordId(record.id);
    try {
      await emailRentReminder(record.id, {
        tenantName: bed.tenantName,
        isStaff: role === 'staff',
        onWhatsAppFallback: () => {
          if (bed.tenantPhone) {
            const msg = `Namaste ${bed.tenantName || 'Resident'} ji 🙏, a friendly reminder that rent for Bed ${bed.bedLabel} at ${owner?.pgName || 'your PG'} is pending.`;
            window.open(getWhatsAppLink(bed.tenantPhone, msg), '_blank');
          }
        },
      });
    } finally {
      setEmailingRecordId(null);
    }
  };

  const [showBankReconciler, setShowBankReconciler] = useState(false);
  const [proofModalRecord, setProofModalRecord] = useState<{ bed: Bed; record: RentRecord } | null>(null);
  const [activeBedDrawer, setActiveBedDrawer] = useState<Bed | null>(null);
  const [confirmVacateBed, setConfirmVacateBed] = useState<Bed | null>(null);
  const [reverseTarget, setReverseTarget] = useState<{ bed: Bed; record: RentRecord } | null>(null);
  const [reverseBusy, setReverseBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState(false); // in-flight guard for paid/approve/vacate

  // Load Owner Profile. `isCurrent` guards against a slow response from a
  // previous ownerId resolving after a newer one (last-writer-by-latency race).
  const reloadOwner = React.useCallback(
    async (isCurrent: () => boolean = () => true) => {
      if (!ownerId) {
        setLoadingOwner(false);
        return;
      }
      setLoadingOwner(true);
      setOwnerError(false);

      // Fail fast instead of spinning forever if the API/Firebase is unreachable.
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12_000);
      try {
        const res = await fetch('/api/owners', { signal: controller.signal });
        if (!isCurrent()) return; // a newer load superseded this one
        if (res.ok) {
          setOwner(await res.json());
        } else if (res.status === 404) {
          // No profile yet → first-time onboarding (wizard). Not an error.
          setOwner(null);
        } else {
          setOwnerError(true);
        }
      } catch (e) {
        // Network failure or the 12s abort above.
        if (!isCurrent()) return;
        console.error('Error fetching owner profile:', e);
        setOwnerError(true);
      } finally {
        clearTimeout(timeout);
        if (isCurrent()) setLoadingOwner(false);
      }
    },
    [ownerId]
  );

  useEffect(() => {
    let active = true;
    // Defer to a microtask so the synchronous setLoadingOwner/setOwnerError at
    // the top of reloadOwner run AFTER this effect commits rather than inside its
    // body (avoids the cascading-render lint rule). Initial state already renders
    // the loading skeleton, so there's no visible delay on mount.
    queueMicrotask(() => {
      if (active) reloadOwner(() => active);
    });
    return () => {
      active = false;
    };
  }, [reloadOwner]);

  // Subscribe to real-time Rent Records for the selected billing period.
  // Re-subscribes when the owner navigates to a different month so past-due and
  // future months can be viewed and collected, not just the current month.
  useEffect(() => {
    if (!ownerId) return;
    // Don't reset error state synchronously in the effect body (cascading-render
    // lint rule). The subscription callbacks are authoritative: the success
    // callback clears the error on the first emission after (re)subscribing, and
    // the error callback sets it — so navigating months self-heals on next data.
    const unsub = subscribeToOwnerRentRecords(
      ownerId,
      selectedPeriod,
      (records) => {
        setRentRecords(records);
        setRentError(false);
        setRentDenied(false);
      },
      propertyFilter,
      (err) => (err.code === 'permission-denied' ? setRentDenied(true) : setRentError(true))
    );
    return unsub;
  }, [ownerId, selectedPeriod, propertyFilter]);

  // A stable signature of rent PAID-state. It only changes when a record's
  // paid/unpaid status actually flips (mark paid, reverse, bulk, partial) — not
  // on every live stream tick — so the deferred defaulters banner re-fetches
  // after money changes without hammering the API on each snapshot.
  const paidSignature = React.useMemo(
    () =>
      rentRecords
        .map((r) => `${r.id}:${r.status === 'paid' ? 1 : 0}`)
        .sort()
        .join('|'),
    [rentRecords]
  );

  // Fetch accurate whole-PG totals via server aggregation (correct even when the
  // live bed window is capped at 100). Refreshes when the bed set or paid-state
  // changes — not on every stream tick.
  const bedCount = beds.length;
  useEffect(() => {
    if (!ownerId) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    (async () => {
      try {
        const qs = propertyFilter ? `?propertyId=${encodeURIComponent(propertyFilter)}` : '';
        const res = await fetch(`/api/owners/summary${qs}`, { signal: controller.signal });
        if (res.ok) setSummary(await res.json());
      } catch {
        /* non-fatal — StatsBar falls back to the live window */
      } finally {
        clearTimeout(timeout);
      }
    })();
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [ownerId, propertyFilter, bedCount, paidSignature]);

  // Load the defaulter / aging report (overdue unpaid rent across all months).
  // Deferred (secondaryReady); re-fetches only when paid-state changes.
  useEffect(() => {
    if (!ownerId || !secondaryReady) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await apiGet<{ defaulters?: typeof defaulters }>('/api/rent/defaulters');
        if (!cancelled) setDefaulters(data.defaulters || []);
      } catch {
        /* non-fatal */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ownerId, propertyFilter, secondaryReady, paidSignature]);

  // Load pending security-deposit refunds (owed to departed/departing tenants).
  useEffect(() => {
    if (!ownerId || !secondaryReady) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await apiGet<{ refunds?: typeof pendingRefunds }>('/api/deposits/refunds');
        if (!cancelled) setPendingRefunds(data.refunds || []);
      } catch {
        /* non-fatal */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ownerId, propertyFilter, secondaryReady]);

  // Pending resident join-requests (from public PG discovery).
  useEffect(() => {
    if (!ownerId || !secondaryReady) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await apiGet<{ requests?: typeof joinRequests }>('/api/owners/join-requests');
        if (!cancelled) setJoinRequests(data.requests || []);
      } catch {
        /* non-fatal */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ownerId, secondaryReady]);

  // Owner accepts a join request: prefill the Add-Tenant flow with the
  // resident's name + phone (phone auto-links the resident account) and mark the
  // request approved. The owner then taps a vacant bed to finish.
  const acceptJoinRequest = async (req: { id: string; residentName: string; residentPhone: string }) => {
    setPrefillTenant({ name: req.residentName, phone: req.residentPhone });
    try {
      await apiPost('/api/owners/join-requests', { requestId: req.id, action: 'approved' });
      setJoinRequests((list) => list.filter((r) => r.id !== req.id));
      toast.success('Approved — now tap a vacant bed to add this resident');
    } catch {
      toast.error('Could not approve request');
    }
  };

  const declineJoinRequest = async (id: string) => {
    try {
      await apiPost('/api/owners/join-requests', { requestId: id, action: 'declined' });
      setJoinRequests((list) => list.filter((r) => r.id !== id));
    } catch {
      toast.error('Could not decline');
    }
  };

  const markRefundIssued = async (depositId: string) => {
    if (refundBusyId) return;
    setRefundBusyId(depositId);
    try {
      await apiPatch(`/api/deposits/refunds/${depositId}`, {});
      toast.success('Refund marked as paid out');
      setPendingRefunds((list) => list.filter((r) => r.id !== depositId));
    } catch (e: unknown) {
      toast.error(errorMessage(e, 'Could not update refund'));
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
        const data = await apiPost<{ record: { receiptNumber: number } }>(
          `/api/rent/${record.id}/confirm`,
          { paymentReference: 'Manual confirmation' }
        );
        toast.success(`Bed ${bed.bedLabel} marked Paid! Receipt REC-${String(data.record.receiptNumber).padStart(5, '0')} issued.`);
        if (activeBedDrawer?.id === bed.id) {
          setActiveBedDrawer({ ...activeBedDrawer, status: 'paid' });
        }
      } else {
        // No persisted rent record for this month (e.g. a guest bed, or no bill
        // generated yet). Previously this showed a false "marked as Paid"
        // success without saving anything — tell the owner the truth instead.
        toast.error(`There's no rent bill for bed ${bed.bedLabel} this month, so there's nothing to mark as paid.`);
      }
    } catch (err: unknown) {
      toast.error(errorMessage(err, 'Failed to update status'));
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
      const data = await apiPost<{ confirmed?: unknown[]; failed?: unknown[] }>(
        '/api/rent/bulk-confirm',
        { recordIds: ids }
      );
      const okCount = data.confirmed?.length || 0;
      const failCount = data.failed?.length || 0;
      toast.success(
        `Confirmed ${okCount} payment${okCount === 1 ? '' : 's'}${failCount ? ` · ${failCount} skipped` : ''}`
      );
    } catch (e: unknown) {
      toast.error(errorMessage(e, 'Bulk confirm failed'));
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
      const data = await apiPost<{
        record?: { amountPaidPaise?: number; amountDuePaise?: number; status?: string };
      }>(`/api/rent/${record.id}/partial`, { amountRupees: rupees });
      const paid = (data.record?.amountPaidPaise ?? 0) / 100;
      const due = (data.record?.amountDuePaise ?? 0) / 100;
      if (data.record?.status === 'paid') {
        toast.success('Rent fully paid — receipt issued.');
      } else {
        toast.success(`Recorded ₹${rupees}. Paid ₹${paid} of ₹${due}.`);
      }
      setPartialAmount('');
    } catch (e: unknown) {
      toast.error(errorMessage(e, 'Could not record payment'));
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
      await apiPost(`/api/rent/${record.id}/reverse`, { reversalReason: reason });

      toast.success(`Payment reversed. Bed ${bed.bedLabel} is now pending.`);
      if (activeBedDrawer?.id === bed.id) {
        setActiveBedDrawer({ ...activeBedDrawer, status: 'occupied' });
      }
      setReverseTarget(null);
    } catch (err: unknown) {
      toast.error(errorMessage(err, 'Could not reverse payment'));
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
      const data = await apiPost<{ record: { receiptNumber: number } }>(
        `/api/rent/${record.id}/confirm`,
        { paymentReference: record.paymentReference }
      );

      toast.success(`Payment approved for ${bed.tenantName}! Receipt REC-${String(data.record.receiptNumber).padStart(5, '0')} issued.`);
      setProofModalRecord(null);
      if (activeBedDrawer?.id === bed.id) {
        setActiveBedDrawer({ ...activeBedDrawer, status: 'paid' });
      }
    } catch (e: unknown) {
      toast.error(errorMessage(e, 'Could not approve payment'));
    } finally {
      setActionBusy(false);
    }
  };

  // Handle Vacate Tenant via POST /api/tenants/[id]/moveout
  const handleConfirmVacate = async () => {
    if (!confirmVacateBed || !confirmVacateBed.tenantId || actionBusy) return;

    setActionBusy(true);
    try {
      await apiPost(`/api/tenants/${confirmVacateBed.tenantId}/moveout`, {
        moveOutDate: todayIST(),
      });

      toast.success(`Bed ${confirmVacateBed.bedLabel} is now vacant`);
      setConfirmVacateBed(null);
      setActiveBedDrawer(null);
    } catch (e: unknown) {
      toast.error(errorMessage(e, 'Could not vacate bed'));
    } finally {
      setActionBusy(false);
    }
  };

  if (loadingOwner) {
    return <OwnerHomeSkeleton />;
  }

  // ---------------- LOAD FAILURE (never spin forever) ----------------
  const noResidentAccess = tenantsError === 'permission-denied' || rentDenied;
  if (ownerError || bedsError || (tenantsError && tenantsError !== 'permission-denied') || rentError) {
    return (
      <div className="mx-auto max-w-xl py-6">
        <div className="app-card">
          <EmptyState
            icon3d="alert"
            title="Couldn’t load your dashboard"
            description="We couldn’t reach the server in time. This is usually a temporary connection issue. Please check your internet and try again."
            action={
              <Button
                onClick={() => {
                  setOwnerError(false);
                  reloadOwner();
                }}
              >
                <RefreshCw className="h-4 w-4" />
                <span>Retry</span>
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  // ---------------- SETUP WIZARD (FIRST TIME PG ONBOARDING) ----------------
  if (!owner) {
    return (
      <PropertySetupWizard
        initialOwnerPhone={phoneNumber || ''}
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
      <div className="space-y-5 text-left">
        <PageHeader
          icon="building"
          tint="violet"
          title="Property & Room Inventory Setup"
          subtitle={`Configure room sharing formats (Single, 2-share to 6-share), rents, and floor layout matrix for ${owner.pgName}`}
          actions={
            <Button variant="outline" onClick={() => setShowSetupWizard(false)}>
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Dashboard</span>
            </Button>
          }
        />
        <PropertySetupWizard
          initialOwnerPhone={phoneNumber || owner.phone || ''}
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

  // Resolve the drawer's bed against the LIVE beds feed at render time. Handlers
  // open/patch `activeBedDrawer` optimistically (e.g. right after assigning a
  // resident, before the snapshot lands); preferring the live copy means the
  // authoritative status + tenantId are picked up as soon as they arrive, so
  // activeTenant/activeRecord resolve to the newly-created records without a
  // setState-in-effect sync.
  const liveBed = activeBedDrawer
    ? beds.find((b) => b.id === activeBedDrawer.id) ?? activeBedDrawer
    : null;
  // Rent records link to a resident (doc id `${tenantId}_${period}`), not a bed —
  // resolve the drawer's current rent record via the bed's tenantId, scoped to
  // the selected billing period. (Matching by bedId silently found nothing.)
  const activeRecord = liveBed?.tenantId
    ? rentRecords.find((r) => r.tenantId === liveBed.tenantId)
    : null;
  const activeTenant = liveBed?.tenantId
    ? tenants.find((t) => t.id === liveBed.tenantId)
    : null;

  // ---------------- Presentation-only derivations ----------------
  const isStaff = role === 'staff';
  // Greet the owner by name (staff see the PG name — the profile is the owner's).
  const ownerFirstLine = (owner.name || '').trim();
  const heroName = !isStaff && ownerFirstLine ? ownerFirstLine : owner.pgName;
  const heroPlace =
    heroName === owner.pgName
      ? owner.pgAddress || 'Live occupancy & automated rent settlement'
      : [owner.pgName, owner.pgAddress].filter(Boolean).join(', ');
  const periodLabel = isCurrentPeriod ? 'This Month' : labelPeriod(selectedPeriod);
  // Active residents (the live feed is capped at 100 → show "100+").
  const residentCount = `${tenants.length}${tenants.length >= 100 ? '+' : ''}`;
  // Bulk confirm — every pending/verify record of the selected month.
  const bulkPendingCount = rentRecords.filter(
    (r) => r.status !== 'paid' && r.id && !r.id.startsWith('temp_')
  ).length;
  // Drawer status pill (selected month's record wins over the bed status).
  const drawerStatus: 'paid' | 'verify' | 'pending' =
    activeBedDrawer?.status === 'paid' || activeRecord?.status === 'paid'
      ? 'paid'
      : activeRecord?.status === 'verify'
      ? 'verify'
      : 'pending';
  const drawerStatusLabel = drawerStatus === 'paid' ? 'Paid' : drawerStatus === 'verify' ? 'Verify' : 'Due';

  const handleAddResident = () => {
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
  };

  // Quick actions only reuse existing handlers / routes.
  const quickActions: QuickAction[] = (
    [
      canTenants && { label: 'Add Resident', icon: 'users', tint: 'violet', onClick: handleAddResident },
      canBeds && { label: 'Add Room / Bed', icon: 'bed', tint: 'sky', onClick: () => setShowSetupWizard(true) },
      canRent && { label: 'Bank CSV', icon: 'rupee', tint: 'mint', onClick: () => setShowBankReconciler(true) },
      canPage('/maintenance') && { label: 'Maintenance', icon: 'wrench-orange', tint: 'peach', href: '/maintenance' },
      canRent && { label: 'Send Reminders', icon: 'bell-purple', tint: 'indigo', onClick: () => setShowReminderModal(true) },
      isStaff
        ? canPage('/analytics') && { label: 'View Analytics', icon: 'chart', tint: 'sky', href: '/analytics' }
        : { label: 'View Reports', icon: 'report', tint: 'sky', href: '/reports' },
    ] as Array<QuickAction | false>
  ).filter((a): a is QuickAction => Boolean(a));

  const periodArrowClass =
    'grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white bg-white text-brand-700 shadow-[0_8px_18px_-10px_rgba(70,40,160,0.45)] transition-colors hover:bg-brand-50 press';

  return (
    <div className="space-y-5 text-left">
      {/* Gradient hero greeting card (design ref: owner dashboard). Sits inside
          the shell's padding as a rounded card on every breakpoint. */}
      <HeroHeader
        variant="gradient"
        illustration="hero-owner"
        actionsClassName="hidden sm:flex"
        eyebrow={
          <>
            <ShieldCheck /> {isStaff ? 'Staff' : 'Owner'}
          </>
        }
        title="Welcome back,"
        highlight={heroName}
        meta={
          <span className="inline-flex items-start gap-1.5 text-[13px] font-medium text-white/85">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="line-clamp-2">{heroPlace}</span>
          </span>
        }
      >
        {/* From sm up the pills stay left of the building art; on phones they
            wrap freely (a narrower box would stack them three rows deep). */}
        <div className="flex flex-wrap items-center gap-2 sm:max-w-[60%]">
          {canTenants && (
            <HeroAction onClick={handleAddResident}>
              <UserPlus /> Add Resident
            </HeroAction>
          )}
          {canBeds && beds.length > 0 && (
            <HeroAction tone="glass" onClick={() => setShowSetupWizard(true)}>
              <Building /> Room Setup
            </HeroAction>
          )}
          {canRent && (
            <HeroAction tone="glass" onClick={() => setShowBankReconciler(true)}>
              <FileSpreadsheet /> Bank CSV
            </HeroAction>
          )}
        </div>
      </HeroHeader>

      {noResidentAccess && (
        <InfoBanner
          tone="info"
          icon="users"
          title="Resident & rent details are hidden for your account"
          description="You can see the bed inventory. Ask the PG owner to grant the Residents or Rent permission to see residents, dues and payments."
        />
      )}

      {/* Empty Inventory Onboarding Banner */}
      {beds.length === 0 && (
        <InfoBanner
          tone="brand"
          icon="building"
          title="No Rooms or Beds Configured Yet (0 Units)"
          description="Your PG has 0 beds ready for lease. Configure your floor-by-floor sharing formats (Single, 2-share to 6-share) and pricing to generate your bed units."
          action={
            <Button className="w-full sm:w-auto" onClick={() => setShowSetupWizard(true)}>
              <Layers className="h-4 w-4" />
              <span>
                Configure Rooms<span className="hidden min-[400px]:inline"> &amp; Generate Beds</span>
              </span>
            </Button>
          }
        />
      )}

      {/* Stat row: rooms · beds · residents · selected month's collection */}
      <StatsRow
        beds={beds}
        rentRecords={rentRecords}
        summary={summary}
        residentCount={residentCount}
        collectionLabel={periodLabel}
        inventoryHref="#bed-inventory"
        residentsHref={canPage('/tenants') ? '/tenants' : undefined}
        restricted={noResidentAccess}
        collectionHref={canPage('/analytics') ? '/analytics' : undefined}
      />

      {/* Resident join requests (from public PG discovery) */}
      {joinRequests.length > 0 && (
        <InfoBanner
          tone="brand"
          icon="user-add"
          className="animate-pop"
          title={`${joinRequests.length} resident ${joinRequests.length === 1 ? 'wants' : 'want'} to join`}
        >
          <ul className="divide-y divide-white/80">
            {joinRequests.slice(0, 6).map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar name={r.residentName} size="md" />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold text-ink">{r.residentName}</div>
                    <div className="font-mono-numbers text-xs font-medium text-muted">{r.residentPhone}</div>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button variant="outline" onClick={() => declineJoinRequest(r.id)}>
                    Decline
                  </Button>
                  <Button onClick={() => acceptJoinRequest(r)}>Accept</Button>
                </div>
              </li>
            ))}
          </ul>
          {prefillTenant && (
            <div className="border-t border-white/80 bg-brand-50/70 px-4 py-2.5 text-xs font-semibold text-brand-700">
              Approved “{prefillTenant.name}” — now tap a vacant bed to finish adding them.
            </div>
          )}
        </InfoBanner>
      )}

      {/* Defaulter / aging report — overdue unpaid rent across all months */}
      {defaulters.length > 0 && (
        <InfoBanner
          tone="danger"
          icon="alert"
          className="animate-pop"
          title={`${defaulters.length} overdue ${defaulters.length === 1 ? 'payment' : 'payments'}`}
          description={
            <span className="font-mono-numbers">
              {formatCurrency(defaulters.reduce((s, d) => s + d.outstandingPaise, 0) / 100)} outstanding
            </span>
          }
          action={
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              aria-expanded={showDefaulters}
              onClick={() => setShowDefaulters((s) => !s)}
            >
              <span>{showDefaulters ? 'Hide' : 'View'}</span>
              <ChevronDown className={`h-4 w-4 transition-transform ${showDefaulters ? 'rotate-180' : ''}`} />
            </Button>
          }
        >
          {showDefaulters && (
            <ul className="divide-y divide-white/80">
              {defaulters.slice(0, 10).map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <div className="truncate text-[13.5px] font-bold text-ink">
                      {d.tenantName || 'Resident'}{' '}
                      <span className="font-medium text-muted">· {d.bedLabel || ''} · {d.period}</span>
                    </div>
                    <div className="text-xs font-semibold text-danger-ink">
                      {d.daysOverdue} days overdue
                      {d.lateFeePaise > 0 && ` · late fee ${formatCurrency(d.lateFeePaise / 100)}`}
                    </div>
                  </div>
                  <span className="shrink-0 font-mono-numbers text-sm font-extrabold text-danger-ink">
                    {formatCurrency(d.outstandingPaise / 100)}
                  </span>
                </li>
              ))}
              {defaulters.length > 10 && (
                <li className="px-4 py-2.5 text-xs font-semibold text-danger-ink">
                  +{defaulters.length - 10} more…
                </li>
              )}
            </ul>
          )}
        </InfoBanner>
      )}

      {/* Pending deposit refunds owed to tenants */}
      {pendingRefunds.length > 0 && (
        <InfoBanner
          tone="info"
          icon="rupee-badge"
          className="animate-pop"
          title={`${pendingRefunds.length} pending deposit ${pendingRefunds.length === 1 ? 'refund' : 'refunds'}`}
        >
          <ul className="divide-y divide-white/80">
            {pendingRefunds.slice(0, 8).map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <span className="block truncate text-[13.5px] font-bold text-ink">
                    {r.tenantName || 'Resident'}
                  </span>
                  <span className="font-mono-numbers text-xs font-semibold text-info-ink">
                    {formatCurrency(r.amountPaise / 100)} to refund
                  </span>
                </div>
                <Button
                  variant="outline"
                  disabled={refundBusyId === r.id}
                  onClick={() => markRefundIssued(r.id)}
                >
                  Mark Paid Out
                </Button>
              </li>
            ))}
          </ul>
        </InfoBanner>
      )}

      {/* Billing period navigator — view/collect rent for any month */}
      <div className="app-card flex items-center justify-between gap-2 rounded-full p-1.5">
        <button
          type="button"
          onClick={() => setSelectedPeriod((p) => shiftPeriod(p, -1))}
          className={periodArrowClass}
          aria-label="Previous month"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="flex min-w-0 flex-col items-center text-center">
          {/* Tap the month label to open the OS month/year picker (full calendar
              selection) instead of only stepping one month at a time with arrows.
              A transparent native <input type="month"> overlays the label. */}
          <label className="relative inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-full px-3 py-1.5 transition-colors hover:bg-brand-50">
            <CalendarDays className="h-4 w-4 shrink-0 text-brand" />
            <span className="font-mono-numbers text-[15px] font-extrabold tracking-[-0.01em] text-ink">
              {labelPeriod(selectedPeriod)}
            </span>
            <input
              type="month"
              value={selectedPeriod}
              max={getCurrentPeriod()}
              onChange={(e) => {
                // <input type="month"> emits YYYY-MM — exactly our period format.
                if (e.target.value) setSelectedPeriod(e.target.value);
              }}
              aria-label="Select billing month"
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
          </label>
          {!isCurrentPeriod && (
            <button
              type="button"
              onClick={() => setSelectedPeriod(getCurrentPeriod())}
              className="block rounded-full px-2 text-[11.5px] font-bold text-brand-700 hover:underline"
            >
              Jump to current month
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => setSelectedPeriod((p) => shiftPeriod(p, 1))}
          disabled={isCurrentPeriod}
          className={`${periodArrowClass} disabled:pointer-events-none disabled:opacity-40`}
          aria-label="Next month"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Bulk confirm — mark every pending/verify record this month paid at once */}
      {bulkPendingCount >= 2 && (
        <InfoBanner
          tone="warning"
          icon="calendar-clock"
          className="animate-pop"
          title={`${bulkPendingCount} payments pending this month`}
          action={
            <Button
              variant="success"
              className="w-full sm:w-auto"
              disabled={actionBusy}
              onClick={bulkConfirmPending}
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>Mark All Paid</span>
            </Button>
          }
        />
      )}

      {/* Overview (occupancy donut + collection) beside Quick Actions on desktop */}
      <div className="grid gap-5 lg:grid-cols-2">
        <StatsBar
          beds={beds}
          rentRecords={rentRecords}
          restricted={noResidentAccess}
          onRemindAll={canRent ? () => setShowReminderModal(true) : undefined}
          onEmailReminders={canRent ? handleEmailReminders : undefined}
          emailReminding={emailReminding}
          summary={summary}
          periodLabel={periodLabel}
        />
        <QuickActionGrid actions={quickActions} title="Quick Actions" icon="star" columns={3} />
      </div>

      {/* Large-PG notice: the live grid is a bounded window; the HUD totals above
          are the accurate whole-PG figures (server-computed). */}
      {summary && summary.totalBeds > beds.length && (
        <InfoBanner
          tone="info"
          icon="building"
          title={`Showing the most recent ${beds.length} of ${summary.totalBeds} beds in the live grid`}
          description={
            <>
              Occupancy above reflects your <strong>entire</strong> PG; rent totals cover the beds
              currently loaded. Use search and the filters to find a specific bed.
            </>
          }
        />
      )}

      {/* Bed inventory (rooms / beds) — anchor target of the stat tiles */}
      <div id="bed-inventory" className="scroll-mt-24 md:scroll-mt-8">
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
      </div>

      {/* RIGHT-SIDE BED DETAILS COMMAND DRAWER */}
      <Drawer
        isOpen={!!activeBedDrawer}
        onClose={() => setActiveBedDrawer(null)}
        title={activeBedDrawer ? `Bed ${activeBedDrawer.bedLabel}` : 'Bed Details'}
        description={activeBedDrawer ? `Room ${activeBedDrawer.roomNumber} · Floor ${activeBedDrawer.floor}` : ''}
        width="md"
        footer={
          activeBedDrawer?.status === 'guest' ? (
            <a href="/guests" className="btn-pill w-full">
              <BedDouble className="h-4 w-4" />
              <span>Manage Guest · Check out</span>
            </a>
          ) : activeBedDrawer?.status !== 'vacant' ? (
            <div className="flex w-full flex-wrap items-center gap-2">
              <Button
                variant="destructive"
                onClick={() => setConfirmVacateBed(activeBedDrawer)}
              >
                <LogOut className="h-4 w-4" />
                <span>Vacate Bed</span>
              </Button>

              <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
                {activeRecord?.status === 'verify' && (
                  <Button
                    onClick={() => {
                      if (activeRecord) {
                        setProofModalRecord({ bed: activeBedDrawer!, record: activeRecord });
                      }
                    }}
                  >
                    <Eye className="h-4 w-4" />
                    <span>View Proof</span>
                  </Button>
                )}

                {activeBedDrawer?.status !== 'paid' && activeRecord?.status !== 'paid' && (
                  <Button
                    variant="success"
                    onClick={() => handleMarkPaid(activeBedDrawer!, activeRecord || undefined)}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Mark as Paid</span>
                  </Button>
                )}

                {(activeBedDrawer?.status === 'paid' || activeRecord?.status === 'paid') && activeRecord?.id && (
                  <Button
                    variant="outline"
                    onClick={() => handleReversePaid(activeBedDrawer!, activeRecord)}
                  >
                    <Undo2 className="h-4 w-4" />
                    <span>Reverse Payment</span>
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="grid w-full grid-cols-2 gap-2">
              <Button
                size="full"
                onClick={() => {
                  setSelectedBedForAdd(activeBedDrawer);
                  setActiveBedDrawer(null);
                }}
              >
                <UserPlus className="h-4 w-4" />
                <span>Add Resident</span>
              </Button>
              <Button
                size="full"
                variant="outline"
                onClick={() => {
                  setGuestBed(activeBedDrawer);
                  setActiveBedDrawer(null);
                }}
              >
                <BedDouble className="h-4 w-4" />
                <span>Check in Guest</span>
              </Button>
            </div>
          )
        }
      >
        {activeBedDrawer && (
          <div className="space-y-4 text-left">
            {activeBedDrawer.status === 'vacant' ? (
              <div className="tint-card tint-slate flex flex-col items-center gap-1 px-6 py-7 text-center">
                <Icon3D name="bed" size={56} />
                <span className="mt-2 text-[13px] font-medium text-muted">This bed is currently</span>
                <span className="text-lg font-extrabold tracking-[-0.015em] text-ink">Vacant</span>
                <span className="font-mono-numbers text-[15px] font-extrabold text-brand-700">
                  {formatCurrency(activeBedDrawer.monthlyRent)}/month
                </span>
              </div>
            ) : (
              <>
                {/* Resident Card */}
                <div className="well p-4">
                  <div className="flex items-center gap-3">
                    <Avatar name={activeBedDrawer.tenantName || 'R'} size="lg" />
                    <h4 className="min-w-0 flex-1 truncate text-base font-extrabold tracking-[-0.01em] text-ink">
                      {activeBedDrawer.tenantName}
                    </h4>
                    <Badge variant={drawerStatus} dot>
                      {drawerStatusLabel}
                    </Badge>
                  </div>
                  {(activeBedDrawer.tenantPhone || activeTenant?.moveInDate) && (
                    <div className="mt-3 divide-y divide-line border-t border-line">
                      {activeBedDrawer.tenantPhone && (
                        <KeyValue label="Phone" value={activeBedDrawer.tenantPhone} />
                      )}
                      {activeTenant?.moveInDate && (
                        <KeyValue
                          label="Resident since"
                          value={new Date(activeTenant.moveInDate).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                        />
                      )}
                    </div>
                  )}
                </div>

                {/* Financial Summary */}
                <div className="grid grid-cols-2 gap-3">
                  <StatTile
                    icon="rupee"
                    tint="mint"
                    label="Monthly Rent"
                    value={formatCurrency(activeBedDrawer.monthlyRent)}
                  />
                  <StatTile
                    icon="wallet-sm"
                    tint="violet"
                    label="Security Deposit"
                    value={formatCurrency(depositPaidRupees(activeTenant))}
                    caption={
                      activeTenant?.securityDepositPaise &&
                      depositPaidRupees(activeTenant) < activeTenant.securityDepositPaise / 100
                        ? `of ${formatCurrency(activeTenant.securityDepositPaise / 100)} agreed`
                        : undefined
                    }
                  />
                </div>

                {/* Partial / advance payment — shown while the active record is not fully paid */}
                {activeRecord && activeRecord.status !== 'paid' && (activeRecord.amountDuePaise ?? 0) > 0 && (
                  <div className="well space-y-3 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[13px] font-bold text-ink-2">Collection Progress</span>
                      <span className="font-mono-numbers text-[13px] font-semibold text-muted">
                        {formatCurrency((activeRecord.amountPaidPaise ?? 0) / 100)} / {formatCurrency((activeRecord.amountDuePaise ?? 0) / 100)}
                      </span>
                    </div>
                    <ProgressBar
                      color="emerald"
                      value={Math.min(
                        100,
                        Math.round(
                          ((activeRecord.amountPaidPaise ?? 0) / Math.max(1, activeRecord.amountDuePaise ?? 1)) * 100
                        )
                      )}
                    />
                    <div className="flex flex-col gap-2 min-[400px]:flex-row min-[400px]:items-center">
                      <Input
                        type="number"
                        min={1}
                        inputMode="numeric"
                        placeholder="Amount (₹)"
                        aria-label="Part payment amount (₹)"
                        value={partialAmount}
                        onChange={(e) => setPartialAmount(e.target.value)}
                      />
                      <Button
                        size="lg"
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
                    <h4 className="text-[13px] font-bold text-ink-2">Direct actions</h4>
                    <div className="grid grid-cols-2 gap-2.5">
                      <a
                        href={telHref(activeBedDrawer.tenantPhone)}
                        className="btn-soft h-11 text-sm"
                      >
                        <Phone className="h-4 w-4 text-brand" />
                        <span>Call</span>
                      </a>
                      <a
                        href={getWhatsAppLink(
                          activeBedDrawer.tenantPhone,
                          `Namaste ${activeBedDrawer.tenantName} ji 🙏, this is a note regarding Bed ${activeBedDrawer.bedLabel} at ${owner.pgName}.`
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#4FD69C_0%,#1FAE76_50%,#128A5B_100%)] px-4 text-sm font-bold text-white shadow-[0_12px_24px_-10px_rgba(18,138,91,0.5),inset_0_1px_0_rgba(255,255,255,0.3)] transition-[filter] hover:brightness-105 press"
                      >
                        <Send className="h-4 w-4" />
                        <span>WhatsApp</span>
                      </a>
                    </div>
                    {/* Email reminder from the owner's Gmail — only when rent is
                        actually due this month. Falls back to WhatsApp for this
                        resident if they have no email / Gmail isn't connected. */}
                    {activeRecord?.id && activeRecord.status !== 'paid' && (
                      <Button
                        variant="outline"
                        size="full"
                        disabled={emailingRecordId === activeRecord.id}
                        loading={emailingRecordId === activeRecord.id}
                        onClick={() => emailOneReminder(activeBedDrawer, activeRecord)}
                      >
                        <Mail className="h-4 w-4" />
                        <span>Email rent reminder</span>
                      </Button>
                    )}
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
                  <div className="space-y-2.5">
                    <h4 className="flex items-center gap-2 text-[13px] font-bold text-ink-2">
                      <Icon3D name="doc-green" size={22} />
                      Document &amp; Photo Vault
                    </h4>
                    <TenantPhotoGallery tenantId={activeTenant.id} />
                  </div>
                )}

                {/* Emergency Contact */}
                {activeTenant?.emergencyContactPhone && (
                  <div className="well flex items-center gap-3 p-3.5">
                    <IconBubble icon="person" tint="peach" size={40} />
                    <div className="min-w-0 flex-1">
                      <span className="block text-xs font-semibold text-muted">Emergency contact</span>
                      <span className="block truncate text-[13.5px] font-bold text-ink">
                        {activeTenant.emergencyContactName || 'Contact'}
                        {activeTenant.emergencyContactRelation ? ` · ${activeTenant.emergencyContactRelation}` : ''}
                      </span>
                      <span className="block font-mono-numbers text-xs font-medium text-muted">
                        {activeTenant.emergencyContactPhone}
                      </span>
                    </div>
                    <a
                      href={telHref(activeTenant.emergencyContactPhone)}
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white bg-white text-brand-700 shadow-[0_8px_18px_-10px_rgba(70,40,160,0.45)] transition-colors hover:bg-brand-50 press"
                      aria-label="Call emergency contact"
                    >
                      <Phone className="h-4 w-4" />
                    </a>
                  </div>
                )}

                {/* Public Link Share */}
                {activeTenant?.token && (
                  <div className="well space-y-2.5 p-4">
                    <span className="flex items-center gap-2 text-[13px] font-bold text-ink-2">
                      <Icon3D name="doc" size={22} />
                      Resident Private Portal Link
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate rounded-xl border border-line bg-white/85 px-3 py-2.5 font-mono text-[12px] text-ink-2">
                        {typeof window !== 'undefined' ? `${window.location.origin}/t/${activeTenant.token}` : `/t/${activeTenant.token}`}
                      </span>
                      <Button
                        variant="soft"
                        onClick={async () => {
                          const url = `${window.location.origin}/t/${activeTenant.token}`;
                          // copyText falls back to execCommand on insecure origins / old browsers.
                          if (await copyText(url)) toast.success('Link copied');
                          else toast.error('Could not copy — long-press the link to copy it manually');
                        }}
                      >
                        <Copy className="h-4 w-4" />
                        <span>Copy</span>
                      </Button>
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
            // Immediately open the bed-detail drawer for the just-assigned bed so
            // the owner can record a payment / view the portal link / vacate right
            // away — these actions live in that drawer and were otherwise hard to
            // find after the add flow closed (reported "no option to add amount
            // paid / checkout"). Mark it occupied optimistically; the real-time
            // bed listener reconciles the authoritative status moments later.
            if (selectedBedForAdd) {
              setActiveBedDrawer({ ...selectedBedForAdd, status: 'occupied' });
            }
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
        isStaff={isStaff}
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
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => setProofModalRecord(null)}
              >
                Close
              </Button>
              <Button
                variant="success"
                className="w-full sm:w-auto"
                onClick={handleApproveProof}
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>Approve & Issue HRA Receipt</span>
              </Button>
            </div>
          }
        >
          <div className="space-y-4 text-left">
            <div className="well divide-y divide-line px-4">
              <KeyValue
                label="Claimed Amount"
                value={formatCurrency(proofModalRecord.record.amount || 0)}
              />
              {proofModalRecord.record.paymentReference && (
                <KeyValue
                  label="Claimed UPI UTR"
                  value={<span className="font-mono">{proofModalRecord.record.paymentReference}</span>}
                />
              )}
            </div>

            {proofModalRecord.record.proofImageUrl ? (
              <div className="well flex items-center justify-center overflow-hidden p-2">
                {/* Plain <img>: this is a short-lived B2 presigned URL (expires
                    ~5 min) of a user-uploaded proof of arbitrary dimensions.
                    next/image can't optimize a rotating private URL and would
                    require per-host remote config for no real benefit. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={proofModalRecord.record.proofImageUrl}
                  alt="Proof screenshot"
                  className="max-h-96 rounded-xl object-contain"
                />
              </div>
            ) : (
              <div className="well">
                <EmptyState icon3d="doc" title="No screenshot image was attached." />
              </div>
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
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="full"
                onClick={() => setConfirmVacateBed(null)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="full"
                onClick={handleConfirmVacate}
              >
                Confirm Vacate
              </Button>
            </div>
          }
        >
          <div className="space-y-3 text-left">
            <InfoBanner
              tone="danger"
              icon="alert"
              title={
                <>
                  This will unassign {confirmVacateBed.tenantName} from Bed {confirmVacateBed.bedLabel}
                </>
              }
              description="Their active lease will be archived and their private portal URL will be disabled."
            />
            <p className="px-1 text-[13px] leading-relaxed text-ink-2">
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
