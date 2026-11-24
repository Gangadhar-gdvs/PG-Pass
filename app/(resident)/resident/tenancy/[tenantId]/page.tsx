'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { formatCurrency, formatDateIN } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { StatusDot } from '@/components/ui/status-dot';
import toast from 'react-hot-toast';

const STATUS_MAP: Record<string, 'paid' | 'pending' | 'verify'> = {
  paid: 'paid',
  verify: 'verify',
  pending: 'pending',
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
      <div className="space-y-3">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-24" />
        <Skeleton className="h-40" />
      </div>
    );
  }
  if (!data) return <p className="text-sm text-[#64748B]">Could not load this tenancy.</p>;

  const { tenant, rentHistory, deposits, tickets } = data;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold">Your Tenancy</h1>
        <p className="text-xs text-[#64748B]">
          {tenant.roomNumber ? `Room ${tenant.roomNumber} · ` : ''}Bed {tenant.bedLabel || '—'} · since {formatDateIN(tenant.moveInDate)}
        </p>
      </div>

      {/* Deposit */}
      <div className="bg-white border border-[#CCFBF1] rounded-[12px] p-4 shadow-xs flex items-center justify-between">
        <span className="text-xs font-semibold text-[#64748B]">Security Deposit Paid</span>
        <span className="font-bold font-mono-numbers">
          {formatCurrency((tenant.depositPaidPaise || 0) / 100)}
        </span>
      </div>

      {/* Rent history */}
      <section>
        <h2 className="text-sm font-bold mb-2">Payment History</h2>
        <div className="space-y-2">
          {rentHistory.length === 0 && <p className="text-xs text-[#94A3B8]">No rent records yet.</p>}
          {rentHistory.map((r: any) => (
            <div key={r.id} className="bg-white border border-[#E2E8F0] rounded-[10px] p-3 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">{r.period}</div>
                <div className="text-xs text-[#64748B] font-mono-numbers">
                  {formatCurrency((r.amountPaidPaise || 0) / 100)} / {formatCurrency((r.amountDuePaise || 0) / 100)}
                  {r.receiptNumber ? ` · REC-${String(r.receiptNumber).padStart(5, '0')}` : ''}
                </div>
              </div>
              <StatusDot status={STATUS_MAP[r.status] || 'pending'} label={r.status} />
            </div>
          ))}
        </div>
      </section>

      {/* Issues */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-bold">My Issues</h2>
          {!issueOpen && (
            <Button size="sm" variant="outline" onClick={() => setIssueOpen(true)}>
              Raise Issue
            </Button>
          )}
        </div>

        {issueOpen && (
          <form onSubmit={raiseIssue} className="bg-white border border-[#E2E8F0] rounded-[10px] p-3 space-y-2 mb-2">
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              rows={3}
              placeholder="Describe the problem (e.g. leaking tap in bathroom)"
              className="w-full px-3 py-2 rounded-[8px] border border-[#CBD5E1] text-sm focus:border-[#0D9488] focus:outline-none resize-none"
            />
            <div className="flex gap-2">
              <Button type="submit" size="sm" variant="solid" loading={sending} className="flex-1 bg-[#0D9488] hover:bg-[#0F766E]">
                Submit
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setIssueOpen(false)}>
                Cancel
              </Button>
            </div>
          </form>
        )}

        <div className="space-y-2">
          {tickets.length === 0 && <p className="text-xs text-[#94A3B8]">No issues raised.</p>}
          {tickets.map((t: any) => (
            <div key={t.id} className="bg-white border border-[#E2E8F0] rounded-[10px] p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold capitalize">{t.category}</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#F1F5F9] text-[#475569] capitalize">
                  {String(t.status).replace('_', ' ')}
                </span>
              </div>
              <p className="text-xs text-[#64748B] mt-1 break-words">{t.description}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
