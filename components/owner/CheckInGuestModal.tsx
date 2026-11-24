'use client';

import React, { useState, useMemo } from 'react';
import { Bed } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Drawer } from '@/components/ui/drawer';
import { formatCurrency } from '@/lib/utils';
import toast from 'react-hot-toast';

function nightsBetween(a: string, b: string): number {
  const d1 = Date.parse(`${a}T00:00:00Z`);
  const d2 = Date.parse(`${b}T00:00:00Z`);
  if (isNaN(d1) || isNaN(d2)) return 1;
  return Math.max(1, Math.round((d2 - d1) / 86400000));
}

export function CheckInGuestModal({
  bed,
  isOpen,
  onClose,
  onSuccess,
}: {
  bed: Bed;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [checkIn, setCheckIn] = useState(today);
  const [checkOut, setCheckOut] = useState(tomorrow);
  const [mode, setMode] = useState<'per_night' | 'flat'>('per_night');
  const [rate, setRate] = useState('500');
  const [flat, setFlat] = useState('');
  const [loading, setLoading] = useState(false);

  const nights = useMemo(() => nightsBetween(checkIn, checkOut), [checkIn, checkOut]);
  const total = useMemo(() => {
    if (mode === 'per_night') return (Number(rate) || 0) * nights;
    return Number(flat) || 0;
  }, [mode, rate, flat, nights]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (name.trim().length < 2) return toast.error('Enter the guest name');
    if (total <= 0) return toast.error('Enter a valid amount');
    setLoading(true);
    try {
      const res = await fetch('/api/guests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bedId: bed.id,
          name: name.trim(),
          phone,
          checkInDate: checkIn,
          checkOutDate: checkOut,
          billingMode: mode,
          nightlyRateRupees: mode === 'per_night' ? Number(rate) : undefined,
          flatTotalRupees: mode === 'flat' ? Number(flat) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || 'Check-in failed');
      toast.success(`${name.trim()} checked in to Bed ${bed.bedLabel}`);
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Check-in failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={`Check in Guest · Bed ${bed.bedLabel}`}
      description={`Room ${bed.roomNumber} · short stay`}
      width="md"
      footer={
        <div className="flex items-center justify-between gap-3 w-full">
          <div className="text-sm">
            <span className="text-slate-500">Total </span>
            <span className="font-extrabold font-mono-numbers">{formatCurrency(total)}</span>
            {mode === 'per_night' && <span className="text-xs text-slate-400"> · {nights}n</span>}
          </div>
          <Button type="submit" form="guest-form" loading={loading} variant="solid">
            Check In Guest
          </Button>
        </div>
      }
    >
      <form id="guest-form" onSubmit={submit} className="space-y-4">
        <Input label="Guest Name" value={name} onChange={(e) => setName(e.target.value)} required disabled={loading} />
        <Input label="Phone (optional)" type="tel" inputMode="numeric" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={loading} />

        <div className="grid grid-cols-2 gap-3">
          <Input label="Check-in" type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} disabled={loading} />
          <Input label="Check-out" type="date" value={checkOut} min={checkIn} onChange={(e) => setCheckOut(e.target.value)} disabled={loading} />
        </div>

        {/* Billing mode toggle */}
        <div className="space-y-2">
          <span className="text-xs font-semibold text-slate-600">Billing</span>
          <div className="flex items-center gap-2 p-1 rounded-[12px] bg-slate-100">
            {(['per_night', 'flat'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className="flex-1 h-10 rounded-[10px] text-xs font-bold transition-all press"
                style={mode === m ? { background: '#fff', color: 'var(--accent)', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' } : { color: '#64748B' }}
              >
                {m === 'per_night' ? 'Per Night' : 'Flat Total'}
              </button>
            ))}
          </div>
        </div>

        {mode === 'per_night' ? (
          <Input label="Rate per night (₹)" type="number" value={rate} onChange={(e) => setRate(e.target.value)} disabled={loading} />
        ) : (
          <Input label="Total amount (₹)" type="number" value={flat} onChange={(e) => setFlat(e.target.value)} disabled={loading} />
        )}

        <div className="p-3.5 rounded-[12px] accent-soft-bg text-xs leading-relaxed">
          Guest check-in is quick: no monthly rent cycle, no deposit, no portal. The bed frees
          automatically when you check them out.
        </div>
      </form>
    </Drawer>
  );
}
