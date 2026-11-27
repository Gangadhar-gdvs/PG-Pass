'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useOwnerSession } from '@/hooks/useOwner';
import { useAuth } from '@/hooks/useAuth';
import { PageHeader, SectionCard, StatTile, KeyValue } from '@/components/ui/dashboard-kit';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PanelSkeleton, StatGridSkeleton } from '@/components/ui/skeletons';
import { OwnerAvatarEditor } from '@/components/owner/OwnerAvatarEditor';
import { Icon3D } from '@/components/brand/Icon3D';
import { useOwnerAvatarUrl } from '@/lib/client/ownerAvatar';
import { PG_AMENITIES_LIST } from '@/lib/constants/amenities';
import { formatCurrency, ownerPlanTier, errorMessage } from '@/lib/utils';
import { apiGet } from '@/lib/client/api';
import type { Owner } from '@/types';
import { Check, ChevronRight, LogOut, Pencil, Plus } from 'lucide-react';

interface Summary {
  totalBeds: number;
  occupiedBeds: number;
  vacantBeds: number;
  occupancyRate: number;
  monthlyPotential: number;
}

const CATEGORY: Record<string, string> = { gents: 'Gents PG', ladies: 'Ladies PG', coliving: 'Co-living' };
const FOOD: Record<string, string> = { '3_meals': '3 meals a day', '2_meals': '2 meals a day', no_food: 'No food' };
const PLAN_LABEL: Record<string, string> = { free: 'Free', growth: 'Growth', pro: 'Pro' };

/** Owner / staff profile: identity, photo, PG details, rent rules, plan, properties. */
export default function ProfilePage() {
  const { role, email, phoneNumber, properties, selectedPropertyId, setSelectedPropertyId } = useOwnerSession();
  const { user, logout } = useAuth();
  const isStaff = role === 'staff';
  const avatarUrl = useOwnerAvatarUrl(!isStaff);

  const [owner, setOwner] = useState<Owner | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // Owner profile is required; the summary is best-effort (a failure there
      // doesn't block the page).
      const [ownerData, summaryData] = await Promise.all([
        apiGet<Owner>('/api/owners'),
        apiGet<Summary>('/api/owners/summary').catch(() => null),
      ]);
      setOwner(ownerData);
      if (summaryData) setSummary(summaryData);
    } catch (e: unknown) {
      setError(errorMessage(e, 'Could not load your profile'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Defer so setState runs after commit, not in the effect body.
    let active = true;
    queueMicrotask(() => {
      if (active) void load();
    });
    return () => {
      active = false;
    };
  }, [load]);

  const signOut = async () => {
    await logout();
    // Full navigation so bfcache can't restore an authenticated page.
    window.location.replace('/login');
  };

  const displayName = owner?.name || user?.displayName || (isStaff ? 'Warden / Staff' : 'PG Owner');
  const phone = owner?.phone ? `+91 ${owner.phone}` : phoneNumber || '';
  const amenities = (owner?.pgAmenities || [])
    .map((id) => PG_AMENITIES_LIST.find((a) => a.id === id)?.label || id)
    .filter(Boolean);
  const plan = ownerPlanTier(owner);

  if (loading) {
    // Real header during load (shape never changes); body is a skeleton matching
    // the page order: identity card → stat tiles.
    return (
      <div className="space-y-5">
        <PageHeader icon="person" tint="mint" title="My" highlight="Profile" subtitle="Your account & PG details" />
        <PanelSkeleton height="h-24" />
        <StatGridSkeleton count={4} />
      </div>
    );
  }

  if (error || !owner) {
    return (
      <div className="space-y-5">
        <PageHeader icon="person" tint="mint" title="My" highlight="Profile" subtitle="Your account & PG details" />
        <div className="app-card">
          <EmptyState
            icon3d="alert"
            tint="peach"
            title="Couldn't load your profile"
            description={error || 'Please check your connection and try again.'}
            action={<Button onClick={() => void load()}>Try again</Button>}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        icon="person"
        tint="mint"
        title="My"
        highlight="Profile"
        subtitle="Your account & PG details"
        actions={
          !isStaff && (
            <Link href="/settings" className="btn-soft !h-11 !px-4 !text-[13px]">
              <Pencil className="h-4 w-4 text-brand" /> Edit details
            </Link>
          )
        }
      />

      {/* Identity */}
      <section className="app-card p-4 sm:p-5">
        {isStaff ? (
          <div className="flex items-center gap-3.5">
            <Avatar name={user?.displayName || phone || 'Staff'} size="xl" />
            <div className="min-w-0">
              <span className="block truncate text-lg font-extrabold text-ink">{user?.displayName || 'Warden / Staff'}</span>
              <Badge variant="brand">Staff</Badge>
            </div>
          </div>
        ) : (
          <OwnerAvatarEditor
            name={displayName}
            url={avatarUrl}
            title={displayName}
            subtitle={owner.pgName ? `Owner · ${owner.pgName}` : 'PG Owner'}
          />
        )}
        <div className="well mt-4 divide-y divide-line px-3.5 py-1">
          <KeyValue label="Role" value={isStaff ? 'Warden / Staff' : 'Owner'} />
          {phone && <KeyValue label="Mobile" value={phone} />}
          {(owner.email || email) && <KeyValue label="Email" value={<span className="break-all">{owner.email || email}</span>} />}
        </div>
      </section>

      {/* Occupancy */}
      {summary && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile icon="bed" tint="sky" label="Total Beds" value={summary.totalBeds} href="/dashboard" />
          <StatTile icon="users" tint="violet" label="Occupied" value={summary.occupiedBeds} href="/tenants" />
          <StatTile icon="house" tint="slate" label="Vacant" value={summary.vacantBeds} href="/dashboard" />
          <StatTile icon="chart" tint="mint" label="Occupancy" value={`${Math.round(summary.occupancyRate)}%`} href="/analytics" />
        </div>
      )}

      {/* PG details */}
      <SectionCard title="PG details" icon="building">
        <div className="well divide-y divide-line px-3.5 py-1">
          <KeyValue label="PG name" value={owner.pgName || '—'} />
          <KeyValue
            label="Address"
            value={<span className="block max-w-[60vw] text-right sm:max-w-md">{owner.pgAddress || owner.address || '—'}</span>}
          />
          {owner.pgCategory && <KeyValue label="Type" value={CATEGORY[owner.pgCategory] || owner.pgCategory} />}
          {owner.foodPlan && <KeyValue label="Food" value={FOOD[owner.foodPlan] || owner.foodPlan} />}
          {typeof owner.noticePeriodDays === 'number' && <KeyValue label="Notice period" value={`${owner.noticePeriodDays} days`} />}
          {summary && summary.monthlyPotential > 0 && (
            <KeyValue label="Monthly potential" value={formatCurrency(summary.monthlyPotential)} />
          )}
        </div>
        {amenities.length > 0 && (
          <div className="mt-3.5">
            <span className="text-[13px] font-semibold text-ink-2">Amenities</span>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {amenities.map((a) => (
                <span key={a} className="chip">
                  {a}
                </span>
              ))}
            </div>
          </div>
        )}
      </SectionCard>

      {/* Owner-only: rent rules + plan */}
      {!isStaff && (
        <>
          <SectionCard title="Rent collection" icon="rupee">
            <div className="well divide-y divide-line px-3.5 py-1">
              <KeyValue label="UPI ID" value={<span className="break-all">{owner.upiId || '—'}</span>} />
              <KeyValue label="Rent due day" value={`${owner.rentDueDay || 5} of every month`} />
              <KeyValue
                label="Late fee"
                value={owner.lateFeePerDayPaise ? `${formatCurrency(owner.lateFeePerDayPaise / 100)} / day` : 'Off'}
              />
              <KeyValue label="Grace period" value={`${owner.lateFeeGraceDays || 0} days`} />
            </div>
          </SectionCard>

          <Link href="/billing" className="tint-card tint-violet flex items-center gap-3.5 p-4 press lift">
            <Icon3D name="wallet" size={44} />
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-semibold text-ink-2/75">Subscription</span>
              <span className="block text-[16px] font-extrabold text-ink">{PLAN_LABEL[plan] || plan} plan</span>
            </span>
            <ChevronRight className="h-5 w-5 text-brand" />
          </Link>
        </>
      )}

      {/* Properties */}
      {properties.length > 0 && (
        <SectionCard
          title="My PGs"
          icon="house"
          action={<span className="chip shrink-0">{properties.length}</span>}
        >
          <div className="space-y-2">
            {properties.map((p) => {
              const active = p.id === selectedPropertyId;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedPropertyId(p.id)}
                  aria-pressed={active}
                  className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition-colors press ${
                    active ? 'border-brand-200 bg-brand-50' : 'border-[#F0EBFD] bg-white/80 hover:bg-lilac'
                  }`}
                >
                  <Icon3D name="building" size={30} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14.5px] font-bold text-ink">{p.pgName}</span>
                    <span className="block text-xs font-medium text-muted">{p.isPrimary ? 'Main property' : 'Property'}</span>
                  </span>
                  {active ? (
                    <Badge variant="brand" dot>
                      Current
                    </Badge>
                  ) : (
                    <span className="text-xs font-bold text-brand-700">Switch</span>
                  )}
                </button>
              );
            })}
            {!isStaff && (
              <Link
                href="/settings"
                className="flex items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-brand-200 py-3 text-[13px] font-bold text-brand-700 press"
              >
                <Plus className="h-4 w-4" /> Add another PG
              </Link>
            )}
          </div>
        </SectionCard>
      )}

      {/* Actions */}
      <div className="grid gap-2.5 sm:grid-cols-2">
        {!isStaff && (
          <Link href="/settings" className="btn-pill w-full">
            <Pencil className="h-4 w-4" /> Edit profile & PG details
          </Link>
        )}
        <button
          type="button"
          onClick={() => void signOut()}
          className="flex h-12 w-full items-center justify-center gap-1.5 rounded-full border border-[#EEE8FD] bg-white text-sm font-bold text-ink-2 shadow-[0_6px_14px_-10px_rgba(70,40,160,0.4)] transition-colors hover:bg-danger-bg hover:text-danger-ink press"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>
      <p className="flex items-center justify-center gap-1.5 pb-2 text-xs font-medium text-muted">
        <Check className="h-3.5 w-3.5 text-success" /> Your details are private to your PG account.
      </p>
    </div>
  );
}
