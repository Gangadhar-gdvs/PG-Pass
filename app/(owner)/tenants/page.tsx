'use client';

import React, { useState } from 'react';
import { useOwnerSession } from '@/hooks/useOwner';
import { useTenants } from '@/hooks/useTenants';
import { useBeds } from '@/hooks/useBeds';
import { formatCurrency, getWhatsAppLink } from '@/lib/utils';
import { config } from '@/lib/config';
import { Tenant } from '@/types';
import {
  Users,
  Search,
  Download,
  Copy,
  ExternalLink,
  Phone,
  Send,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DataTable, Column } from '@/components/ui/data-table';
import { Avatar } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/empty-state';
import { ListSkeleton } from '@/components/ui/skeletons';
import { HeroHeader } from '@/components/ui/dashboard-kit';
import toast from 'react-hot-toast';

export default function TenantsPage() {
  const { ownerId, properties, selectedPropertyId } = useOwnerSession();
  const propertyFilter = properties.length > 1 ? selectedPropertyId : undefined;
  const { tenants, loading, error } = useTenants(ownerId, propertyFilter);
  const { beds } = useBeds(ownerId, propertyFilter);

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;

  const bedMap = new Map();
  beds.forEach((b) => bedMap.set(b.id, b));

  const filteredTenants = tenants.filter((t) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const matchName = t.name.toLowerCase().includes(q);
    const matchPhone = t.phone.includes(q);
    const matchBed = t.bedLabel?.toLowerCase().includes(q) || false;
    return matchName || matchPhone || matchBed;
  });

  // Client-side pagination so a large directory doesn't render hundreds of rows
  // (and DOM nodes) at once on mobile. Reset to the first page when the search
  // narrows/changes the result set.
  const pageCount = Math.max(1, Math.ceil(filteredTenants.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pagedTenants = filteredTenants.slice(
    safePage * PAGE_SIZE,
    safePage * PAGE_SIZE + PAGE_SIZE
  );
  React.useEffect(() => {
    // Defer so setState runs after commit, not in the effect body (cascading-render lint rule).
    queueMicrotask(() => {
      setPage(0);
    });
  }, [search]);

  const handleCopyLink = (token?: string) => {
    if (!token) {
      toast.error('No portal token generated for this resident');
      return;
    }
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : config.app.url;
    const url = `${baseUrl}/t/${token}`;
    navigator.clipboard.writeText(url);
    toast.success('Resident portal link copied');
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
    toast.success('Exported resident list to CSV');
  };

  const columns: Column<Tenant>[] = [
    {
      key: 'name',
      header: 'Resident',
      sortable: true,
      render: (t) => (
        <div className="flex items-center gap-2.5">
          <Avatar name={t.name} size="sm" />
          <span className="font-bold text-[#09090B] text-xs">{t.name}</span>
        </div>
      ),
    },
    {
      key: 'phone',
      header: 'Phone',
      render: (t) => (
        <span className="font-mono-numbers text-xs text-[#475569]">
          +91 {t.phone}
        </span>
      ),
    },
    {
      key: 'bedLabel',
      header: 'Assigned Unit',
      sortable: true,
      render: (t) => (
        <span className="inline-flex items-center font-mono-numbers text-xs font-semibold px-2 py-0.5 rounded-[6px] bg-[#F1F5F9] border border-[#E2E8F0] text-[#09090B]">
          {t.bedLabel || 'Bed'}
        </span>
      ),
    },
    {
      key: 'moveInDate',
      header: 'Move-In Date',
      sortable: true,
      render: (t) => (
        <span className="text-xs text-[#64748B]">
          {t.moveInDate ? new Date(t.moveInDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
        </span>
      ),
    },
    {
      key: 'depositPaid',
      header: 'Deposit',
      sortable: true,
      align: 'right',
      render: (t) => (
        <span className="font-mono-numbers text-xs font-bold text-[#09090B]">
          {formatCurrency(t.depositPaid || 0)}
        </span>
      ),
    },
    {
      key: 'token',
      header: 'Portal Link',
      align: 'center',
      render: (t) => (
        <div className="flex items-center justify-center gap-1.5">
          <button
            type="button"
            title="Copy resident link"
            onClick={() => handleCopyLink(t.token)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[6px] border border-[#E2E8F0] hover:bg-[#F8FAFC] text-[11px] font-semibold accent-text transition-colors cursor-pointer"
          >
            <Copy className="w-3 h-3 accent-text" />
            <span>Copy</span>
          </button>
          <a
            href={`/t/${t.token}`}
            target="_blank"
            rel="noopener noreferrer"
            title="Open portal"
            className="p-1 rounded-[6px] border border-[#E2E8F0] hover:bg-[#F8FAFC] text-[#64748B] transition-colors cursor-pointer"
          >
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Contact',
      align: 'right',
      render: (t) => (
        <div className="flex items-center justify-end gap-1.5">
          <a
            href={`tel:${t.phone}`}
            title="Call"
            className="p-1.5 rounded-[6px] border border-[#E2E8F0] hover:bg-[#F8FAFC] text-[#475569] transition-colors"
          >
            <Phone className="w-3.5 h-3.5" />
          </a>
          <a
            href={getWhatsAppLink(t.phone, `Namaste ${t.name} ji 🙏`)}
            target="_blank"
            rel="noopener noreferrer"
            title="WhatsApp"
            className="p-1.5 rounded-[6px] bg-[#10B981] hover:bg-[#059669] text-white transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
          </a>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5 text-left">
      {/* Top Header */}
      <HeroHeader
        eyebrow="Residents"
        title="Resident Directory"
        subtitle={`Active leaseholders, private portal URLs, and deposit ledger (${tenants.length} total).`}
        right={
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center h-9 px-4 rounded-full bg-white/15 hover:bg-white/25 border border-white/25 text-white text-xs font-bold press"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" />
            <span>Export CSV</span>
          </button>
        }
      />

      {/* Search Input */}
      <div className="relative max-w-sm">
        <Search className="w-3.5 h-3.5 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Filter by name, phone, or bed label..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-white border border-[#E2E8F0] rounded-[8px] pl-9 pr-3 py-2 text-xs text-[#09090B] placeholder:text-[#94A3B8] focus:outline-none focus:border-[color:var(--accent)]"
        />
      </div>

      {/* Data Table */}
      {loading ? (
        <ListSkeleton rows={6} />
      ) : error ? (
        <EmptyState
          icon={<Users className="w-6 h-6 text-[#DC2626]" />}
          title="Couldn't load residents"
          description="We couldn't reach the server in time. Check your connection and try again."
          action={
            <button
              onClick={() => window.location.reload()}
              className="h-11 px-5 rounded-full accent-bg text-white text-sm font-bold press"
            >
              Retry
            </button>
          }
        />
      ) : filteredTenants.length === 0 ? (
        <EmptyState
          icon={<Users className="w-6 h-6 text-[#64748B]" />}
          title="No residents found"
          description={
            tenants.length === 0
              ? 'Assign residents to beds from your dashboard inventory to populate this directory.'
              : 'Try clearing your search query.'
          }
        />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={pagedTenants}
            keyExtractor={(t) => t.id}
          />
          {pageCount > 1 && (
            <div className="flex items-center justify-between mt-3 text-xs">
              <span className="text-[#64748B]">
                Showing {safePage * PAGE_SIZE + 1}–
                {Math.min(filteredTenants.length, safePage * PAGE_SIZE + PAGE_SIZE)} of{' '}
                {filteredTenants.length}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={safePage === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  Previous
                </Button>
                <span className="text-[#64748B] font-semibold">
                  {safePage + 1} / {pageCount}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={safePage >= pageCount - 1}
                  onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
