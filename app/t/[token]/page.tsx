'use client';

import React, { useEffect, useState, use } from 'react';
import { Tenant, Owner, RentRecord } from '@/types';
import {
  getTenantByToken,
  getOwnerProfile,
  getTenantCurrentRentRecord,
} from '@/lib/firestore';
import { getCurrentMonthYear, getWhatsAppLink } from '@/lib/utils';
import { RentStatusCard } from '@/components/tenant/RentStatusCard';
import { ProofUploader } from '@/components/tenant/ProofUploader';
import { DepositVault } from '@/components/tenant/DepositVault';
import {
  Building,
  Phone,
  MessageCircle,
  AlertCircle,
  ShieldCheck,
} from 'lucide-react';
import Link from 'next/link';

interface TenantPageProps {
  params: Promise<{ token: string }>;
}

export default function TenantPortalPage({ params }: TenantPageProps) {
  const resolvedParams = use(params);
  const token = resolvedParams.token;

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [owner, setOwner] = useState<Owner | null>(null);
  const [rentRecord, setRentRecord] = useState<RentRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const t = await getTenantByToken(token);

        if (!t) {
          setNotFound(true);
          setLoading(false);
          return;
        }

        setTenant(t);

        let o = await getOwnerProfile(t.ownerId);
        if (!o) {
          o = {
            id: t.ownerId,
            name: 'PG Owner',
            phone: '',
            pgName: 'PG Accommodation',
            pgAddress: '',
            panNumber: '',
            upiId: '',
          };
        }
        setOwner(o);

        const currentMonth = getCurrentMonthYear();
        const record = await getTenantCurrentRentRecord(t.id, currentMonth);
        if (record) {
          setRentRecord(record);
        } else {
          setRentRecord({
            id: `temp_${t.id}`,
            tenantId: t.id,
            bedId: t.bedId,
            ownerId: t.ownerId,
            monthYear: currentMonth,
            amount: t.monthlyRent || o.monthlyRent || 8500,
            status: 'pending',
          });
        }
      } catch (e) {
        console.error('Error loading resident portal:', e);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-4">
        <div className="w-8 h-8 border-2 border-[#D97706] border-t-transparent rounded-full animate-spin mb-3" />
        <span className="text-xs text-[#64748B] font-medium">Loading resident pass...</span>
      </div>
    );
  }

  if (notFound || !tenant || !owner) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-[#FEF2F2] border border-[#FECACA] text-[#EF4444] flex items-center justify-center mb-3">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-[#09090B]">Link Not Found or Inactive</h2>
        <p className="text-xs text-[#64748B] max-w-sm mt-1 mb-6 leading-relaxed">
          This private resident portal link could not be located. If you moved in recently or switched rooms, please ask your PG manager for an updated link.
        </p>
        <Link
          href="/"
          className="text-xs font-semibold text-[#D97706] bg-[#FEF3C7] hover:bg-[#FDE68A] px-4 py-2 rounded-[8px] border border-[#FDE68A] transition-colors"
        >
          Go to PGPass Home
        </Link>
      </div>
    );
  }

  const handleProofUploaded = (url: string) => {
    if (rentRecord) {
      setRentRecord({
        ...rentRecord,
        status: 'verify',
        proofImageUrl: url,
      });
    }
  };

  const isPaid = rentRecord?.status === 'paid';

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#09090B] flex flex-col items-center px-4 py-6 sm:py-10">
      <div className="w-full max-w-[480px] space-y-4">
        {/* Top PG Info Header */}
        <div className="bg-white border border-[#E2E8F0] rounded-[12px] p-4 shadow-xs flex items-start justify-between text-left">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-[8px] bg-[#FEF3C7] border border-[#FDE68A] text-[#D97706] flex items-center justify-center shrink-0">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-[#09090B] leading-tight">
                {owner.pgName || 'PG Accommodation'}
              </h1>
              {owner.pgAddress && (
                <p className="text-[11px] text-[#64748B] mt-0.5 line-clamp-1">
                  {owner.pgAddress}
                </p>
              )}
              <div className="mt-1 flex items-center gap-2">
                <span className="text-[11px] font-semibold text-[#D97706] bg-[#FEF3C7] px-2 py-0.5 rounded-[4px]">
                  Bed {tenant.bedLabel || 'Assigned'}
                </span>
                <span className="text-[11px] text-[#64748B]">
                  Resident: <strong className="text-[#09090B]">{tenant.name}</strong>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Primary Rent Status & Receipt / Payment Card */}
        <RentStatusCard
          tenant={tenant}
          owner={owner}
          rentRecord={rentRecord}
          onProofUploaded={handleProofUploaded}
        />

        {/* Upload Screenshot if not paid */}
        {!isPaid && (
          <ProofUploader
            rentRecord={rentRecord}
            bedId={tenant.bedId}
            tenantId={tenant.id}
            onSuccess={handleProofUploaded}
          />
        )}

        {/* Move-in Condition Vault */}
        <DepositVault
          tenantId={tenant.id}
          ownerId={owner.id}
          depositAmount={tenant.depositPaid || 0}
          ownerPhone={owner.phone}
          tenantName={tenant.name}
          token={token}
        />

        {/* Contact Owner Action */}
        {owner.phone && (
          <div className="bg-white border border-[#E2E8F0] rounded-[12px] p-3.5 shadow-xs flex items-center justify-between text-xs">
            <span className="text-[#64748B]">Need assistance with your stay?</span>
            <div className="flex items-center gap-2">
              <a
                href={`tel:${owner.phone}`}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-[6px] border border-[#E2E8F0] text-[#09090B] hover:bg-[#F8FAFC] font-semibold transition-colors cursor-pointer"
              >
                <Phone className="w-3.5 h-3.5 text-[#64748B]" />
                <span>Call</span>
              </a>
              <a
                href={getWhatsAppLink(owner.phone, `Hi, I am ${tenant.name} from Bed ${tenant.bedLabel || ''}.`)}
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

        {/* Minimal Footer */}
        <footer className="pt-4 pb-2 text-center text-[11px] text-[#94A3B8] flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-[#10B981]" />
          <span>PGPass Official Resident Portal · Direct P2P Rent System</span>
        </footer>
      </div>
    </div>
  );
}
