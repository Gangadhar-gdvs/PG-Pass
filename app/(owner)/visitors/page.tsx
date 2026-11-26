'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useOwnerSession } from '@/hooks/useOwner';
import { HeroHeader } from '@/components/ui/dashboard-kit';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CardListSkeleton } from '@/components/ui/skeletons';
import { EmptyState } from '@/components/ui/empty-state';
import { DoorOpen, Plus, LogOut } from 'lucide-react';
import type { Visitor } from '@/types';
import { errorMessage, tsToDate } from '@/lib/utils';
import toast from 'react-hot-toast';

function timeLabel(v: unknown): string {
  const d = tsToDate(v as never);
  return d ? d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true }) : '';
}

export default function OwnerVisitorsPage() {
  const { ownerId } = useOwnerSession();
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [purpose, setPurpose] = useState('');
  const [visiting, setVisiting] = useState('');
  const [phone, setPhone] = useState('');
  const [posting, setPosting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/visitors');
      if (res.ok) setVisitors((await res.json()).visitors || []);
    } catch {
      /* non-fatal */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!ownerId) return;
    let active = true;
    queueMicrotask(() => {
      if (active) load();
    });
    return () => {
      active = false;
    };
  }, [ownerId, load]);

  const checkIn = async () => {
    if (!name.trim()) {
      toast.error('Enter the visitor name');
      return;
    }
    setPosting(true);
    try {
      const res = await fetch('/api/visitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          purpose: purpose.trim() || undefined,
          visitingResident: visiting.trim() || undefined,
          phone: phone.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not check in');
      toast.success('Visitor checked in');
      setName('');
      setPurpose('');
      setVisiting('');
      setPhone('');
      setShowForm(false);
      load();
    } catch (e: unknown) {
      toast.error(errorMessage(e, 'Could not check in visitor'));
    } finally {
      setPosting(false);
    }
  };

  const checkOut = async (id: string) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/visitors/${id}/checkout`, { method: 'POST' });
      if (!res.ok) throw new Error('failed');
      setVisitors((prev) => prev.map((v) => (v.id === id ? { ...v, status: 'out' } : v)));
    } catch {
      toast.error('Could not check out');
    } finally {
      setBusyId(null);
    }
  };

  const inside = visitors.filter((v) => v.status === 'in');

  return (
    <div className="space-y-4 text-left">
      <div className="-mx-4 -mt-4 sm:-mx-6 md:mx-0 md:mt-0">
        <HeroHeader
          eyebrow={<><DoorOpen className="h-3 w-3" /> Visitors</>}
          title="Visitor Log"
          subtitle={`${inside.length} currently inside`}
          right={
            <button
              type="button"
              onClick={() => setShowForm((s) => !s)}
              className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-bold accent-text shadow-sm press"
            >
              <Plus className="h-3.5 w-3.5" /> Check in
            </button>
          }
        />
      </div>

      {showForm && (
        <section className="app-card p-4 space-y-3">
          <Input label="Visitor name" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} disabled={posting} />
          <div className="grid grid-cols-2 gap-2">
            <Input label="Purpose (optional)" placeholder="e.g. Delivery" value={purpose} onChange={(e) => setPurpose(e.target.value)} disabled={posting} />
            <Input label="Visiting (optional)" placeholder="Resident name" value={visiting} onChange={(e) => setVisiting(e.target.value)} disabled={posting} />
          </div>
          <Input label="Phone (optional)" type="tel" inputMode="numeric" placeholder="10-digit mobile" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={posting} />
          <Button size="sm" variant="solid" loading={posting} onClick={checkIn}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Check in visitor
          </Button>
        </section>
      )}

      {loading ? (
        <CardListSkeleton rows={3} height="h-16" />
      ) : visitors.length === 0 ? (
        <div className="app-card p-6">
          <EmptyState
            icon={<DoorOpen className="w-6 h-6 accent-text" />}
            title="No visitors logged"
            description="Record visitors at the gate — who they are and who they’re visiting."
            action={<Button size="sm" variant="solid" onClick={() => setShowForm(true)}><Plus className="h-3.5 w-3.5 mr-1" /> Check in</Button>}
          />
        </div>
      ) : (
        <div className="space-y-2">
          {visitors.map((v) => {
            const isIn = v.status === 'in';
            return (
              <div key={v.id} className={`app-card p-3.5 flex items-center gap-3 ${isIn ? '' : 'opacity-70'}`}>
                <span className={`icon-chip ${isIn ? 'accent-text' : 'text-[#94A3B8]'}`}>
                  <DoorOpen className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-[#0F172A] truncate">
                    {v.name}
                    {isIn ? (
                      <span className="ml-2 text-[10px] font-bold text-[#0F766E] bg-[#E7F9F1] px-1.5 py-0.5 rounded">INSIDE</span>
                    ) : (
                      <span className="ml-2 text-[10px] font-bold text-[#94A3B8] bg-[#F1F5F9] px-1.5 py-0.5 rounded">LEFT</span>
                    )}
                  </div>
                  <div className="text-[11px] text-[#64748B] truncate">
                    {[v.purpose, v.visitingResident ? `visiting ${v.visitingResident}` : ''].filter(Boolean).join(' · ') || '—'}
                  </div>
                  <div className="text-[11px] text-[#94A3B8]">
                    In {timeLabel(v.checkInAt)}{!isIn && v.checkOutAt ? ` · Out ${timeLabel(v.checkOutAt)}` : ''}
                  </div>
                </div>
                {isIn && (
                  <button
                    type="button"
                    onClick={() => checkOut(v.id)}
                    disabled={busyId === v.id}
                    className="shrink-0 inline-flex items-center gap-1 text-[11px] font-bold accent-text px-2.5 py-1.5 rounded-[8px] border border-[color:var(--accent)]"
                  >
                    <LogOut className="h-3.5 w-3.5" /> Out
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
