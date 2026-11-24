'use client';

import React, { useState, useEffect } from 'react';
import { useOwnerSession } from '@/hooks/useOwner';
import { AddPropertyCard } from '@/components/owner/AddPropertyCard';
import { SupportLink } from '@/components/ui/support-link';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
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
  const { ownerId } = useOwnerSession();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [pgName, setPgName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [pgAddress, setPgAddress] = useState('');
  const [upiId, setUpiId] = useState('');
  const [panNumber, setPanNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [rentDueDay, setRentDueDay] = useState('5');
  const [lateFeePerDay, setLateFeePerDay] = useState('0');
  const [lateFeeGraceDays, setLateFeeGraceDays] = useState('0');

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/owners');
        if (res.ok) {
          const profile = await res.json();
          setPgName(profile.pgName || '');
          setOwnerName(profile.name || '');
          setPgAddress(profile.address || profile.pgAddress || '');
          setUpiId(profile.upiId || '');
          setPanNumber(profile.panNumber || '');
          setPhone(profile.phone || '');
          setRentDueDay(String(profile.rentDueDay ?? 5));
          setLateFeePerDay(String(Math.round((profile.lateFeePerDayPaise ?? 0) / 100)));
          setLateFeeGraceDays(String(profile.lateFeeGraceDays ?? 0));
        }
      } catch (e) {
        console.error('Error fetching settings:', e);
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
      const res = await fetch('/api/owners', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pgName: sanitizedPgName,
          name: sanitizedOwnerName,
          address: sanitizedPgAddress || 'PG Address',
          upiId: upiValidation.formatted,
          panNumber: panValidation.formatted,
          phone: phone.replace(/\D/g, '').slice(-10) || '9876543210',
          rentDueDay: Math.min(28, Math.max(1, Number(rentDueDay) || 5)),
          lateFeePerDayPaise: Math.max(0, Math.round((Number(lateFeePerDay) || 0) * 100)),
          lateFeeGraceDays: Math.max(0, Math.min(28, Number(lateFeeGraceDays) || 0)),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to update settings');
      }

      toast.success('Settings updated successfully');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto py-8 space-y-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-8 w-56" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-11" />
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-8 space-y-5">
      <AddPropertyCard />

      <div className="bg-white border border-[#E2E8F0] rounded-[12px] p-6 sm:p-8 shadow-xs">
        <div className="flex items-center gap-3 pb-5 mb-6 border-b border-[#E2E8F0]">
          <div className="w-10 h-10 rounded-[8px] bg-[#FEF3C7] border border-[#FDE68A] text-[#D97706] flex items-center justify-center shrink-0">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-[#09090B]">Property & Banking Settings</h1>
            <p className="text-xs text-[#64748B]">
              Configure payment endpoints and official details for compliant rent receipts.
            </p>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-5">
          <div className="space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#94A3B8] flex items-center gap-1.5">
              <Building className="w-3.5 h-3.5 text-[#D97706]" />
              <span>Property Information</span>
            </h2>

            <Input
              label="PG Business Name"
              placeholder="e.g. Skyline Luxury Coliving"
              value={pgName}
              onChange={(e) => setPgName(e.target.value)}
              required
              disabled={saving}
            />

            <Input
              label="Proprietor / Landlord Full Name"
              placeholder="e.g. Property Manager Name"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              required
              disabled={saving}
            />

            <Input
              label="Complete Property Address"
              placeholder="e.g. #42, 5th Cross, Koramangala 4th Block, Bengaluru - 560034"
              value={pgAddress}
              onChange={(e) => setPgAddress(e.target.value)}
              required
              disabled={saving}
            />
          </div>

          <div className="space-y-4 pt-4 border-t border-[#E2E8F0]">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#94A3B8] flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-[#10B981]" />
              <span>Banking & Tax Details</span>
            </h2>

            <Input
              label="Landlord UPI ID (0% Gateway Settlement)"
              placeholder="e.g. ramesh@okaxis or 9876543210@paytm"
              value={upiId}
              onChange={(e) => setUpiId(e.target.value)}
              required
              disabled={saving}
            />

            <Input
              label="Income Tax PAN (For Tenant HRA Receipts)"
              placeholder="e.g. ABCDE1234F"
              value={panNumber}
              onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
              required
              disabled={saving}
              maxLength={10}
            />
          </div>

          <div className="space-y-4 pt-4 border-t border-[#E2E8F0]">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#94A3B8] flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-[#D97706]" />
              <span>Rent Collection</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="rent-due-day" className="text-xs font-semibold text-[#334155]">
                  Rent Due Day (of month)
                </label>
                <input
                  id="rent-due-day"
                  type="number"
                  min={1}
                  max={28}
                  value={rentDueDay}
                  onChange={(e) => setRentDueDay(e.target.value)}
                  disabled={saving}
                  className="w-full h-11 rounded-[8px] border border-[#CBD5E1] px-3 text-sm text-[#09090B] focus:border-[#D97706] focus:outline-none disabled:opacity-50"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="late-fee" className="text-xs font-semibold text-[#334155]">
                  Late Fee / day (₹)
                </label>
                <input
                  id="late-fee"
                  type="number"
                  min={0}
                  value={lateFeePerDay}
                  onChange={(e) => setLateFeePerDay(e.target.value)}
                  disabled={saving}
                  className="w-full h-11 rounded-[8px] border border-[#CBD5E1] px-3 text-sm text-[#09090B] focus:border-[#D97706] focus:outline-none disabled:opacity-50"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="late-grace" className="text-xs font-semibold text-[#334155]">
                  Grace Days
                </label>
                <input
                  id="late-grace"
                  type="number"
                  min={0}
                  max={28}
                  value={lateFeeGraceDays}
                  onChange={(e) => setLateFeeGraceDays(e.target.value)}
                  disabled={saving}
                  className="w-full h-11 rounded-[8px] border border-[#CBD5E1] px-3 text-sm text-[#09090B] focus:border-[#D97706] focus:outline-none disabled:opacity-50"
                />
              </div>
            </div>
            <p className="text-[11px] text-[#64748B]">
              Due day applies to newly generated rent records. Set late fee to ₹0 to disable penalties.
            </p>
          </div>

          <div className="p-4 rounded-[8px] bg-[#ECFDF5] border border-[#A7F3D0] flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-[#10B981] shrink-0 mt-0.5" />
            <p className="text-xs text-[#065F46] leading-relaxed">
              Your UPI ID and PAN are securely used to generate real-time QR codes and sequential PDF receipts. Zero gateway commissions apply.
            </p>
          </div>

          <Button
            type="submit"
            size="lg"
            variant="solid"
            loading={saving}
            className="w-full bg-[#D97706] hover:bg-[#B45309] text-white"
          >
            <Save className="w-4 h-4 mr-2" />
            <span>Save Configuration</span>
          </Button>
        </form>
      </div>

      <div className="flex justify-center pt-1">
        <SupportLink subject="Owner support request" />
      </div>
    </div>
  );
}
