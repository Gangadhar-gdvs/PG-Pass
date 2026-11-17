'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getOwnerProfile, updateOwnerProfile } from '@/lib/firestore';
import { Owner } from '@/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { validatePan, validateUpi, sanitizeText } from '@/lib/security';
import {
  Settings,
  Building2,
  CreditCard,
  FileText,
  Save,
  RotateCcw,
  ShieldCheck,
  CheckCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function SettingsPage() {
  const { user } = useAuth();
  const ownerId = user?.uid || 'demo_owner';

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
      toast.error(upiValidation.error || 'Invalid UPI ID');
      return;
    }

    const panValidation = validatePan(panNumber);
    if (!panValidation.valid) {
      toast.error(panValidation.error || 'Invalid PAN Number');
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
      toast.success('Settings updated securely! ✅');
    } catch (err: any) {
      toast.error('Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  const handleResetData = () => {
    if (confirm('Are you sure you want to reset demo data and start fresh?')) {
      if (typeof window !== 'undefined') {
        localStorage.clear();
        toast.success('Local data reset! Reloading...');
        setTimeout(() => window.location.reload(), 600);
      }
    }
  };

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center">
        <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-3" />
        <span className="text-xs text-slate-400">Loading Settings...</span>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-5 shadow-lg backdrop-blur-sm">
        <h1 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
          <Settings className="w-5 h-5 text-indigo-400" />
          <span>PG & Landlord Profile Settings</span>
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">
          These details appear on resident payment screens and official HRA tax receipts.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* PG Information */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 shadow-md backdrop-blur-sm space-y-4">
          <h2 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
            <Building2 className="w-4 h-4 text-indigo-400" />
            <span>Accommodation Information</span>
          </h2>

          <Input
            label="PG Accommodation Name"
            value={pgName}
            onChange={(e) => setPgName(e.target.value)}
            required
          />

          <Input
            label="Owner / Landlord Full Name"
            value={ownerName}
            onChange={(e) => setOwnerName(e.target.value)}
            required
          />

          <Input
            label="Full Physical Address"
            value={pgAddress}
            onChange={(e) => setPgAddress(e.target.value)}
            required
          />
        </div>

        {/* UPI & Tax Details */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 shadow-md backdrop-blur-sm space-y-4">
          <h2 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
            <CreditCard className="w-4 h-4 text-emerald-400" />
            <span>Collection & Tax Compliance</span>
          </h2>

          <Input
            label="Primary Collection UPI ID"
            placeholder="e.g. yourname@okaxis"
            value={upiId}
            onChange={(e) => setUpiId(e.target.value)}
            required
          />

          <Input
            label="Owner PAN (Required for Tenant HRA Tax Filings)"
            placeholder="e.g. ABCDE1234F"
            maxLength={10}
            value={panNumber}
            onChange={(e) => setPanNumber(e.target.value)}
            required
          />
          <p className="text-[11px] text-slate-500">
            Tenants paying above ₹8,333/month require landlord PAN to claim House Rent Allowance (HRA) exemption.
          </p>
        </div>

        <div className="flex gap-3">
          <Button type="submit" loading={saving} size="lg" className="flex-1 font-bold py-3">
            <Save className="w-4 h-4 mr-2" />
            <span>Save Profile Changes</span>
          </Button>
        </div>
      </form>

      {/* Danger Zone / Reset */}
      <div className="bg-rose-950/20 border border-rose-500/20 rounded-3xl p-6">
        <h3 className="text-sm font-bold text-rose-300 mb-1">Reset Local Demo Storage</h3>
        <p className="text-xs text-slate-400 mb-4">
          Clear all cached mock beds, test residents, and uploaded photos to start fresh from step 1.
        </p>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          onClick={handleResetData}
          className="text-xs"
        >
          <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
          <span>Reset All Mock Data</span>
        </Button>
      </div>
    </div>
  );
}
