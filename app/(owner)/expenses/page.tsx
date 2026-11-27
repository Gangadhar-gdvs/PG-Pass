'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useOwnerSession } from '@/hooks/useOwner';
import { formatCurrency, formatDateIN, errorMessage, readApiError, todayIST } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dropdown } from '@/components/ui/dropdown';
import { ProgressBar } from '@/components/ui/progress-bar';
import { CardListSkeleton, ListSkeleton, StatGridSkeleton } from '@/components/ui/skeletons';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader, SectionCard, StatTile } from '@/components/ui/dashboard-kit';
import { Icon3D, IconBubble, type Icon3DName, type Tint } from '@/components/brand/Icon3D';
import { Trash2, Plus, IndianRupee, Store, CalendarDays } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Expense } from '@/types';

const CATEGORIES = [
  { value: 'salary', label: 'Staff Salary' },
  { value: 'utilities', label: 'Utilities (Power/Water)' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'supplies', label: 'Supplies' },
  { value: 'food', label: 'Food / Mess' },
  { value: 'rent', label: 'Property Rent' },
  { value: 'internet', label: 'Internet' },
  { value: 'other', label: 'Other' },
];
const CAT_LABEL: Record<string, string> = Object.fromEntries(CATEGORIES.map((c) => [c.value, c.label]));

/** Presentation only: the 3D icon + pastel tint for each expense category. */
const CAT_VISUAL: Record<string, { icon: Icon3DName; tint: Tint }> = {
  salary: { icon: 'staff', tint: 'indigo' },
  utilities: { icon: 'bolt', tint: 'amber' },
  maintenance: { icon: 'wrench-orange', tint: 'peach' },
  supplies: { icon: 'tools-purple', tint: 'violet' },
  food: { icon: 'house', tint: 'mint' },
  rent: { icon: 'building', tint: 'rose' },
  internet: { icon: 'home-blue', tint: 'sky' },
  other: { icon: 'grid', tint: 'slate' },
};
const visualFor = (category: string) => CAT_VISUAL[category] || CAT_VISUAL.other;

export default function ExpensesPage() {
  const { ownerId } = useOwnerSession();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  // Staff without the expenses permission get 403 — show that, not an empty ledger.
  const [denied, setDenied] = useState(false);

  const [category, setCategory] = useState('utilities');
  const [amount, setAmount] = useState('');
  const [vendor, setVendor] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(() => todayIST());
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  // `quiet` re-syncs list + server month total without the loading skeleton.
  const load = useCallback(async (opts?: { quiet?: boolean }) => {
    if (!opts?.quiet) setLoading(true);
    try {
      const res = await fetch('/api/expenses');
      if (res.ok) {
        const data = await res.json();
        setExpenses(data.expenses || []);
        setTotal(data.total || 0);
        setDenied(false);
      } else if (res.status === 403) {
        setDenied(true);
      }
    } catch {
      /* non-fatal */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!ownerId) return;
    // Defer so setState runs after commit, not in the effect body (cascading-render lint rule).
    let active = true;
    queueMicrotask(() => {
      if (active) load();
    });
    return () => {
      active = false;
    };
  }, [ownerId, load]);

  const addExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const rupees = Number(amount);
    if (!rupees || rupees <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, amountRupees: rupees, vendor, note, date }),
      });
      if (!res.ok) {
        throw new Error(await readApiError(res, 'Could not save expense'));
      }
      toast.success('Expense recorded');
      setAmount('');
      setVendor('');
      setNote('');
      await load();
    } catch (err: unknown) {
      toast.error(errorMessage(err, 'Could not save expense'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (busyId) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/expenses/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await readApiError(res, 'Could not delete'));
      setExpenses((list) => list.filter((e) => e.id !== id));
      toast.success('Expense removed');
      // The "This Month" total is server-computed — refresh it so it reflects
      // the deletion immediately (previously it stayed stale until reload).
      void load({ quiet: true });
    } catch (e: unknown) {
      toast.error(errorMessage(e, 'Could not delete'));
    } finally {
      setBusyId(null);
    }
  };

  // Display-only breakdown of the entries already loaded.
  const listedPaise = expenses.reduce((sum, e) => sum + e.amountPaise, 0);
  const largestPaise = expenses.reduce((max, e) => Math.max(max, e.amountPaise), 0);
  const byCategory = Object.entries(
    expenses.reduce<Record<string, number>>((acc, e) => {
      acc[e.category] = (acc[e.category] || 0) + e.amountPaise;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1]);

  if (denied) {
    return (
      <div className="space-y-5">
        <PageHeader icon="wallet-orange" tint="peach" title="Expenses" subtitle="PG spending ledger" />
        <div className="app-card">
          <EmptyState
            icon3d="wallet-orange"
            tint="peach"
            title="No access to expenses"
            description="Your staff account doesn't include expense access. Ask the PG owner to grant the Expenses permission."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        icon="wallet-orange"
        tint="peach"
        title="Expenses"
        subtitle={
          <>
            This month: <span className="font-mono-numbers font-bold text-ink">{formatCurrency(total / 100)}</span>
          </>
        }
      />

      {/* Totals */}
      {loading ? (
        <StatGridSkeleton count={4} />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 stagger">
          <StatTile icon="wallet-orange" tint="peach" label="This Month" value={formatCurrency(total / 100)} />
          <StatTile icon="report" tint="indigo" label="Entries" value={expenses.length} />
          <StatTile icon="chart" tint="violet" label="Categories" value={byCategory.length} />
          <StatTile icon="alert" tint="rose" label="Largest Bill" value={formatCurrency(largestPaise / 100)} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 items-start">
        {/* Add expense */}
        <form onSubmit={addExpense} className="lg:col-span-2">
          <SectionCard title="Record an expense" icon="wallet-orange" bodyClassName="space-y-4">
            <Dropdown
              label="Category"
              id="exp-cat"
              value={category}
              onChange={setCategory}
              disabled={saving}
              options={CATEGORIES.map((c) => ({ value: c.value, label: c.label }))}
            />
            <div className="grid grid-cols-1 min-[400px]:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-4">
              <Input
                label="Amount (₹)"
                type="number"
                leading={<IndianRupee />}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                disabled={saving}
              />
              <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={saving} />
            </div>
            <Input
              label="Vendor (optional)"
              leading={<Store />}
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
              disabled={saving}
            />
            <Input label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} disabled={saving} />
            <Button type="submit" variant="solid" size="full" loading={saving}>
              <Plus className="h-4 w-4" /> Add Expense
            </Button>
          </SectionCard>
        </form>

        <div className="lg:col-span-3 space-y-5">
          {/* Category breakdown */}
          {loading ? (
            <CardListSkeleton rows={4} height="h-28" cols={2} />
          ) : byCategory.length > 0 ? (
            <SectionCard title="Where it went" icon="chart">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 gap-2.5 stagger">
                {byCategory.map(([cat, paise]) => {
                  const v = visualFor(cat);
                  const pct = listedPaise > 0 ? Math.round((paise / listedPaise) * 100) : 0;
                  return (
                    <div key={cat} className={`tint-card tint-${v.tint} flex flex-col gap-2 p-3.5`}>
                      <div className="flex items-start justify-between gap-2">
                        <Icon3D name={v.icon} size={36} />
                        <span className="rounded-full bg-white/70 px-2 py-0.5 font-mono-numbers text-[11px] font-bold text-ink-2">
                          {pct}%
                        </span>
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-[12.5px] font-semibold text-ink-2">{CAT_LABEL[cat] || 'Expense'}</div>
                        <div className="font-mono-numbers text-[17px] font-extrabold leading-tight tracking-[-0.02em] text-ink">
                          {formatCurrency(paise / 100)}
                        </div>
                      </div>
                      <ProgressBar value={pct} height="sm" aria-hidden="true" />
                    </div>
                  );
                })}
              </div>
            </SectionCard>
          ) : null}

          {/* List */}
          {loading ? (
            <ListSkeleton rows={4} />
          ) : expenses.length === 0 ? (
            <div className="app-card">
              <EmptyState
                illustration="clipboard"
                title="No expenses this month"
                description="Track staff salary, utilities, maintenance and vendor bills to see your net position."
              />
            </div>
          ) : (
            <SectionCard
              title="This month's entries"
              icon="report"
              action={<span className="chip font-mono-numbers">{expenses.length}</span>}
            >
              <ul className="divide-y divide-line stagger">
                {expenses.map((e) => {
                  const v = visualFor(e.category);
                  return (
                    <li key={e.id} className="flex items-start gap-3 py-3 first:pt-1 last:pb-1">
                      <IconBubble icon={v.icon} tint={v.tint} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 truncate pt-0.5 text-[14.5px] font-bold text-ink">
                            {CAT_LABEL[e.category] || 'Expense'}
                            {e.vendor ? <span className="font-medium text-muted"> · {e.vendor}</span> : null}
                          </div>
                          <span className="shrink-0 font-mono-numbers text-[15px] font-extrabold text-ink">
                            {formatCurrency(e.amountPaise / 100)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-1.5 text-[12px] font-medium text-muted">
                            <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                            <span className="font-mono-numbers shrink-0">{formatDateIN(e.date)}</span>
                            {e.note ? <span className="truncate">· {e.note}</span> : null}
                          </div>
                          <button
                            type="button"
                            disabled={busyId === e.id}
                            onClick={() => remove(e.id)}
                            className="-my-1.5 -mr-2.5 inline-grid h-11 w-11 shrink-0 place-items-center rounded-full text-faint transition-colors hover:bg-danger-bg hover:text-danger disabled:opacity-50 press"
                            aria-label="Delete expense"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </SectionCard>
          )}
        </div>
      </div>
    </div>
  );
}
