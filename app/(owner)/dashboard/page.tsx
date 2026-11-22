'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useBeds } from '@/hooks/useBeds';
import { useTenants } from '@/hooks/useTenants';
import {
  getOwnerProfile,
  createOwnerProfile,
  createBeds,
  updateBedStatus,
  updateRentRecord,
  vacateTenant,
  subscribeToOwnerRentRecords,
} from '@/lib/firestore';
import { getCurrentMonthYear, formatCurrency, getWhatsAppLink } from '@/lib/utils';
import { Bed, Owner, RentRecord, Tenant } from '@/types';
import { StatsBar } from '@/components/owner/StatsBar';
import { BedGrid } from '@/components/owner/BedGrid';
import { AddTenantModal } from '@/components/owner/AddTenantModal';
import { WhatsAppReminderModal } from '@/components/owner/WhatsAppReminderModal';
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
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function OwnerDashboardPage() {
  const { user } = useAuth();
  const ownerId = user?.uid || '';

  const [owner, setOwner] = useState<Owner | null>(null);
  const [loadingOwner, setLoadingOwner] = useState(true);

  // Setup Wizard State
  const [pgName, setPgName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [pgAddress, setPgAddress] = useState('');
  const [totalFloors, setTotalFloors] = useState('2');
  const [roomsPerFloor, setRoomsPerFloor] = useState('3');
  const [bedsPerRoom, setBedsPerRoom] = useState('2');
  const [monthlyRent, setMonthlyRent] = useState('8500');
  const [upiId, setUpiId] = useState('');
  const [panNumber, setPanNumber] = useState('');
  const [submittingSetup, setSubmittingSetup] = useState(false);

  // Active Hooks for Beds, Tenants, Records
  const { beds } = useBeds(ownerId);
  const { tenants } = useTenants(ownerId);
  const [rentRecords, setRentRecords] = useState<RentRecord[]>([]);

  // Modals & Drawer State
  const [selectedBedForAdd, setSelectedBedForAdd] = useState<Bed | null>(null);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [proofModalRecord, setProofModalRecord] = useState<{ bed: Bed; record: RentRecord } | null>(null);
  const [activeBedDrawer, setActiveBedDrawer] = useState<Bed | null>(null);
  const [confirmVacateBed, setConfirmVacateBed] = useState<Bed | null>(null);

  // Load Owner Profile
  useEffect(() => {
    async function loadOwner() {
      try {
        const profile = await getOwnerProfile(ownerId);
        if (profile) {
          setOwner(profile);
        }
      } catch (e) {
        console.error('Error fetching owner profile:', e);
      } finally {
        setLoadingOwner(false);
      }
    }

    if (ownerId) loadOwner();
  }, [ownerId]);

  // Subscribe to real-time Rent Records for the current month
  useEffect(() => {
    if (!ownerId) return;
    const currentMonth = getCurrentMonthYear();
    const unsub = subscribeToOwnerRentRecords(ownerId, currentMonth, (records) => {
      setRentRecords(records);
    });
    return unsub;
  }, [ownerId]);

  // Setup Wizard Submission
  const handleCompleteSetup = async (e: React.FormEvent) => {
    e.preventDefault();

    const sanitizedPgName = sanitizeText(pgName, 80);
    const sanitizedOwnerName = sanitizeText(ownerName, 60);
    const sanitizedPgAddress = sanitizeText(pgAddress, 200);

    if (!sanitizedPgName || !sanitizedOwnerName) {
      toast.error('Please enter your PG Name and Owner Name');
      return;
    }

    const upiValidation = validateUpi(upiId);
    if (!upiValidation.valid) {
      toast.error(upiValidation.error || 'Please enter a valid UPI ID (e.g., name@okicici)');
      return;
    }

    const panValidation = validatePan(panNumber);
    if (!panValidation.valid) {
      toast.error(panValidation.error || 'Please enter a valid 10-character PAN');
      return;
    }

    setSubmittingSetup(true);

    try {
      const floors = Math.min(Math.max(Number(totalFloors) || 1, 1), 30);
      const rooms = Math.min(Math.max(Number(roomsPerFloor) || 1, 1), 30);
      const bedsCount = Math.min(Math.max(Number(bedsPerRoom) || 1, 1), 10);
      const rent = Math.max(Number(monthlyRent) || 1000, 500);

      const profileData: Omit<Owner, 'id' | 'createdAt'> = {
        name: sanitizedOwnerName,
        phone: user?.phoneNumber || '+91 98765 43210',
        pgName: sanitizedPgName,
        pgAddress: sanitizedPgAddress,
        upiId: upiValidation.formatted,
        panNumber: panValidation.formatted,
        totalFloors: floors,
        roomsPerFloor: rooms,
        bedsPerRoom: bedsCount,
        monthlyRent: rent,
      };

      await createOwnerProfile(ownerId, profileData);
      await createBeds(ownerId, floors, rooms, bedsCount, rent);

      setOwner({
        ...profileData,
        id: ownerId,
      });

      toast.success(`Setup complete! Generated ${floors * rooms * bedsCount} beds.`);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Setup failed');
    } finally {
      setSubmittingSetup(false);
    }
  };

  // Mark Paid
  const handleMarkPaid = async (bed: Bed, record?: RentRecord) => {
    try {
      await updateBedStatus(bed.id, 'paid', bed.tenantId, bed.tenantName, bed.tenantPhone);
      if (record?.id) {
        await updateRentRecord(record.id, {
          status: 'paid',
          paidDate: new Date().toISOString().split('T')[0],
        });
      }
      toast.success(`Bed ${bed.bedLabel} marked as Paid`);
      if (activeBedDrawer?.id === bed.id) {
        setActiveBedDrawer({ ...activeBedDrawer, status: 'paid' });
      }
    } catch (err) {
      toast.error('Failed to update status');
    }
  };

  // Approve payment from screenshot proof
  const handleApproveProof = async () => {
    if (!proofModalRecord) return;
    const { bed, record } = proofModalRecord;

    try {
      await updateBedStatus(bed.id, 'paid', bed.tenantId, bed.tenantName, bed.tenantPhone);
      await updateRentRecord(record.id, {
        status: 'paid',
        paidDate: new Date().toISOString().split('T')[0],
      });
      toast.success(`Payment approved for ${bed.tenantName}!`);
      setProofModalRecord(null);
      if (activeBedDrawer?.id === bed.id) {
        setActiveBedDrawer({ ...activeBedDrawer, status: 'paid' });
      }
    } catch (e) {
      toast.error('Could not approve payment');
    }
  };

  // Handle Vacate Tenant
  const handleConfirmVacate = async () => {
    if (!confirmVacateBed || !confirmVacateBed.tenantId) return;

    try {
      await vacateTenant(confirmVacateBed.tenantId, confirmVacateBed.id);
      toast.success(`Bed ${confirmVacateBed.bedLabel} is now vacant`);
      setConfirmVacateBed(null);
      setActiveBedDrawer(null);
    } catch (e) {
      toast.error('Could not vacate bed');
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
      <div className="max-w-2xl mx-auto py-8">
        <div className="bg-white border border-[#E2E8F0] rounded-[12px] p-6 sm:p-8 shadow-xs">
          <div className="mb-6 pb-4 border-b border-[#E2E8F0]">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#D97706] bg-[#FEF3C7] px-2.5 py-0.5 rounded-[6px] inline-block mb-2">
              PG Setup Wizard
            </span>
            <h1 className="text-xl font-bold text-[#09090B] tracking-tight">
              Configure Your PG Property
            </h1>
            <p className="text-xs text-[#64748B] mt-1">
              Enter building specs to automatically generate your visual bed inventory and rent links.
            </p>
          </div>

          <form onSubmit={handleCompleteSetup} className="space-y-4">
            <div className="space-y-3">
              <Input
                label="PG Property Name"
                placeholder="e.g. Sri Krishna Luxury PG"
                value={pgName}
                onChange={(e) => setPgName(e.target.value)}
                required
              />

              <Input
                label="Owner / Landlord Name"
                placeholder="e.g. Suresh Reddy"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                required
              />

              <Input
                label="Property Address"
                placeholder="e.g. Plot 42, Ayyappa Society, Madhapur, Hyderabad"
                value={pgAddress}
                onChange={(e) => setPgAddress(e.target.value)}
                required
              />
            </div>

            <div className="pt-3 border-t border-[#E2E8F0]">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#475569] block mb-2">
                Room & Bed Layout
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Input
                  label="Floors"
                  type="number"
                  min={1}
                  max={20}
                  value={totalFloors}
                  onChange={(e) => setTotalFloors(e.target.value)}
                  required
                />
                <Input
                  label="Rooms / Floor"
                  type="number"
                  min={1}
                  max={20}
                  value={roomsPerFloor}
                  onChange={(e) => setRoomsPerFloor(e.target.value)}
                  required
                />
                <Input
                  label="Beds / Room"
                  type="number"
                  min={1}
                  max={6}
                  value={bedsPerRoom}
                  onChange={(e) => setBedsPerRoom(e.target.value)}
                  required
                />
                <Input
                  label="Monthly Rent (₹)"
                  type="number"
                  value={monthlyRent}
                  onChange={(e) => setMonthlyRent(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="pt-3 border-t border-[#E2E8F0]">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#475569] block mb-2">
                Settlement & HRA Compliance
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Owner UPI ID (for tenant rent transfers)"
                  placeholder="name@okicici"
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                  required
                />

                <Input
                  label="Landlord PAN (for tenant HRA receipts)"
                  placeholder="ABCDE1234F"
                  value={panNumber}
                  onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
                  required
                />
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <Button
                type="submit"
                size="lg"
                loading={submittingSetup}
                variant="solid"
                className="w-full sm:w-auto"
              >
                Save PG & Generate Bed Inventory
              </Button>
            </div>
          </form>
        </div>
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
            variant="solid"
            onClick={() => {
              const firstVacant = beds.find((b) => b.status === 'vacant');
              if (firstVacant) setSelectedBedForAdd(firstVacant);
              else toast.error('No vacant beds available');
            }}
            className="text-xs"
          >
            <UserPlus className="w-3.5 h-3.5 mr-1.5" />
            <span>Add Resident</span>
          </Button>
        </div>
      </div>

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
                {formatCurrency(proofModalRecord.record.amount)}
              </span>
            </div>

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
    </div>
  );
}
