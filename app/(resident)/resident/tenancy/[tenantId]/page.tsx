'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { formatCurrency, formatDateIN } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ShieldCheck, Wrench } from 'lucide-react';
import toast from 'react-hot-toast';

const STATUS_STYLE: Record<string, string> = {
  paid: 'bg-[#D1FAE5] text-[#065F46]',
  verify: 'bg-[#E0E7FF] text-[#4338CA]',
  pending: 'bg-[#FEF3C7] text-[#92400E]',
};

export default function TenancyDetail() {
  const params = useParams();
  const tenantId = params.tenantId as string;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [issueOpen, setIssueOpen] = useState(false);
  const [desc, setDesc] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/resident/tenancy/${tenantId}`);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    load();
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
    } catch (e: any) {
      toast.error(e.message || 'Could not submit');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3 pt-4">
        <Skeleton className="h-7 w-40 rounded-xl" />
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-40 rounded-2xl" />
      </div>
    );
  }
  if (!data) return <p className="text-sm text-slate-500 pt-6">Could not load this tenancy.</p>;

  const { tenant, rentHistory, tickets } = data;

  return (
    <div className="space-y-5 pt-4">
      <Link href="/resident/home" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 press">
        <ArrowLeft className="w-4 h-4" /> My PGs
      </Link>

      <div>
        <h1 className="text-xl font-extrabold text-slate-900">Your Tenancy</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          {tenant.roomNumber ? `Room ${tenant.roomNumber} · ` : ''}Bed {tenant.bedLabel || '—'} · since{' '}
          {formatDateIN(tenant.moveInDate)}
        </p>
      </div>

      {/* Deposit card */}
      <div className="app-card p-4 flex items-center gap-3">
        <div className="w-11 h-11 rounded-[14px] accent-soft-bg flex items-center justify-center">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Security Deposit</div>
          <div className="font-extrabold font-mono-numbers text-lg text-slate-900">
            {formatCurrency((tenant.depositPaidPaise || 0) / 100)}
          </div>
        </div>
      </div>

      {/* Rent history */}
      <section>
        <h2 className="text-sm font-extrabold text-slate-900 mb-2 px-1">Payment History</h2>
        <div className="space-y-2 stagger">
          {rentHistory.length === 0 && <p className="text-xs text-slate-400 px-1">No rent records yet.</p>}
          {rentHistory.map((r: any) => (
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
          {tickets.map((t: any) => (
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
