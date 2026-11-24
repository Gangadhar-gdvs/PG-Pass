'use client';

import React, { useState, useEffect } from 'react';
import { useOwnerSession } from '@/hooks/useOwner';
import { PLAN_LIMITS } from '@/lib/constants/limits';
import { PLAN_TIER, PlanTier, ACCOUNT_STATUS } from '@/lib/constants/status';
import {
  Users,
  UserPlus,
  ShieldCheck,
  ShieldAlert,
  Phone,
  Mail,
  Trash2,
  Lock,
  Unlock,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PhoneInput } from '@/components/ui/phone-input';
import { Drawer } from '@/components/ui/drawer';
import { Avatar } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { validatePhone, sanitizeText } from '@/lib/security';
import { OwnerOnlyGuard } from '@/components/owner/OwnerOnlyGuard';
import { StaffPermissionsEditor } from '@/components/owner/StaffPermissionsEditor';
import { DEFAULT_STAFF_PERMISSIONS, StaffPermission } from '@/lib/constants/permissions';
import { Star } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

interface StaffMember {
  uid: string;
  id?: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  accountStatus: string;
  createdAt: string;
  permissions?: string[];
  ratingAgg?: { count: number; sum: number };
}

function StaffPageInner() {
  const { ownerId } = useOwnerSession();

  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [permsOpenUid, setPermsOpenUid] = useState<string | null>(null);

  // Invite modal state
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [setupLinkInfo, setSetupLinkInfo] = useState<{ name: string; link: string } | null>(null);

  const loadData = async () => {
    try {
      const [ownerRes, staffRes] = await Promise.all([
        fetch('/api/owners'),
        fetch('/api/staff'),
      ]);

      if (ownerRes.ok) {
        const ownerData = await ownerRes.json();
        setProfile(ownerData);
      }
      if (staffRes.ok) {
        const data = await staffRes.json();
        setStaffList(data.staff || []);
      }
    } catch (e) {
      console.error('Error fetching staff list:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (ownerId) loadData();
  }, [ownerId]);

  const currentTier: PlanTier = (profile?.planTier as PlanTier) || PLAN_TIER.FREE;
  const currentLimits = PLAN_LIMITS[currentTier] || PLAN_LIMITS.free;
  const canAddStaff = staffList.length < currentLimits.maxStaff;

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPhoneError('');

    const cleanName = sanitizeText(name, 60);
    if (!cleanName) {
      toast.error('Please enter the staff member full name');
      return;
    }

    const phoneValidation = validatePhone(phone);
    if (!phoneValidation.valid) {
      setPhoneError(phoneValidation.error || 'Enter a valid 10-digit mobile number');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: cleanName,
          email: email.trim().toLowerCase(),
          phone: phoneValidation.cleaned,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to invite staff member');
      }

      toast.success(`Warden account provisioned for ${cleanName}`);
      setIsInviteOpen(false);
      setName('');
      setEmail('');
      setPhone('');
      if (data.setupLink) {
        // Surface the one-time password-setup link so the owner can forward it
        // to the warden (there is no automated email/SMS delivery).
        setSetupLinkInfo({ name: cleanName, link: data.setupLink });
      }
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Invitation failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (staff: StaffMember) => {
    const newStatus =
      staff.accountStatus === ACCOUNT_STATUS.ACTIVE
        ? ACCOUNT_STATUS.SUSPENDED
        : ACCOUNT_STATUS.ACTIVE;

    try {
      const res = await fetch(`/api/staff/${staff.uid}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Status update failed');
      }

      toast.success(
        `Staff access ${newStatus === ACCOUNT_STATUS.ACTIVE ? 'restored' : 'suspended'}`
      );
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Could not update status');
    }
  };

  const handleRevoke = async (staff: StaffMember) => {
    if (!confirm(`Are you sure you want to permanently revoke access for ${staff.name}?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/staff/${staff.uid}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Revocation failed');
      }

      toast.success('Staff access revoked permanently');
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Could not revoke staff');
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8 space-y-6 text-left">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 border-b border-[#E2E8F0]">
        <div>
          <h1 className="text-xl font-bold text-[#09090B] tracking-tight">
            Staff & Warden Delegation
          </h1>
          <p className="text-xs text-[#64748B] mt-0.5">
            Delegate resident check-ins and rent payment recording with scoped RBAC.
          </p>
        </div>

        <Button
          variant="solid"
          size="md"
          disabled={!canAddStaff}
          onClick={() => setIsInviteOpen(true)}
          className="bg-[#D97706] hover:bg-[#B45309] text-white text-xs font-semibold"
        >
          <UserPlus className="w-4 h-4 mr-1.5" />
          <span>Add Staff Member ({staffList.length}/{currentLimits.maxStaff})</span>
        </Button>
      </div>

      {/* Free Tier Upgrade Banner if maxStaff === 0 */}
      {currentLimits.maxStaff === 0 && (
        <div className="p-4 rounded-[10px] bg-[#FFFBEB] border border-[#FDE68A] flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-[#D97706] shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <span className="font-bold text-[#92400E] block">
              Staff Delegation is Locked on Free Tier
            </span>
            <p className="text-[#B45309] leading-relaxed">
              Your PG is on the Free tier (1 owner). Upgrade to{' '}
              <strong className="font-semibold">Growth (1 staff seat)</strong> or{' '}
              <strong className="font-semibold">Pro (5 staff seats)</strong> to invite wardens and assistants.
            </p>
            <div className="pt-1">
              <Link
                href="/billing"
                className="inline-flex items-center gap-1 text-xs font-bold text-[#92400E] hover:underline"
              >
                <span>View SaaS upgrade options</span>
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Scoped RBAC Explanation Box */}
      <div className="p-4 rounded-[10px] bg-[#F8FAFC] border border-[#E2E8F0] space-y-2 text-xs">
        <div className="flex items-center gap-1.5 font-bold text-[#09090B]">
          <ShieldCheck className="w-4 h-4 text-[#10B981]" />
          <span>Per-Staff Access Control</span>
        </div>
        <p className="text-[#475569] pt-1 leading-relaxed">
          Each staff member gets their own access toggles — grant only what that person needs.
          Permissions are independent per staff (never shared), enforced on the server, and banking
          settings, subscription and staff management always stay owner-only.
        </p>
      </div>

      {/* Staff List Table / Cards */}
      {staffList.length === 0 ? (
        <div className="bg-white border border-[#E2E8F0] rounded-[12px] p-10 text-center space-y-2">
          <Users className="w-10 h-10 text-[#94A3B8] mx-auto mb-2" />
          <h3 className="text-sm font-bold text-[#09090B]">No Staff Members Added</h3>
          <p className="text-xs text-[#64748B] max-w-sm mx-auto">
            Add a warden or manager to let them manage daily room occupancies without granting access to banking settings.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-[#E2E8F0] rounded-[12px] divide-y divide-[#E2E8F0] shadow-xs">
          {staffList.map((staff) => {
            const staffUid = staff.uid || staff.id || '';
            const agg = staff.ratingAgg || { count: 0, sum: 0 };
            const ratingAvg = agg.count > 0 ? Math.round((agg.sum / agg.count) * 10) / 10 : 0;
            return (
            <div key={staffUid} className="p-4 text-xs">
             <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <Avatar name={staff.name} size="md" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[#09090B] text-sm">
                      {staff.name}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-[4px] uppercase ${
                        staff.accountStatus === ACCOUNT_STATUS.ACTIVE
                          ? 'bg-[#ECFDF5] text-[#10B981]'
                          : 'bg-[#FEF2F2] text-[#DC2626]'
                      }`}
                    >
                      {staff.accountStatus}
                    </span>
                    {agg.count > 0 && (
                      <span className="text-[10px] font-bold text-amber-600 flex items-center gap-0.5">
                        <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                        {ratingAvg} ({agg.count})
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[#64748B] mt-0.5">
                    <span className="flex items-center gap-1 min-w-0">
                      <Mail className="w-3 h-3 text-[#94A3B8] shrink-0" />
                      <span className="truncate max-w-[180px] sm:max-w-none">{staff.email}</span>
                    </span>
                    <span className="flex items-center gap-1 font-mono">
                      <Phone className="w-3 h-3 text-[#94A3B8] shrink-0" />
                      <span>+91 {staff.phone}</span>
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setPermsOpenUid(permsOpenUid === staffUid ? null : staffUid)}
                  className="px-2.5 py-1.5 rounded-[6px] border border-[#E2E8F0] hover:bg-[#F8FAFC] text-[#475569] font-semibold transition-colors cursor-pointer"
                >
                  {permsOpenUid === staffUid ? 'Close' : 'Permissions'}
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleStatus(staff)}
                  title={staff.accountStatus === ACCOUNT_STATUS.ACTIVE ? 'Suspend' : 'Activate'}
                  className="p-1.5 rounded-[6px] border border-[#E2E8F0] hover:bg-[#F8FAFC] text-[#475569] transition-colors cursor-pointer"
                >
                  {staff.accountStatus === ACCOUNT_STATUS.ACTIVE ? (
                    <Lock className="w-3.5 h-3.5 text-[#DC2626]" />
                  ) : (
                    <Unlock className="w-3.5 h-3.5 text-[#10B981]" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => handleRevoke(staff)}
                  title="Revoke access"
                  className="p-1.5 rounded-[6px] border border-[#FECACA] hover:bg-[#FEF2F2] text-[#DC2626] transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
             </div>

             {permsOpenUid === staffUid && (
               <StaffPermissionsEditor
                 staffUid={staffUid}
                 initial={(staff.permissions as StaffPermission[]) || DEFAULT_STAFF_PERMISSIONS}
                 onSaved={(perms) =>
                   setStaffList((list) =>
                     list.map((s) => ((s.uid || s.id) === staffUid ? { ...s, permissions: perms } : s))
                   )
                 }
               />
             )}
            </div>
            );
          })}
        </div>
      )}

      {/* INVITE STAFF DRAWER */}
      <Drawer
        isOpen={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
        title="Invite Staff / Warden"
        description="Creates an authorized account bound to your PG accommodation"
        width="md"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsInviteOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="invite-staff-form"
              size="sm"
              variant="solid"
              loading={submitting}
              className="bg-[#D97706] hover:bg-[#B45309] text-white"
            >
              Provision Account
            </Button>
          </div>
        }
      >
        <form
          id="invite-staff-form"
          onSubmit={handleInviteSubmit}
          className="space-y-4 text-left"
        >
          <Input
            label="Staff Full Name"
            placeholder="e.g. Suresh Kumar"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            disabled={submitting}
          />

          <Input
            label="Staff Login Email"
            type="email"
            placeholder="suresh@gmail.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={submitting}
          />

          <PhoneInput
            label="Staff Mobile Number"
            value={phone}
            onChange={setPhone}
            error={phoneError}
            disabled={submitting}
          />

          <div className="p-3.5 rounded-[8px] bg-[#F8FAFC] border border-[#E2E8F0] text-xs text-[#64748B] leading-relaxed">
            The warden can sign in using Google or Email/Password. Custom security claims
            will automatically scope all their reads to your PG.
          </div>
        </form>
      </Drawer>

      {/* Setup-link share: shown once right after inviting a warden */}
      <Drawer
        isOpen={!!setupLinkInfo}
        onClose={() => setSetupLinkInfo(null)}
        title="Share Warden Setup Link"
        description={setupLinkInfo ? `For ${setupLinkInfo.name}` : ''}
        width="md"
      >
        {setupLinkInfo && (
          <div className="space-y-4">
            <p className="text-xs text-[#64748B] leading-relaxed">
              Send this one-time link to the warden so they can set their password and sign in.
              It is shown only now — you can regenerate it later via “Forgot password”.
            </p>
            <div className="p-3 rounded-[8px] bg-[#F8FAFC] border border-[#E2E8F0] break-all text-xs font-mono text-[#334155]">
              {setupLinkInfo.link}
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                type="button"
                variant="solid"
                className="flex-1"
                onClick={() => {
                  navigator.clipboard?.writeText(setupLinkInfo.link);
                  toast.success('Setup link copied');
                }}
              >
                Copy Link
              </Button>
              <a
                className="flex-1"
                href={`https://wa.me/?text=${encodeURIComponent(
                  `Hi ${setupLinkInfo.name}, set up your PGPass warden login here: ${setupLinkInfo.link}`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button type="button" variant="outline" className="w-full">
                  Share on WhatsApp
                </Button>
              </a>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}

export default function StaffPage() {
  return (
    <OwnerOnlyGuard>
      <StaffPageInner />
    </OwnerOnlyGuard>
  );
}
