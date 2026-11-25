'use client';

import React, { useState } from 'react';
import { Bed } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { PhoneInput } from '@/components/ui/phone-input';
import { Drawer } from '@/components/ui/drawer';
import { validatePhone, sanitizeText } from '@/lib/security';
import toast from 'react-hot-toast';

interface AddTenantModalProps {
  bed: Bed;
  ownerId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (tenantId: string, rawPortalToken?: string) => void;
  prefillName?: string;
  prefillPhone?: string;
}

export function AddTenantModal({
  bed,
  isOpen,
  onClose,
  onSuccess,
  prefillName,
  prefillPhone,
}: AddTenantModalProps) {
  const [name, setName] = useState(prefillName || '');
  const [phone, setPhone] = useState(prefillPhone || '');

  // Seed from a join-request when the modal opens.
  React.useEffect(() => {
    if (isOpen) {
      if (prefillName) setName(prefillName);
      if (prefillPhone) setPhone(prefillPhone);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, prefillName, prefillPhone]);
  const [moveInDate, setMoveInDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [rent, setRent] = useState(String(bed.monthlyRent || 8500));
  const [deposit, setDeposit] = useState(String(bed.monthlyRent || 8500));
  const [idProofType, setIdProofType] = useState('aadhaar');
  const [emName, setEmName] = useState('');
  const [emPhone, setEmPhone] = useState('');
  const [emRelation, setEmRelation] = useState('');
  const [loading, setLoading] = useState(false);
  const [phoneError, setPhoneError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return; // double-submit guard
    setPhoneError('');

    const sanitizedName = sanitizeText(name, 60);
    if (!sanitizedName) {
      toast.error('Please enter the resident’s full name');
      return;
    }

    const phoneValidation = validatePhone(phone);
    if (!phoneValidation.valid) {
      setPhoneError(
        phoneValidation.error || 'Please enter a valid 10-digit mobile number'
      );
      return;
    }
    const cleanPhone = phoneValidation.cleaned;

    setLoading(true);
    try {
      const depositVal = Number(deposit) || 0;
      const rentVal = Number(rent) || bed.monthlyRent || 8500;

      const res = await fetch('/api/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bedId: bed.id,
          name: sanitizedName,
          phone: cleanPhone,
          moveInDate,
          idProofType,
          emergencyContactName: emName.trim() || undefined,
          emergencyContactPhone: emPhone.replace(/\D/g, '').slice(-10) || undefined,
          emergencyContactRelation: emRelation.trim() || undefined,
          securityDepositPaise: Math.round(depositVal * 100),
          depositPaidPaise: Math.round(depositVal * 100),
          initialRentAmountPaise: Math.round(rentVal * 100),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to assign resident');
      }

      toast.success(`${sanitizedName} assigned to Bed ${bed.bedLabel}`);
      onSuccess(data.tenant.id, data.rawPortalToken);
      onClose();
    } catch (err: any) {
      console.error('Tenant assignment error:', err);
      toast.error(err.message || 'Failed to add resident');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={`Assign Bed ${bed.bedLabel}`}
      description={`Room ${bed.roomNumber} · Floor ${bed.floor}`}
      width="md"
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="add-tenant-form"
            loading={loading}
            variant="solid"
          >
            Assign Resident & Generate Link
          </Button>
        </div>
      }
    >
      <form id="add-tenant-form" onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Resident Full Name"
          placeholder="e.g. Rahul Sharma"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          disabled={loading}
        />

        <PhoneInput
          label="WhatsApp Number"
          value={phone}
          onChange={setPhone}
          error={phoneError}
          disabled={loading}
        />

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Monthly Rent (₹)"
            type="number"
            value={rent}
            onChange={(e) => setRent(e.target.value)}
            required
            disabled={loading}
          />

          <Input
            label="Security Deposit (₹)"
            type="number"
            value={deposit}
            onChange={(e) => setDeposit(e.target.value)}
            required
            disabled={loading}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Move-In Date"
            type="date"
            value={moveInDate}
            onChange={(e) => setMoveInDate(e.target.value)}
            required
            disabled={loading}
          />

          <Select
            label="ID Proof Type"
            id="add-tenant-idproof"
            value={idProofType}
            onChange={(e) => setIdProofType(e.target.value)}
            disabled={loading}
          >
            <option value="aadhaar">Aadhaar Card</option>
            <option value="pan">PAN Card</option>
            <option value="driving_license">Driving License</option>
            <option value="voter_id">Voter ID</option>
            <option value="passport">Passport</option>
            <option value="other">Other</option>
          </Select>
        </div>

        {/* Emergency contact (optional) */}
        <div className="space-y-3 pt-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8]">
            Emergency Contact (optional)
          </span>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Contact Name"
              placeholder="e.g. Parent / Guardian"
              value={emName}
              onChange={(e) => setEmName(e.target.value)}
              disabled={loading}
            />
            <Input
              label="Relation"
              placeholder="e.g. Father"
              value={emRelation}
              onChange={(e) => setEmRelation(e.target.value)}
              disabled={loading}
            />
          </div>
          <Input
            label="Contact Phone"
            type="tel"
            inputMode="numeric"
            placeholder="10-digit mobile"
            value={emPhone}
            onChange={(e) => setEmPhone(e.target.value)}
            disabled={loading}
          />
        </div>

        <div className="p-3.5 rounded-[8px] bg-[#F8FAFC] border border-[#E2E8F0] text-xs text-[#64748B] leading-relaxed">
          Assigning this bed will atomically issue an unguessable cryptographic resident pass URL.
          The tenant can verify via the last 4 digits of their phone, pay 0%-fee rent directly via UPI, and download verified HRA receipts.
        </div>
      </form>
    </Drawer>
  );
}
