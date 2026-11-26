'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useOwnerSession } from '@/hooks/useOwner';
import { formatDateIN, tsToDate, errorMessage } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { CardListSkeleton, StatGridSkeleton } from '@/components/ui/skeletons';
import { EmptyState } from '@/components/ui/empty-state';
import { FilterChips, PageHeader, StatTile } from '@/components/ui/dashboard-kit';
import { IconBubble, type Icon3DName, type Tint } from '@/components/brand/Icon3D';
import { CalendarDays, Check, CheckCircle2, Play, UserRound } from 'lucide-react';
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

/** Presentation only: 3D icon + tint per ticket category. */
const CATEGORY_VISUAL: Record<string, { icon: Icon3DName; tint: Tint }> = {
  plumbing: { icon: 'wrench', tint: 'sky' },
  electrical: { icon: 'bolt', tint: 'amber' },
  wifi: { icon: 'home-blue', tint: 'indigo' },
  furniture: { icon: 'bed', tint: 'violet' },
  cleaning: { icon: 'tools', tint: 'mint' },
  appliance: { icon: 'tools-purple', tint: 'rose' },
  other: { icon: 'wrench-orange', tint: 'peach' },
};

const STATUS_META: Record<MaintenanceStatus, { label: string; badge: NonNullable<BadgeProps['variant']> }> = {
  open: { label: 'Open', badge: 'pending' },
  in_progress: { label: 'In progress', badge: 'verify' },
  resolved: { label: 'Resolved', badge: 'paid' },
};

const STEPS: MaintenanceStatus[] = ['open', 'in_progress', 'resolved'];

/**
 * Open → In progress → Resolved track: three equal violet pill segments with
 * labels, so it fits a 320px phone. Decorative — the badge carries the status text.
 */
function TicketProgress({ status }: { status: MaintenanceStatus }) {
  const current = STEPS.indexOf(status);
  return (
    <div className="grid grid-cols-3 gap-1.5" aria-hidden="true">
      {STEPS.map((s, i) => {
        const reached = i <= current;
        const complete = i < current || (s === 'resolved' && reached);
        return (
          <div key={s} className="min-w-0 space-y-1.5">
            <span
              className={`block h-2 rounded-full ${
                reached ? 'bg-[image:var(--grad-brand)]' : 'bg-brand-100'
              }`}
            />
            <span
              className={`flex min-w-0 items-center gap-1 text-[11px] font-bold leading-none ${
                reached ? 'text-brand-700' : 'text-faint'
              }`}
            >
              {complete ? (
                <Check className="h-3 w-3 shrink-0" strokeWidth={3} />
              ) : (
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${reached ? 'bg-brand' : 'bg-brand-200'}`} />
              )}
              <span className="truncate">{STATUS_META[s].label}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

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
    if (!ownerId) return;
    // Defer so setState runs after commit, not in the effect body (cascading-render lint rule).
    let active = true;
    queueMicrotask(() => {
      if (active) load();
    });
    return () => {
      active = false;
    };
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
    } catch (e: unknown) {
      toast.error(errorMessage(e, 'Could not update ticket'));
    } finally {
      setBusyId(null);
    }
  };

  const openCount = tickets.filter((t) => t.status === 'open').length;

  // Display-only counts of the tickets loaded for the current filter. A status
  // that the current filter excludes shows "—" rather than a misleading 0.
  const countFor = (s: MaintenanceStatus): number | string =>
    filter === 'all' || filter === s ? tickets.filter((t) => t.status === s).length : '—';

  return (
    <div className="space-y-5">
      <PageHeader
        icon="wrench"
        tint="sky"
        title="Maintenance"
        highlight="& Complaints"
        subtitle={`Issues raised by your residents${openCount > 0 ? ` · ${openCount} open` : ''}.`}
      />

      {loading ? (
        <StatGridSkeleton count={4} />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 stagger">
          <StatTile
            icon="tools-purple"
            tint="violet"
            label={filter === 'all' ? 'All Tickets' : 'Showing'}
            value={tickets.length}
          />
          <StatTile icon="alert" tint="peach" label="Open" value={countFor('open')} />
          <StatTile icon="wrench" tint="sky" label="In Progress" value={countFor('in_progress')} />
          <StatTile icon="check" tint="mint" label="Resolved" value={countFor('resolved')} />
        </div>
      )}

      <FilterChips<'all' | MaintenanceStatus>
        options={[
          { value: 'all', label: 'All' },
          { value: 'open', label: 'Open' },
          { value: 'in_progress', label: 'In Progress' },
          { value: 'resolved', label: 'Resolved' },
        ]}
        value={filter}
        onChange={setFilter}
      />

      {loading ? (
        <CardListSkeleton rows={4} height="h-52" cols={2} />
      ) : tickets.length === 0 ? (
        <div className="app-card">
          <EmptyState
            icon3d="wrench"
            title="No tickets here"
            description="When residents raise maintenance issues from their portal, they'll show up here."
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 stagger">
          {tickets.map((t) => {
            const v = CATEGORY_VISUAL[t.category] || CATEGORY_VISUAL.other;
            const meta = STATUS_META[t.status];
            const created = formatDateIN(tsToDate(t.createdAt));
            return (
              <article key={t.id} className="app-card flex flex-col gap-3.5 p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <IconBubble icon={v.icon} tint={v.tint} size={48} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-[15px] font-bold leading-snug text-ink">
                        {CATEGORY_LABELS[t.category] || 'Issue'}
                      </h3>
                      <Badge variant={meta.badge} dot className="shrink-0">
                        {meta.label}
                      </Badge>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex min-w-0 items-center gap-1 text-[12.5px] font-medium text-muted">
                        <UserRound className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">
                          {t.tenantName || 'Resident'}
                          {t.bedLabel ? ` · ${t.bedLabel}` : ''}
                        </span>
                      </span>
                      {created && (
                        <span className="chip font-mono-numbers">
                          <CalendarDays className="h-3.5 w-3.5" />
                          {created}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <p className="well px-3.5 py-2.5 text-[13px] leading-relaxed text-ink-2 break-words">
                  {t.description}
                </p>

                <TicketProgress status={t.status} />

                {t.status !== 'resolved' && (
                  <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3.5">
                    {t.status === 'open' && (
                      <Button
                        variant="outline"
                        className="flex-1"
                        disabled={busyId === t.id}
                        onClick={() => transition(t, 'in_progress')}
                      >
                        <Play className="h-4 w-4" />
                        Start
                      </Button>
                    )}
                    <Button
                      variant="success"
                      className="flex-1"
                      disabled={busyId === t.id}
                      onClick={() => transition(t, 'resolved')}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Mark Resolved
                    </Button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
