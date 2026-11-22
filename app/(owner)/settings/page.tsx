'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getOwnerProfile, updateOwnerProfile } from '@/lib/firestore';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { validatePan, validateUpi, sanitizeText } from '@/lib/security';
import {
  Settings,
  Building,
  CreditCard,
  ShieldCheck,
  Save,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function SettingsPage() {
  const { user } = useAuth();
  const ownerId = user?.uid || '';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [pgName, setPgName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [pgAddress, setPgAddress] = useState('');
  const [upiId, setUpiId] = useState('');
  const [panNumber, setPanNumber] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const profile = await getOwnerProfile(ownerId);
        if (profile) {
          setPgName(profile.pgName || '');
          setOwnerName(profile.name || '');
          setPgAddress(profile.pgAddress || '');
          setUpiId(profile.upiId || '');
          setPanNumber(profile.panNumber || '');
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    if (ownerId) load();
  }, [ownerId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    const sanitizedPgName = sanitizeText(pgName, 80);
    const sanitizedOwnerName = sanitizeText(ownerName, 60);
    const sanitizedPgAddress = sanitizeText(pgAddress, 200);

    if (!sanitizedPgName || !sanitizedOwnerName) {
      toast.error('PG Name and Owner Name are required');
      return;
    }

    const upiValidation = validateUpi(upiId);
    if (!upiValidation.valid) {
      toast.error(upiValidation.error || 'Invalid UPI ID format');
      return;
    }

    const panValidation = validatePan(panNumber);
    if (!panValidation.valid) {
      toast.error(panValidation.error || 'Invalid PAN Number format');
      return;
    }

    setSaving(true);
    try {
      await updateOwnerProfile(ownerId, {
        pgName: sanitizedPgName,
        name: sanitizedOwnerName,
        pgAddress: sanitizedPgAddress,
        upiId: upiValidation.formatted,
        panNumber: panValidation.formatted,
      });
      toast.success('Settings updated successfully');
    } catch (err: any) {
      toast.error('Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#D97706] border-t-transparent rounded-full animate-spin mb-3" />
        <span className="text-xs text-[#64748B]">Loading settings...</span>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 text-left">
      {/* Top Header */}
      <div className="pb-3 border-b border-[#E2E8F0]">
        <h1 className="text-xl font-bold text-[#09090B] tracking-tight">
          Property & Settlement Profile
        </h1>
        <p className="text-xs text-[#64748B] mt-0.5">
          These details are automatically populated in tenant UPI payment screens and certified HRA tax receipts.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        {/* PG Information Section */}
        <div className="bg-white border border-[#E2E8F0] rounded-[12px] p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-[#E2E8F0]">
            <Building className="w-4 h-4 text-[#D97706]" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#09090B]">
              Accommodation Information
            </h2>
          </div>

          <Input
            label="PG Accommodation Name"
            value={pgName}
            onChange={(e) => setPgName(e.target.value)}
            required
            disabled={saving}
          />

          <Input
            label="Owner / Landlord Full Name"
            value={ownerName}
            onChange={(e) => setOwnerName(e.target.value)}
            required
            disabled={saving}
          />

          <Input
            label="Physical Property Address"
            value={pgAddress}
            onChange={(e) => setPgAddress(e.target.value)}
            required
            disabled={saving}
          />
        </div>

        {/* UPI & Tax Details Section */}
        <div className="bg-white border border-[#E2E8F0] rounded-[12px] p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-[#E2E8F0]">
            <CreditCard className="w-4 h-4 text-[#D97706]" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#09090B]">
              Settlement & HRA Credentials
            </h2>
          </div>

          <Input
            label="Owner UPI ID (for tenant rent transfers)"
            placeholder="e.g. name@okicici"
            value={upiId}
            onChange={(e) => setUpiId(e.target.value)}
            helperText="Residents will pay directly to this UPI address via GPay, PhonePe, or Paytm."
            required
            disabled={saving}
          />

          <Input
            label="Landlord PAN (for instant HRA tax receipts)"
            placeholder="e.g. ABCDE1234F"
            value={panNumber}
            onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
            helperText="Printed on tenant HRA rent exemption certificates. Masked by default for privacy."
            required
            disabled={saving}
          />
        </div>

        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-1.5 text-[11px] text-[#64748B]">
            <ShieldCheck className="w-3.5 h-3.5 text-[#10B981]" />
            <span>Encrypted cloud storage</span>
          </div>

          <Button
            type="submit"
            size="md"
            loading={saving}
            variant="solid"
          >
            <Save className="w-3.5 h-3.5 mr-1.5" />
            <span>Save Profile</span>
          </Button>
        </div>
      </form>
    </div>
  );
}
