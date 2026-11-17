'use client';

import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useTenants } from '@/hooks/useTenants';
import { useBeds } from '@/hooks/useBeds';
import { formatCurrency, getWhatsAppLink } from '@/lib/utils';
import { config } from '@/lib/config';
import { Tenant, Bed } from '@/types';
import {
  Users,
  Search,
  Download,
  Copy,
  ExternalLink,
  MessageCircle,
  Phone,
  Calendar,
  CheckCircle2,
  Share2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import toast from 'react-hot-toast';

export default function TenantsPage() {
  const { user } = useAuth();
  const ownerId = user?.uid || 'demo_owner';
  const { tenants, loading } = useTenants(ownerId);
  const { beds } = useBeds(ownerId);

  const [search, setSearch] = useState('');

  const bedMap = new Map<string, Bed>();
  beds.forEach((b) => bedMap.set(b.id, b));

  const filteredTenants = tenants.filter((t) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const matchName = t.name.toLowerCase().includes(q);
    const matchPhone = t.phone.includes(q);
    const matchBed = t.bedLabel?.toLowerCase().includes(q) || false;
    return matchName || matchPhone || matchBed;
  });

  const handleCopyLink = (token: string) => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : config.app.url;
    const url = `${baseUrl}/t/${token}`;
    navigator.clipboard.writeText(url);
    toast.success('Resident portal link copied to clipboard!');
  };

  const handleExportCsv = () => {
    if (tenants.length === 0) {
      toast.error('No resident records to export');
      return;
    }

    const baseUrl = typeof window !== 'undefined' ? window.location.origin : config.app.url;
    const headers = ['Resident Name', 'Phone', 'Room/Bed', 'Move In Date', 'Deposit Paid (INR)', 'Portal Link'];
    const rows = tenants.map((t) => [
      `"${t.name}"`,
      `"${t.phone}"`,
      `"${t.bedLabel || 'Bed'}"`,
      `"${t.moveInDate}"`,
      t.depositPaid || 0,
      `"${baseUrl}/t/${t.token}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `PGPass_Tenants_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Resident list exported to CSV! 📊');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-900/60 border border-slate-800 rounded-3xl p-5 shadow-lg backdrop-blur-sm">
        <div>
          <h1 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-400" />
            <span>Resident Directory ({tenants.length})</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            View active residents, personal portal links, and security deposit records.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            size="sm"
            variant="outline"
            onClick={handleExportCsv}
            className="text-xs font-semibold border-slate-700 bg-slate-900"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" />
            <span>Export CSV</span>
          </Button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Filter by name, phone, or bed label..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-slate-900/80 border border-slate-800 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
        />
      </div>

      {/* Tenants Table / Cards */}
      {filteredTenants.length === 0 ? (
        <div className="text-center py-16 bg-slate-900/30 border border-slate-800/80 rounded-3xl p-6">
          <Users className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h4 className="text-sm font-bold text-white mb-1">No residents found</h4>
          <p className="text-xs text-slate-400">
            {tenants.length === 0
              ? 'Add residents by tapping any vacant bed on your Bed Grid.'
              : 'Try clearing your search query.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {filteredTenants.map((t) => {
            const bed = bedMap.get(t.bedId);
            const portalUrl = `/t/${t.token}`;

            return (
              <div
                key={t.id}
                className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4.5 flex flex-col justify-between hover:border-slate-700 transition-colors shadow-md"
              >
                <div>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="text-sm font-bold text-white">{t.name}</h3>
                      <span className="text-xs text-slate-400 font-mono">+91 {t.phone}</span>
                    </div>

                    <span className="text-xs font-bold text-indigo-300 bg-indigo-500/15 border border-indigo-500/25 px-2.5 py-0.5 rounded-lg">
                      {t.bedLabel || bed?.bedLabel || 'Bed'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400 my-3 p-2.5 bg-slate-950/60 rounded-xl border border-slate-800/60">
                    <div>
                      <span className="text-slate-500 block">Move-in Date:</span>
                      <span className="text-slate-200 font-medium">{t.moveInDate || 'Not set'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Security Deposit:</span>
                      <span className="text-emerald-400 font-bold">{formatCurrency(t.depositPaid || 0)}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <a
                      href={`tel:${t.phone}`}
                      className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-colors"
                      title="Call"
                    >
                      <Phone className="w-3.5 h-3.5" />
                    </a>
                    <a
                      href={`https://wa.me/91${t.phone.slice(-10)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-xl bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 transition-colors"
                      title="WhatsApp"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                    </a>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleCopyLink(t.token)}
                      className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                      title="Copy Public Portal Link"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Link</span>
                    </button>

                    <a
                      href={portalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 text-xs font-semibold flex items-center gap-1 border border-indigo-500/30 transition-colors"
                      title="View Tenant Portal"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>View</span>
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
