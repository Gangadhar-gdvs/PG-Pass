'use client';

import React, { useState, useEffect } from 'react';
import { useOwnerSession } from '@/hooks/useOwner';
import { errorMessage, normalizePhone } from '@/lib/utils';
import { fetchJson } from '@/hooks/useAsyncData';
import { apiPut } from '@/lib/client/api';
import { LoadError } from '@/components/ui/load-error';
import { AddPropertyCard } from '@/components/owner/AddPropertyCard';
import { OwnerOnlyGuard } from '@/components/owner/OwnerOnlyGuard';
import { PgPhotoGallery } from '@/components/owner/PgPhotoGallery';
import { GmailConnectCard } from '@/components/owner/GmailConnectCard';
import { SupportLink } from '@/components/ui/support-link';
import { Input } from '@/components/ui/input';
import { PhoneInput } from '@/components/ui/phone-input';
import { OwnerAvatarEditor } from '@/components/owner/OwnerAvatarEditor';
import { useOwnerAvatarUrl } from '@/lib/client/ownerAvatar';
import { FormSkeleton } from '@/components/ui/skeletons';
import { Button } from '@/components/ui/button';
import { PageHeader, SectionCard, InfoBanner } from '@/components/ui/dashboard-kit';
import { validateUpi, validatePhone, sanitizeText } from '@/lib/security';
import { Save } from 'lucide-react';
import toast from 'react-hot-toast';

function SettingsPageInner() {
  const { ownerId, selectedPropertyId } = useOwnerSession();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [saving, setSaving] = useState(false);

  const [pgName, setPgName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [pgAddress, setPgAddress] = useState('');
  const [upiId, setUpiId] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const avatarUrl = useOwnerAvatarUrl();
  const [rentDueDay, setRentDueDay] = useState('5');
  const [lateFeePerDay, setLateFeePerDay] = useState('0');
  const [lateFeeGraceDays, setLateFeeGraceDays] = useState('0');

  useEffect(() => {
    async function load() {
      try {
        // Surface a load failure instead of silently showing a blank settings
        // form (which an owner could accidentally SAVE over their real profile).
        const profile = await fetchJson<{
          pgName?: string; name?: string; address?: string; pgAddress?: string; upiId?: string;
          phone?: string | number; rentDueDay?: number; lateFeePerDayPaise?: number; lateFeeGraceDays?: number;
        }>('/api/owners');
        setPgName(profile.pgName || '');
        setOwnerName(profile.name || '');
        setPgAddress(profile.address || profile.pgAddress || '');
        setUpiId(profile.upiId || '');
        setPhone(normalizePhone(String(profile.phone ?? '')));
        setRentDueDay(String(profile.rentDueDay ?? 5));
        setLateFeePerDay(String(Math.round((profile.lateFeePerDayPaise ?? 0) / 100)));
        setLateFeeGraceDays(String(profile.lateFeeGraceDays ?? 0));
        setLoadError(null);
      } catch (e) {
        setLoadError(errorMessage(e, "Couldn't load your settings. Please try again."));
      } finally {
        setLoading(false);
      }
    }
    if (ownerId) load();
  }, [ownerId, reloadKey]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    const sanitizedPgName = sanitizeText(pgName, 80);
    const sanitizedOwnerName = sanitizeText(ownerName, 60);
    const sanitizedPgAddress = sanitizeText(pgAddress, 200);

    if (!sanitizedPgName || !sanitizedOwnerName) {
      toast.error('PG Name and Owner Name are required');
      return;
    }

    // Never persist a placeholder number: the owner's phone is shown to
    // residents and used on receipts, so it must be real.
    const phoneValidation = validatePhone(phone);
    if (!phoneValidation.valid) {
      setPhoneError(phoneValidation.error || 'Enter a valid 10-digit mobile number');
      toast.error('Please enter your 10-digit mobile number');
      return;
    }
    setPhoneError('');

    const upiValidation = validateUpi(upiId);
    if (!upiValidation.valid) {
      toast.error(upiValidation.error || 'Invalid UPI ID format');
      return;
    }

    setSaving(true);
    try {
      await apiPut('/api/owners', {
        pgName: sanitizedPgName,
        name: sanitizedOwnerName,
        address: sanitizedPgAddress || 'PG Address',
        upiId: upiValidation.formatted,
        phone: phoneValidation.cleaned,
        rentDueDay: Math.min(28, Math.max(1, Number(rentDueDay) || 5)),
        lateFeePerDayPaise: Math.max(0, Math.round((Number(lateFeePerDay) || 0) * 100)),
        lateFeeGraceDays: Math.max(0, Math.min(28, Number(lateFeeGraceDays) || 0)),
      });

      toast.success('Settings updated successfully');
    } catch (err: unknown) {
      toast.error(errorMessage(err, 'Failed to update settings'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    // Render the REAL header during load so its shape never changes when data
    // arrives; only the body is a skeleton.
    return (
      <div className="max-w-3xl mx-auto space-y-5">
        <PageHeader
          icon="tools-purple"
          tint="slate"
          title="Property & Banking"
          highlight="Settings"
          subtitle="Configure payment endpoints and official details for compliant rent receipts."
        />
        <FormSkeleton fields={5} />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="max-w-3xl mx-auto">
        <LoadError message={loadError} onRetry={() => { setLoading(true); setLoadError(null); setReloadKey((k) => k + 1); }} />
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
        <SectionCard title="Profile photo" icon="person">
          <OwnerAvatarEditor
            name={ownerName || phone || 'Owner'}
            url={avatarUrl}
            title={ownerName || 'PG Owner'}
            subtitle="Shown on your account. Private — only you can see it."
          />
        </SectionCard>

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

          <PhoneInput
            label="Owner mobile number"
            value={phone}
            onChange={(v) => {
              setPhone(v);
              if (phoneError) setPhoneError('');
            }}
            error={phoneError}
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

      {/* Anchor target for `/settings#gmail` deep-links (e.g. the "Connect"
          action on a rent-reminder email prompt). scroll-mt clears the sticky header. */}
      <div id="gmail" className="scroll-mt-24">
        <GmailConnectCard />
      </div>

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
