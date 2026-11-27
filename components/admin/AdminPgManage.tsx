'use client';

import React, { useEffect, useState } from 'react';
import type { SuperAdminPgOverview } from '@/lib/server/services/adminOverview.service';
import {
  ALL_STAFF_PERMISSIONS,
  STAFF_PERMISSION_LABELS,
  StaffPermission,
} from '@/lib/constants/permissions';
import { ShieldCheck, Lock, Unlock, Trash2, Star, Save } from 'lucide-react';
import type { Expense } from '@/types';
import { errorMessage } from '@/lib/utils';
import { apiGet, apiPost } from '@/lib/client/api';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { SectionCard, InfoBanner } from '@/components/ui/dashboard-kit';
import { Icon3D, type Icon3DName, type Tint } from '@/components/brand/Icon3D';
import { useConfirm } from '@/components/ui/confirm-dialog';

/** Shape of the admin pg-detail history payload (counts + expense soft-delete flags). */
interface PgDetail {
  rentRecords?: unknown[];
  deposits?: unknown[];
  expenses?: Expense[];
  maintenance?: unknown[];
  reviews?: unknown[];
  logs?: unknown[];
}

/**
 * Admin per-PG management + history. Admin can act on the owner's behalf:
 * edit owner settings, set any staff member's permissions, and
 * suspend/reactivate/revoke staff. Also shows full history (rent, deposits,
 * expenses, maintenance, reviews, logs). All actions are admin-gated + logged.
 */
export function AdminPgManage({ pg, onChanged }: { pg: SuperAdminPgOverview; onChanged?: () => void }) {
  const ownerId = pg.owner.id;
  const [detail, setDetail] = useState<PgDetail | null>(null);
  const [askConfirm, confirmDialogEl] = useConfirm();
  const [loadingDetail, setLoadingDetail] = useState(true);
  const [busy, setBusy] = useState(false);

  // Editable owner fields.
  const [name, setName] = useState(pg.owner.name || '');
  const [phone, setPhone] = useState(pg.owner.phone || '');
  const [upiId, setUpiId] = useState(pg.owner.upiId || '');

  // Per-staff permission editing state.
  const [editPermsUid, setEditPermsUid] = useState<string | null>(null);
  const [permSet, setPermSet] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Defer so setState runs after commit, not in the effect body (cascading-render lint rule).
    queueMicrotask(() => {
      setName(pg.owner.name || '');
      setPhone(pg.owner.phone || '');
      setUpiId(pg.owner.upiId || '');
      setLoadingDetail(true);
    });
    apiGet<PgDetail>(`/api/admin/pg-detail?ownerId=${encodeURIComponent(ownerId)}`)
      .then(setDetail)
      .catch(() => setDetail(null))
      .finally(() => setLoadingDetail(false));
  }, [ownerId, pg.owner.name, pg.owner.phone, pg.owner.upiId]);

  const post = async (bodyObj: Record<string, unknown>, okMsg: string) => {
    setBusy(true);
    try {
      await apiPost('/api/admin/manage', bodyObj);
      toast.success(okMsg);
      onChanged?.();
      return true;
    } catch (e: unknown) {
      toast.error(errorMessage(e, 'Action failed'));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const saveOwner = () =>
    post({ action: 'updateOwner', ownerId, profile: { name, phone, upiId } }, 'Owner profile updated');

  const saveStaffPerms = async (staffUid: string) => {
    const ok = await post(
      { action: 'setStaffPerms', staffUid, permissions: Array.from(permSet) },
      'Permissions updated'
    );
    if (ok) setEditPermsUid(null);
  };


  return (
    <div className="space-y-4">
      {/* Owner settings (admin act-as-owner) */}
      <SectionCard title="Owner settings" icon="person">
        <p className="-mt-1 mb-3 text-[12.5px] font-medium text-muted">Edit the owner&apos;s profile on their behalf.</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Input label="Owner name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Owner name" />
          <Input label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" inputMode="tel" />
          <Input label="UPI ID" value={upiId} onChange={(e) => setUpiId(e.target.value)} placeholder="UPI ID" />
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={saveOwner} disabled={busy} className="w-full sm:w-auto">
            <Save className="h-4 w-4" /> Save owner
          </Button>
        </div>
      </SectionCard>

      {/* Staff management */}
      <SectionCard title={`Staff (${pg.staff.length})`} icon="staff">
        {pg.staff.length === 0 ? (
          <EmptyState icon3d="staff" title="No staff for this PG." className="py-6" />
        ) : (
          <div className="divide-y divide-line">
            {pg.staff.map((s) => {
              const statusVariant = s.deleted ? 'vacant' : s.accountStatus === 'active' ? 'paid' : 'danger';
              const statusLabel = s.deleted ? 'Revoked' : s.accountStatus;
              return (
                <div key={s.uid} className="py-3.5 first:pt-1 last:pb-1">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <Avatar name={s.name} size="md" />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="truncate text-[14.5px] font-bold text-ink">{s.name}</span>
                          <Badge variant={statusVariant} dot className="capitalize">
                            {statusLabel}
                          </Badge>
                          {s.ratingCount > 0 && (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-warning-ink">
                              <Star className="h-3.5 w-3.5 fill-warning text-warning" aria-hidden="true" />
                              <span className="font-mono-numbers">
                                {s.ratingAvg} ({s.ratingCount})
                              </span>
                            </span>
                          )}
                        </div>
                        <div className="truncate text-[12.5px] font-medium text-muted">
                          {s.email} · <span className="font-mono-numbers">+91 {s.phone}</span>
                        </div>
                        <div className="mt-0.5 text-xs font-semibold text-ink-2">
                          {s.permissions.length} permission{s.permissions.length === 1 ? '' : 's'}
                        </div>
                      </div>
                    </div>
                    {!s.deleted && (
                      <div className="flex shrink-0 flex-wrap items-center gap-2 pl-13 sm:pl-0">
                        <Button
                          variant="soft"
                          size="md"
                          aria-expanded={editPermsUid === s.uid}
                          onClick={() => {
                            setEditPermsUid(editPermsUid === s.uid ? null : s.uid);
                            setPermSet(new Set(s.permissions));
                          }}
                        >
                          <ShieldCheck className="h-4 w-4" /> Perms
                        </Button>
                        <button
                          type="button"
                          onClick={() =>
                            post(
                              {
                                action: 'setStaffStatus',
                                staffUid: s.uid,
                                status: s.accountStatus === 'active' ? 'suspended' : 'active',
                              },
                              'Staff status updated'
                            )
                          }
                          title={s.accountStatus === 'active' ? 'Suspend' : 'Activate'}
                          aria-label={s.accountStatus === 'active' ? `Suspend ${s.name}` : `Activate ${s.name}`}
                          className={`grid h-11 w-11 place-items-center rounded-full ring-1 ring-inset transition-colors press ${
                            s.accountStatus === 'active'
                              ? 'bg-warning-bg text-warning-ink ring-warning-line hover:brightness-[0.98]'
                              : 'bg-success-bg text-success-ink ring-success-line hover:brightness-[0.98]'
                          }`}
                        >
                          {s.accountStatus === 'active' ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            const ok = await askConfirm({
                              title: `Revoke ${s.name}'s access?`,
                              message: 'They lose access immediately. Their record is kept for history.',
                              confirmLabel: 'Revoke access',
                            });
                            if (ok) post({ action: 'revokeStaff', staffUid: s.uid }, 'Staff access revoked');
                          }}
                          title="Revoke access"
                          aria-label={`Revoke ${s.name}'s access`}
                          className="grid h-11 w-11 place-items-center rounded-full bg-danger-bg text-danger-ink ring-1 ring-inset ring-danger-line transition-colors hover:brightness-[0.98] press"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  {editPermsUid === s.uid && (
                    <div className="well mt-3 space-y-2.5 p-3 animate-pop">
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {ALL_STAFF_PERMISSIONS.map((p) => {
                          const on = permSet.has(p);
                          return (
                            <button
                              key={p}
                              type="button"
                              role="switch"
                              aria-checked={on}
                              onClick={() =>
                                setPermSet((prev) => {
                                  const n = new Set(prev);
                                  if (n.has(p)) n.delete(p);
                                  else n.add(p);
                                  return n;
                                })
                              }
                              className={`flex min-h-11 items-center justify-between gap-3 rounded-2xl px-3.5 py-2 text-left transition-colors press ${
                                on ? 'bg-white ring-1 ring-inset ring-brand-200' : 'bg-white/60 ring-1 ring-inset ring-line hover:bg-white'
                              }`}
                            >
                              <span className={`min-w-0 truncate text-[13px] font-semibold ${on ? 'text-ink' : 'text-muted'}`}>
                                {STAFF_PERMISSION_LABELS[p as StaffPermission]}
                              </span>
                              <MiniSwitch on={on} />
                            </button>
                          );
                        })}
                      </div>
                      <Button onClick={() => saveStaffPerms(s.uid)} disabled={busy} size="full">
                        Save permissions
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      {/* History */}
      <SectionCard title="History" icon="clock">
        {loadingDetail ? (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3" aria-label="Loading history">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-[84px] rounded-2xl" />
            ))}
          </div>
        ) : !detail ? (
          <InfoBanner tone="danger" title="Could not load history." />
        ) : (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 stagger">
            <HistoryStat icon="rupee" tint="mint" label="Rent records" value={detail.rentRecords?.length || 0} />
            <HistoryStat icon="wallet" tint="violet" label="Deposits" value={detail.deposits?.length || 0} />
            <HistoryStat
              icon="wallet-orange"
              tint="peach"
              label="Expenses"
              value={`${detail.expenses?.filter((e) => !e.deletedAt).length || 0}`}
              sub={
                detail.expenses?.some((e) => e.deletedAt)
                  ? `${detail.expenses.filter((e) => e.deletedAt).length} removed`
                  : undefined
              }
            />
            <HistoryStat icon="wrench" tint="sky" label="Maintenance" value={detail.maintenance?.length || 0} />
            <HistoryStat icon="star" tint="amber" label="Reviews" value={detail.reviews?.length || 0} />
            <HistoryStat icon="report" tint="indigo" label="Log events" value={detail.logs?.length || 0} />
          </div>
        )}
      </SectionCard>
      {confirmDialogEl}
    </div>
  );
}

/** Small violet switch used inside permission rows (state is on the parent button's aria-checked). */
function MiniSwitch({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${on ? 'bg-[image:var(--grad-brand)]' : 'bg-line-strong'}`}
    >
      <span
        className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-[0_2px_6px_rgba(70,40,160,0.3)] transition-transform ${
          on ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </span>
  );
}

function HistoryStat({
  icon,
  tint,
  label,
  value,
  sub,
}: {
  icon: Icon3DName;
  tint: Tint;
  label: string;
  value: number | string;
  sub?: string;
}) {
  return (
    <div className={`tint-card tint-${tint} flex items-center gap-3 p-3`}>
      <Icon3D name={icon} size={30} />
      <div className="min-w-0">
        <div className="text-[20px] font-extrabold leading-none tracking-[-0.02em] text-ink font-mono-numbers">{value}</div>
        <div className="mt-1 truncate text-xs font-semibold text-ink-2">{label}</div>
        {sub && <div className="truncate text-[11px] font-medium text-muted">{sub}</div>}
      </div>
    </div>
  );
}
