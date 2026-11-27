'use client';

import React from 'react';
import { Bed, RentRecord } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { Send, Mail, CalendarDays } from 'lucide-react';
import { DonutChart, SectionCard, StatTile } from '@/components/ui/dashboard-kit';
import { IconBubble, type Icon3DName, type Tint } from '@/components/brand/Icon3D';
import { Button } from '@/components/ui/button';

export interface DashboardSummary {
  totalBeds: number;
  occupiedBeds: number;
  vacantBeds: number;
  occupancyRate: number;
  monthlyPotential: number;
  occupiedPotential: number;
}

interface StatsBarProps {
  beds: Bed[];
  rentRecords: RentRecord[];
  /** Omit to hide the reminder buttons (e.g. staff without the Rent permission). */
  onRemindAll?: () => void;
  // Optional one-button "email reminders from the owner's Gmail".
  onEmailReminders?: () => void;
  emailReminding?: boolean;
  // Accurate server-computed totals (via Firestore aggregations). When present,
  // the occupancy/potential figures come from here instead of the live bed
  // window, so they're correct for PGs larger than the 100-row cap.
  summary?: DashboardSummary | null;
  /** Label for the selected billing period chip ("This Month", "Oct 2026"). */
  periodLabel?: string;
  /** Staff without resident/rent access: money rows show "—". */
  restricted?: boolean;
}

export interface DashboardStats {
  totalBeds: number;
  occupiedBeds: number;
  vacantBeds: number;
  occupancyRate: number;
  totalCollected: number;
  totalPending: number;
  paidCount: number;
  pendingCount: number;
  verifyCount: number;
  collectRate: number;
}

/**
 * Occupancy + rent-collection figures for the dashboard. Pure derivation from
 * the live beds window, the selected month's rent records and (when loaded) the
 * server summary — shared by the stat row and the Overview card.
 */
export function computeDashboardStats(
  beds: Bed[],
  rentRecords: RentRecord[],
  summary?: DashboardSummary | null
): DashboardStats {
  // Prefer the server summary for whole-PG totals; fall back to the live window
  // (correct for PGs ≤100 beds, and used while the summary is still loading).
  const totalBeds = summary?.totalBeds ?? beds.length;
  const occupiedBeds = summary?.occupiedBeds ?? beds.filter((b) => b.status !== 'vacant').length;
  const vacantBeds = summary?.vacantBeds ?? totalBeds - occupiedBeds;
  const occupancyRate =
    summary?.occupancyRate ?? (totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0);

  // Rent records key by tenantId (doc id `${tenantId}_${period}`), not bedId.
  const recordByTenant = new Map<string, RentRecord>();
  rentRecords.forEach((r) => {
    if (r.tenantId) recordByTenant.set(r.tenantId, r);
  });

  let totalCollected = 0;
  let totalPending = 0;
  let paidCount = 0;
  let pendingCount = 0;
  let verifyCount = 0;

  beds.forEach((bed) => {
    // Skip vacant and guests (guests are billed separately, no monthly record).
    if (bed.status === 'vacant' || bed.status === 'guest') return;

    // Status from the selected month's record (via tenant), not bed.status.
    const record = bed.tenantId ? recordByTenant.get(bed.tenantId) : undefined;
    const isPaid = record?.status === 'paid';
    const isVerify = record?.status === 'verify';

    // Prefer the record's real amounts (honours partial payments + prorating) and
    // fall back to the bed's configured monthly rent when no record exists yet.
    const paidRupees = record ? Math.round((record.amountPaidPaise ?? 0) / 100) : 0;
    const dueRupees = record
      ? Math.round((record.amountDuePaise ?? 0) / 100)
      : bed.monthlyRent || 0;

    if (isPaid) {
      paidCount++;
      totalCollected += dueRupees;
    } else if (isVerify) {
      verifyCount++;
      // A payment awaiting verification is partly collected in reality.
      totalCollected += paidRupees;
      totalPending += Math.max(0, dueRupees - paidRupees);
    } else {
      pendingCount++;
      // Count any partial already paid toward collected; the rest is pending.
      totalCollected += paidRupees;
      totalPending += Math.max(0, dueRupees - paidRupees);
    }
  });

  const totalProjected = totalCollected + totalPending;

  const collectRate = totalProjected > 0 ? Math.round((totalCollected / totalProjected) * 100) : 0;

  return {
    totalBeds,
    occupiedBeds,
    vacantBeds,
    occupancyRate,
    totalCollected,
    totalPending,
    paidCount,
    pendingCount,
    verifyCount,
    collectRate,
  };
}

/**
 * Stat row under the hero (ref: Total Rooms · Total Beds · Residents · This
 * Month). Every figure is derived from data the dashboard already holds.
 */
export function StatsRow({
  beds,
  rentRecords,
  summary,
  residentCount,
  collectionLabel = 'This Month',
  inventoryHref,
  residentsHref,
  collectionHref,
  restricted = false,
}: {
  beds: Bed[];
  rentRecords: RentRecord[];
  summary?: DashboardSummary | null;
  residentCount: React.ReactNode;
  collectionLabel?: string;
  inventoryHref?: string;
  residentsHref?: string;
  collectionHref?: string;
  /** Staff without resident/rent access: show "—" (hidden), never a fake 0. */
  restricted?: boolean;
}) {
  const { totalBeds, totalCollected } = computeDashboardStats(beds, rentRecords, summary);
  // Rooms are counted from the live bed window; mark the figure as a floor
  // ("12+") when the window doesn't hold every bed of a large PG.
  const windowed = (summary?.totalBeds ?? 0) > beds.length;
  const roomCount = new Set(beds.map((b) => `${b.propertyId ?? ''}|${b.floor}|${b.roomNumber}`)).size;

  return (
    <div className="stagger grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatTile
        icon="house"
        tint="violet"
        label="Total Rooms"
        value={`${roomCount}${windowed ? '+' : ''}`}
        href={inventoryHref}
      />
      <StatTile icon="bed-teal" tint="sky" label="Total Beds" value={totalBeds} href={inventoryHref} />
      <StatTile
        icon="users"
        tint="indigo"
        label="Residents"
        value={restricted ? '—' : residentCount}
        caption={restricted ? 'Hidden' : undefined}
        href={restricted ? undefined : residentsHref}
      />
      <StatTile
        icon="rupee"
        tint="mint"
        label={collectionLabel}
        value={restricted ? '—' : formatCurrency(totalCollected)}
        caption={restricted ? 'Hidden' : undefined}
        href={restricted ? undefined : collectionHref}
      />
    </div>
  );
}

/** One figure in the Overview card: 3D icon bubble, label, value, optional note. */
function OverviewRow({
  icon,
  tint,
  label,
  value,
  sub,
}: {
  icon: Icon3DName;
  tint: Tint;
  label: string;
  value: React.ReactNode;
  sub?: string;
}) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <IconBubble icon={icon} tint={tint} size={38} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-2">
          <span className="text-[13px] font-semibold text-ink-2">{label}</span>
          <span className="font-mono-numbers text-[15px] font-extrabold tracking-[-0.01em] text-ink">{value}</span>
        </div>
        {sub && <div className="text-[11.5px] font-medium text-muted">{sub}</div>}
      </div>
    </div>
  );
}

export function StatsBar({
  beds,
  rentRecords,
  onRemindAll,
  onEmailReminders,
  emailReminding,
  summary,
  periodLabel = 'This Month',
  restricted = false,
}: StatsBarProps) {
  const {
    totalBeds,
    occupiedBeds,
    vacantBeds,
    occupancyRate,
    totalCollected,
    totalPending,
    paidCount,
    pendingCount,
    verifyCount,
    collectRate,
  } = computeDashboardStats(beds, rentRecords, summary);

  return (
    <SectionCard
      title="Overview"
      icon="chart"
      action={
        <span className="chip shrink-0 gap-1.5 py-1.5 text-[12.5px] font-bold">
          <CalendarDays className="h-3.5 w-3.5" />
          {periodLabel}
        </span>
      }
      bodyClassName="@container"
    >
      {/* Donut occupancy + collected / pending figures (matches design ref) */}
      <div className="flex flex-col items-center gap-4 @xs:flex-row">
        <div className="flex shrink-0 flex-col items-center gap-2.5">
          <DonutChart percent={occupancyRate} size={120} stroke={14} sublabel="Occupancy" />
          <span className="chip font-mono-numbers font-bold">
            {occupiedBeds} / {totalBeds} occupied
          </span>
        </div>
        <div className="w-full min-w-0 flex-1 @xs:border-l @xs:border-line @xs:pl-4">
          <OverviewRow
            icon="wallet-sm"
            tint="violet"
            label="Total Collection"
            value={restricted ? '—' : formatCurrency(totalCollected)}
            sub={restricted ? 'Hidden for your account' : `${paidCount} paid · ${collectRate}% collected`}
          />
          <OverviewRow
            icon="alert"
            tint="peach"
            label="Pending Dues"
            value={restricted ? '—' : formatCurrency(totalPending)}
            sub={restricted ? 'Hidden for your account' : `${pendingCount} due`}
          />
          <OverviewRow icon="bed" tint="sky" label="Vacant Beds" value={vacantBeds} />
          {verifyCount > 0 && (
            <OverviewRow icon="doc" tint="violet" label="Proofs to verify" value={verifyCount} />
          )}
        </div>
      </div>

      {pendingCount > 0 && onRemindAll && (
        <div className="mt-4 grid grid-cols-1 gap-2.5 border-t border-line pt-4 @md:grid-cols-2">
          <Button className="w-full" onClick={onRemindAll}>
            <Send className="h-4 w-4" />
            <span>WhatsApp Reminders</span>
          </Button>
          {onEmailReminders && (
            <Button
              variant="outline"
              className="w-full"
              onClick={onEmailReminders}
              disabled={emailReminding}
            >
              <Mail className="h-4 w-4" />
              <span>{emailReminding ? 'Sending…' : 'Email from my Gmail'}</span>
            </Button>
          )}
        </div>
      )}
    </SectionCard>
  );
}
