'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { formatCurrency, formatDateIN, errorMessage, tsToDate } from '@/lib/utils';
import { HeaderSkeleton, PanelSkeleton } from '@/components/ui/skeletons';
import { Button } from '@/components/ui/button';
import { HeroHeader } from '@/components/ui/dashboard-kit';
import { ArrowLeft, ShieldCheck, Wrench, Star } from 'lucide-react';
import { RateStaffSection } from '@/components/resident/RateStaffSection';
import type { Tenant, RentRecord, MaintenanceTicket, Notice } from '@/types';
import toast from 'react-hot-toast';

const STATUS_STYLE: Record<string, string> = {
  paid: 'bg-[#D1FAE5] text-[#065F46]',
  verify: 'bg-[#E0E7FF] text-[#4338CA]',
  pending: 'bg-[#FEF3C7] text-[#92400E]',
};

interface TenancyStaffRow {
  uid: string;
  name: string;
  ratingAvg: number;
  ratingCount: number;
}

interface TenancyData {
  tenant: Tenant;
  rentHistory: RentRecord[];
  tickets: MaintenanceTicket[];
  staff: TenancyStaffRow[];
}

export default function TenancyDetail() {
  const params = useParams();
  const tenantId = params.tenantId as string;
  const [data, setData] = useState<TenancyData | null>(null);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [issueOpen, setIssueOpen] = useState(false);
  const [desc, setDesc] = useState('');
  const [sending, setSending] = useState(false);
  const [pgRating, setPgRating] = useState(0);
  const [pgText, setPgText] = useState('');
  const [pgOpen, setPgOpen] = useState(false);
  const [pgBusy, setPgBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [res, nRes] = await Promise.all([
        fetch(`/api/resident/tenancy/${tenantId}`),
        fetch(`/api/resident/tenancy/${tenantId}/notices`),
      ]);
      if (res.ok) setData((await res.json()) as TenancyData);
      if (nRes.ok) {
        const nd = await nRes.json();
        setNotices(nd.notices || []);
      }
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    // Defer so setState runs after commit, not in the effect body (cascading-render lint rule).
    let active = true;
    queueMicrotask(() => {
      if (active) load();
    });
    return () => {
      active = false;
    };
  }, [load]);

  const raiseIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending || desc.trim().length < 3) return;
    setSending(true);
    try {
      const res = await fetch(`/api/resident/tenancy/${tenantId}/issue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: desc.trim() }),
      });
      if (!res.ok) throw new Error('Could not submit');
      toast.success('Issue reported');
      setDesc('');
      setIssueOpen(false);
      await load();
    } catch (e: unknown) {
      toast.error(errorMessage(e, 'Could not submit'));
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3 pt-4">
        <HeaderSkeleton action={false} />
        <PanelSkeleton height="h-20" />
        <PanelSkeleton height="h-40" />
      </div>
    );
  }
  if (!data) return <p className="text-sm text-slate-500 pt-6">Could not load this tenancy.</p>;

  const { tenant, rentHistory, tickets, staff } = data;

  const submitPgReview = async () => {
    if (pgRating < 1) {
      toast.error('Pick a star rating');
      return;
    }
    setPgBusy(true);
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ownerId: tenant.ownerId,
          propertyId: tenant.propertyId,
          rating: pgRating,
          text: pgText.trim() || undefined,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Could not submit review');
      toast.success('Thanks for reviewing your PG!');
      setPgOpen(false);
      setPgText('');
      setPgRating(0);
    } catch (e: unknown) {
      toast.error(errorMessage(e, 'Could not submit review'));
    } finally {
      setPgBusy(false);
    }
  };

  return (
    <div className="space-y-5 pt-4">
      <Link href="/resident/home" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 press">
        <ArrowLeft className="w-4 h-4" /> My PGs
      </Link>

      <HeroHeader
        eyebrow="Your Tenancy"
        title={tenant.ownerName || 'Your Tenancy'}
        subtitle={`${tenant.roomNumber ? `Room ${tenant.roomNumber} · ` : ''}Bed ${tenant.bedLabel || '—'} · since ${formatDateIN(tenant.moveInDate)}`}
      >
        <div className="rounded-[16px] bg-white/15 backdrop-blur-sm px-4 py-3 flex items-center gap-3">
          <div className="w-11 h-11 rounded-[14px] bg-white/20 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <div className="text-[11px] font-bold uppercase tracking-wider text-white/80">Security Deposit</div>
            <div className="font-extrabold font-mono-numbers text-lg text-white">
              {formatCurrency((tenant.depositPaidPaise || 0) / 100)}
            </div>
          </div>
        </div>
      </HeroHeader>

      {/* Notices from the PG owner */}
      {notices.length > 0 && (
        <section>
          <h2 className="text-sm font-extrabold text-slate-900 mb-2 px-1">Notices</h2>
          <div className="space-y-2">
            {notices.map((n) => (
              <div key={n.id} className="app-card p-3.5">
                <div className="flex items-center gap-2 flex-wrap">
                  {n.pinned && <span className="text-[10px] font-bold accent-text accent-soft-bg px-1.5 py-0.5 rounded">PINNED</span>}
                  <h3 className="text-sm font-bold text-slate-900">{n.title}</h3>
                </div>
                <p className="mt-1 text-xs text-slate-600 whitespace-pre-wrap break-words">{n.body}</p>
                <p className="mt-1.5 text-[11px] text-slate-400">{formatDateIN(tsToDate(n.createdAt))}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Rent history */}
      <section>
        <h2 className="text-sm font-extrabold text-slate-900 mb-2 px-1">Payment History</h2>
        <div className="space-y-2 stagger">
          {rentHistory.length === 0 && <p className="text-xs text-slate-400 px-1">No rent records yet.</p>}
          {rentHistory.map((r) => (
            <div key={r.id} className="app-card p-3.5 flex items-center justify-between">
              <div>
                <div className="text-sm font-bold text-slate-900">{r.period}</div>
                <div className="text-xs text-slate-500 font-mono-numbers mt-0.5">
                  {formatCurrency((r.amountPaidPaise || 0) / 100)} / {formatCurrency((r.amountDuePaise || 0) / 100)}
                  {r.receiptNumber ? ` · REC-${String(r.receiptNumber).padStart(5, '0')}` : ''}
                </div>
              </div>
              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full capitalize ${STATUS_STYLE[r.status] || STATUS_STYLE.pending}`}>
                {r.status}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Review this PG */}
      <section>
        <div className="flex items-center justify-between mb-2 px-1">
          <h2 className="text-sm font-extrabold text-slate-900">Review this PG</h2>
          {!pgOpen && (
            <button onClick={() => setPgOpen(true)} className="text-xs font-bold accent-text press">
              + Write
            </button>
          )}
        </div>
        {pgOpen && (
          <div className="app-card p-3.5 space-y-2 animate-pop">
            <div className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" onClick={() => setPgRating(n)} className="cursor-pointer" aria-label={`${n} star`}>
                  <Star className={`w-6 h-6 ${n <= pgRating ? 'fill-amber-500 text-amber-500' : 'text-slate-300'}`} />
                </button>
              ))}
            </div>
            <textarea
              value={pgText}
              onChange={(e) => setPgText(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="How is your stay? Cleanliness, food, staff, value…"
              className="w-full px-3 py-2.5 rounded-[12px] border-2 border-slate-200 text-sm focus:border-[color:var(--accent)] focus:outline-none resize-none"
            />
            <div className="flex gap-2">
              <Button type="button" size="md" variant="solid" loading={pgBusy} onClick={submitPgReview} className="flex-1">
                Post Review
              </Button>
              <Button type="button" size="md" variant="outline" onClick={() => setPgOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </section>

      {/* Rate individual staff */}
      <RateStaffSection staff={staff || []} />

      {/* Issues */}
      <section>
        <div className="flex items-center justify-between mb-2 px-1">
          <h2 className="text-sm font-extrabold text-slate-900">My Issues</h2>
          {!issueOpen && (
            <button onClick={() => setIssueOpen(true)} className="text-xs font-bold accent-text press">
              + Raise
            </button>
          )}
        </div>

        {issueOpen && (
          <form onSubmit={raiseIssue} className="app-card p-3.5 space-y-2 mb-2 animate-pop">
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              rows={3}
              placeholder="Describe the problem (e.g. leaking tap in bathroom)"
              className="w-full px-3 py-2.5 rounded-[12px] border-2 border-slate-200 text-sm focus:border-[color:var(--accent)] focus:outline-none resize-none"
            />
            <div className="flex gap-2">
              <Button type="submit" size="md" variant="solid" loading={sending} className="flex-1">
                Submit Issue
              </Button>
              <Button type="button" size="md" variant="outline" onClick={() => setIssueOpen(false)}>
                Cancel
              </Button>
            </div>
          </form>
        )}

        <div className="space-y-2 stagger">
          {tickets.length === 0 && <p className="text-xs text-slate-400 px-1">No issues raised.</p>}
          {tickets.map((t) => (
            <div key={t.id} className="app-card p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold capitalize flex items-center gap-1.5 text-slate-900">
                  <Wrench className="w-3.5 h-3.5 text-slate-400" />
                  {t.category}
                </span>
                <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 capitalize">
                  {String(t.status).replace('_', ' ')}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1.5 break-words">{t.description}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
