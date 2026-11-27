'use client';

import React, { useState, useEffect, useRef } from 'react';
import { RentStatusCard } from '@/components/tenant/RentStatusCard';
import { DepositVault } from '@/components/tenant/DepositVault';
import { RaiseIssue } from '@/components/tenant/RaiseIssue';
import { Phone, MessageCircle, ShieldCheck, Lock, Unlock, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { OtpInput } from '@/components/ui/otp-input';
import { Skeleton } from '@/components/ui/skeleton';
import { StatCardSkeleton, PanelSkeleton } from '@/components/ui/skeletons';
import {
  HeroHeader,
  StatTile,
  InfoBanner,
  QuickActionGrid,
  SectionCard,
  type QuickAction,
} from '@/components/ui/dashboard-kit';
import { IconBubble } from '@/components/brand/Icon3D';
import { Illustration } from '@/components/brand/Illustration';
import { Logo } from '@/components/brand/Logo';
import { formatCurrency, getWhatsAppLink, apiErrorMessage } from '@/lib/utils';
import type { RentRecord } from '@/types';
import toast from 'react-hot-toast';

interface TenantPortalViewProps {
  token: string;
}

interface PortalData {
  tenant: {
    id: string;
    name: string;
    roomNumber?: string;
    bedLabel?: string;
    moveInDate?: string;
    depositPaidPaise?: number;
    securityDepositPaise?: number;
  };
  pg: {
    name: string;
    address?: string;
    upiId?: string;
    upiMerchantName?: string;
    phone?: string;
  };
  rentRecords: RentRecord[];
}

/** Scroll to a section of the unlocked portal (quick actions). */
function scrollToSection(id: string) {
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  document.getElementById(id)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
}

/** Standalone glass top bar (the token portal has no app shell). */
function PortalTopBar({ onLock }: { onLock?: () => void }) {
  return (
    <header
      className="sticky top-0 z-30 glass-bar"
      style={{ paddingTop: 'max(0.6rem, env(safe-area-inset-top))', paddingBottom: '0.6rem' }}
    >
      <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3 px-4">
        <Logo size={36} />
        {onLock && (
          <button
            type="button"
            onClick={onLock}
            title="Lock pass"
            aria-label="Lock pass"
            className="inline-flex h-11 items-center gap-1.5 rounded-full border border-white bg-white/90 px-4 text-[13px] font-bold text-ink-2 shadow-[0_8px_18px_-10px_rgba(70,40,160,0.45)] transition-colors hover:text-brand-700 cursor-pointer press"
          >
            <Lock className="w-4 h-4 text-brand" />
            <span>Lock</span>
          </button>
        )}
      </div>
    </header>
  );
}

export function TenantPortalView({ token }: TenantPortalViewProps) {
  const [portalData, setPortalData] = useState<PortalData | null>(null);
  const [portalAuth, setPortalAuth] = useState<{ token: string; pin: string } | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [submittingPin, setSubmittingPin] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLockedOut, setIsLockedOut] = useState(false);
  const pinWrapRef = useRef<HTMLDivElement>(null);

  const storageKey = `pgpass_pin_${token}`;

  const attemptUnlock = async (pin: string, isAuto = false): Promise<boolean> => {
    try {
      const res = await fetch(`/api/portal/${token}/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        if (res.status === 429) {
          setIsLockedOut(true);
        }
        if (!isAuto) {
          setErrorMsg(apiErrorMessage(data, 'Incorrect verification PIN'));
        }
        localStorage.removeItem(storageKey);
        return false;
      }

      setPortalData(data);
      setPortalAuth({ token, pin });
      setErrorMsg(null);
      localStorage.setItem(storageKey, pin);
      return true;
    } catch {
      if (!isAuto) {
        setErrorMsg('Network error. Please try again.');
      }
      return false;
    }
  };

  useEffect(() => {
    async function init() {
      setLoading(true);
      const savedPin = localStorage.getItem(storageKey);
      if (savedPin) {
        await attemptUnlock(savedPin, true);
      }
      setLoading(false);
    }
    init();
    // Run once per token: auto-unlock from a saved PIN. `attemptUnlock`/`storageKey`
    // are intentionally omitted — they're recreated each render and including them
    // would re-trigger an unlock attempt on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Keep the PIN field auto-focused when the lock screen appears (the OTP boxes
  // don't take `autoFocus`, so focus the first one directly — no state change).
  const showLock = !loading && (!portalData || !portalAuth);
  useEffect(() => {
    if (showLock) pinWrapRef.current?.querySelector('input')?.focus();
  }, [showLock]);

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinInput || pinInput.length !== 4) {
      setErrorMsg('Please enter 4 digits');
      return;
    }

    setSubmittingPin(true);
    await attemptUnlock(pinInput, false);
    setSubmittingPin(false);
  };

  const handleLock = () => {
    localStorage.removeItem(storageKey);
    setPortalAuth(null);
    setPortalData(null);
    setPinInput('');
    toast.success('Session locked');
  };

  if (loading) {
    return (
      <div className="min-h-screen">
        <PortalTopBar />
        <main className="mx-auto w-full max-w-2xl space-y-5 px-4 pt-4 pb-10" aria-busy="true">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2.5 pt-2">
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-8 w-44" />
              <Skeleton className="h-4 w-40 rounded-full" />
            </div>
            <Skeleton className="h-28 w-36 rounded-[28px]" />
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </div>
          <PanelSkeleton height="h-36" />
          <p className="text-center text-xs font-medium text-muted">Verifying resident pass...</p>
        </main>
      </div>
    );
  }

  // 1. PIN Lock Screen (if not authenticated)
  if (!portalData || !portalAuth) {
    return (
      <div className="min-h-screen flex flex-col">
        <PortalTopBar />
        <main className="flex flex-1 items-center justify-center px-4 py-8">
          <div className="app-card w-full max-w-md p-6 sm:p-8 text-center animate-fade-up">
            <Illustration name="shield-orbit" width={180} priority float className="mx-auto" />

            <h2 className="mt-3 text-[22px] font-extrabold leading-tight tracking-[-0.02em] text-ink">
              Resident Pass <span className="text-gradient">Verification</span>
            </h2>
            <p className="mt-2 text-[13px] leading-relaxed text-muted">
              To protect your resident privacy and payment records, enter the{' '}
              <strong className="text-ink">last 4 digits</strong> of your registered mobile number.
            </p>

            <form onSubmit={handlePinSubmit} className="mt-6 space-y-4">
              <div ref={pinWrapRef} className="mx-auto max-w-[248px]">
                <OtpInput
                  length={4}
                  value={pinInput}
                  disabled={isLockedOut || submittingPin}
                  error={!!errorMsg}
                  onChange={(v) => {
                    const val = v.replace(/\D/g, '').slice(0, 4);
                    setPinInput(val);
                    if (errorMsg) setErrorMsg(null);
                  }}
                />
              </div>

              {errorMsg && (
                <div role="alert" className="text-left animate-pop">
                  <InfoBanner tone="danger" title={errorMsg} />
                </div>
              )}

              <Button
                type="submit"
                size="full"
                variant="solid"
                disabled={isLockedOut || pinInput.length !== 4}
                loading={submittingPin}
              >
                <Unlock className="w-4 h-4" />
                <span>Unlock Resident Pass</span>
              </Button>
            </form>

            <div className="mt-6 border-t border-line pt-4 text-center">
              <span className="text-[12px] font-medium text-muted">
                Having trouble? Ask your PG manager for assistance.
              </span>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // No fabricated amount — when there's no rent record yet, leave the due amount
  // unknown (null) so the UI shows "—" instead of inventing ₹8,500.
  const activeRentRecord: RentRecord | undefined = portalData.rentRecords?.[0];

  const quickActions: QuickAction[] = [
    {
      label: 'Pay Rent & Bills',
      description: 'UPI, QR & receipts',
      icon: 'wallet',
      tint: 'violet',
      onClick: () => scrollToSection('portal-rent'),
    },
    {
      label: 'Raise Maintenance',
      description: 'Report issues',
      icon: 'wrench',
      tint: 'sky',
      onClick: () => scrollToSection('portal-issue'),
    },
    {
      label: 'Move-In Vault',
      description: 'Condition photos',
      icon: 'doc',
      tint: 'indigo',
      onClick: () => scrollToSection('portal-vault'),
    },
  ];
  if (portalData.pg.phone) {
    quickActions.push({
      label: 'Contact PG',
      description: 'Call or WhatsApp',
      icon: 'person',
      tint: 'mint',
      onClick: () => scrollToSection('portal-contact'),
    });
  }

  return (
    <div className="min-h-screen text-ink">
      <PortalTopBar onLock={handleLock} />

      <main className="mx-auto w-full max-w-2xl space-y-5 px-4 pt-3 pb-10 text-left animate-fade-up">
        {/* Greeting */}
        <HeroHeader
          variant="light"
          title="Hello,"
          highlight={
            <>
              {portalData.tenant.name} <span className="text-ink">👋</span>
            </>
          }
          subtitle="Welcome back to your PG!"
          meta={
            <div className="space-y-1.5">
              <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-white bg-white/85 px-3.5 py-2 text-[13px] font-semibold text-ink shadow-[0_8px_18px_-10px_rgba(70,40,160,0.45)]">
                <MapPin className="h-4 w-4 shrink-0 text-brand" />
                <span className="truncate">{portalData.pg.name}</span>
              </span>
              {portalData.pg.address && (
                <p className="line-clamp-1 px-1 text-[12px] font-medium text-muted">{portalData.pg.address}</p>
              )}
            </div>
          }
          illustration="hero-resident"
        />

        {/* Room / bed / deposit */}
        <div className="grid grid-cols-3 gap-2.5 sm:gap-3 stagger">
          <StatTile
            icon="bed"
            tint="violet"
            label="Room No."
            value={<span className="break-all">{portalData.tenant.roomNumber || '-'}</span>}
          />
          <StatTile
            icon="bed"
            tint="sky"
            label="Bed No."
            value={<span className="break-all">{portalData.tenant.bedLabel || '-'}</span>}
          />
          <StatTile
            icon="wallet"
            tint="mint"
            label="Deposit"
            value={
              <span className="text-[15px] sm:text-[20px]">
                {formatCurrency(Math.round((portalData.tenant.depositPaidPaise || 0) / 100))}
              </span>
            }
          />
        </div>

        {/* Primary Rent Status Ticket & UPI Settlement */}
        <div id="portal-rent" className="scroll-mt-24">
          <RentStatusCard
            tenant={portalData.tenant}
            pg={portalData.pg}
            rentRecord={activeRentRecord}
            portalAuth={portalAuth}
            onStatusChange={(updated) => {
              setPortalData({
                ...portalData,
                rentRecords: [updated, ...(portalData.rentRecords?.slice(1) || [])],
              });
            }}
          />
        </div>

        {/* Quick navigation to the sections below. The kit's list layout goes
            2-up from 380px (too narrow for the labels) — single column until 520px. */}
        <SectionCard title="Quick Actions" icon="grid">
          <div className="max-[519px]:[&>div]:grid-cols-1">
            <QuickActionGrid layout="list" bare actions={quickActions} />
          </div>
        </SectionCard>

        {/* Move-in Condition Vault */}
        <div id="portal-vault" className="scroll-mt-24">
          <DepositVault
            tenantId={portalData.tenant.id}
            depositAmount={Math.round((portalData.tenant.depositPaidPaise || 0) / 100)}
            ownerPhone={portalData.pg.phone}
            tenantName={portalData.tenant.name}
            token={token}
            portalAuth={portalAuth}
          />
        </div>

        {/* Raise a maintenance issue */}
        <div id="portal-issue" className="scroll-mt-24">
          <RaiseIssue portalAuth={portalAuth} />
        </div>

        {/* Contact PG Manager Action */}
        {portalData.pg.phone && (
          <section id="portal-contact" className="app-card scroll-mt-24 p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <IconBubble icon="person" tint="mint" size={44} />
                <span className="text-[15px] font-bold text-ink">Need help with your stay?</span>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
                <a
                  href={`tel:${portalData.pg.phone}`}
                  className="btn-soft !h-11 !px-4 text-[13px] cursor-pointer"
                >
                  <Phone className="w-4 h-4 text-brand" />
                  <span>Call</span>
                </a>
                <a
                  href={getWhatsAppLink(
                    portalData.pg.phone,
                    `Hi, I am ${portalData.tenant.name} from Bed ${portalData.tenant.bedLabel || ''}.`
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-11 items-center justify-center gap-1.5 rounded-full bg-success px-4 text-[13px] font-bold text-white shadow-[0_12px_24px_-10px_rgba(18,138,91,0.5)] transition-colors hover:bg-success-ink cursor-pointer press"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>WhatsApp</span>
                </a>
              </div>
            </div>
          </section>
        )}

        {/* Privacy-Centric Tamper Evident Footer */}
        <footer className="flex items-center justify-center gap-1.5 pt-2 pb-2 text-center text-[12px] font-medium text-muted">
          <ShieldCheck className="w-4 h-4 shrink-0 text-success" />
          <span>PGPass Official Resident Portal · Direct P2P Rent System</span>
        </footer>
      </main>
    </div>
  );
}
