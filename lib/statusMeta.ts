import type { BadgeProps } from '@/components/ui/badge';

/**
 * Single source of truth for mapping a domain status string → a Badge variant +
 * human label. Previously this `status → {colour,label}` mapping was re-inlined
 * in ~10 UI files (BedCard, RoomCard, StatsBar, RentStatusCard, maintenance,
 * guests, visitors, utilities, admin…). Change a colour or a label HERE and it
 * reflects everywhere. Render via `<StatusBadge domain=.. status=.. />`.
 */

type Variant = NonNullable<BadgeProps['variant']>;
export interface StatusMeta {
  variant: Variant;
  label: string;
}

export type StatusDomain =
  | 'rent'
  | 'bed'
  | 'maintenance'
  | 'guest'
  | 'account'
  | 'subscription';

const FALLBACK: StatusMeta = { variant: 'neutral', label: '—' };

const MAPS: Record<StatusDomain, Record<string, StatusMeta>> = {
  // rent_records.status
  rent: {
    paid: { variant: 'paid', label: 'Paid' },
    verify: { variant: 'verify', label: 'Under Verification' },
    pending: { variant: 'pending', label: 'Payment Due' },
    overdue: { variant: 'danger', label: 'Overdue' },
    partial: { variant: 'pending', label: 'Partially Paid' },
    none: { variant: 'neutral', label: 'No Bill' },
  },
  // beds.status
  bed: {
    vacant: { variant: 'vacant', label: 'Vacant' },
    occupied: { variant: 'paid', label: 'Occupied' },
    maintenance: { variant: 'amber', label: 'Maintenance' },
    guest: { variant: 'cyan', label: 'Guest' },
  },
  // maintenance_tickets.status — colours match the established design (open is a
  // calm pending-amber, not an alarming red; in-progress uses the brand "verify"
  // pill), so adopting StatusBadge here is a pure refactor with no visual change.
  maintenance: {
    open: { variant: 'pending', label: 'Open' },
    in_progress: { variant: 'verify', label: 'In Progress' },
    resolved: { variant: 'paid', label: 'Resolved' },
    closed: { variant: 'neutral', label: 'Closed' },
  },
  // guest_stays — active / completed
  guest: {
    active: { variant: 'paid', label: 'Staying Now' },
    upcoming: { variant: 'cyan', label: 'Upcoming' },
    completed: { variant: 'neutral', label: 'Checked Out' },
    checked_out: { variant: 'neutral', label: 'Checked Out' },
  },
  // staff/owner accountStatus
  account: {
    active: { variant: 'paid', label: 'Active' },
    suspended: { variant: 'danger', label: 'Suspended' },
    pending_review: { variant: 'pending', label: 'Pending Review' },
    revoked: { variant: 'neutral', label: 'Revoked' },
  },
  // subscription_requests.status
  subscription: {
    pending: { variant: 'pending', label: 'Pending' },
    approved: { variant: 'paid', label: 'Approved' },
    rejected: { variant: 'danger', label: 'Rejected' },
  },
};

/**
 * Resolve a domain status to its `{ variant, label }`. Unknown values degrade to
 * a neutral "—" badge instead of throwing, so a future status never crashes the UI.
 */
export function statusMeta(domain: StatusDomain, status: string | null | undefined): StatusMeta {
  if (!status) return FALLBACK;
  return MAPS[domain]?.[status] ?? { ...FALLBACK, label: titleCase(status) };
}

function titleCase(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
