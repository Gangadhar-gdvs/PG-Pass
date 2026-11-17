'use client';

import React, { useEffect, useState, use } from 'react';
import { Tenant, Owner, RentRecord } from '@/types';
import {
  getTenantByToken,
  getOwnerProfile,
  getTenantCurrentRentRecord,
} from '@/lib/firestore';
import { getCurrentMonthYear } from '@/lib/utils';
import { RentStatusCard } from '@/components/tenant/RentStatusCard';
import { ProofUploader } from '@/components/tenant/ProofUploader';
import { DepositVault } from '@/components/tenant/DepositVault';
import { AffiliateCard } from '@/components/monetization/AffiliateCard';
import {
  Building2,
  Phone,
  MessageCircle,
  HelpCircle,
  ShieldCheck,
  CheckCircle,
  AlertTriangle,
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
        let t = await getTenantByToken(token);

        // Fallback for "demo" token or testing
        if (!t && (token === 'demo' || token === 'sample')) {
          t = {
            id: 'demo_tenant_1',
            ownerId: 'owner_demo_101',
            bedId: 'owner_demo_101_101-A',
            bedLabel: '101-A',
            roomNumber: '101',
            name: 'Rahul Sharma',
            phone: '9876543210',
            moveInDate: '2026-11-01',
            depositPaid: 8500,
            token: 'demo',
            active: true,
          };
        }

        if (!t) {
          setNotFound(true);
          setLoading(false);
          return;
        }

        setTenant(t);

        // Fetch Owner Details
        let o = await getOwnerProfile(t.ownerId);
        if (!o) {
          o = {
            id: t.ownerId,
            name: 'Suresh Reddy',
            phone: '9876543210',
            pgName: 'Sri Krishna Luxury PG',
            pgAddress: 'Plot 42, Ayyappa Society, Madhapur, Hyderabad - 500081',
            panNumber: 'ABCDE1234F',
            upiId: 'sureshreddy@okicici',
            totalFloors: 3,
            roomsPerFloor: 4,
            bedsPerRoom: 2,
            monthlyRent: 8500,
          };
        }
        setOwner(o);

        // Fetch Current Month Rent Record
        const currentMonth = getCurrentMonthYear();
        const record = await getTenantCurrentRentRecord(t.id, currentMonth);
        if (record) {
          setRentRecord(record);
        } else {
          // Default pending record
          setRentRecord({
            id: 'temp_rec_1',
            tenantId: t.id,
            bedId: t.bedId,
            ownerId: t.ownerId,
            monthYear: currentMonth,
            amount: 8500,
            status: 'pending',
          });
        }
      } catch (e) {
        console.error('Error loading resident portal:', e);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#090d16] flex flex-col items-center justify-center p-4">
        <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
        <span className="text-xs text-slate-400 font-medium">Securing Resident Portal...</span>
      </div>
    );
  }

  if (notFound || !tenant || !owner) {
    return (
      <div className="min-h-screen bg-[#090d16] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-rose-500/10 text-rose-400 flex items-center justify-center mb-4">
          <AlertTriangle className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Portal Link Not Found</h2>
        <p className="text-xs text-slate-400 max-w-sm mb-6 leading-relaxed">
          The link you opened might be expired or incorrect. Please ask your PG owner to resend your WhatsApp link.
        </p>
        <Link
          href="/"
          className="text-xs font-bold text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 px-4 py-2 rounded-xl border border-indigo-500/20"
        >
          Return to PGPass Home
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

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col items-center px-4 py-6 sm:py-10 relative overflow-hidden">
      {/* Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-indigo-600/15 blur-[120px] pointer-events-none rounded-full" />

      {/* Header Brand */}
      <header className="w-full max-w-md flex items-center justify-between mb-6 relative z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white font-black text-sm flex items-center justify-center">
            P
          </div>
          <span className="font-extrabold text-sm text-white tracking-tight">PGPass</span>
        </div>

        <span className="text-[10px] uppercase font-bold tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full flex items-center gap-1">
          <ShieldCheck className="w-3 h-3" />
          Verified Link
        </span>
      </header>

      {/* Main Stack */}
      <main className="w-full max-w-md space-y-4 relative z-10 pb-16">
        {/* Rent Status & HRA Card */}
        <RentStatusCard
          tenant={tenant}
          owner={owner}
          rentRecord={rentRecord}
          onProofUploaded={handleProofUploaded}
        />

        {/* Proof Uploader (shown when pending or verify) */}
        {rentRecord?.status !== 'paid' && (
          <ProofUploader
            rentRecord={rentRecord}
            bedId={tenant.bedId}
            tenantId={tenant.id}
            onSuccess={handleProofUploaded}
          />
        )}

        {/* Move-In Room Condition Vault */}
        <DepositVault
          tenantId={tenant.id}
          ownerId={owner.id}
          depositAmount={tenant.depositPaid || 8500}
          ownerPhone={owner.phone}
          tenantName={tenant.name}
          token={tenant.token}
        />

        {/* Contextual Affiliate Offer */}
        <AffiliateCard context={rentRecord?.status === 'paid' ? 'hra' : 'general'} />

        {/* Landlord Contact Card */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex items-center justify-between text-xs">
          <div>
            <span className="text-[11px] text-slate-500 block">Landlord / Caretaker</span>
            <span className="font-bold text-white">{owner.name}</span>
          </div>

          {owner.phone && (
            <div className="flex gap-2">
              <a
                href={`tel:${owner.phone}`}
                className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white transition-colors"
                title="Call Landlord"
              >
                <Phone className="w-4 h-4" />
              </a>
              <a
                href={`https://wa.me/91${owner.phone.replace(/\D/g, '').slice(-10)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-xl bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 transition-colors"
                title="WhatsApp Landlord"
              >
                <MessageCircle className="w-4 h-4" />
              </a>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full text-center text-[11px] text-slate-600 mt-auto py-4 relative z-10">
        <p>PGPass • Zero-App PG Rent Management</p>
      </footer>
    </div>
  );
}
