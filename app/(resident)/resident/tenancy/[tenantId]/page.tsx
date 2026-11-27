'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { formatCurrency, formatDateIN, errorMessage, tsToDate, todayIST } from '@/lib/utils';
import { apiGet, apiPost } from '@/lib/client/api';
import { StatCardSkeleton, PanelSkeleton } from '@/components/ui/skeletons';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import {
  HeroHeader,
  PageHeader,
  StatTile,
  InfoBanner,
  QuickActionGrid,
  SectionCard,
  ActivityRow,
} from '@/components/ui/dashboard-kit';
import { Icon3D, IconBubble, type Icon3DName, type Tint } from '@/components/brand/Icon3D';
import { ArrowLeft, ArrowRight, Star, Plus, Clock, Building2, CalendarDays, Pin } from 'lucide-react';
import { RateStaffSection } from '@/components/resident/RateStaffSection';
import type { Tenant, RentRecord, MaintenanceTicket, Notice } from '@/types';
import toast from 'react-hot-toast';

type BadgeVariant = NonNullable<BadgeProps['variant']>;

const RENT_STATUS: Record<string, { badge: BadgeVariant; label: string; icon: Icon3DName; tint: Tint }> = {
  paid: { badge: 'paid', label: 'Paid', icon: 'check', tint: 'mint' },
  verify: { badge: 'verify', label: 'Verifying', icon: 'clock', tint: 'violet' },
  pending: { badge: 'pending', label: 'Pending', icon: 'alert', tint: 'peach' },
};

const TICKET_BADGE: Record<string, BadgeVariant> = {
  open: 'pending',
  in_progress: 'verify',
  resolved: 'paid',
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** "2026-11" → "Nov 2026" (falls back to the raw value). */
function formatPeriod(period?: string): string {
  if (!period) return '—';
  const m = /^(\d{4})-(\d{2})$/.exec(period);
  if (!m) return period;
  return `${MONTHS[Number(m[2]) - 1] ?? m[2]} ${m[1]}`;
}

/** Whole days from `fromISO` to `toISO` (both YYYY-MM-DD). */
function daysBetween(fromISO: string, toISO: string): number {
  return Math.round((Date.parse(`${toISO}T00:00:00Z`) - Date.parse(`${fromISO}T00:00:00Z`)) / 86_400_000);
}

const remainingPaise = (r: RentRecord) => Math.max(0, (r.amountDuePaise || 0) - (r.amountPaidPaise || 0));

/** Scroll to an existing section on this page (quick actions / banner). */
function scrollToSection(id: string) {
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  document.getElementById(id)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
}

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
  // Today's local date (YYYY-MM-DD), read once — used only for due-date display.
  const [today] = useState(() => todayIST());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Tenancy is primary; notices are best-effort (a failure there doesn't
      // blank the page).
      const [tenancy, noticeData] = await Promise.all([
        apiGet<TenancyData>(`/api/resident/tenancy/${tenantId}`).catch(() => null),
        apiGet<{ notices?: typeof notices }>(`/api/resident/tenancy/${tenantId}/notices`).catch(() => null),
      ]);
      if (tenancy) setData(tenancy);
      if (noticeData) setNotices(noticeData.notices || []);
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
      await apiPost(`/api/resident/tenancy/${tenantId}/issue`, { description: desc.trim() });
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
      <div className="space-y-5 pt-2" aria-busy="true">
        <Skeleton className="h-11 w-28 rounded-full" />
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2.5 pt-2">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-8 w-44" />
            <Skeleton className="h-4 w-40 rounded-full" />
          </div>
          <Skeleton className="h-28 w-36 rounded-[28px]" />
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>
        <PanelSkeleton height="h-24" />
        <PanelSkeleton height="h-44" />
      </div>
    );
  }
  if (!data) {
    return (
      <div className="pt-4">
        <div className="app-card p-2">
          <EmptyState
            icon3d="alert"
            title="Could not load this tenancy."
            action={
              <Link href="/resident/home" className="btn-soft">
                <ArrowLeft className="h-4 w-4" /> My PGs
              </Link>
            }
          />
        </div>
      </div>
    );
  }

  const { tenant, rentHistory, tickets, staff } = data;

  const submitPgReview = async () => {
    if (pgRating < 1) {
      toast.error('Pick a star rating');
      return;
    }
    setPgBusy(true);
    try {
      await apiPost('/api/reviews', {
        ownerId: tenant.ownerId,
        propertyId: tenant.propertyId,
        rating: pgRating,
        text: pgText.trim() || undefined,
      });
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

  /* ---------- Derived display data (no new fetches) ---------- */
  const currentPeriod = today.slice(0, 7);
  const latest: RentRecord | undefined = rentHistory[0];

  let banner: {
    tone: 'success' | 'warning' | 'danger' | 'brand';
    icon: Icon3DName;
    headline: string;
    detail: string;
  } | null = null;
  if (latest) {
    const periodText = latest.period === currentPeriod ? 'this Month' : formatPeriod(latest.period);
    const paid = formatCurrency((latest.amountPaidPaise || 0) / 100);
    if (latest.status === 'paid') {
      banner = {
        tone: 'success',
        icon: 'check',
        headline: `Paid for ${periodText}`,
        detail: `${paid} paid${latest.receiptNumber ? ` · REC-${String(latest.receiptNumber).padStart(5, '0')}` : ''}`,
      };
    } else if (latest.status === 'verify') {
      banner = {
        tone: 'brand',
        icon: 'calendar-clock',
        headline: 'Payment under verification',
        detail: `${formatPeriod(latest.period)} · ${paid} awaiting confirmation from your PG`,
      };
    } else {
      const hasDue = !!latest.dueDate && ISO_DATE.test(latest.dueDate);
      const overdue = hasDue && daysBetween(latest.dueDate as string, today) > 0;
      banner = {
        tone: overdue ? 'danger' : 'warning',
        icon: 'alert',
        headline: overdue ? 'Rent overdue' : `Rent due for ${periodText}`,
        detail: `${formatCurrency(remainingPaise(latest) / 100)}${hasDue ? ` · Due ${formatDateIN(latest.dueDate)}` : ''}`,
      };
    }
  }

  const reminders = rentHistory
    .filter((r) => r.status === 'pending' && !!r.dueDate && ISO_DATE.test(r.dueDate))
    .sort((a, b) => (a.dueDate as string).localeCompare(b.dueDate as string))
    .slice(0, 3);

  return (
    <div className="space-y-5">
      <PageHeader
        back={{ href: '/resident/home', label: 'Back to My PGs' }}
        icon="building"
        tint="violet"
        title="My"
        highlight="Tenancy"
        subtitle={[tenant.roomNumber && `Room ${tenant.roomNumber}`, tenant.bedLabel && `Bed ${tenant.bedLabel}`].filter(Boolean).join(' · ') || 'Your PG'}
      />

      <HeroHeader
        variant="light"
        title="Hello,"
        highlight={
          <>
            {tenant.name || 'there'} <span className="text-ink">👋</span>
          </>
        }
        subtitle="Welcome back to your PG!"
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-white bg-white/85 px-3.5 py-2 text-[13px] font-semibold text-ink shadow-[0_8px_18px_-10px_rgba(70,40,160,0.45)]">
              <Building2 className="h-4 w-4 shrink-0 text-brand" />
              <span className="truncate">{tenant.ownerName || 'Your Tenancy'}</span>
            </span>
            {tenant.moveInDate && (
              <span className="chip font-mono-numbers">
                <CalendarDays className="h-3.5 w-3.5" /> Since {formatDateIN(tenant.moveInDate)}
              </span>
            )}
          </div>
        }
        illustration="hero-resident"
      />

      {/* Room / bed / deposit */}
      <div className="grid grid-cols-3 gap-2.5 sm:gap-3 stagger">
        <StatTile icon="bed" tint="violet" label="Room No." value={<span className="break-all">{tenant.roomNumber || '—'}</span>} />
        <StatTile icon="bed" tint="sky" label="Bed No." value={<span className="break-all">{tenant.bedLabel || '—'}</span>} />
        <StatTile
          icon="wallet"
          tint="mint"
          label="Deposit"
          value={
            <span className="text-[15px] sm:text-[20px]">{formatCurrency((tenant.depositPaidPaise || 0) / 100)}</span>
          }
        />
      </div>

      {/* Rent status */}
      <div id="rent-status" className="scroll-mt-24">
        {banner ? (
          <InfoBanner
            tone={banner.tone}
            icon={<Icon3D name={banner.icon} size={52} />}
            title={
              <>
                <span className="block text-[12.5px] font-bold opacity-75">Rent Status</span>
                <span className="block text-[18px] leading-tight tracking-[-0.015em]">{banner.headline}</span>
              </>
            }
            description={<span className="font-mono-numbers">{banner.detail}</span>}
            action={
              <button
                type="button"
                onClick={() => scrollToSection('payments')}
                className="inline-flex h-11 items-center gap-1.5 rounded-full bg-white px-4 text-[13px] font-bold text-brand-700 shadow-[0_10px_20px_-10px_rgba(30,10,90,0.45)] press"
              >
                View Details <ArrowRight className="h-4 w-4" strokeWidth={2.4} />
              </button>
            }
            className="animate-pop"
          />
        ) : (
          <InfoBanner tone="info" title="Rent Status" description="No rent records yet." />
        )}
      </div>

      {/* The kit's list layout goes 2-up from 380px, which leaves the label
          ~40px wide on phones — keep it single-column until there's room. */}
      <SectionCard title="Quick Actions" icon="grid">
        <div className="max-[519px]:[&>div]:grid-cols-1">
          <QuickActionGrid
            layout="list"
            bare
            actions={[
              {
                label: 'Pay Rent & Bills',
                description: 'Rent status & dues',
                icon: 'wallet',
                tint: 'violet',
                onClick: () => scrollToSection('rent-status'),
              },
              {
                label: 'Raise Maintenance',
                description: 'Report issues',
                icon: 'wrench',
                tint: 'sky',
                onClick: () => {
                  setIssueOpen(true);
                  scrollToSection('issues');
                },
              },
              {
                label: 'View Notices',
                description: 'Stay updated',
                icon: 'bell',
                tint: 'peach',
                onClick: () => scrollToSection('notices'),
              },
              {
                label: 'My Bills',
                description: 'Check history',
                icon: 'doc-green',
                tint: 'mint',
                onClick: () => scrollToSection('payments'),
              },
            ]}
          />
        </div>
      </SectionCard>

      {/* Upcoming dues */}
      <SectionCard title="Upcoming Reminders" icon="calendar">
        {reminders.length === 0 ? (
          <p className="text-[13px] font-medium text-muted">No upcoming dues — you&apos;re all caught up.</p>
        ) : (
          <div className="divide-y divide-line">
            {reminders.map((r) => {
              const due = r.dueDate as string;
              const [, mm, dd] = due.split('-');
              const days = daysBetween(today, due);
              return (
                <div key={r.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-brand-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
                    <span className="font-mono-numbers text-[19px] font-extrabold leading-none text-ink">{dd}</span>
                    <span className="mt-0.5 text-[11.5px] font-bold text-brand-700">{MONTHS[Number(mm) - 1] ?? mm}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[14.5px] font-bold text-ink">Rent Due</div>
                    <div className="truncate font-mono-numbers text-[12.5px] font-medium text-ink-2/75">
                      {formatCurrency(remainingPaise(r) / 100)} • {formatDateIN(due)}
                    </div>
                  </div>
                  {days > 0 ? (
                    <span className="chip shrink-0">
                      <Clock className="h-3.5 w-3.5" /> In {days} day{days === 1 ? '' : 's'}
                    </span>
                  ) : days === 0 ? (
                    <span className="chip shrink-0 bg-warning-bg text-warning-ink">Due today</span>
                  ) : (
                    <span className="chip shrink-0 bg-danger-bg text-danger-ink">
                      Overdue {-days} day{days === -1 ? '' : 's'}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      {/* Notices from the PG owner */}
      <div id="notices" className="scroll-mt-24">
        <SectionCard title="Latest Notices" icon="megaphone">
          {notices.length === 0 ? (
            <p className="text-[13px] font-medium text-muted">No notices from your PG yet.</p>
          ) : (
            <div className="divide-y divide-line">
              {notices.map((n) => {
                const date = formatDateIN(tsToDate(n.createdAt));
                return (
                  <div key={n.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                    <IconBubble icon="megaphone" tint="violet" size={44} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                          {n.pinned && (
                            <Badge variant="brand">
                              <Pin className="h-3 w-3" /> Pinned
                            </Badge>
                          )}
                          <h3 className="break-words text-[14.5px] font-bold text-ink">{n.title}</h3>
                        </div>
                        {date && <span className="chip shrink-0 font-mono-numbers">{date}</span>}
                      </div>
                      <p className="mt-1 whitespace-pre-wrap break-words text-[13px] leading-relaxed text-ink-2/80">
                        {n.body}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>
      </div>

      {/* Rent history */}
      <div id="payments" className="scroll-mt-24">
        <SectionCard title="Payment History" icon="rupee">
          {rentHistory.length === 0 ? (
            <p className="text-[13px] font-medium text-muted">No rent records yet.</p>
          ) : (
            <div className="-my-3 divide-y divide-line stagger">
              {rentHistory.map((r) => {
                const s = RENT_STATUS[r.status] || RENT_STATUS.pending;
                return (
                  <ActivityRow
                    key={r.id}
                    icon={s.icon}
                    tint={s.tint}
                    title={formatPeriod(r.period)}
                    subtitle={
                      <span className="font-mono-numbers">
                        {formatCurrency((r.amountPaidPaise || 0) / 100)} / {formatCurrency((r.amountDuePaise || 0) / 100)}
                        {r.receiptNumber ? ` · REC-${String(r.receiptNumber).padStart(5, '0')}` : ''}
                      </span>
                    }
                    trailing={<Badge variant={s.badge}>{s.label}</Badge>}
                  />
                );
              })}
            </div>
          )}
        </SectionCard>
      </div>

      {/* Issues */}
      <div id="issues" className="scroll-mt-24">
        <SectionCard
          title="My Issues"
          icon="wrench"
          action={
            !issueOpen ? (
              <Button variant="soft" size="md" onClick={() => setIssueOpen(true)}>
                <Plus className="h-4 w-4" /> Raise
              </Button>
            ) : undefined
          }
        >
          {issueOpen && (
            <form onSubmit={raiseIssue} className="well mb-3 space-y-3 p-3.5 animate-pop">
              <Textarea
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                rows={3}
                aria-label="Describe the problem"
                placeholder="Describe the problem (e.g. leaking tap in bathroom)"
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

          {tickets.length === 0 ? (
            <p className="text-[13px] font-medium text-muted">No issues raised.</p>
          ) : (
            <div className="divide-y divide-line stagger">
              {tickets.map((t) => (
                <div key={t.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                  <IconBubble icon="wrench" tint="sky" size={44} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-[14.5px] font-bold capitalize text-ink">{t.category}</span>
                      <Badge variant={TICKET_BADGE[String(t.status)] || 'default'} className="capitalize">
                        {String(t.status).replace('_', ' ')}
                      </Badge>
                    </div>
                    <p className="mt-1 break-words text-[13px] leading-relaxed text-ink-2/80">{t.description}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      {/* Review this PG */}
      <SectionCard
        title="Review this PG"
        icon="star"
        action={
          !pgOpen ? (
            <Button variant="soft" size="md" onClick={() => setPgOpen(true)}>
              <Plus className="h-4 w-4" /> Write
            </Button>
          ) : undefined
        }
      >
        {pgOpen ? (
          <div className="space-y-3 animate-pop">
            <div className="-ml-2 flex items-center">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPgRating(n)}
                  className="grid h-11 w-11 cursor-pointer place-items-center rounded-full transition-transform hover:bg-brand-50 active:scale-90"
                  aria-label={`${n} star`}
                >
                  <Star
                    className={`h-7 w-7 ${n <= pgRating ? 'fill-warning text-warning' : 'text-line-strong'}`}
                    strokeWidth={1.8}
                  />
                </button>
              ))}
            </div>
            <Textarea
              value={pgText}
              onChange={(e) => setPgText(e.target.value)}
              rows={3}
              maxLength={1000}
              aria-label="Your review"
              placeholder="How is your stay? Cleanliness, food, staff, value…"
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
        ) : (
          <p className="text-[13px] font-medium text-muted">Share how your stay has been — it helps other residents.</p>
        )}
      </SectionCard>

      {/* Rate individual staff */}
      <RateStaffSection staff={staff || []} />
    </div>
  );
}
