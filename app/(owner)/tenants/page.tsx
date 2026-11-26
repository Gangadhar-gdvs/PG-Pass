'use client';

import React, { useState } from 'react';
import { useOwnerSession } from '@/hooks/useOwner';
import { useTenants } from '@/hooks/useTenants';
import { useBeds } from '@/hooks/useBeds';
import { formatCurrency, getWhatsAppLink, depositPaidRupees } from '@/lib/utils';
import { config } from '@/lib/config';
import { Tenant } from '@/types';
import {
  Download,
  Copy,
  ExternalLink,
  Phone,
  Send,
  BedDouble,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  RotateCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DataTable, Column } from '@/components/ui/data-table';
import { Avatar } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/empty-state';
import { SearchInput } from '@/components/ui/input';
import { ListSkeleton, StatGridSkeleton } from '@/components/ui/skeletons';
import { PageHeader, SectionCard, StatTile } from '@/components/ui/dashboard-kit';
import toast from 'react-hot-toast';
import { copyText } from '@/lib/client/clipboard';

/* Round icon links (call / open portal / WhatsApp). Mobile keeps the 44px
   touch target; desktop table rows use a tighter 36px. */
const roundLink =
  'inline-grid h-11 w-11 sm:h-9 sm:w-9 shrink-0 place-items-center rounded-full transition-colors press';
const roundSoft = `${roundLink} bg-brand-50 text-brand-700 hover:bg-brand-100`;
const roundSuccess = `${roundLink} bg-success-bg text-success-ink hover:bg-success-line`;

const moveInLabel = (t: Tenant) =>
  t.moveInDate
    ? new Date(t.moveInDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';

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

  // Display-only totals derived from the data already on the page.
  const vacantBeds = beds.filter((b) => b.status === 'vacant').length;
  const depositsHeld = tenants.reduce((sum, t) => sum + depositPaidRupees(t), 0);
  const portalReady = tenants.filter((t) => Boolean(t.token)).length;

  const handleCopyLink = (token?: string) => {
    if (!token) {
      toast.error('No portal token generated for this resident');
      return;
    }
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : config.app.url;
    const url = `${baseUrl}/t/${token}`;
    void copyText(url).then((ok) =>
      ok ? toast.success('Resident portal link copied') : toast.error('Could not copy — long-press or select the text to copy it manually')
    );
  };

  const handleExportCsv = () => {
    if (tenants.length === 0) {
      toast.error('No resident records to export');
      return;
    }
    // Trigger a download from the server endpoint, which builds the CSV with
    // formula-injection protection (blueprint §14) — the old client CSV was unsafe.
    const a = document.createElement('a');
    a.href = '/api/reports/export?type=residents';
    a.download = '';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const columns: Column<Tenant>[] = [
    {
      key: 'name',
      header: 'Resident',
      sortable: true,
      render: (t) => (
        <div className="flex items-center gap-3">
          <Avatar name={t.name} size="md" />
          <span className="font-bold text-ink text-[13.5px]">{t.name}</span>
        </div>
      ),
    },
    {
      key: 'phone',
      header: 'Phone',
      render: (t) => (
        <span className="font-mono-numbers text-[13px] font-medium text-ink-2">
          +91 {t.phone}
        </span>
      ),
    },
    {
      key: 'bedLabel',
      header: 'Assigned Unit',
      sortable: true,
      render: (t) => (
        <span className="chip font-mono-numbers">
          <BedDouble className="h-3.5 w-3.5" />
          {t.bedLabel || 'Bed'}
        </span>
      ),
    },
    {
      key: 'moveInDate',
      header: 'Move-In Date',
      sortable: true,
      render: (t) => <span className="text-[13px] font-medium text-muted">{moveInLabel(t)}</span>,
    },
    {
      key: 'depositPaidPaise',
      header: 'Deposit',
      sortable: true,
      align: 'right',
      render: (t) => (
        <span className="font-mono-numbers text-[14px] font-extrabold text-ink">
          {formatCurrency(depositPaidRupees(t))}
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
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-brand-50 px-3.5 text-xs font-bold text-brand-700 transition-colors hover:bg-brand-100 cursor-pointer press"
          >
            <Copy className="h-3.5 w-3.5" />
            <span>Copy</span>
          </button>
          <a
            href={`/t/${t.token}`}
            target="_blank"
            rel="noopener noreferrer"
            title="Open portal"
            className={roundSoft}
          >
            <ExternalLink className="h-3.5 w-3.5" />
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
          <a href={`tel:${t.phone}`} title="Call" className={roundSoft}>
            <Phone className="h-4 w-4" />
          </a>
          <a
            href={getWhatsAppLink(t.phone, `Namaste ${t.name} ji 🙏`)}
            target="_blank"
            rel="noopener noreferrer"
            title="WhatsApp"
            className={roundSuccess}
          >
            <Send className="h-4 w-4" />
          </a>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5 text-left">
      <PageHeader
        icon="users"
        tint="violet"
        title="Resident"
        highlight="Directory"
        subtitle={`Active leaseholders, private portal URLs, and deposit ledger (${tenants.length} total).`}
        actions={
          <Button variant="outline" onClick={handleExportCsv}>
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        }
      />

      {/* Stat row — derived from the residents + beds already loaded */}
      {loading ? (
        <StatGridSkeleton count={4} />
      ) : !error ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 stagger">
          <StatTile icon="users" tint="violet" label="Residents" value={tenants.length} />
          <StatTile icon="bed" tint="sky" label="Vacant Beds" value={vacantBeds} />
          <StatTile icon="wallet" tint="mint" label="Deposits Held" value={formatCurrency(depositsHeld)} />
          <StatTile icon="check" tint="peach" label="Portal Links Ready" value={portalReady} />
        </div>
      ) : null}

      {/* Search */}
      <SearchInput
        placeholder="Filter by name, phone, or bed label..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        aria-label="Search residents"
        containerClassName="w-full sm:max-w-md"
      />

      {/* Directory */}
      {loading ? (
        <ListSkeleton rows={6} />
      ) : error ? (
        <div className="app-card">
          <EmptyState
            icon3d="alert"
            title="Couldn't load residents"
            description="We couldn't reach the server in time. Check your connection and try again."
            action={
              <Button onClick={() => window.location.reload()}>
                <RotateCw className="h-4 w-4" />
                Retry
              </Button>
            }
          />
        </div>
      ) : filteredTenants.length === 0 ? (
        <div className="app-card">
          {tenants.length === 0 ? (
            <EmptyState
              illustration="clipboard"
              title="No residents found"
              description="Assign residents to beds from your dashboard inventory to populate this directory."
            />
          ) : (
            <EmptyState
              icon3d="users"
              title="No residents found"
              description="Try clearing your search query."
            />
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {/* Phones: rich resident cards (avatar, unit + move-in chips, actions). */}
          <SectionCard
            className="sm:hidden"
            title="Residents"
            icon="users"
            action={<span className="chip font-mono-numbers">{filteredTenants.length}</span>}
          >
            <ul className="divide-y divide-line stagger">
              {pagedTenants.map((t) => (
                <li key={t.id} className="py-3.5 first:pt-1 last:pb-1">
                  <div className="flex items-center gap-3">
                    <Avatar name={t.name} size="lg" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[15px] font-bold text-ink">{t.name}</div>
                      <div className="font-mono-numbers text-[12.5px] font-medium text-muted">+91 {t.phone}</div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="font-mono-numbers text-[15px] font-extrabold text-ink">
                        {formatCurrency(depositPaidRupees(t))}
                      </div>
                      <div className="text-[11px] font-semibold text-muted">Deposit</div>
                    </div>
                  </div>

                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    <span className="chip font-mono-numbers">
                      <BedDouble className="h-3.5 w-3.5" />
                      {t.bedLabel || 'Bed'}
                    </span>
                    <span className="chip">
                      <CalendarDays className="h-3.5 w-3.5" />
                      Moved in {moveInLabel(t)}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <button
                      type="button"
                      title="Copy resident link"
                      onClick={() => handleCopyLink(t.token)}
                      className="inline-flex h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full bg-brand-50 px-3 text-[13px] font-bold text-brand-700 transition-colors hover:bg-brand-100 cursor-pointer press"
                    >
                      <Copy className="h-4 w-4 shrink-0" />
                      <span className="truncate">Copy</span>
                    </button>
                    <a
                      href={`/t/${t.token}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Open portal"
                      aria-label="Open portal"
                      className={roundSoft}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                    <a href={`tel:${t.phone}`} title="Call" aria-label="Call" className={roundSoft}>
                      <Phone className="h-4 w-4" />
                    </a>
                    <a
                      href={getWhatsAppLink(t.phone, `Namaste ${t.name} ji 🙏`)}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="WhatsApp"
                      aria-label="WhatsApp"
                      className={roundSuccess}
                    >
                      <Send className="h-4 w-4" />
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          </SectionCard>

          {/* Tablet / desktop: sortable table. */}
          <div className="hidden sm:block">
            <DataTable
              columns={columns}
              data={pagedTenants}
              keyExtractor={(t) => t.id}
            />
          </div>

          {pageCount > 1 && (
            <div className="flex flex-col-reverse items-center gap-3 sm:flex-row sm:justify-between">
              <span className="text-[13px] font-medium text-muted">
                Showing{' '}
                <span className="font-mono-numbers font-bold text-ink">
                  {safePage * PAGE_SIZE + 1}–
                  {Math.min(filteredTenants.length, safePage * PAGE_SIZE + PAGE_SIZE)}
                </span>{' '}
                of <span className="font-mono-numbers font-bold text-ink">{filteredTenants.length}</span>
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  disabled={safePage === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <span className="chip font-mono-numbers">
                  {safePage + 1} / {pageCount}
                </span>
                <Button
                  variant="outline"
                  disabled={safePage >= pageCount - 1}
                  onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
