'use client';

import React, { useState } from 'react';
import { Bed } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PhoneInput } from '@/components/ui/phone-input';
import { Drawer } from '@/components/ui/drawer';
import { createTenant } from '@/lib/firestore';
import { validatePhone, sanitizeText } from '@/lib/security';
import toast from 'react-hot-toast';

interface AddTenantModalProps {
  bed: Bed;
  ownerId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (tenantId: string) => void;
}

export function AddTenantModal({
  bed,
  ownerId,
  isOpen,
  onClose,
  onSuccess,
}: AddTenantModalProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [moveInDate, setMoveInDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [rent, setRent] = useState(String(bed.monthlyRent || 8500));
  const [deposit, setDeposit] = useState(String(bed.monthlyRent || 8500));
  const [loading, setLoading] = useState(false);
  const [phoneError, setPhoneError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPhoneError('');

    const sanitizedName = sanitizeText(name, 60);
    if (!sanitizedName) {
      toast.error('Please enter the resident’s full name');
      return;
    }

    const phoneValidation = validatePhone(phone);
    if (!phoneValidation.valid) {
      setPhoneError(phoneValidation.error || 'Please enter a valid 10-digit mobile number');
      return;
    }
    const cleanPhone = phoneValidation.cleaned;

    setLoading(true);
    try {
      const tenantId = await createTenant({
        ownerId,
        bedId: bed.id,
        bedLabel: bed.bedLabel,
        roomNumber: bed.roomNumber,
        name: sanitizedName,
        phone: cleanPhone,
        moveInDate,
        depositPaid: Number(deposit) || 0,
        monthlyRent: Number(rent) || bed.monthlyRent || 8500,
      });

      toast.success(`${sanitizedName} assigned to Bed ${bed.bedLabel}`);
      onSuccess(tenantId);
      onClose();
    } catch (err: any) {
      console.error(err);
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

        <Input
          label="Move-In Date"
          type="date"
          value={moveInDate}
          onChange={(e) => setMoveInDate(e.target.value)}
          required
          disabled={loading}
        />

        <div className="p-3.5 rounded-[8px] bg-[#F8FAFC] border border-[#E2E8F0] text-xs text-[#64748B] leading-relaxed">
          Assigning this bed will instantly generate an unguessable private portal URL for this resident. They can upload payment proofs and download official HRA tax receipts without downloading an app.
        </div>
      </form>
    </Drawer>
  );
}
