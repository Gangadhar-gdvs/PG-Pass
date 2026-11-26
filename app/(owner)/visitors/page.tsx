'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useOwnerSession } from '@/hooks/useOwner';
import { PageHeader, SectionCard, StatTile } from '@/components/ui/dashboard-kit';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { ListSkeleton, StatGridSkeleton } from '@/components/ui/skeletons';
import { EmptyState } from '@/components/ui/empty-state';
import { Plus, LogOut, LogIn, Phone, UserRound } from 'lucide-react';
import type { Visitor } from '@/types';
import { errorMessage, tsToDate } from '@/lib/utils';
import toast from 'react-hot-toast';

function timeLabel(v: unknown): string {
  const d = tsToDate(v as never);
  return d ? d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true }) : '';
}

/** Local YYYY-MM-DD key (display only — powers the "Today" tile). */
function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function OwnerVisitorsPage() {
  const { ownerId } = useOwnerSession();
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [today] = useState(() => dayKey(new Date()));

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
  // Display-only: check-ins whose date is today (local time).
  const todayCount = visitors.filter((v) => {
    const d = tsToDate(v.checkInAt);
    return d ? dayKey(d) === today : false;
  }).length;

  return (
    <div className="space-y-5 text-left">
      <PageHeader
        icon="user-add"
        tint="sky"
        title="Visitor"
        highlight="Log"
        subtitle={`${inside.length} currently inside`}
        actions={
          <Button onClick={() => setShowForm((s) => !s)} aria-expanded={showForm}>
            <Plus className="h-4 w-4" /> Check in
          </Button>
        }
      />

      {loading ? (
        <StatGridSkeleton count={4} />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 stagger">
          <StatTile icon="user-add" tint="sky" label="Inside Now" value={inside.length} />
          <StatTile icon="calendar-clock" tint="violet" label="Today" value={todayCount} />
          <StatTile icon="check" tint="mint" label="Checked Out" value={visitors.length - inside.length} />
          <StatTile icon="users" tint="indigo" label="Total Logged" value={visitors.length} />
        </div>
      )}

      {showForm && (
        <SectionCard title="Check in a visitor" icon="user-add" className="animate-pop" bodyClassName="space-y-4">
          <Input
            label="Visitor name"
            placeholder="Full name"
            leading={<UserRound />}
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={posting}
          />
          <div className="grid grid-cols-1 min-[380px]:grid-cols-2 gap-3">
            <Input label="Purpose (optional)" placeholder="e.g. Delivery" value={purpose} onChange={(e) => setPurpose(e.target.value)} disabled={posting} />
            <Input label="Visiting (optional)" placeholder="Resident name" value={visiting} onChange={(e) => setVisiting(e.target.value)} disabled={posting} />
          </div>
          <Input
            label="Phone (optional)"
            type="tel"
            inputMode="numeric"
            placeholder="10-digit mobile"
            leading={<Phone />}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={posting}
          />
          <div className="flex justify-end">
            <Button variant="solid" loading={posting} onClick={checkIn} className="w-full sm:w-auto">
              <Plus className="h-4 w-4" /> Check in visitor
            </Button>
          </div>
        </SectionCard>
      )}

      {loading ? (
        <ListSkeleton rows={4} />
      ) : visitors.length === 0 ? (
        <div className="app-card">
          <EmptyState
            icon3d="user-add"
            title="No visitors logged"
            description="Record visitors at the gate — who they are and who they’re visiting."
            action={
              <Button variant="solid" onClick={() => setShowForm(true)}>
                <Plus className="h-4 w-4" /> Check in
              </Button>
            }
          />
        </div>
      ) : (
        <SectionCard
          title="Visitor log"
          icon="calendar-clock"
          action={<span className="chip font-mono-numbers">{visitors.length}</span>}
        >
          <ul className="divide-y divide-line stagger">
            {visitors.map((v) => {
              const isIn = v.status === 'in';
              return (
                <li key={v.id} className="py-3.5 first:pt-1 last:pb-1">
                  <div className={`flex items-center gap-3 ${isIn ? '' : 'opacity-75'}`}>
                    <Avatar name={v.name} size="lg" />
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-[15px] font-bold text-ink">{v.name}</span>
                        <Badge variant={isIn ? 'paid' : 'vacant'} dot className="shrink-0">
                          {isIn ? 'Inside' : 'Left'}
                        </Badge>
                      </div>
                      <div className="truncate text-[12.5px] font-medium text-muted">
                        {[v.purpose, v.visitingResident ? `visiting ${v.visitingResident}` : ''].filter(Boolean).join(' · ') || '—'}
                      </div>
                    </div>
                  </div>

                  <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                    <div className={`flex flex-wrap items-center gap-1.5 ${isIn ? '' : 'opacity-75'}`}>
                      <span className="chip font-mono-numbers">
                        <LogIn className="h-3.5 w-3.5" /> In {timeLabel(v.checkInAt)}
                      </span>
                      {!isIn && v.checkOutAt ? (
                        <span className="chip font-mono-numbers">
                          <LogOut className="h-3.5 w-3.5" /> Out {timeLabel(v.checkOutAt)}
                        </span>
                      ) : null}
                    </div>
                    {isIn && (
                      <Button
                        variant="outline"
                        onClick={() => checkOut(v.id)}
                        disabled={busyId === v.id}
                        className="ml-auto"
                      >
                        <LogOut className="h-4 w-4" /> Check out
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </SectionCard>
      )}
    </div>
  );
}
