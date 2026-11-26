'use client';

import React, { useState, useEffect } from 'react';
import { useOwnerSession } from '@/hooks/useOwner';
import { PLAN_LIMITS } from '@/lib/constants/limits';
import { PlanTier, ACCOUNT_STATUS } from '@/lib/constants/status';
import {
  UserPlus,
  ShieldCheck,
  Phone,
  Mail,
  Trash2,
  Lock,
  Unlock,
  ArrowRight,
  Copy,
  Share2,
  Star,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { PhoneInput } from '@/components/ui/phone-input';
import { Drawer } from '@/components/ui/drawer';
import { Avatar } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/empty-state';
import { HeaderSkeleton, CardListSkeleton, ListSkeleton } from '@/components/ui/skeletons';
import { PageHeader, SectionCard, InfoBanner } from '@/components/ui/dashboard-kit';
import { GlyphTile, IconBubble } from '@/components/brand/Icon3D';
import { validatePhone, sanitizeText } from '@/lib/security';
import { errorMessage, ownerPlanTier } from '@/lib/utils';
import { OwnerOnlyGuard } from '@/components/owner/OwnerOnlyGuard';
import { StaffPermissionsEditor } from '@/components/owner/StaffPermissionsEditor';
import {
  DEFAULT_STAFF_PERMISSIONS,
  STAFF_PERMISSION_LABELS,
  StaffPermission,
} from '@/lib/constants/permissions';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { copyText } from '@/lib/client/clipboard';
import { useConfirm } from '@/components/ui/confirm-dialog';

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
  const [askConfirm, confirmDialogEl] = useConfirm();
  const [profile, setProfile] = useState<{ plan?: PlanTier; planTier?: PlanTier } | null>(null);
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
    if (!ownerId) return;
    // Defer so setState runs after commit, not in the effect body (cascading-render lint rule).
    let active = true;
    queueMicrotask(() => {
      if (active) loadData();
    });
    return () => {
      active = false;
    };
  }, [ownerId]);

  const currentTier: PlanTier = ownerPlanTier(profile);
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
    } catch (err: unknown) {
      toast.error(errorMessage(err, 'Invitation failed'));
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
    } catch (err: unknown) {
      toast.error(errorMessage(err, 'Could not update status'));
    }
  };

  const handleRevoke = async (staff: StaffMember) => {
    const ok = await askConfirm({
      title: 'Revoke staff access?',
      message: `${staff.name} will immediately lose access to this PG. This can't be undone from here.`,
      confirmLabel: 'Revoke access',
    });
    if (!ok) return;

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
    } catch (err: unknown) {
      toast.error(errorMessage(err, 'Could not revoke staff'));
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-5">
        <HeaderSkeleton />
        <CardListSkeleton rows={1} height="h-24" />
        <ListSkeleton rows={3} />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5 text-left">
      {/* Top Header */}
      <PageHeader
        icon="staff"
        tint="indigo"
        title="Staff & Warden"
        highlight="Delegation"
        subtitle="Delegate resident check-ins and rent payment recording with scoped RBAC."
        actions={
          <Button
            variant="solid"
            size="md"
            disabled={!canAddStaff}
            onClick={() => setIsInviteOpen(true)}
          >
            <UserPlus className="h-4 w-4" />
            <span>
              Add Staff Member ({staffList.length}/{currentLimits.maxStaff})
            </span>
          </Button>
        }
      />

      {/* Free Tier Upgrade Banner if maxStaff === 0 */}
      {currentLimits.maxStaff === 0 && (
        <InfoBanner
          tone="brand"
          icon="alert"
          title="Staff Delegation is Locked on Free Tier"
          description={
            <>
              Your PG is on the Free tier (1 owner). Upgrade to{' '}
              <strong className="font-bold text-ink">Growth (1 staff seat)</strong> or{' '}
              <strong className="font-bold text-ink">Pro (5 staff seats)</strong> to invite wardens and assistants.
            </>
          }
          action={
            <Link href="/billing" className="btn-pill h-11 w-full px-5 text-[13px] sm:w-auto">
              <span>View SaaS upgrade options</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          }
        />
      )}

      {/* Scoped RBAC Explanation */}
      <InfoBanner
        tone="info"
        icon={<GlyphTile icon={ShieldCheck} tone="sky" size={40} />}
        title="Per-Staff Access Control"
        description="Each staff member gets their own access toggles — grant only what that person needs. Permissions are independent per staff (never shared), enforced on the server, and banking settings, subscription and staff management always stay owner-only."
      />

      {/* Staff List */}
      {staffList.length === 0 ? (
        <div className="app-card">
          <EmptyState
            icon3d="staff"
            title="No Staff Members Added"
            description="Add a warden or manager to let them manage daily room occupancies without granting access to banking settings."
          />
        </div>
      ) : (
        <SectionCard
          title="Staff Members"
          icon="users"
          action={
            <span className="chip shrink-0 font-mono-numbers">
              {staffList.length}/{currentLimits.maxStaff} seats
            </span>
          }
        >
          <div className="divide-y divide-line stagger">
            {staffList.map((staff) => {
              const staffUid = staff.uid || staff.id || '';
              const agg = staff.ratingAgg || { count: 0, sum: 0 };
              const ratingAvg = agg.count > 0 ? Math.round((agg.sum / agg.count) * 10) / 10 : 0;
              const isActive = staff.accountStatus === ACCOUNT_STATUS.ACTIVE;
              const permsOpen = permsOpenUid === staffUid;
              // Same source the permissions editor starts from, shown as chips.
              const grantedPerms = ((staff.permissions as StaffPermission[]) || DEFAULT_STAFF_PERMISSIONS).filter(
                (p) => p in STAFF_PERMISSION_LABELS
              );
              return (
                <div key={staffUid} className="py-4 first:pt-1 last:pb-1">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <Avatar name={staff.name} size="lg" />
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="mr-0.5 text-[15px] font-bold text-ink">{staff.name}</span>
                          <Badge variant={isActive ? 'paid' : 'danger'} dot className="capitalize">
                            {(staff.accountStatus || '').replace(/_/g, ' ')}
                          </Badge>
                          {staff.role && (
                            <Badge variant="brand" className="capitalize">
                              {staff.role}
                            </Badge>
                          )}
                          {agg.count > 0 && (
                            <Badge variant="pending">
                              <Star className="h-3 w-3 fill-current" />
                              {ratingAvg} ({agg.count})
                            </Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] font-medium text-muted">
                          <span className="flex min-w-0 items-center gap-1.5">
                            <Mail className="h-3.5 w-3.5 shrink-0 text-faint" />
                            <span className="max-w-[200px] truncate sm:max-w-none">{staff.email}</span>
                          </span>
                          <span className="flex items-center gap-1.5 font-mono-numbers">
                            <Phone className="h-3.5 w-3.5 shrink-0 text-faint" />
                            <span>+91 {staff.phone}</span>
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                          {grantedPerms.length === 0 ? (
                            <Badge variant="vacant">No access granted</Badge>
                          ) : (
                            <>
                              {grantedPerms.slice(0, 3).map((p) => (
                                <span key={p} className="chip">
                                  {STAFF_PERMISSION_LABELS[p]}
                                </span>
                              ))}
                              {grantedPerms.length > 3 && (
                                <span className="chip bg-lilac-2 text-ink-2">+{grantedPerms.length - 3} more</span>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-2 min-[380px]:pl-[60px] sm:pl-0">
                      <Button
                        type="button"
                        variant="soft"
                        size="md"
                        aria-expanded={permsOpen}
                        onClick={() => setPermsOpenUid(permsOpenUid === staffUid ? null : staffUid)}
                      >
                        <ShieldCheck className="h-4 w-4" />
                        {permsOpen ? 'Close' : 'Permissions'}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => handleToggleStatus(staff)}
                        title={isActive ? 'Suspend' : 'Activate'}
                        aria-label={isActive ? 'Suspend' : 'Activate'}
                        className="shrink-0"
                      >
                        {isActive ? (
                          <Lock className="h-4 w-4 text-danger" />
                        ) : (
                          <Unlock className="h-4 w-4 text-success" />
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => handleRevoke(staff)}
                        title="Revoke access"
                        aria-label="Revoke access"
                        className="shrink-0"
                      >
                        <Trash2 className="h-4 w-4 text-danger" />
                      </Button>
                    </div>
                  </div>

                  {permsOpen && (
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
        </SectionCard>
      )}

      {/* INVITE STAFF DRAWER */}
      <Drawer
        isOpen={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
        title="Invite Staff / Warden"
        description="Creates an authorized account bound to your PG accommodation"
        width="md"
        footer={
          <div className="grid grid-cols-2 gap-2.5 sm:flex sm:justify-end">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => setIsInviteOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="invite-staff-form"
              size="md"
              variant="solid"
              loading={submitting}
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

          <div className="well flex items-start gap-3 p-3.5">
            <IconBubble icon={<ShieldCheck className="h-4.5 w-4.5" />} tint="violet" size={36} />
            <p className="text-[13px] leading-relaxed text-ink-2">
              The warden can sign in using Google or Email/Password. Custom security claims
              will automatically scope all their reads to your PG.
            </p>
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
            <p className="text-[13px] leading-relaxed text-ink-2">
              Send this one-time link to the warden so they can set their password and sign in.
              It is shown only now — you can regenerate it later via “Forgot password”.
            </p>
            <div className="well break-all p-3.5 font-mono text-xs text-ink-2">
              {setupLinkInfo.link}
            </div>
            <div className="flex flex-col gap-2.5 sm:flex-row">
              <Button
                type="button"
                variant="solid"
                className="flex-1"
                onClick={async () => {
                  if (await copyText(setupLinkInfo.link)) toast.success('Setup link copied');
                  else toast.error('Could not copy — long-press or select the text to copy it manually');
                }}
              >
                <Copy className="h-4 w-4" />
                Copy Link
              </Button>
              <a
                className="btn-soft h-11 flex-1 text-sm"
                href={`https://wa.me/?text=${encodeURIComponent(
                  `Hi ${setupLinkInfo.name}, set up your PGPass warden login here: ${setupLinkInfo.link}`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Share2 className="h-4 w-4 text-brand" />
                Share on WhatsApp
              </a>
            </div>
          </div>
        )}
      </Drawer>
      {confirmDialogEl}
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
