'use client';

import React, { useState, useEffect } from 'react';
import { RentStatusCard } from '@/components/tenant/RentStatusCard';
import { DepositVault } from '@/components/tenant/DepositVault';
import { RaiseIssue } from '@/components/tenant/RaiseIssue';
import {
  Building,
  Phone,
  MessageCircle,
  AlertCircle,
  ShieldCheck,
  Lock,
  Unlock,
  KeyRound,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getWhatsAppLink } from '@/lib/utils';
import Link from 'next/link';
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
  rentRecords: any[];
}

export function TenantPortalView({ token }: TenantPortalViewProps) {
  const [portalData, setPortalData] = useState<PortalData | null>(null);
  const [portalAuth, setPortalAuth] = useState<{ token: string; pin: string } | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [submittingPin, setSubmittingPin] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLockedOut, setIsLockedOut] = useState(false);

  const storageKey = `pgpass_pin_${token}`;

  const attemptUnlock = async (pin: string, isAuto = false): Promise<boolean> => {
    try {
      const res = await fetch(`/api/portal/${token}/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 429) {
          setIsLockedOut(true);
        }
        if (!isAuto) {
          setErrorMsg(data.message || 'Incorrect verification PIN');
        }
        localStorage.removeItem(storageKey);
        return false;
      }

      setPortalData(data);
      setPortalAuth({ token, pin });
      setErrorMsg(null);
      localStorage.setItem(storageKey, pin);
      return true;
    } catch (err: any) {
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
  }, [token]);

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
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-4">
        <div className="w-8 h-8 border-2 border-[#D97706] border-t-transparent rounded-full animate-spin mb-3" />
        <span className="text-xs text-[#64748B] font-medium">Verifying resident pass...</span>
      </div>
    );
  }

  // 1. PIN Lock Screen (if not authenticated)
  if (!portalData || !portalAuth) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-[400px] bg-white border border-[#E2E8F0] rounded-[16px] p-6 shadow-sm text-center">
          <div className="w-12 h-12 rounded-full bg-[#FEF3C7] border border-[#FDE68A] text-[#D97706] flex items-center justify-center mx-auto mb-3">
            <Lock className="w-6 h-6" />
          </div>

          <h2 className="text-base font-bold text-[#09090B]">Resident Pass Verification</h2>
          <p className="text-xs text-[#64748B] mt-1 mb-5 leading-relaxed">
            To protect your resident privacy and payment records, enter the{' '}
            <strong className="text-[#09090B]">last 4 digits</strong> of your registered mobile number.
          </p>

          <form onSubmit={handlePinSubmit} className="space-y-4">
            <div>
              <div className="relative">
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={4}
                  autoFocus
                  disabled={isLockedOut || submittingPin}
                  placeholder="• • • •"
                  value={pinInput}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                    setPinInput(val);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  className="w-full h-12 text-center text-xl font-mono tracking-[0.5em] font-bold rounded-[8px] border border-[#CBD5E1] bg-[#F8FAFC] focus:bg-white focus:outline-none focus:border-[#D97706] transition-all"
                />
              </div>
              {errorMsg && (
                <div className="mt-2 text-left p-2.5 rounded-[6px] bg-[#FEF2F2] border border-[#FECACA] flex items-start gap-1.5 text-xs text-[#DC2626]">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}
            </div>

            <Button
              type="submit"
              size="lg"
              variant="solid"
              disabled={isLockedOut || pinInput.length !== 4}
              loading={submittingPin}
              className="w-full bg-[#D97706] hover:bg-[#B45309] text-white font-semibold"
            >
              <Unlock className="w-4 h-4 mr-1.5" />
              <span>Unlock Resident Pass</span>
            </Button>
          </form>

          <div className="mt-6 pt-4 border-t border-[#F1F5F9] text-center">
            <span className="text-[11px] text-[#94A3B8]">
              Having trouble? Ask your PG manager for assistance.
            </span>
          </div>
        </div>
      </div>
    );
  }

  const activeRentRecord = portalData.rentRecords?.[0] || {
    period: new Date().toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }),
    amountDuePaise: 850000,
    status: 'pending',
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#09090B] flex flex-col items-center px-4 py-6 sm:py-10">
      <div className="w-full max-w-[480px] space-y-4">
        {/* Top Header Card */}
        <div className="bg-white border border-[#E2E8F0] rounded-[12px] p-4 shadow-xs flex items-start justify-between text-left">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-[8px] bg-[#FEF3C7] border border-[#FDE68A] text-[#D97706] flex items-center justify-center shrink-0">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-[#09090B] leading-tight">
                {portalData.pg.name}
              </h1>
              {portalData.pg.address && (
                <p className="text-[11px] text-[#64748B] mt-0.5 line-clamp-1">
                  {portalData.pg.address}
                </p>
              )}
              <div className="mt-1 flex items-center gap-2">
                <span className="text-[11px] font-semibold text-[#D97706] bg-[#FEF3C7] px-2 py-0.5 rounded-[4px]">
                  Room {portalData.tenant.roomNumber || '-'} · Bed {portalData.tenant.bedLabel || '-'}
                </span>
                <span className="text-[11px] text-[#64748B]">
                  Resident: <strong className="text-[#09090B]">{portalData.tenant.name}</strong>
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLock}
            title="Lock pass"
            className="p-1.5 rounded-[6px] text-[#94A3B8] hover:text-[#09090B] hover:bg-[#F1F5F9] transition-colors cursor-pointer"
          >
            <Lock className="w-4 h-4" />
          </button>
        </div>

        {/* Primary Rent Status Ticket & UPI Settlement */}
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

        {/* Move-in Condition Vault */}
        <DepositVault
          tenantId={portalData.tenant.id}
          depositAmount={Math.round((portalData.tenant.depositPaidPaise || 0) / 100)}
          ownerPhone={portalData.pg.phone}
          tenantName={portalData.tenant.name}
          token={token}
          portalAuth={portalAuth}
        />

        {/* Raise a maintenance issue */}
        <RaiseIssue portalAuth={portalAuth} />

        {/* Contact PG Manager Action */}
        {portalData.pg.phone && (
          <div className="bg-white border border-[#E2E8F0] rounded-[12px] p-3.5 shadow-xs flex items-center justify-between text-xs">
            <span className="text-[#64748B]">Need help with your stay?</span>
            <div className="flex items-center gap-2">
              <a
                href={`tel:${portalData.pg.phone}`}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-[6px] border border-[#E2E8F0] text-[#09090B] hover:bg-[#F8FAFC] font-semibold transition-colors cursor-pointer"
              >
                <Phone className="w-3.5 h-3.5 text-[#64748B]" />
                <span>Call</span>
              </a>
              <a
                href={getWhatsAppLink(
                  portalData.pg.phone,
                  `Hi, I am ${portalData.tenant.name} from Bed ${portalData.tenant.bedLabel || ''}.`
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-[6px] bg-[#10B981] hover:bg-[#059669] text-white font-semibold transition-colors cursor-pointer"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>WhatsApp</span>
              </a>
            </div>
          </div>
        )}

        {/* Privacy-Centric Tamper Evident Footer */}
        <footer className="pt-4 pb-2 text-center text-[11px] text-[#94A3B8] flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-[#10B981]" />
          <span>PGPass Official Resident Portal · Direct P2P Rent System</span>
        </footer>
      </div>
    </div>
  );
}
