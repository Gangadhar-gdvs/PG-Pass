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
import { ShieldCheck, UserPlus, Crown, UserCog, Ban, RotateCcw } from 'lucide-react';
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
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
      {GRANTABLE_ADMIN_PERMISSIONS.map((p) => {
        const on = selected.has(p);
        return (
          <button
            key={p}
            type="button"
            onClick={() => onToggle(p)}
            className={`flex items-center justify-between gap-2 px-3 py-2 rounded-[8px] border text-left text-xs transition-colors cursor-pointer ${
              on ? 'border-[color:var(--accent)] accent-soft-bg' : 'border-[#E2E8F0] bg-white text-[#64748B] hover:bg-[#F8FAFC]'
            }`}
          >
            <span className="min-w-0 truncate">{ADMIN_PERMISSION_LABELS[p]}</span>
            <span className={`relative w-8 shrink-0 rounded-full transition-colors ${on ? 'accent-bg' : 'bg-[#CBD5E1]'}`} style={{ height: 18 }}>
              <span className="absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white transition-all" style={{ left: on ? 16 : 2 }} />
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
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Add admin */}
      <section className="app-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <span className="icon-chip accent-text"><UserPlus className="h-5 w-5" /></span>
          <div>
            <h2 className="text-sm font-bold text-[#0F172A]">Add an admin</h2>
            <p className="text-[11px] text-[#64748B]">They must have signed in once (so their account exists). New admins are staff-tier.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Input label="Email" type="email" placeholder="admin@domain.com" value={email} onChange={(e) => setEmail(e.target.value)} disabled={creating} />
          <Input label="Name (optional)" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} disabled={creating} />
        </div>
        <div className="space-y-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wide text-[#64748B]">Permissions</span>
          <PermToggles selected={newPerms} onToggle={toggleNew} />
        </div>
        <Button size="sm" variant="solid" loading={creating} onClick={createAdmin}>
          <UserPlus className="h-3.5 w-3.5 mr-1" /> Add admin
        </Button>
      </section>

      {/* Roster */}
      <section className="app-card p-4">
        <h2 className="mb-3 text-sm font-bold text-[#0F172A]">Admins</h2>
        {loading ? (
          <p className="text-xs text-[#94A3B8] py-4 text-center">Loading admins…</p>
        ) : error ? (
          <div className="py-4 text-center">
            <p className="text-xs text-[#DC2626] mb-2">Couldn’t load admins.</p>
            <Button size="sm" variant="outline" onClick={load}>Retry</Button>
          </div>
        ) : admins.length === 0 ? (
          <p className="text-xs text-[#94A3B8] py-4 text-center">No admins yet.</p>
        ) : (
          <div className="divide-y divide-[#F1F5F9]">
            {admins.map((a) => {
              const isSuper = a.role === 'super';
              const suspended = a.accountStatus === 'suspended';
              return (
                <div key={a.id} className="py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className={`icon-chip ${isSuper ? 'accent-text' : 'text-[#64748B]'}`}>
                        {isSuper ? <Crown className="h-5 w-5" /> : <UserCog className="h-5 w-5" />}
                      </span>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-[#0F172A] truncate">
                          {a.name || a.email}
                          {isSuper && <span className="ml-2 text-[10px] font-bold accent-text accent-soft-bg px-1.5 py-0.5 rounded">SUPER</span>}
                          {suspended && <span className="ml-2 text-[10px] font-bold text-[#DC2626] bg-[#FEF2F2] px-1.5 py-0.5 rounded">SUSPENDED</span>}
                        </div>
                        <div className="text-[11px] text-[#64748B] truncate">{a.email}</div>
                      </div>
                    </div>
                    {!isSuper && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setEditId(editId === a.id ? null : a.id);
                            setEditPerms(new Set(a.permissions));
                          }}
                          className="text-[11px] font-bold accent-text px-2 py-1 rounded hover:bg-[#F8FAFC]"
                        >
                          {editId === a.id ? 'Close' : 'Permissions'}
                        </button>
                        {suspended ? (
                          <button type="button" disabled={busyId === a.id} onClick={() => setStatus(a.id, 'active')} className="inline-flex items-center gap-1 text-[11px] font-bold text-[#10B981] px-2 py-1 rounded hover:bg-[#ECFDF5]">
                            <RotateCcw className="h-3 w-3" /> Reactivate
                          </button>
                        ) : (
                          <button type="button" disabled={busyId === a.id} onClick={() => setStatus(a.id, 'suspended')} className="inline-flex items-center gap-1 text-[11px] font-bold text-[#DC2626] px-2 py-1 rounded hover:bg-[#FEF2F2]">
                            <Ban className="h-3 w-3" /> Suspend
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {isSuper ? (
                    <p className="mt-1.5 ml-[2.75rem] text-[11px] text-[#94A3B8]">Full access to everything (super admin).</p>
                  ) : editId === a.id ? (
                    <div className="mt-3 ml-0 sm:ml-[2.75rem] space-y-2.5">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-[#64748B]">
                        <ShieldCheck className="h-3.5 w-3.5 accent-text" /> Grant only what this admin needs
                      </div>
                      <PermToggles selected={editPerms} onToggle={toggleEdit} />
                      <Button size="sm" variant="solid" loading={busyId === a.id} onClick={() => savePerms(a.id)}>
                        Save permissions
                      </Button>
                    </div>
                  ) : (
                    <p className="mt-1.5 ml-[2.75rem] text-[11px] text-[#64748B]">
                      {a.permissions.length === 0 ? 'No permissions granted.' : a.permissions.map((p) => ADMIN_PERMISSION_LABELS[p]).join(' · ')}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
