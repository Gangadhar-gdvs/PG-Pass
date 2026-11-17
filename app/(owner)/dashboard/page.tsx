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
import { getCurrentMonthYear, formatCurrency } from '@/lib/utils';
import { Bed, Owner, RentRecord, Tenant } from '@/types';
import { StatsBar } from '@/components/owner/StatsBar';
import { BedGrid } from '@/components/owner/BedGrid';
import { AddTenantModal } from '@/components/owner/AddTenantModal';
import { WhatsAppReminderModal } from '@/components/owner/WhatsAppReminderModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { validatePan, validateUpi, sanitizeText } from '@/lib/security';
import { config } from '@/lib/config';
import {
  Building2,
  Sparkles,
  Layers,
  CheckCircle,
  X,
  Eye,
  AlertCircle,
  FileCheck,
  Check,
  Calendar,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function OwnerDashboardPage() {
  const { user } = useAuth();
  const ownerId = user?.uid || 'demo_owner';

  const [owner, setOwner] = useState<Owner | null>(null);
  const [loadingOwner, setLoadingOwner] = useState(true);

  // Setup Wizard State for first-time owners
  const [setupStep, setSetupStep] = useState(1);
  const [pgName, setPgName] = useState('Sri Krishna Luxury PG');
  const [ownerName, setOwnerName] = useState('Suresh Reddy');
  const [pgAddress, setPgAddress] = useState('Plot 42, Ayyappa Society, Madhapur, Hyderabad');
  const [totalFloors, setTotalFloors] = useState('3');
  const [roomsPerFloor, setRoomsPerFloor] = useState('4');
  const [bedsPerRoom, setBedsPerRoom] = useState('2');
  const [monthlyRent, setMonthlyRent] = useState('8500');
  const [upiId, setUpiId] = useState('sureshreddy@okicici');
  const [panNumber, setPanNumber] = useState('ABCDE1234F');
  const [submittingSetup, setSubmittingSetup] = useState(false);

  // Active Hooks for Beds, Tenants, Records
  const { beds } = useBeds(ownerId);
  const { tenants } = useTenants(ownerId);
  const [rentRecords, setRentRecords] = useState<RentRecord[]>([]);

  // Modals state
  const [selectedBedForAdd, setSelectedBedForAdd] = useState<Bed | null>(null);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [proofModalRecord, setProofModalRecord] = useState<{ bed: Bed; record: RentRecord } | null>(null);
  const [vacateModalBed, setVacateModalBed] = useState<Bed | null>(null);

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

  // Handle Complete Setup Wizard
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

      toast.success(`Success! Generated ${floors * rooms * bedsCount} beds for ${sanitizedPgName}! 🎉`);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Setup failed');
    } finally {
      setSubmittingSetup(false);
    }
  };

  // Mark Paid (Cash or direct offline settlement)
  const handleMarkPaid = async (bed: Bed, record?: RentRecord) => {
    try {
      await updateBedStatus(bed.id, 'paid', bed.tenantId, bed.tenantName, bed.tenantPhone);
      if (record?.id) {
        await updateRentRecord(record.id, {
          status: 'paid',
          paidDate: new Date().toISOString().split('T')[0],
        });
      }
      toast.success(`Bed ${bed.bedLabel} marked as Paid!`);
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
      toast.success(`Payment approved for ${bed.tenantName}! HRA receipt generated.`);
      setProofModalRecord(null);
    } catch (e) {
      toast.error('Could not approve payment');
    }
  };

  // Handle Vacate Tenant
  const handleConfirmVacate = async () => {
    if (!vacateModalBed || !vacateModalBed.tenantId) return;

    try {
      await vacateTenant(vacateModalBed.tenantId, vacateModalBed.id);
      toast.success(`Bed ${vacateModalBed.bedLabel} is now vacant.`);
      setVacateModalBed(null);
    } catch (e) {
      toast.error('Could not vacate bed');
    }
  };

  if (loadingOwner) {
    return (
      <div className="py-20 flex flex-col items-center justify-center">
        <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-3" />
        <span className="text-xs text-slate-400">Loading PG Data...</span>
      </div>
    );
  }

  // ---------------- SETUP WIZARD (FIRST TIME PG ONBOARDING) ----------------
  if (!owner) {
    return (
      <div className="max-w-xl mx-auto py-8">
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
          <div className="mb-6">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-full inline-block mb-2">
              Setup Wizard (30 Seconds)
            </span>
            <h1 className="text-2xl font-black text-white">Configure Your PG Accommodation</h1>
            <p className="text-xs text-slate-400 mt-1">
              Enter your building details to auto-generate your live visual room & bed grid.
            </p>
          </div>

          <form onSubmit={handleCompleteSetup} className="space-y-4">
            <div className="space-y-3">
              <Input
                label="PG Name"
                placeholder="e.g. Sri Krishna Luxury PG"
                value={pgName}
                onChange={(e) => setPgName(e.target.value)}
                required
              />

              <Input
                label="Owner / Caretaker Name"
                placeholder="e.g. Suresh Reddy"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                required
              />

              <Input
                label="PG Full Address"
                placeholder="e.g. Plot 42, Ayyappa Society, Madhapur, Hyderabad"
                value={pgAddress}
                onChange={(e) => setPgAddress(e.target.value)}
                required
              />
            </div>

            <div className="pt-2 border-t border-slate-800">
              <span className="text-xs font-bold text-slate-300 block mb-2">Room & Bed Layout</span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
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
                  label="Rooms/Floor"
                  type="number"
                  min={1}
                  max={20}
                  value={roomsPerFloor}
                  onChange={(e) => setRoomsPerFloor(e.target.value)}
                  required
                />
                <Input
                  label="Beds/Room"
                  type="number"
                  min={1}
                  max={6}
                  value={bedsPerRoom}
                  onChange={(e) => setBedsPerRoom(e.target.value)}
                  required
                />
                <Input
                  label="Rent (₹)"
                  type="number"
                  value={monthlyRent}
                  onChange={(e) => setMonthlyRent(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800">
              <span className="text-xs font-bold text-slate-300 block mb-2">Payment & HRA Details</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="UPI ID for Rent Collection"
                  placeholder="e.g. sureshreddy@okicici"
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                  required
                />
                <Input
                  label="Owner PAN (For Tenant HRA Receipts)"
                  placeholder="e.g. ABCDE1234F"
                  value={panNumber}
                  onChange={(e) => setPanNumber(e.target.value)}
                  maxLength={10}
                  required
                />
              </div>
            </div>

            <div className="pt-4">
              <Button type="submit" size="full" loading={submittingSetup} className="py-3.5 font-bold">
                <Sparkles className="w-4 h-4 mr-2" />
                <span>Auto-Generate PG Bed Grid</span>
              </Button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // ---------------- FULL DASHBOARD ----------------
  return (
    <div className="space-y-6">
      {/* Top PG Info Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-900/60 border border-slate-800 rounded-3xl p-5 shadow-lg backdrop-blur-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Building2 className="w-4 h-4 text-indigo-400" />
            <h1 className="text-xl font-black text-white tracking-tight">{owner.pgName}</h1>
          </div>
          <p className="text-xs text-slate-400 leading-snug">{owner.pgAddress}</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-300">
            <span className="text-slate-500 mr-1.5">UPI:</span>
            <span className="font-mono font-bold text-indigo-300">{owner.upiId || 'Not set'}</span>
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      <StatsBar
        beds={beds}
        rentRecords={rentRecords}
        onRemindAll={() => setShowReminderModal(true)}
      />

      {/* Main Bed Grid */}
      <BedGrid
        beds={beds}
        rentRecords={rentRecords}
        ownerName={owner.name}
        pgName={owner.pgName}
        ownerUpi={owner.upiId}
        onAddTenant={(bed) => setSelectedBedForAdd(bed)}
        onMarkPaid={(bed, rec) => handleMarkPaid(bed, rec)}
        onVerifyProof={(bed, rec) => setProofModalRecord({ bed, record: rec })}
        onVacate={(bed) => setVacateModalBed(bed)}
      />

      {/* Modal: Add Resident */}
      {selectedBedForAdd && (
        <AddTenantModal
          bed={selectedBedForAdd}
          ownerId={ownerId}
          isOpen={true}
          onClose={() => setSelectedBedForAdd(null)}
          onSuccess={() => setSelectedBedForAdd(null)}
        />
      )}

      {/* Modal: WhatsApp Remind All */}
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

      {/* Modal: Proof Verification Inspector */}
      {proofModalRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative">
            <button
              onClick={() => setProofModalRecord(null)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-full hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="mb-4">
              <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full inline-block mb-1.5">
                Inspect Payment Proof
              </span>
              <h3 className="text-lg font-black text-white">
                {proofModalRecord.bed.tenantName} • Bed {proofModalRecord.bed.bedLabel}
              </h3>
              <p className="text-xs text-slate-400">
                Amount: {formatCurrency(proofModalRecord.bed.monthlyRent)}
              </p>
            </div>

            {/* Proof Image Box */}
            <div className="rounded-2xl overflow-hidden border border-slate-700 bg-black/50 max-h-72 flex items-center justify-center mb-5">
              {proofModalRecord.record.proofImageUrl ? (
                <img
                  src={proofModalRecord.record.proofImageUrl}
                  alt="Proof Screenshot"
                  className="max-h-72 object-contain"
                />
              ) : (
                <div className="p-8 text-center text-xs text-slate-500">No screenshot image found</div>
              )}
            </div>

            <div className="flex gap-2.5">
              <Button
                variant="ghost"
                onClick={() => setProofModalRecord(null)}
                className="flex-1 text-slate-400"
              >
                Close
              </Button>
              <Button
                variant="success"
                onClick={handleApproveProof}
                className="flex-1 font-bold"
              >
                <Check className="w-4 h-4 mr-1.5" />
                <span>Approve & Mark Paid</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Vacate Confirmation */}
      {vacateModalBed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto mb-3">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">Vacate Bed {vacateModalBed.bedLabel}?</h3>
            <p className="text-xs text-slate-400 mb-6 leading-relaxed">
              This will remove <strong>{vacateModalBed.tenantName}</strong> from this bed and mark it vacant for new
              bookings.
            </p>
            <div className="flex gap-2.5">
              <Button
                variant="ghost"
                onClick={() => setVacateModalBed(null)}
                className="flex-1 text-slate-400"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleConfirmVacate}
                className="flex-1 font-bold"
              >
                Confirm Vacate
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
