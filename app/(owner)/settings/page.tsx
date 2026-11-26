'use client';

import React, { useState, useEffect } from 'react';
import { useOwnerSession } from '@/hooks/useOwner';
import { errorMessage } from '@/lib/utils';
import { AddPropertyCard } from '@/components/owner/AddPropertyCard';
import { OwnerOnlyGuard } from '@/components/owner/OwnerOnlyGuard';
import { PgPhotoGallery } from '@/components/owner/PgPhotoGallery';
import { GmailConnectCard } from '@/components/owner/GmailConnectCard';
import { SupportLink } from '@/components/ui/support-link';
import { Input } from '@/components/ui/input';
import { HeaderSkeleton, FormSkeleton } from '@/components/ui/skeletons';
import { Button } from '@/components/ui/button';
import { PageHeader, SectionCard, InfoBanner } from '@/components/ui/dashboard-kit';
import { validateUpi, sanitizeText } from '@/lib/security';
import { Save } from 'lucide-react';
import toast from 'react-hot-toast';

function SettingsPageInner() {
  const { ownerId, selectedPropertyId } = useOwnerSession();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [pgName, setPgName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [pgAddress, setPgAddress] = useState('');
  const [upiId, setUpiId] = useState('');
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
    } catch (err: unknown) {
      toast.error(errorMessage(err, 'Failed to update settings'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-5">
        <HeaderSkeleton action={false} />
        <FormSkeleton fields={5} />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <PageHeader
        icon="tools-purple"
        tint="slate"
        title="Property & Banking"
        highlight="Settings"
        subtitle="Configure payment endpoints and official details for compliant rent receipts."
      />

      <AddPropertyCard />

      <form onSubmit={handleSave} className="space-y-5">
        <SectionCard title="Property Information" icon="building" bodyClassName="space-y-4">
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
        </SectionCard>

        <SectionCard
          title="Banking & Tax Details"
          icon="wallet"
          action={<span className="chip shrink-0">0% gateway</span>}
          bodyClassName="space-y-4"
        >
          <Input
            label="Landlord UPI ID (0% Gateway Settlement)"
            placeholder="e.g. ramesh@okaxis or 9876543210@paytm"
            value={upiId}
            onChange={(e) => setUpiId(e.target.value)}
            required
            disabled={saving}
          />
        </SectionCard>

        <SectionCard title="Rent Collection" icon="calendar-clock" bodyClassName="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 items-end gap-3">
            <Input
              id="rent-due-day"
              label="Rent Due Day (of month)"
              type="number"
              min={1}
              max={28}
              value={rentDueDay}
              onChange={(e) => setRentDueDay(e.target.value)}
              disabled={saving}
            />
            <Input
              id="late-fee"
              label="Late Fee / day (₹)"
              type="number"
              min={0}
              value={lateFeePerDay}
              onChange={(e) => setLateFeePerDay(e.target.value)}
              disabled={saving}
            />
            <Input
              id="late-grace"
              label="Grace Days"
              type="number"
              min={0}
              max={28}
              value={lateFeeGraceDays}
              onChange={(e) => setLateFeeGraceDays(e.target.value)}
              disabled={saving}
            />
          </div>
          <p className="text-xs font-medium leading-relaxed text-muted">
            Due day applies to newly generated rent records. Set late fee to ₹0 to disable penalties.
          </p>
        </SectionCard>

        <InfoBanner
          tone="success"
          title="Secure, zero-commission payments"
          description="Your UPI ID and PAN are securely used to generate real-time QR codes and sequential PDF receipts. Zero gateway commissions apply."
        />

        <div className="flex justify-end">
          <Button type="submit" size="lg" variant="solid" loading={saving} className="w-full sm:w-auto">
            <Save className="h-4 w-4" />
            <span>Save Configuration</span>
          </Button>
        </div>
      </form>

      <GmailConnectCard />

      <PgPhotoGallery propertyId={selectedPropertyId} />

      <div className="flex justify-center pt-1">
        <SupportLink subject="Owner support request" />
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <OwnerOnlyGuard>
      <SettingsPageInner />
    </OwnerOnlyGuard>
  );
}
