'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  GRANTABLE_ADMIN_PERMISSIONS,
  ADMIN_PERMISSION_LABELS,
  DEFAULT_ADMIN_PERMISSIONS,
  AdminPermission,
} from '@/lib/constants/permissions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { SectionCard, InfoBanner } from '@/components/ui/dashboard-kit';
import { ShieldCheck, UserPlus, Crown, Ban, RotateCcw, Mail } from 'lucide-react';
import toast from 'react-hot-toast';
import { errorMessage } from '@/lib/utils';

interface AdminRow {
  id: string;
  email: string;
  name?: string;
  role: 'super' | 'staff';
  permissions: AdminPermission[];
  accountStatus: 'active' | 'suspended';
}

/** Compact permission toggle grid reused for create + edit. */
function PermToggles({
  selected,
  onToggle,
}: {
  selected: Set<AdminPermission>;
  onToggle: (p: AdminPermission) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {GRANTABLE_ADMIN_PERMISSIONS.map((p) => {
        const on = selected.has(p);
        return (
          <button
            key={p}
            type="button"
            role="switch"
            aria-checked={on}
            onClick={() => onToggle(p)}
            className={`flex min-h-12 items-center justify-between gap-3 rounded-2xl px-3.5 py-2.5 text-left transition-colors press ${
              on
                ? 'bg-brand-50 ring-1 ring-inset ring-brand-200'
                : 'bg-lilac ring-1 ring-inset ring-line hover:bg-brand-50/60'
            }`}
          >
            <span className={`min-w-0 text-[13px] font-semibold leading-snug ${on ? 'text-ink' : 'text-muted'}`}>
              {ADMIN_PERMISSION_LABELS[p]}
            </span>
            <span
              aria-hidden="true"
              className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${
                on ? 'bg-[image:var(--grad-brand)]' : 'bg-line-strong'
              }`}
            >
              <span
                className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-[0_2px_6px_rgba(70,40,160,0.3)] transition-transform ${
                  on ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Super-admin-only panel: list admins, add new staff admins, edit their
 *  permissions, suspend/reactivate. All actions are enforced server-side. */
export function AdminUsersPanel() {
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Add-admin form
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [newPerms, setNewPerms] = useState<Set<AdminPermission>>(new Set(DEFAULT_ADMIN_PERMISSIONS));
  const [creating, setCreating] = useState(false);

  // Inline edit
  const [editId, setEditId] = useState<string | null>(null);
  const [editPerms, setEditPerms] = useState<Set<AdminPermission>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch('/api/admin/admins');
      if (!res.ok) throw new Error('failed');
      const data = await res.json();
      setAdmins(data.admins || []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) load();
    });
    return () => {
      active = false;
    };
  }, [load]);

  const toggleNew = (p: AdminPermission) =>
    setNewPerms((prev) => {
      const n = new Set(prev);
      if (n.has(p)) n.delete(p);
      else n.add(p);
      return n;
    });
  const toggleEdit = (p: AdminPermission) =>
    setEditPerms((prev) => {
      const n = new Set(prev);
      if (n.has(p)) n.delete(p);
      else n.add(p);
      return n;
    });

  const createAdmin = async () => {
    if (!email.trim()) {
      toast.error('Enter the admin’s email');
      return;
    }
    setCreating(true);
    try {
      const res = await fetch('/api/admin/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), name: name.trim() || undefined, permissions: Array.from(newPerms) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not add admin');
      toast.success('Admin added');
      setEmail('');
      setName('');
      setNewPerms(new Set(DEFAULT_ADMIN_PERMISSIONS));
      load();
    } catch (e: unknown) {
      toast.error(errorMessage(e, 'Could not add admin'));
    } finally {
      setCreating(false);
    }
  };

  const savePerms = async (id: string) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/admins/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissions: Array.from(editPerms) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save');
      toast.success('Permissions updated');
      setEditId(null);
      load();
    } catch (e: unknown) {
      toast.error(errorMessage(e, 'Could not save permissions'));
    } finally {
      setBusyId(null);
    }
  };

  const setStatus = async (id: string, status: 'active' | 'suspended') => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/admins/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not update');
      toast.success(status === 'suspended' ? 'Admin suspended' : 'Admin reactivated');
      load();
    } catch (e: unknown) {
      toast.error(errorMessage(e, 'Could not update admin'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
      {/* Add admin */}
      <SectionCard title="Add an admin" icon="user-add" className="lg:sticky lg:top-36">
        <p className="-mt-1 mb-4 text-[12.5px] font-medium leading-relaxed text-muted">
          They must have signed in once (so their account exists). New admins are staff-tier.
        </p>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <Input
              label="Email"
              type="email"
              placeholder="admin@domain.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={creating}
              leading={<Mail />}
            />
            <Input label="Name (optional)" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} disabled={creating} />
          </div>
          <div className="space-y-2">
            <span className="block text-[13px] font-semibold text-ink-2">Permissions</span>
            <PermToggles selected={newPerms} onToggle={toggleNew} />
          </div>
          <Button size="full" variant="solid" loading={creating} onClick={createAdmin}>
            <UserPlus className="h-4 w-4" /> Add admin
          </Button>
        </div>
      </SectionCard>

      {/* Roster */}
      <SectionCard
        title="Admins"
        icon="users-purple"
        action={!loading && !error ? <span className="chip shrink-0 font-mono-numbers">{admins.length}</span> : undefined}
      >
        {loading ? (
          <div className="space-y-3" aria-label="Loading admins">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 py-1.5">
                <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-1/3" />
                  <Skeleton className="h-3 w-1/2 rounded-full" />
                </div>
              </div>
            ))}
            <span className="sr-only">Loading admins…</span>
          </div>
        ) : error ? (
          <InfoBanner
            tone="danger"
            title="Couldn’t load admins."
            action={
              <Button size="sm" variant="outline" onClick={load}>
                Retry
              </Button>
            }
          />
        ) : admins.length === 0 ? (
          <EmptyState icon3d="staff" title="No admins yet." className="py-8" />
        ) : (
          <div className="divide-y divide-line">
            {admins.map((a) => {
              const isSuper = a.role === 'super';
              const suspended = a.accountStatus === 'suspended';
              return (
                <div key={a.id} className="py-3.5 first:pt-1 last:pb-1">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar name={a.name || a.email} size="md" />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="truncate text-[14.5px] font-bold text-ink">{a.name || a.email}</span>
                          {isSuper && (
                            <Badge variant="brand">
                              <Crown className="h-3 w-3" aria-hidden="true" /> Super admin
                            </Badge>
                          )}
                          {suspended && (
                            <Badge variant="danger" dot>
                              Suspended
                            </Badge>
                          )}
                        </div>
                        <div className="truncate text-[12.5px] font-medium text-muted">{a.email}</div>
                      </div>
                    </div>
                    {!isSuper && (
                      <div className="flex shrink-0 flex-wrap items-center gap-2">
                        <Button
                          variant="soft"
                          size="md"
                          aria-expanded={editId === a.id}
                          onClick={() => {
                            setEditId(editId === a.id ? null : a.id);
                            setEditPerms(new Set(a.permissions));
                          }}
                        >
                          {editId === a.id ? 'Close' : 'Permissions'}
                        </Button>
                        {suspended ? (
                          <Button variant="success" size="md" disabled={busyId === a.id} onClick={() => setStatus(a.id, 'active')}>
                            <RotateCcw className="h-4 w-4" /> Reactivate
                          </Button>
                        ) : (
                          <Button variant="destructive" size="md" disabled={busyId === a.id} onClick={() => setStatus(a.id, 'suspended')}>
                            <Ban className="h-4 w-4" /> Suspend
                          </Button>
                        )}
                      </div>
                    )}
                  </div>

                  {isSuper ? (
                    <p className="mt-2 pl-13 text-[12.5px] font-medium text-muted">Full access to everything (super admin).</p>
                  ) : editId === a.id ? (
                    <div className="well mt-3 space-y-3 p-3.5 sm:ml-13 animate-pop">
                      <div className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-2">
                        <ShieldCheck className="h-4 w-4 text-brand" aria-hidden="true" /> Grant only what this admin needs
                      </div>
                      <PermToggles selected={editPerms} onToggle={toggleEdit} />
                      <Button size="full" variant="solid" loading={busyId === a.id} onClick={() => savePerms(a.id)}>
                        Save permissions
                      </Button>
                    </div>
                  ) : a.permissions.length === 0 ? (
                    <p className="mt-2 pl-13 text-[12.5px] font-medium text-muted">No permissions granted.</p>
                  ) : (
                    <div className="mt-2 flex flex-wrap gap-1.5 pl-13">
                      {a.permissions.map((p) => (
                        <Badge key={p} variant="neutral">
                          {ADMIN_PERMISSION_LABELS[p]}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
