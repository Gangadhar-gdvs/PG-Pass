'use client';

import React, { useEffect, useState } from 'react';
import type { SuperAdminPgOverview } from '@/lib/server/services/adminOverview.service';
import {
  ALL_STAFF_PERMISSIONS,
  STAFF_PERMISSION_LABELS,
  StaffPermission,
} from '@/lib/constants/permissions';
import { UserCog, ShieldCheck, History, Lock, Unlock, Trash2, Star, Loader2, Save } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Expense } from '@/types';
import { errorMessage } from '@/lib/utils';
import toast from 'react-hot-toast';

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
// Section header — hoisted to module scope (not defined during render) so it has
// a stable identity and doesn't remount its subtree on every parent render.
function H({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#64748B] flex items-center gap-1.5">
      <Icon className="w-3.5 h-3.5" /> {label}
    </span>
  );
}

export function AdminPgManage({ pg, onChanged }: { pg: SuperAdminPgOverview; onChanged?: () => void }) {
  const ownerId = pg.owner.id;
  const [detail, setDetail] = useState<PgDetail | null>(null);
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
    fetch(`/api/admin/pg-detail?ownerId=${encodeURIComponent(ownerId)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setDetail)
      .catch(() => setDetail(null))
      .finally(() => setLoadingDetail(false));
  }, [ownerId, pg.owner.name, pg.owner.phone, pg.owner.upiId]);

  const post = async (bodyObj: Record<string, unknown>, okMsg: string) => {
    setBusy(true);
    try {
      const res = await fetch('/api/admin/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyObj),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Action failed');
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
    <div className="space-y-3">
      {/* Owner settings (admin act-as-owner) */}
      <div className="bg-white border border-[#E2E8F0] rounded-[12px] p-4.5 space-y-2.5 shadow-xs">
        <H icon={UserCog} label="Owner Settings (admin edit)" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Owner name"
            className="h-9 px-2.5 rounded-[6px] border border-[#E2E8F0] text-xs focus:outline-none focus:border-[#4F46E5]"
          />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone"
            className="h-9 px-2.5 rounded-[6px] border border-[#E2E8F0] text-xs focus:outline-none focus:border-[#4F46E5]"
          />
          <input
            value={upiId}
            onChange={(e) => setUpiId(e.target.value)}
            placeholder="UPI ID"
            className="h-9 px-2.5 rounded-[6px] border border-[#E2E8F0] text-xs focus:outline-none focus:border-[#4F46E5]"
          />
        </div>
        <button
          onClick={saveOwner}
          disabled={busy}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] bg-[#4F46E5] text-white text-xs font-bold disabled:opacity-60 cursor-pointer"
        >
          <Save className="w-3.5 h-3.5" /> Save owner
        </button>
      </div>

      {/* Staff management */}
      <div className="bg-white border border-[#E2E8F0] rounded-[12px] p-4.5 space-y-2.5 shadow-xs">
        <H icon={ShieldCheck} label={`Staff (${pg.staff.length})`} />
        {pg.staff.length === 0 ? (
          <p className="text-xs text-[#94A3B8]">No staff for this PG.</p>
        ) : (
          <div className="divide-y divide-[#F1F5F9]">
            {pg.staff.map((s) => (
              <div key={s.uid} className="py-2.5 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[#09090B] truncate">{s.name}</span>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                          s.deleted
                            ? 'bg-[#F1F5F9] text-[#64748B]'
                            : s.accountStatus === 'active'
                            ? 'bg-[#ECFDF5] text-[#10B981]'
                            : 'bg-[#FEF2F2] text-[#DC2626]'
                        }`}
                      >
                        {s.deleted ? 'revoked' : s.accountStatus}
                      </span>
                      {s.ratingCount > 0 && (
                        <span className="text-[10px] font-bold text-amber-600 flex items-center gap-0.5">
                          <Star className="w-3 h-3 fill-amber-500 text-amber-500" /> {s.ratingAvg} ({s.ratingCount})
                        </span>
                      )}
                    </div>
                    <div className="text-[#94A3B8] truncate">{s.email} · +91 {s.phone}</div>
                    <div className="text-[#64748B] mt-0.5">
                      {s.permissions.length} permission{s.permissions.length === 1 ? '' : 's'}
                    </div>
                  </div>
                  {!s.deleted && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => {
                          setEditPermsUid(editPermsUid === s.uid ? null : s.uid);
                          setPermSet(new Set(s.permissions));
                        }}
                        className="px-2 py-1 rounded-[6px] border border-[#E2E8F0] font-semibold text-[#475569] hover:bg-[#F8FAFC] cursor-pointer"
                      >
                        Perms
                      </button>
                      <button
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
                        className="p-1.5 rounded-[6px] border border-[#E2E8F0] hover:bg-[#F8FAFC] cursor-pointer"
                      >
                        {s.accountStatus === 'active' ? (
                          <Lock className="w-3.5 h-3.5 text-[#DC2626]" />
                        ) : (
                          <Unlock className="w-3.5 h-3.5 text-[#10B981]" />
                        )}
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Revoke ${s.name}'s access? (record is kept)`))
                            post({ action: 'revokeStaff', staffUid: s.uid }, 'Staff access revoked');
                        }}
                        title="Revoke access"
                        className="p-1.5 rounded-[6px] border border-[#FECACA] hover:bg-[#FEF2F2] text-[#DC2626] cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {editPermsUid === s.uid && (
                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {ALL_STAFF_PERMISSIONS.map((p) => {
                      const on = permSet.has(p);
                      return (
                        <button
                          key={p}
                          onClick={() =>
                            setPermSet((prev) => {
                              const n = new Set(prev);
                              if (n.has(p)) n.delete(p);
                              else n.add(p);
                              return n;
                            })
                          }
                          className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-[6px] border text-left cursor-pointer ${
                            on ? 'border-[#4F46E5] bg-[#EEF2FF] text-[#3730A3]' : 'border-[#E2E8F0] text-[#64748B]'
                          }`}
                        >
                          <span className="min-w-0 truncate">{STAFF_PERMISSION_LABELS[p as StaffPermission]}</span>
                          <span className={`text-[10px] font-bold ${on ? 'text-[#4F46E5]' : 'text-[#CBD5E1]'}`}>
                            {on ? 'ON' : 'OFF'}
                          </span>
                        </button>
                      );
                    })}
                    <button
                      onClick={() => saveStaffPerms(s.uid)}
                      disabled={busy}
                      className="sm:col-span-2 h-8 rounded-[6px] bg-[#4F46E5] text-white font-bold disabled:opacity-60 cursor-pointer"
                    >
                      Save permissions
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* History */}
      <div className="bg-white border border-[#E2E8F0] rounded-[12px] p-4.5 space-y-2 shadow-xs">
        <H icon={History} label="History" />
        {loadingDetail ? (
          <div className="flex items-center gap-2 text-xs text-[#94A3B8] py-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading history…
          </div>
        ) : !detail ? (
          <p className="text-xs text-[#94A3B8]">Could not load history.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
            <HistoryStat label="Rent records" value={detail.rentRecords?.length || 0} />
            <HistoryStat label="Deposits" value={detail.deposits?.length || 0} />
            <HistoryStat
              label="Expenses"
              value={`${detail.expenses?.filter((e) => !e.deletedAt).length || 0}`}
              sub={
                detail.expenses?.some((e) => e.deletedAt)
                  ? `${detail.expenses.filter((e) => e.deletedAt).length} removed`
                  : undefined
              }
            />
            <HistoryStat label="Maintenance" value={detail.maintenance?.length || 0} />
            <HistoryStat label="Reviews" value={detail.reviews?.length || 0} />
            <HistoryStat label="Log events" value={detail.logs?.length || 0} />
          </div>
        )}
      </div>
    </div>
  );
}

function HistoryStat({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[8px] p-2.5">
      <div className="text-[18px] font-extrabold text-[#09090B] font-mono-numbers leading-none">{value}</div>
      <div className="text-[10px] text-[#64748B] mt-1">{label}</div>
      {sub && <div className="text-[9px] text-[#94A3B8]">{sub}</div>}
    </div>
  );
}
