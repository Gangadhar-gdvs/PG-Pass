'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useOwnerSession } from '@/hooks/useOwner';
import { formatDateIN } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { CardListSkeleton } from '@/components/ui/skeletons';
import { EmptyState } from '@/components/ui/empty-state';
import { TabBar } from '@/components/ui/tab-bar';
import { Wrench } from 'lucide-react';
import toast from 'react-hot-toast';
import type { MaintenanceTicket, MaintenanceStatus } from '@/types';

const CATEGORY_LABELS: Record<string, string> = {
  plumbing: 'Plumbing',
  electrical: 'Electrical',
  wifi: 'WiFi / Internet',
  furniture: 'Furniture',
  cleaning: 'Cleaning',
  appliance: 'Appliance',
  other: 'Other',
};

const STATUS_STYLES: Record<MaintenanceStatus, string> = {
  open: 'bg-[#FEF3C7] text-[#92400E]',
  in_progress: 'bg-[#E0E7FF] text-[#4338CA]',
  resolved: 'bg-[#D1FAE5] text-[#065F46]',
};

export default function MaintenancePage() {
  const { ownerId } = useOwnerSession();
  const [tickets, setTickets] = useState<MaintenanceTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | MaintenanceStatus>('all');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = filter === 'all' ? '' : `?status=${filter}`;
      const res = await fetch(`/api/maintenance${qs}`);
      if (res.ok) {
        const data = await res.json();
        setTickets(data.tickets || []);
      }
    } catch {
      /* non-fatal */
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    if (ownerId) load();
  }, [ownerId, load]);

  const transition = async (ticket: MaintenanceTicket, status: MaintenanceStatus) => {
    if (busyId) return;
    setBusyId(ticket.id);
    try {
      const res = await fetch(`/api/maintenance/${ticket.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Could not update ticket');
      }
      toast.success(status === 'resolved' ? 'Marked resolved' : 'Marked in progress');
      await load();
    } catch (e: any) {
      toast.error(e.message || 'Could not update ticket');
    } finally {
      setBusyId(null);
    }
  };

  const openCount = tickets.filter((t) => t.status === 'open').length;

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-[8px] bg-[#FEF3C7] border border-[#FDE68A] text-[#D97706] flex items-center justify-center shrink-0">
          <Wrench className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-[#09090B]">Maintenance & Complaints</h1>
          <p className="text-xs text-[#64748B]">
            Issues raised by your residents{openCount > 0 ? ` · ${openCount} open` : ''}.
          </p>
        </div>
      </div>

      <TabBar
        tabs={[
          { id: 'all', label: 'All' },
          { id: 'open', label: 'Open' },
          { id: 'in_progress', label: 'In Progress' },
          { id: 'resolved', label: 'Resolved' },
        ]}
        activeTab={filter}
        onChange={(id) => setFilter(id as any)}
        variant="pill"
      />

      {loading ? (
        <CardListSkeleton rows={4} height="h-24" />
      ) : tickets.length === 0 ? (
        <EmptyState
          icon={<Wrench className="w-6 h-6 text-[#64748B]" />}
          title="No tickets here"
          description="When residents raise maintenance issues from their portal, they'll show up here."
        />
      ) : (
        <div className="space-y-3">
          {tickets.map((t) => (
            <div key={t.id} className="bg-white border border-[#E2E8F0] rounded-[12px] p-4 shadow-xs">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-[#09090B]">
                      {CATEGORY_LABELS[t.category] || 'Issue'}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_STYLES[t.status]}`}>
                      {t.status.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-xs text-[#334155] mt-1.5 break-words">{t.description}</p>
                  <p className="text-[11px] text-[#94A3B8] mt-1.5">
                    {t.tenantName || 'Resident'}
                    {t.bedLabel ? ` · ${t.bedLabel}` : ''} · {formatDateIN(t.createdAt?.toDate?.() || t.createdAt)}
                  </p>
                </div>
              </div>

              {t.status !== 'resolved' && (
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[#F1F5F9]">
                  {t.status === 'open' && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyId === t.id}
                      onClick={() => transition(t, 'in_progress')}
                    >
                      Start
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="solid"
                    className="bg-[#10B981] hover:bg-[#059669]"
                    disabled={busyId === t.id}
                    onClick={() => transition(t, 'resolved')}
                  >
                    Mark Resolved
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
