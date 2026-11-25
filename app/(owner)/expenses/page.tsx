'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useOwnerSession } from '@/hooks/useOwner';
import { formatCurrency, formatDateIN } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dropdown } from '@/components/ui/dropdown';
import { CardListSkeleton } from '@/components/ui/skeletons';
import { EmptyState } from '@/components/ui/empty-state';
import { Wallet, Trash2, Plus } from 'lucide-react';
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

export default function ExpensesPage() {
  const { ownerId } = useOwnerSession();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [category, setCategory] = useState('utilities');
  const [amount, setAmount] = useState('');
  const [vendor, setVendor] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/expenses');
      if (res.ok) {
        const data = await res.json();
        setExpenses(data.expenses || []);
        setTotal(data.total || 0);
      }
    } catch {
      /* non-fatal */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (ownerId) load();
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
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Could not save expense');
      }
      toast.success('Expense recorded');
      setAmount('');
      setVendor('');
      setNote('');
      await load();
    } catch (err: any) {
      toast.error(err.message || 'Could not save expense');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (busyId) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/expenses/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Could not delete');
      setExpenses((list) => list.filter((e) => e.id !== id));
      toast.success('Expense removed');
    } catch (e: any) {
      toast.error(e.message || 'Could not delete');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-[8px] bg-[#FEF3C7] border border-[#FDE68A] text-[#D97706] flex items-center justify-center shrink-0">
          <Wallet className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-[#09090B]">Expenses</h1>
          <p className="text-xs text-[#64748B]">
            This month: <span className="font-bold text-[#09090B]">{formatCurrency(total / 100)}</span>
          </p>
        </div>
      </div>

      {/* Add expense */}
      <form onSubmit={addExpense} className="bg-white border border-[#E2E8F0] rounded-[12px] p-4 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Dropdown
            label="Category"
            id="exp-cat"
            value={category}
            onChange={setCategory}
            disabled={saving}
            options={CATEGORIES.map((c) => ({ value: c.value, label: c.label }))}
          />
          <Input label="Amount (₹)" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} required disabled={saving} />
          <Input label="Vendor (optional)" value={vendor} onChange={(e) => setVendor(e.target.value)} disabled={saving} />
          <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={saving} />
        </div>
        <Input label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} disabled={saving} />
        <Button type="submit" variant="solid" loading={saving} className="w-full">
          <Plus className="w-4 h-4 mr-1.5" /> Add Expense
        </Button>
      </form>

      {/* List */}
      {loading ? (
        <CardListSkeleton rows={4} height="h-16" />
      ) : expenses.length === 0 ? (
        <EmptyState
          icon={<Wallet className="w-6 h-6 text-[#64748B]" />}
          title="No expenses this month"
          description="Track staff salary, utilities, maintenance and vendor bills to see your net position."
        />
      ) : (
        <div className="space-y-2">
          {expenses.map((e) => (
            <div key={e.id} className="bg-white border border-[#E2E8F0] rounded-[10px] p-3 flex items-center justify-between shadow-xs">
              <div className="min-w-0">
                <div className="text-sm font-bold text-[#09090B]">
                  {CAT_LABEL[e.category] || 'Expense'}
                  {e.vendor ? <span className="font-normal text-[#64748B]"> · {e.vendor}</span> : null}
                </div>
                <div className="text-[11px] text-[#94A3B8]">
                  {formatDateIN(e.date)}{e.note ? ` · ${e.note}` : ''}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-sm font-bold font-mono-numbers text-[#09090B]">
                  {formatCurrency(e.amountPaise / 100)}
                </span>
                <button
                  type="button"
                  disabled={busyId === e.id}
                  onClick={() => remove(e.id)}
                  className="inline-flex items-center justify-center h-9 w-9 rounded-[8px] text-[#94A3B8] hover:text-[#EF4444] hover:bg-[#FEF2F2] transition-colors"
                  aria-label="Delete expense"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
