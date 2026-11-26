'use client';

import React, { useState, useMemo } from 'react';
import { Bed } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Drawer } from '@/components/ui/drawer';
import { InfoBanner, KeyValue } from '@/components/ui/dashboard-kit';
import { IconBubble, type Icon3DName, type Tint } from '@/components/brand/Icon3D';
import { CalendarDays, Moon, UserRound, Wallet } from 'lucide-react';
import { formatCurrency, errorMessage } from '@/lib/utils';
import toast from 'react-hot-toast';

function nightsBetween(a: string, b: string): number {
  const d1 = Date.parse(`${a}T00:00:00Z`);
  const d2 = Date.parse(`${b}T00:00:00Z`);
  if (isNaN(d1) || isNaN(d2)) return 1;
  return Math.max(1, Math.round((d2 - d1) / 86400000));
}

/** Glass form section with a small 3D icon header (local to this drawer). */
function FormSection({
  icon,
  tint,
  title,
  children,
}: {
  icon: Icon3DName;
  tint: Tint;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="app-card space-y-3.5 p-4">
      <div className="flex items-center gap-2.5">
        <IconBubble icon={icon} tint={tint} size={36} />
        <h4 className="text-[14.5px] font-bold leading-tight tracking-[-0.01em] text-ink">{title}</h4>
      </div>
      {children}
    </section>
  );
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
  // Read the clock in lazy useState initializers (run once at mount, exempt from
  // the render-purity rule) rather than during render. `checkIn`/`checkOut` seed
  // from today/tomorrow; `today` is also the min for the date inputs.
  const [today] = useState(() => new Date().toISOString().slice(0, 10));
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [checkIn, setCheckIn] = useState(() => new Date().toISOString().slice(0, 10));
  const [checkOut, setCheckOut] = useState(() =>
    new Date(Date.now() + 86400000).toISOString().slice(0, 10)
  );
  const [mode, setMode] = useState<'per_night' | 'flat'>('per_night');
  const [rate, setRate] = useState('500');
  const [flat, setFlat] = useState('');
  const [loading, setLoading] = useState(false);

  const nights = useMemo(() => nightsBetween(checkIn, checkOut), [checkIn, checkOut]);
  const total = useMemo(() => {
    if (mode === 'per_night') return (Number(rate) || 0) * nights;
    return Number(flat) || 0;
  }, [mode, rate, flat, nights]);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
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
    } catch (err: unknown) {
      toast.error(errorMessage(err, 'Check-in failed'));
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
        <div className="flex w-full items-center justify-between gap-3">
          <div className="min-w-0 leading-tight">
            <span className="block text-xs font-semibold text-muted">Total</span>
            <span className="text-lg font-extrabold font-mono-numbers text-ink">{formatCurrency(total)}</span>
            {mode === 'per_night' && <span className="text-xs font-semibold text-faint"> · {nights}n</span>}
          </div>
          <Button type="button" onClick={() => submit()} loading={loading} variant="solid">
            Check In Guest
          </Button>
        </div>
      }
    >
      <form id="guest-form" onSubmit={submit} className="space-y-3.5 stagger">
        <FormSection icon="user-add" tint="sky" title="Guest">
          <Input label="Guest Name" value={name} onChange={(e) => setName(e.target.value)} leading={<UserRound />} required disabled={loading} />
          <Input label="Phone (optional)" type="tel" inputMode="numeric" value={phone} onChange={(e) => setPhone(e.target.value)} className="font-mono-numbers" disabled={loading} />
        </FormSection>

        <FormSection icon="calendar" tint="violet" title="Stay dates">
          <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2">
            <Input label="Check-in" type="date" value={checkIn} min={today} onChange={(e) => setCheckIn(e.target.value)} disabled={loading} />
            <Input label="Check-out" type="date" value={checkOut} min={checkIn} onChange={(e) => setCheckOut(e.target.value)} disabled={loading} />
          </div>
        </FormSection>

        <FormSection icon="rupee" tint="mint" title="Billing">
          {/* Billing mode toggle */}
          <div role="group" aria-label="Billing" className="flex items-center gap-1 rounded-full bg-lilac-2 p-1 shadow-[inset_0_1px_2px_rgba(70,40,160,0.08)]">
            {(['per_night', 'flat'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                aria-pressed={mode === m}
                className={`inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full text-[13px] font-bold transition-all press ${
                  mode === m
                    ? 'bg-[image:var(--grad-brand)] text-white shadow-[var(--shadow-brand)]'
                    : 'text-muted hover:text-brand-700'
                }`}
              >
                {m === 'per_night' ? <Moon className="h-4 w-4" /> : <Wallet className="h-4 w-4" />}
                {m === 'per_night' ? 'Per Night' : 'Flat Total'}
              </button>
            ))}
          </div>

          {mode === 'per_night' ? (
            <Input label="Rate per night (₹)" type="number" value={rate} onChange={(e) => setRate(e.target.value)} className="font-mono-numbers font-semibold" disabled={loading} />
          ) : (
            <Input label="Total amount (₹)" type="number" value={flat} onChange={(e) => setFlat(e.target.value)} className="font-mono-numbers font-semibold" disabled={loading} />
          )}

          <div className="well divide-y divide-line px-3.5 py-1">
            <KeyValue
              label={
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5 text-faint" /> Nights
                </span>
              }
              value={nights}
            />
            <KeyValue label="Billing" value={mode === 'per_night' ? 'Per Night' : 'Flat Total'} />
            <KeyValue label="Total" value={<span className="text-[15px] text-brand-700">{formatCurrency(total)}</span>} />
          </div>
        </FormSection>

        <InfoBanner
          tone="brand"
          icon="bed-teal"
          title="Guest check-in is quick"
          description="No monthly rent cycle, no deposit, no portal. The bed frees automatically when you check them out."
        />
      </form>
    </Drawer>
  );
}
