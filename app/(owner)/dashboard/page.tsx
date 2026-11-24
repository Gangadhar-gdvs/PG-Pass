'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useBeds } from '@/hooks/useBeds';
import { useTenants } from '@/hooks/useTenants';
import {
  subscribeToOwnerRentRecords,
} from '@/lib/firestore';
import { getPhotoViewUrl } from '@/lib/client/uploader';
import { getCurrentMonthYear, formatCurrency, getWhatsAppLink } from '@/lib/utils';
import { Bed, Owner, RentRecord, Tenant } from '@/types';
import { StatsBar } from '@/components/owner/StatsBar';
import { BedGrid } from '@/components/owner/BedGrid';
import { AddTenantModal } from '@/components/owner/AddTenantModal';
import { WhatsAppReminderModal } from '@/components/owner/WhatsAppReminderModal';
import { BankCsvReconciler } from '@/components/owner/BankCsvReconciler';
import { PropertySetupWizard } from '@/components/owner/PropertySetupWizard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Drawer } from '@/components/ui/drawer';
import { StatusDot } from '@/components/ui/status-dot';
import { Avatar } from '@/components/ui/avatar';
import { validatePan, validateUpi, sanitizeText } from '@/lib/security';
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
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function OwnerDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const ownerId = user?.uid || '';

  const [owner, setOwner] = useState<Owner | null>(null);
  const [loadingOwner, setLoadingOwner] = useState(true);

  // Active Hooks for Beds, Tenants, Records
  const { beds } = useBeds(ownerId);
  const { tenants } = useTenants(ownerId);
  const [rentRecords, setRentRecords] = useState<RentRecord[]>([]);

  // Modals & Drawer State
  const [showSetupWizard, setShowSetupWizard] = useState(false);
  const [selectedBedForAdd, setSelectedBedForAdd] = useState<Bed | null>(null);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [showBankReconciler, setShowBankReconciler] = useState(false);
  const [proofModalRecord, setProofModalRecord] = useState<{ bed: Bed; record: RentRecord } | null>(null);
  const [activeBedDrawer, setActiveBedDrawer] = useState<Bed | null>(null);
  const [confirmVacateBed, setConfirmVacateBed] = useState<Bed | null>(null);

  // Load Owner Profile
  useEffect(() => {
    if (authLoading) return;
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
  }, [ownerId, authLoading]);

  // Subscribe to real-time Rent Records for the current month
  useEffect(() => {
    if (!ownerId) return;
    const currentMonth = getCurrentMonthYear();
    const unsub = subscribeToOwnerRentRecords(ownerId, currentMonth, (records) => {
      setRentRecords(records);
    });
    return unsub;
  }, [ownerId]);

  // Mark Paid via POST /api/rent/[id]/confirm
  const handleMarkPaid = async (bed: Bed, record?: RentRecord) => {
    try {
      if (record?.id && !record.id.startsWith('temp_')) {
        const res = await fetch(`/api/rent/${record.id}/confirm`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paymentReference: 'Manual confirmation' }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Confirmation failed');
        toast.success(`Bed ${bed.bedLabel} marked Paid! Receipt REC-#{String(data.record.receiptNumber).padStart(5, '0')} issued.`);
      } else {
        toast.success(`Bed ${bed.bedLabel} marked as Paid`);
      }
      if (activeBedDrawer?.id === bed.id) {
        setActiveBedDrawer({ ...activeBedDrawer, status: 'paid' });
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to update status');
    }
  };

  // Reverse Paid via POST /api/rent/[id]/reverse
  const handleReversePaid = async (bed: Bed, record: RentRecord) => {
    const reason = prompt('Please enter reason for reversing this payment:');
    if (!reason || !reason.trim()) {
      toast.error('Reversal reason is required');
      return;
    }

    try {
      const res = await fetch(`/api/rent/${record.id}/reverse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reversalReason: reason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Reversal failed');

      toast.success(`Payment reversed. Bed ${bed.bedLabel} is now pending.`);
      if (activeBedDrawer?.id === bed.id) {
        setActiveBedDrawer({ ...activeBedDrawer, status: 'occupied' });
      }
    } catch (err: any) {
      toast.error(err.message || 'Could not reverse payment');
    }
  };

  // Approve payment from screenshot proof via POST /api/rent/[id]/confirm
  const handleApproveProof = async () => {
    if (!proofModalRecord) return;
    const { bed, record } = proofModalRecord;

    try {
      const res = await fetch(`/api/rent/${record.id}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentReference: record.paymentReference }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Could not confirm payment');

      toast.success(`Payment approved for ${bed.tenantName}! Receipt REC-#{String(data.record.receiptNumber).padStart(5, '0')} issued.`);
      setProofModalRecord(null);
      if (activeBedDrawer?.id === bed.id) {
        setActiveBedDrawer({ ...activeBedDrawer, status: 'paid' });
      }
    } catch (e: any) {
      toast.error(e.message || 'Could not approve payment');
    }
  };

  // Handle Vacate Tenant via POST /api/tenants/[id]/moveout
  const handleConfirmVacate = async () => {
    if (!confirmVacateBed || !confirmVacateBed.tenantId) return;

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
        initialOwnerPhone={user?.phoneNumber || '9876543210'}
        onComplete={(newOwner) => setOwner(newOwner)}
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
          initialOwnerPhone={user?.phoneNumber || owner.phone || '9876543210'}
          existingOwner={owner}
          onCancel={() => setShowSetupWizard(false)}
          onComplete={(newOwner) => {
            setOwner(newOwner);
            setShowSetupWizard(false);
            toast.success('Bed inventory successfully generated!');
          }}
        />
      </div>
    );
  }

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
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowSetupWizard(true)}
            className="text-xs border-[#CBD5E1] text-[#334155] hover:bg-[#F8FAFC]"
          >
            <Building className="w-3.5 h-3.5 mr-1.5 text-[#D97706]" />
            <span>Room Setup</span>
          </Button>
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
        onConfigureRooms={() => setShowSetupWizard(true)}
      />

      {/* RIGHT-SIDE BED DETAILS COMMAND DRAWER */}
      <Drawer
        isOpen={!!activeBedDrawer}
        onClose={() => setActiveBedDrawer(null)}
        title={activeBedDrawer ? `Bed ${activeBedDrawer.bedLabel}` : 'Bed Details'}
        description={activeBedDrawer ? `Room ${activeBedDrawer.roomNumber} · Floor ${activeBedDrawer.floor}` : ''}
        width="md"
        footer={
          activeBedDrawer?.status !== 'vacant' ? (
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
            <Button
              size="sm"
              variant="solid"
              className="w-full bg-[#D97706]"
              onClick={() => {
                setSelectedBedForAdd(activeBedDrawer);
                setActiveBedDrawer(null);
              }}
            >
              <UserPlus className="w-3.5 h-3.5 mr-1.5" />
              <span>Assign Resident to this Bed</span>
            </Button>
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
          onClose={() => setSelectedBedForAdd(null)}
          onSuccess={() => setSelectedBedForAdd(null)}
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

      {/* BANK CSV STATEMENT RECONCILER */}
      <BankCsvReconciler
        isOpen={showBankReconciler}
        onClose={() => setShowBankReconciler(false)}
        rentRecords={rentRecords}
      />
    </div>
  );
}
