'use client';

import React, { useState, useEffect } from 'react';
import { useOwnerSession } from '@/hooks/useOwner';
import { useBeds } from '@/hooks/useBeds';
import { PLAN_LIMITS } from '@/lib/constants/limits';
import { PLAN_TIER, PlanTier } from '@/lib/constants/status';
import type { Owner } from '@/types';
import { formatCurrency, errorMessage, ownerPlanTier } from '@/lib/utils';
import { fetchJson } from '@/hooks/useAsyncData';
import { apiPost } from '@/lib/client/api';
import { LoadError } from '@/components/ui/load-error';
import { generateQrDataUrl } from '@/lib/client/qrcode';
import { buildUpiPayload } from '@/lib/client/upi';
import { Check, Camera, Sparkles, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input, fieldLabelClass } from '@/components/ui/input';
import { Drawer } from '@/components/ui/drawer';
import { ProgressBar } from '@/components/ui/progress-bar';
import { CardListSkeleton, PanelSkeleton } from '@/components/ui/skeletons';
import { PageHeader, SectionCard } from '@/components/ui/dashboard-kit';
import { IconBubble, IconTile, type Icon3DName, type Tint } from '@/components/brand/Icon3D';
import { OwnerOnlyGuard } from '@/components/owner/OwnerOnlyGuard';
import toast from 'react-hot-toast';

const ADMIN_BILLING_UPI = 'pgpass.billing@icici';

/** Green gradient check used in plan feature lists. */
function FeatureCheck() {
  return (
    <span
      aria-hidden="true"
      className="mt-px grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[linear-gradient(135deg,#4FD69C_0%,#17A06B_100%)] text-white shadow-[0_4px_8px_-4px_rgba(23,160,107,0.6)]"
    >
      <Check className="h-3 w-3" strokeWidth={3.2} />
    </span>
  );
}

/**
 * Glass plan card. The owner's CURRENT plan gets a violet gradient border; the
 * rest are plain glass with a hover lift.
 */
function PlanCard({
  icon,
  tint,
  name,
  price,
  period,
  blurb,
  features,
  current,
  badge,
  action,
}: {
  icon: Icon3DName;
  tint: Tint;
  name: string;
  price: string;
  period: string;
  blurb: string;
  features: string[];
  current: boolean;
  badge?: React.ReactNode;
  action: React.ReactNode;
}) {
  const body = (
    <div
      className={`flex h-full flex-col justify-between p-5 sm:p-6 ${
        current ? 'rounded-[20px] bg-[linear-gradient(180deg,#FFFFFF_0%,#F8F4FF_100%)]' : ''
      }`}
    >
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <IconTile icon={icon} tint={tint} size={48} />
          {badge}
        </div>
        <div>
          <h3 className="text-[17px] font-extrabold tracking-[-0.015em] text-ink">{name}</h3>
          <div className="mt-1.5 flex items-baseline gap-1">
            <span className="font-mono-numbers text-[32px] font-extrabold leading-none tracking-[-0.03em] text-ink">
              {price}
            </span>
            <span className="text-[13px] font-semibold text-muted">{period}</span>
          </div>
          <p className="mt-2 text-[13px] leading-relaxed text-muted">{blurb}</p>
        </div>
        <ul className="space-y-2.5 border-t border-line pt-4">
          {features.map((f) => (
            <li key={f} className="flex items-start gap-2.5 text-[13px] font-medium text-ink-2">
              <FeatureCheck />
              <span>{f}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="pt-6">{action}</div>
    </div>
  );

  if (current) {
    return (
      <div className="h-full rounded-[22px] bg-[image:var(--grad-brand)] p-[2px] shadow-[0_24px_48px_-22px_rgba(106,43,234,0.6)]">
        {body}
      </div>
    );
  }
  return <div className="app-card lift h-full">{body}</div>;
}

const ActiveBadge = () => (
  <Badge variant="paid" dot className="shrink-0">
    Active
  </Badge>
);

/** Selectable billing-cycle option (radio-style card). */
function CycleOption({
  active,
  onClick,
  title,
  price,
  extra,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  price: string;
  extra?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`relative flex min-h-[76px] flex-col justify-center rounded-2xl border-2 p-3.5 text-left transition-all press ${
        active
          ? 'border-brand bg-brand-50 shadow-[0_12px_24px_-16px_rgba(106,43,234,0.8)]'
          : 'border-white bg-white/80 shadow-[0_8px_18px_-12px_rgba(70,40,160,0.35)] hover:border-brand-200'
      }`}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className={`grid h-4.5 w-4.5 place-items-center rounded-full border-2 ${
              active ? 'border-brand bg-[image:var(--grad-brand)]' : 'border-line-strong bg-white'
            }`}
          >
            {active && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
          </span>
          <span className={`text-[13px] font-bold ${active ? 'text-brand-700' : 'text-ink-2'}`}>{title}</span>
        </span>
        {extra}
      </span>
      <span className="mt-1.5 block font-mono-numbers text-[17px] font-extrabold tracking-[-0.02em] text-ink">
        {price}
      </span>
    </button>
  );
}

function BillingPageInner() {
  const { ownerId } = useOwnerSession();
  const { beds } = useBeds(ownerId);

  const [profile, setProfile] = useState<(Owner & { planTier?: PlanTier }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Upgrade Modal State
  const [selectedPlan, setSelectedPlan] = useState<PlanTier | null>(null);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [utrInput, setUtrInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');

  useEffect(() => {
    async function load() {
      try {
        // Surface a load failure instead of silently defaulting the owner to the
        // Free plan + quotas when the profile couldn't be fetched.
        const data = await fetchJson<Owner & { planTier?: PlanTier }>('/api/owners');
        setProfile(data);
        setLoadError(null);
      } catch (e) {
        setLoadError(errorMessage(e, "Couldn't load your subscription. Please try again."));
      } finally {
        setLoading(false);
      }
    }
    if (ownerId) load();
  }, [ownerId, reloadKey]);

  const currentTier: PlanTier = ownerPlanTier(profile);
  const currentLimits = PLAN_LIMITS[currentTier] || PLAN_LIMITS.free;

  const totalBedsCount = beds.length;
  const bedUsagePercent = Math.min(
    Math.round((totalBedsCount / currentLimits.maxBeds) * 100),
    100
  );

  // Price calculations in rupees
  const getPlanPriceRupees = (tier: PlanTier, cycle: 'monthly' | 'yearly') => {
    if (tier === PLAN_TIER.GROWTH) {
      return cycle === 'monthly' ? 999 : 9990; // 2 months free on yearly
    }
    if (tier === PLAN_TIER.PRO) {
      return cycle === 'monthly' ? 1999 : 19990;
    }
    return 0;
  };

  const selectedAmountRupees = selectedPlan
    ? getPlanPriceRupees(selectedPlan, billingCycle)
    : 0;

  useEffect(() => {
    if (selectedPlan && selectedAmountRupees > 0) {
      const upiLink = buildUpiPayload({
        upiId: ADMIN_BILLING_UPI,
        merchantName: 'PGPass Platform SaaS',
        amountPaise: selectedAmountRupees * 100,
        transactionNote: `SaaS ${selectedPlan.toUpperCase()} Plan PG ${profile?.pgName || ownerId.slice(0, 6)}`,
      });
      generateQrDataUrl(upiLink).then(setQrDataUrl);
    }
  }, [selectedPlan, billingCycle, selectedAmountRupees, profile, ownerId]);

  const handleUpgradeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlan || selectedPlan === PLAN_TIER.FREE) return;

    const cleanUtr = utrInput.trim().toUpperCase();
    if (cleanUtr.length < 6) {
      toast.error('Please enter a valid 12-digit UPI UTR reference number');
      return;
    }

    setSubmitting(true);
    try {
      await apiPost('/api/billing/upgrade', {
        requestedPlan: selectedPlan,
        billingCycle,
        amountPaise: selectedAmountRupees * 100,
        utrReference: cleanUtr,
      });

      toast.success('Upgrade request submitted! Admin will activate your tier shortly.');
      setSelectedPlan(null);
      setUtrInput('');
    } catch (err: unknown) {
      toast.error(errorMessage(err, 'Submission error'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    // Real header during load so its shape doesn't change when data arrives.
    return (
      <div className="max-w-5xl mx-auto space-y-5">
        <PageHeader
          icon="rupee"
          tint="mint"
          title="Subscription &"
          highlight="Platform Quotas"
          subtitle="Flat, zero-commission SaaS pricing. Never pay a percentage of your rent."
        />
        <PanelSkeleton height="h-48" />
        <CardListSkeleton rows={3} height="h-80" cols={3} />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="max-w-5xl mx-auto">
        <LoadError message={loadError} onRetry={() => { setLoading(true); setLoadError(null); setReloadKey((k) => k + 1); }} />
      </div>
    );
  }

  const bedSlotsLeft = currentLimits.maxBeds - totalBedsCount;

  return (
    <div className="max-w-5xl mx-auto space-y-5 text-left">
      {/* Top Header */}
      <PageHeader
        icon="rupee"
        tint="mint"
        title="Subscription &"
        highlight="Platform Quotas"
        subtitle="Flat, zero-commission SaaS pricing. Never pay a percentage of your rent."
        actions={
          <span className="inline-flex h-10 items-center gap-2 rounded-full border border-white bg-white/75 pl-4 pr-1.5 text-[13px] font-semibold text-muted shadow-[0_6px_16px_-10px_rgba(70,40,160,0.4)]">
            Active Tier
            <span className="inline-flex h-7 items-center rounded-full bg-[image:var(--grad-brand)] px-3 text-xs font-bold capitalize text-white shadow-[var(--shadow-brand)]">
              {currentTier} Plan
            </span>
          </span>
        }
      />

      {/* Resource Quotas */}
      <SectionCard title="Your Quotas" icon="grid">
        <div className="divide-y divide-line">
          {/* Bed Quota */}
          <div className="flex items-start gap-3 py-3 first:pt-0">
            <IconBubble icon="bed" tint="sky" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <span className="text-[14.5px] font-bold text-ink">Bed Inventory</span>
                <span className="font-mono-numbers text-[14px] font-extrabold text-ink">
                  {totalBedsCount} / {currentLimits.maxBeds}
                </span>
              </div>
              <ProgressBar
                value={bedUsagePercent}
                color={bedUsagePercent > 85 ? 'amber' : 'emerald'}
                height="md"
              />
              <span className="block text-[12.5px] font-medium text-muted">
                {bedSlotsLeft > 0 ? `${bedSlotsLeft} slots available` : 'Bed quota limit reached'}
              </span>
            </div>
          </div>

          {/* Staff Allocation */}
          <div className="flex items-start gap-3 py-3">
            <IconBubble icon="staff" tint="indigo" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <span className="text-[14.5px] font-bold text-ink">Staff / Wardens</span>
                <span className="font-mono-numbers text-[14px] font-extrabold text-ink">
                  {currentLimits.maxStaff} allowed
                </span>
              </div>
              <p className="mt-0.5 text-[12.5px] font-medium leading-relaxed text-muted">
                {currentLimits.maxStaff === 0
                  ? 'Upgrade to Growth or Pro to delegate warden check-ins.'
                  : `Manage up to ${currentLimits.maxStaff} staff assistants with scoped access.`}
              </p>
            </div>
          </div>

          {/* Photo Vault */}
          <div className="flex items-start gap-3 py-3 last:pb-0">
            <IconBubble icon={<Camera className="h-5 w-5" />} tint="peach" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <span className="text-[14.5px] font-bold text-ink">Backblaze B2 Vault</span>
                <span className="font-mono-numbers text-[14px] font-extrabold text-ink">
                  Up to {currentLimits.maxPhotos} photos
                </span>
              </div>
              <p className="mt-0.5 text-[12.5px] font-medium leading-relaxed text-muted">
                Encrypted private condition photos and payment screenshot archives.
              </p>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* Tier Comparison & Upgrade Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 stagger">
        {/* FREE TIER */}
        <PlanCard
          icon="home-blue"
          tint="sky"
          name="Free Tier"
          price="₹0"
          period="/ forever"
          blurb="Perfect for single-owner small PGs starting out."
          features={[
            'Up to 20 beds inventory',
            '0% direct UPI settlement',
            'Sequential HRA tax receipts',
            'Up to 40 B2 inspection photos',
          ]}
          current={currentTier === PLAN_TIER.FREE}
          badge={currentTier === PLAN_TIER.FREE ? <ActiveBadge /> : undefined}
          action={
            <Button variant="outline" size="full" disabled={currentTier === PLAN_TIER.FREE}>
              {currentTier === PLAN_TIER.FREE ? 'Current Plan' : 'Free Tier'}
            </Button>
          }
        />

        {/* GROWTH TIER */}
        <PlanCard
          icon="building"
          tint="violet"
          name="Growth"
          price="₹999"
          period="/ month"
          blurb="For mid-size PGs managing up to 100 residents."
          features={[
            'Up to 100 beds inventory',
            '1 Warden / Staff delegation seat',
            'Up to 500 B2 encrypted photos',
            'Priority WhatsApp reminder queues',
          ]}
          current={currentTier === PLAN_TIER.GROWTH}
          badge={
            currentTier === PLAN_TIER.GROWTH ? (
              <ActiveBadge />
            ) : (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[image:var(--grad-brand)] px-3 py-1 text-[11.5px] font-bold text-white shadow-[var(--shadow-brand)]">
                <Sparkles className="h-3.5 w-3.5" />
                Most Popular
              </span>
            )
          }
          action={
            <Button
              variant={currentTier === PLAN_TIER.GROWTH ? 'outline' : 'solid'}
              size="full"
              disabled={currentTier === PLAN_TIER.GROWTH}
              onClick={() => setSelectedPlan(PLAN_TIER.GROWTH)}
            >
              {currentTier === PLAN_TIER.GROWTH ? (
                'Current Plan'
              ) : (
                <>
                  Upgrade to Growth
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          }
        />

        {/* PRO TIER */}
        <PlanCard
          icon="star"
          tint="amber"
          name="Pro Enterprise"
          price="₹1,999"
          period="/ month"
          blurb="For large coliving buildings with multiple wardens."
          features={[
            'Up to 500 beds inventory',
            '5 Warden delegation seats',
            'Up to 2,500 B2 photos archive',
            'Audit logging & priority SLA',
          ]}
          current={currentTier === PLAN_TIER.PRO}
          badge={currentTier === PLAN_TIER.PRO ? <ActiveBadge /> : undefined}
          action={
            <Button
              variant={currentTier === PLAN_TIER.PRO ? 'outline' : 'solid'}
              size="full"
              disabled={currentTier === PLAN_TIER.PRO}
              onClick={() => setSelectedPlan(PLAN_TIER.PRO)}
            >
              {currentTier === PLAN_TIER.PRO ? (
                'Current Plan'
              ) : (
                <>
                  Upgrade to Pro
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          }
        />
      </div>

      {/* UPGRADE MODAL DRAWER */}
      {selectedPlan && (
        <Drawer
          isOpen={!!selectedPlan}
          onClose={() => setSelectedPlan(null)}
          title={`Upgrade to ${selectedPlan.toUpperCase()} Plan`}
          description="0% Gateway Fee settlement via Direct UPI to Platform"
          width="md"
        >
          <form onSubmit={handleUpgradeSubmit} className="space-y-5 text-left">
            {/* Billing Cycle Selector */}
            <div role="group" aria-labelledby="billing-cycle-label" className="space-y-2">
              <span id="billing-cycle-label" className={fieldLabelClass}>
                Billing Cycle
              </span>
              <div className="grid grid-cols-2 gap-2.5">
                <CycleOption
                  active={billingCycle === 'monthly'}
                  onClick={() => setBillingCycle('monthly')}
                  title="Monthly"
                  price={formatCurrency(getPlanPriceRupees(selectedPlan, 'monthly'))}
                />
                <CycleOption
                  active={billingCycle === 'yearly'}
                  onClick={() => setBillingCycle('yearly')}
                  title="Yearly"
                  price={formatCurrency(getPlanPriceRupees(selectedPlan, 'yearly'))}
                  extra={<Badge variant="paid">2 Mo Free</Badge>}
                />
              </div>
            </div>

            {/* QR Code and Payment Details */}
            <div className="well flex flex-col items-center gap-3 p-5 text-center">
              <span className="text-[13px] font-medium text-ink-2">
                Scan to pay{' '}
                <span className="font-mono-numbers font-extrabold text-ink">
                  {formatCurrency(selectedAmountRupees)}
                </span>{' '}
                via any UPI App:
              </span>
              <div className="rounded-[20px] border border-white bg-white p-2.5 shadow-[0_14px_30px_-16px_rgba(70,40,160,0.45)]">
                {qrDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- dynamic client-generated data-URL QR code; next/image can't optimize a runtime data URL
                  <img
                    src={qrDataUrl}
                    alt="Admin UPI QR"
                    className="h-40 w-40 rounded-xl"
                  />
                ) : (
                  <div className="flex h-40 w-40 items-center justify-center rounded-xl animate-shimmer text-xs font-semibold text-muted">
                    Loading QR...
                  </div>
                )}
              </div>
              <span className="chip font-mono text-[12.5px]">{ADMIN_BILLING_UPI}</span>
            </div>

            {/* UTR Reference Input */}
            <Input
              label="Enter 12-digit UPI UTR Reference"
              type="text"
              required
              maxLength={32}
              placeholder="e.g. 432198765432"
              value={utrInput}
              onChange={(e) => setUtrInput(e.target.value)}
              helperText="Found in your GPay, PhonePe, or Paytm payment details."
              className="font-mono tracking-wide"
            />

            <Button type="submit" size="full" variant="success" loading={submitting}>
              <span>Submit Payment for Activation</span>
            </Button>
          </form>
        </Drawer>
      )}
    </div>
  );
}

export default function BillingPage() {
  return (
    <OwnerOnlyGuard>
      <BillingPageInner />
    </OwnerOnlyGuard>
  );
}
