'use client';

import React, { useState } from 'react';
import { Bed } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createTenant } from '@/lib/firestore';
import { validatePhone, sanitizeText } from '@/lib/security';
import { X, UserPlus, Phone, Calendar, IndianRupee } from 'lucide-react';
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
  const [moveInDate, setMoveInDate] = useState(new Date().toISOString().split('T')[0]);
  const [deposit, setDeposit] = useState(String(bed.monthlyRent || 8500));
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const sanitizedName = sanitizeText(name, 60);
    if (!sanitizedName) {
      toast.error('Please enter the resident’s full name');
      return;
    }

    const phoneValidation = validatePhone(phone);
    if (!phoneValidation.valid) {
      toast.error(phoneValidation.error || 'Please enter a valid 10-digit WhatsApp number');
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
        monthlyRent: bed.monthlyRent || 8500,
      });

      toast.success(`${name} assigned to Bed ${bed.bedLabel}!`);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-full hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="mb-5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 text-xs font-bold mb-2">
            <span>Room {bed.roomNumber}</span>
            <span>•</span>
            <span>Bed {bed.bedLabel}</span>
          </div>
          <h2 className="text-xl font-black text-white">Add Resident to Bed</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Create resident record & generate their personal rent portal link.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Resident Full Name"
            placeholder="e.g. Rahul Sharma"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
          />

          <Input
            label="WhatsApp Mobile Number"
            type="tel"
            inputMode="numeric"
            maxLength={10}
            placeholder="98765 43210"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            prefix={<span className="text-slate-400 font-bold">+91</span>}
            suffix={<Phone className="w-4 h-4 text-slate-500" />}
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Move-In Date"
              type="date"
              value={moveInDate}
              onChange={(e) => setMoveInDate(e.target.value)}
              required
            />

            <Input
              label="Security Deposit"
              type="number"
              placeholder="8500"
              value={deposit}
              onChange={(e) => setDeposit(e.target.value)}
              prefix={<IndianRupee className="w-3.5 h-3.5 text-slate-500" />}
              required
            />
          </div>

          <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl text-xs text-slate-400 flex items-center justify-between">
            <span>Monthly Rent</span>
            <span className="font-bold text-white">₹{bed.monthlyRent.toLocaleString('en-IN')}/month</span>
          </div>

          <div className="pt-2 flex gap-3">
            <Button type="button" variant="ghost" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" loading={loading} className="flex-1 font-bold">
              <UserPlus className="w-4 h-4 mr-1.5" />
              <span>Confirm & Assign</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
