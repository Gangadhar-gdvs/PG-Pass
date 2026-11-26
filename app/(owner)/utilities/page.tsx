'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useOwnerSession } from '@/hooks/useOwner';
import { useBeds } from '@/hooks/useBeds';
import { OwnerOnlyGuard } from '@/components/owner/OwnerOnlyGuard';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Dropdown } from '@/components/ui/dropdown';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Drawer } from '@/components/ui/drawer';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { ListSkeleton, StatGridSkeleton } from '@/components/ui/skeletons';
import {
  ActivityRow,
  FilterChips,
  InfoBanner,
  KeyValue,
  PageHeader,
  SectionCard,
  StatTile,
} from '@/components/ui/dashboard-kit';
import { type Icon3DName, type Tint } from '@/components/brand/Icon3D';
import { errorMessage, formatDateIN } from '@/lib/utils';
import {
  UTILITY_RULE_LABELS,
  UTILITY_TYPE_LABELS,
  formatPeriodLabel,
  rupeeText,
  rupeesToPaise,
  shiftPeriod,
} from '@/lib/utilitySplit';
import { istTodayIso } from '@/lib/assets';
import { Check, ChevronLeft, ChevronRight, Gauge, IndianRupee, Plus, RotateCcw, Store } from 'lucide-react';
import toast from 'react-hot-toast';
import type {
  UtilityAllocation,
  UtilityAllocationRule,
  UtilityBill,
  UtilityBillStatus,
  UtilityScope,
  UtilityType,
} from '@/types';

/* ---------------- presentation maps ---------------- */

const TYPE_VISUAL: Record<UtilityType, { icon: Icon3DName; tint: Tint }> = {
  electricity: { icon: 'bolt', tint: 'amber' },
  water: { icon: 'home-blue', tint: 'sky' },
  gas: { icon: 'house', tint: 'peach' },
  internet: { icon: 'home-blue', tint: 'indigo' },
  other: { icon: 'grid', tint: 'slate' },
};

const STATUS_META: Record<UtilityBillStatus, { label: string; badge: NonNullable<BadgeProps['variant']> }> = {
  draft: { label: 'Not applied', badge: 'pending' },
  partial: { label: 'Partial', badge: 'verify' },
  applied: { label: 'Applied', badge: 'paid' },
  void: { label: 'Voided', badge: 'vacant' },
};

const ALLOC_META: Record<UtilityAllocation['status'], { label: string; badge: NonNullable<BadgeProps['variant']> }> = {
  pending: { label: 'Not charged', badge: 'pending' },
  applied: { label: 'Charged', badge: 'paid' },
  skipped: { label: 'Skipped', badge: 'danger' },
  reversed: { label: 'Reversed', badge: 'vacant' },
};

const TYPE_OPTIONS = (Object.keys(UTILITY_TYPE_LABELS) as UtilityType[]).map((t) => ({
  value: t,
  label: t === 'other' ? 'Other utility' : UTILITY_TYPE_LABELS[t],
}));

/** Mirrors the server's preview payload (lib/server/services/utilities.service). */
interface PreviewLine {
  tenantId: string;
  tenantName: string;
  bedLabel: string | null;
  days: number;
  weight: number;
  sharePaise: number;
  roundingPaise: number;
}
interface UtilityPreview {
  label: string;
  periodLabel: string;
  daysInPeriod: number;
  units: number | null;
  residents: Array<{ tenantId: string; tenantName: string; bedLabel: string | null; days: number }>;
  split: { totalWeight: number; lines: PreviewLine[]; allocatedPaise: number; excluded: Array<{ tenantName: string; reason: string }> } | null;
  error: string | null;
  duplicate: { id: string; status: UtilityBillStatus } | null;
  overlaps: Array<{ id: string; label: string }>;
}

async function readError(res: Response, fallback: string): Promise<string> {
  const body = await res.json().catch(() => ({}));
  return body.error || body.message || fallback;
}

const paiseToInput = (p: number) => (p % 100 === 0 ? String(p / 100) : (p / 100).toFixed(2));

/* ---------------- shared: allocation table ---------------- */

/** How the split was calculated, in plain words (transparency requirement). */
function SplitExplainer({ rule, totalPaise, totalWeight, count }: { rule: UtilityAllocationRule; totalPaise: number; totalWeight: number; count: number }) {
  const text =
    rule === 'equal'
      ? `${rupeeText(totalPaise)} ÷ ${count} resident${count === 1 ? '' : 's'} who stayed this month.`
      : rule === 'occupancy_days'
      ? `${rupeeText(totalPaise)} × each resident's days stayed ÷ ${totalWeight} total resident-days.`
      : 'Amounts entered by you — they must add up exactly to the bill.';
  return (
    <p className="well px-3.5 py-2.5 text-[12.5px] leading-relaxed text-ink-2">
      {text}
      {rule !== 'custom' && (
        <> Shares are rounded down to the paisa; the few paise left over go 1 paisa each to the largest remainders, so the total matches the bill exactly.</>
      )}
    </p>
  );
}

function AllocationRows({
  lines,
  daysInPeriod,
  custom,
  onCustomChange,
  statusFor,
}: {
  lines: Array<PreviewLine & { status?: UtilityAllocation['status']; skipReason?: string | null }>;
  daysInPeriod: number;
  custom?: Record<string, string>;
  onCustomChange?: (tenantId: string, value: string) => void;
  statusFor?: boolean;
}) {
  return (
    <ul className="divide-y divide-line">
      {lines.map((l) => (
        <li key={l.tenantId} className="py-3 first:pt-1 last:pb-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-[14px] font-bold text-ink">{l.tenantName}</div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] font-medium text-muted">
                {l.bedLabel && <span>Bed {l.bedLabel}</span>}
                <span className="font-mono-numbers">
                  {l.days}/{daysInPeriod} days
                </span>
                {l.roundingPaise > 0 && <span className="chip font-mono-numbers">+1 paisa rounding</span>}
              </div>
            </div>
            {onCustomChange ? (
              <div className="w-32 shrink-0">
                <Input
                  aria-label={`Amount for ${l.tenantName}`}
                  inputMode="decimal"
                  leading={<IndianRupee />}
                  value={custom?.[l.tenantId] ?? ''}
                  onChange={(e) => onCustomChange(l.tenantId, e.target.value)}
                  placeholder="0"
                />
              </div>
            ) : (
              <div className="shrink-0 text-right">
                <div className="font-mono-numbers text-[15px] font-extrabold text-ink">{rupeeText(l.sharePaise)}</div>
                {statusFor && l.status && (
                  <Badge variant={ALLOC_META[l.status].badge} dot className="mt-1">
                    {ALLOC_META[l.status].label}
                  </Badge>
                )}
              </div>
            )}
          </div>
          {statusFor && l.skipReason && l.status === 'skipped' && (
            <p className="mt-1.5 text-[12px] font-medium leading-relaxed text-danger-ink">{l.skipReason}</p>
          )}
        </li>
      ))}
    </ul>
  );
}

/* ---------------- New bill sheet ---------------- */

function NewBillDrawer({
  period: initialPeriod,
  rooms,
  propertyId,
  onClose,
  onSaved,
}: {
  period: string;
  rooms: string[];
  propertyId?: string;
  onClose: () => void;
  onSaved: (bill: UtilityBill) => void;
}) {
  const [type, setType] = useState<UtilityType>('electricity');
  const [provider, setProvider] = useState('');
  const [period, setPeriod] = useState(initialPeriod);
  const [scope, setScope] = useState<UtilityScope>(rooms.length > 0 ? 'room' : 'property');
  const [roomNumber, setRoomNumber] = useState(rooms[0] || '');
  const [amount, setAmount] = useState('');
  const [meterPrev, setMeterPrev] = useState('');
  const [meterCur, setMeterCur] = useState('');
  const [meterReset, setMeterReset] = useState(false);
  const [rule, setRule] = useState<UtilityAllocationRule>('equal');
  const [custom, setCustom] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // The preview is stored with the request key it was computed for, so a stale
  // split (inputs changed, recalculation pending) can never be saved.
  const [previewState, setPreviewState] = useState<{ key: string; data: UtilityPreview } | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewFailure, setPreviewFailure] = useState<string | null>(null);

  // Client-side parsing (exact paise, no floats); the server re-validates everything.
  const totalPaise = amount.trim() === '' ? 0 : rupeesToPaise(amount);
  const meterError =
    (meterPrev.trim() === '') !== (meterCur.trim() === '')
      ? 'Enter both meter readings, or leave both empty'
      : (meterPrev && !Number.isFinite(Number(meterPrev))) || (meterCur && !Number.isFinite(Number(meterCur)))
      ? 'Meter readings must be numbers'
      : null;
  const customPaise: Record<string, number> = {};
  let customInvalid = false;
  if (rule === 'custom') {
    for (const [id, v] of Object.entries(custom)) {
      if (v.trim() === '') continue;
      const p = rupeesToPaise(v);
      if (p === null) customInvalid = true;
      else customPaise[id] = p;
    }
  }

  const requestBody =
    totalPaise === null || meterError || customInvalid || (scope === 'room' && !roomNumber)
      ? null
      : {
      propertyId,
      type,
      provider: provider.trim() || undefined,
      period,
      scope,
      roomNumber: scope === 'room' ? roomNumber : undefined,
      totalPaise,
      meter: meterPrev.trim() && meterCur.trim() ? { previous: Number(meterPrev), current: Number(meterCur), reset: meterReset } : undefined,
      notes: notes.trim() || undefined,
      rule,
      customPaise: rule === 'custom' ? customPaise : undefined,
    };

  // Notes/provider don't change the split — leave them out of the preview key.
  const previewKey = requestBody ? JSON.stringify({ ...requestBody, notes: undefined, provider: undefined }) : null;

  // Debounced live preview (dry run on the server — residents, days, shares).
  useEffect(() => {
    if (!previewKey) return;
    let active = true;
    const timer = setTimeout(async () => {
      setPreviewing(true);
      try {
        const res = await fetch('/api/utilities/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: previewKey,
        });
        if (!active) return;
        if (res.ok) {
          const data = await res.json();
          setPreviewState({ key: previewKey, data: data.preview as UtilityPreview });
          setPreviewFailure(null);
        } else {
          setPreviewFailure(await readError(res, 'Could not calculate the split'));
        }
      } catch {
        if (active) setPreviewFailure('Could not reach the server. Check your connection and try again.');
      } finally {
        if (active) setPreviewing(false);
      }
    }, 350);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [previewKey]);

  const preview = previewState?.data ?? null;
  const previewFresh = !!previewKey && previewState?.key === previewKey;

  const chooseRule = (next: UtilityAllocationRule) => {
    // Pre-fill custom amounts from the current split so the owner only tweaks.
    if (next === 'custom' && preview?.split && Object.keys(custom).length === 0) {
      setCustom(Object.fromEntries(preview.split.lines.map((l) => [l.tenantId, paiseToInput(l.sharePaise)])));
    }
    setRule(next);
  };

  const customSum = Object.values(customPaise).reduce((s, v) => s + v, 0);
  const remaining = (totalPaise ?? 0) - customSum;
  const blocking =
    !requestBody || !preview || !previewFresh || !!preview.error || !!preview.duplicate || !!previewFailure || previewing;

  const save = async () => {
    if (saving || !requestBody || blocking) return;
    setSaving(true);
    try {
      const res = await fetch('/api/utilities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      if (!res.ok) throw new Error(await readError(res, 'Could not save the bill'));
      const data = await res.json();
      toast.success('Bill saved — review and apply it to rent');
      onSaved(data.bill as UtilityBill);
    } catch (e: unknown) {
      toast.error(errorMessage(e, 'Could not save the bill'));
    } finally {
      setSaving(false);
    }
  };

  const residentLines: PreviewLine[] =
    preview?.split?.lines ??
    (preview?.residents || [])
      .filter((r) => r.days > 0)
      .map((r) => ({ ...r, weight: 0, sharePaise: 0, roundingPaise: 0 }));

  return (
    <Drawer
      isOpen
      onClose={onClose}
      title="New utility bill"
      description="Split a bill transparently across the residents who stayed"
      width="lg"
      footer={
        <div className="grid grid-cols-2 gap-2.5 sm:flex sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" variant="solid" onClick={save} loading={saving} disabled={blocking}>
            Save bill
          </Button>
        </div>
      }
    >
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div className="app-card space-y-4 p-4 sm:p-5">
          <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2">
            <Dropdown label="Utility" value={type} onChange={(v) => setType(v as UtilityType)} options={TYPE_OPTIONS} disabled={saving} />
            <Input
              label="Billing month"
              type="month"
              value={period}
              onChange={(e) => e.target.value && setPeriod(e.target.value)}
              disabled={saving}
            />
          </div>

          <div className="space-y-1.5">
            <span className="text-[13px] font-semibold text-ink-2">Applies to</span>
            <FilterChips<UtilityScope>
              options={[
                { value: 'room', label: 'One room' },
                { value: 'property', label: 'Whole PG' },
              ]}
              value={scope}
              onChange={setScope}
            />
          </div>
          {scope === 'room' &&
            (rooms.length > 0 ? (
              <Dropdown
                label="Room"
                value={roomNumber}
                onChange={setRoomNumber}
                options={rooms.map((r) => ({ value: r, label: `Room ${r}` }))}
                disabled={saving}
              />
            ) : (
              <InfoBanner tone="info" description="No rooms found for this PG yet. Add beds first, or record the bill for the whole PG." />
            ))}

          <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2">
            <Input
              label="Bill amount (₹)"
              inputMode="decimal"
              leading={<IndianRupee />}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              error={totalPaise === null ? 'Enter a valid amount (up to 2 decimals)' : undefined}
              placeholder="0"
              disabled={saving}
              required
            />
            <Input
              label="Provider (optional)"
              leading={<Store />}
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              placeholder="e.g. BESCOM"
              maxLength={80}
              disabled={saving}
            />
          </div>
        </div>

        <SectionCard title="Meter reading (optional)" icon="bolt" bodyClassName="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Previous"
              inputMode="decimal"
              leading={<Gauge />}
              value={meterPrev}
              onChange={(e) => setMeterPrev(e.target.value)}
              disabled={saving}
            />
            <Input
              label="Current"
              inputMode="decimal"
              leading={<Gauge />}
              value={meterCur}
              onChange={(e) => setMeterCur(e.target.value)}
              disabled={saving}
            />
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={meterReset}
            onClick={() => setMeterReset((v) => !v)}
            className="flex min-h-11 w-full items-center gap-3 rounded-2xl px-1 text-left press"
          >
            <span
              className={`grid h-6 w-6 shrink-0 place-items-center rounded-lg border ${
                meterReset ? 'border-transparent bg-[image:var(--grad-brand)] text-white' : 'border-line-strong bg-white'
              }`}
              aria-hidden="true"
            >
              {meterReset && <Check className="h-4 w-4" strokeWidth={3} />}
            </span>
            <span className="text-[13px] font-semibold text-ink-2">
              Meter was reset or replaced this month
              <span className="block text-[12px] font-medium text-muted">Allows a current reading lower than the previous one.</span>
            </span>
          </button>
          {meterError ? (
            <p className="text-xs font-semibold text-danger">{meterError}</p>
          ) : preview?.units !== null && preview?.units !== undefined ? (
            <p className="chip font-mono-numbers">{preview.units} units used</p>
          ) : null}
        </SectionCard>

        <SectionCard
          title="Split between residents"
          icon="users"
          action={previewing || (preview && !previewFresh) ? <span className="chip">Calculating…</span> : undefined}
          bodyClassName="space-y-4"
        >
          <FilterChips<UtilityAllocationRule>
            options={[
              { value: 'equal', label: UTILITY_RULE_LABELS.equal },
              { value: 'occupancy_days', label: UTILITY_RULE_LABELS.occupancy_days },
              { value: 'custom', label: UTILITY_RULE_LABELS.custom },
            ]}
            value={rule}
            onChange={chooseRule}
          />

          {preview?.duplicate && (
            <InfoBanner
              tone="danger"
              title="Already recorded"
              description={`${preview.label} already exists. Void that bill first if it needs correcting.`}
            />
          )}
          {preview && preview.overlaps.length > 0 && (
            <InfoBanner
              tone="warning"
              title="Possible double charge"
              description={`Also recorded this month: ${preview.overlaps.map((o) => o.label).join(', ')}. Residents covered by both would pay twice.`}
            />
          )}
          {previewFailure && <InfoBanner tone="danger" description={previewFailure} />}
          {customInvalid && <InfoBanner tone="warning" description="One of the custom amounts isn't a valid rupee amount." />}
          {preview?.error && !customInvalid && <InfoBanner tone="warning" description={preview.error} />}

          {!preview && !previewFailure ? (
            <ListSkeleton rows={3} />
          ) : residentLines.length === 0 ? (
            <EmptyState
              icon3d="users"
              tint="sky"
              title="No residents to split with"
              description={`Nobody in ${scope === 'room' ? `Room ${roomNumber || '—'}` : 'this PG'} stayed during ${formatPeriodLabel(period)}.`}
            />
          ) : (
            <>
              <AllocationRows
                lines={residentLines}
                daysInPeriod={preview?.daysInPeriod || 30}
                custom={rule === 'custom' ? custom : undefined}
                onCustomChange={rule === 'custom' ? (id, v) => setCustom((c) => ({ ...c, [id]: v })) : undefined}
              />
              {rule === 'custom' ? (
                <div className="flex items-center justify-between gap-3 border-t border-line pt-3">
                  <span className="text-[13px] font-semibold text-ink-2">Left to allocate</span>
                  <Badge variant={remaining === 0 ? 'paid' : 'pending'} dot>
                    <span className="font-mono-numbers">{rupeeText(remaining)}</span>
                  </Badge>
                </div>
              ) : (
                preview?.split && (
                  <>
                    <div className="flex items-center justify-between gap-3 border-t border-line pt-3">
                      <span className="text-[13px] font-semibold text-ink-2">Total allocated</span>
                      <span className="inline-flex items-center gap-1.5 font-mono-numbers text-[14px] font-extrabold text-success-ink">
                        <Check className="h-4 w-4" strokeWidth={3} />
                        {rupeeText(preview.split.allocatedPaise)}
                      </span>
                    </div>
                    <SplitExplainer
                      rule={rule}
                      totalPaise={totalPaise ?? 0}
                      totalWeight={preview.split.totalWeight}
                      count={preview.split.lines.length}
                    />
                  </>
                )
              )}
              {preview?.split && preview.split.excluded.length > 0 && (
                <p className="text-[12px] font-medium text-muted">
                  Not included: {preview.split.excluded.map((x) => x.tenantName).join(', ')} (did not stay this month).
                </p>
              )}
            </>
          )}
        </SectionCard>

        <Textarea
          label="Notes (optional)"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={300}
          placeholder="e.g. Bill no. 4471, due 10 Dec"
          disabled={saving}
        />
        <InfoBanner
          tone="brand"
          description="Saving does not charge anyone yet. You'll see the final split and can apply it to rent in the next step."
        />
      </form>
    </Drawer>
  );
}

/* ---------------- Bill detail sheet ---------------- */

function BillDetailDrawer({
  bill,
  onClose,
  onChanged,
}: {
  bill: UtilityBill;
  onClose: () => void;
  onChanged: (bill: UtilityBill) => void;
}) {
  const [confirmApply, setConfirmApply] = useState(false);
  const [confirmVoid, setConfirmVoid] = useState(false);
  const [busy, setBusy] = useState(false);

  const chargeable = bill.allocations.filter((a) => a.sharePaise > 0);
  const toCharge = chargeable.filter((a) => a.status !== 'applied');
  const skipped = bill.allocations.filter((a) => a.status === 'skipped');
  const v = TYPE_VISUAL[bill.type] || TYPE_VISUAL.other;
  const meta = STATUS_META[bill.status];
  const totalWeight = bill.allocations.reduce((s, a) => s + a.weight, 0);

  const apply = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/utilities/${bill.id}/apply`, { method: 'POST' });
      if (!res.ok) throw new Error(await readError(res, 'Could not apply the bill'));
      const data = await res.json();
      const charged = data.result?.charged?.length || 0;
      const skippedN = data.result?.skipped?.length || 0;
      if (charged > 0) toast.success(`Added to ${charged} resident${charged === 1 ? "'s" : "s'"} rent`);
      else if (skippedN === 0) toast.success('Already applied — nothing new to charge');
      if (skippedN > 0) toast.error(`${skippedN} resident${skippedN === 1 ? '' : 's'} skipped — see the reasons below`);
      onChanged(data.bill as UtilityBill);
      setConfirmApply(false);
    } catch (e: unknown) {
      toast.error(errorMessage(e, 'Could not apply the bill'));
    } finally {
      setBusy(false);
    }
  };

  const voidBill = async (reason: string) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/utilities/${bill.id}/void`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) throw new Error(await readError(res, 'Could not void the bill'));
      const data = await res.json();
      const credits: Array<{ tenantName: string; paise: number }> = data.result?.credits || [];
      const covered: string[] = data.result?.covered || [];
      toast.success('Bill voided and charges reversed');
      if (covered.length > 0) {
        toast(`${covered.join(', ')}: rent is now fully covered by payments already made — confirm it to issue the receipt.`, {
          duration: 7000,
        });
      }
      if (credits.length > 0) {
        toast(`Overpaid now: ${credits.map((c) => `${c.tenantName} ${rupeeText(c.paise)}`).join(', ')} — refund or adjust next month.`, {
          duration: 7000,
        });
      }
      onChanged(data.bill as UtilityBill);
      setConfirmVoid(false);
    } catch (e: unknown) {
      toast.error(errorMessage(e, 'Could not void the bill'));
    } finally {
      setBusy(false);
    }
  };

  const canApply = bill.status === 'draft' || bill.status === 'partial';
  const canVoid = bill.status !== 'void';

  return (
    <>
      <Drawer
        isOpen
        onClose={onClose}
        title={bill.label}
        description={`${rupeeText(bill.totalPaise)} · ${UTILITY_RULE_LABELS[bill.rule]}`}
        width="lg"
        footer={
          canApply || canVoid ? (
            <div className="grid grid-cols-2 gap-2.5 sm:flex sm:justify-end">
              {canVoid && (
                <Button type="button" variant="outline" onClick={() => setConfirmVoid(true)} disabled={busy}>
                  <RotateCcw className="h-4 w-4" /> Void bill
                </Button>
              )}
              {canApply ? (
                <Button type="button" variant="solid" onClick={() => setConfirmApply(true)} disabled={busy || toCharge.length === 0}>
                  Apply to rent
                </Button>
              ) : (
                <Button type="button" variant="soft" onClick={onClose}>
                  Done
                </Button>
              )}
            </div>
          ) : undefined
        }
      >
        <div className="space-y-5">
          {bill.status === 'draft' && (
            <InfoBanner
              tone="warning"
              title="Not charged yet"
              description={`Review the split below. "Apply to rent" adds each share as a line item on the resident's ${formatPeriodLabel(bill.period)} rent.`}
            />
          )}
          {bill.status === 'partial' && (
            <InfoBanner
              tone="info"
              title={`${skipped.length} share${skipped.length === 1 ? '' : 's'} still to charge`}
              description="Fix the reasons shown next to each resident, then apply again — already-charged residents are never charged twice."
            />
          )}
          {bill.status === 'applied' && (
            <InfoBanner
              tone="success"
              title={chargeable.length > 0 ? 'Applied to rent' : 'Nothing to charge'}
              description={
                chargeable.length > 0
                  ? `Charged to ${chargeable.length} resident${chargeable.length === 1 ? '' : 's'} for ${formatPeriodLabel(bill.period)}.`
                  : 'This bill has no amount to split, so no rent was changed.'
              }
            />
          )}
          {bill.status === 'void' && (
            <InfoBanner
              tone="danger"
              title="Voided"
              description={`${bill.voidReason || 'No reason given'}${bill.voidedAt ? ` · ${formatDateIN(new Date(String(bill.voidedAt)))}` : ''}. Any charges were reversed.`}
            />
          )}

          <SectionCard title="Bill details" icon={v.icon} bodyClassName="divide-y divide-line">
            <KeyValue label="Status" value={<Badge variant={meta.badge} dot>{meta.label}</Badge>} />
            <KeyValue label="Total" value={rupeeText(bill.totalPaise)} />
            <KeyValue label="Utility" value={`${UTILITY_TYPE_LABELS[bill.type]}${bill.provider ? ` · ${bill.provider}` : ''}`} />
            <KeyValue label="Applies to" value={bill.scope === 'room' ? `Room ${bill.roomNumber}` : 'Whole PG'} />
            <KeyValue label="Month" value={`${formatPeriodLabel(bill.period)} (${bill.daysInPeriod} days)`} />
            {bill.meter && (
              <KeyValue
                label="Meter"
                value={`${bill.meter.previous} → ${bill.meter.current} = ${bill.meter.units} units${bill.meter.reset ? ' (reset)' : ''}`}
              />
            )}
            {bill.notes && <KeyValue label="Notes" value={<span className="font-sans font-medium">{bill.notes}</span>} />}
          </SectionCard>

          <SectionCard
            title="Per-resident split"
            icon="users"
            action={<span className="chip font-mono-numbers">{bill.allocations.length}</span>}
            bodyClassName="space-y-3"
          >
            {bill.allocations.length === 0 ? (
              <p className="text-[13px] text-muted">No residents were part of this bill.</p>
            ) : (
              <>
                <AllocationRows lines={bill.allocations} daysInPeriod={bill.daysInPeriod} statusFor />
                <SplitExplainer rule={bill.rule} totalPaise={bill.totalPaise} totalWeight={totalWeight} count={bill.allocations.length} />
              </>
            )}
          </SectionCard>

          {bill.history.length > 0 && (
            <SectionCard title="History" icon="clock">
              <ul className="divide-y divide-line">
                {bill.history.map((h, i) => (
                  <li key={`${h.at}-${i}`}>
                    <ActivityRow
                      icon={h.action === 'voided' ? 'alert' : h.action === 'applied' ? 'check' : 'doc'}
                      tint={h.action === 'voided' ? 'rose' : h.action === 'applied' ? 'mint' : 'indigo'}
                      title={h.action === 'created' ? 'Bill saved' : h.action === 'applied' ? 'Applied to rent' : 'Voided'}
                      subtitle={h.note || undefined}
                      trailing={<span className="font-mono-numbers">{formatDateIN(new Date(h.at))}</span>}
                    />
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}
        </div>
      </Drawer>

      <ConfirmDialog
        open={confirmApply}
        tone="default"
        title="Apply to rent?"
        message={`Adds ${toCharge.length} line item${toCharge.length === 1 ? '' : 's'} (“${bill.label}”) to residents' ${formatPeriodLabel(
          bill.period
        )} rent. Fully-paid rent will show a balance again.`}
        confirmLabel="Apply"
        busy={busy}
        onConfirm={apply}
        onCancel={() => setConfirmApply(false)}
      />
      <ConfirmDialog
        open={confirmVoid}
        tone="danger"
        title="Void this bill?"
        message="Charges are removed from unpaid rent; where rent has payments, a reversal line is added instead. This can't be undone."
        confirmLabel="Void bill"
        reasonLabel="Reason"
        reasonPlaceholder="e.g. Wrong meter reading"
        busy={busy}
        onConfirm={voidBill}
        onCancel={() => setConfirmVoid(false)}
      />
    </>
  );
}

/* ---------------- Page ---------------- */

function UtilitiesView() {
  const { ownerId, properties, selectedPropertyId } = useOwnerSession();
  const propertyFilter = properties.length > 1 ? selectedPropertyId : undefined;
  const { beds } = useBeds(ownerId, propertyFilter);
  const rooms = useMemo(
    () =>
      Array.from(new Set(beds.filter((b) => !b.deletedAt && b.roomNumber).map((b) => b.roomNumber))).sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true })
      ),
    [beds]
  );

  const [period, setPeriod] = useState(() => istTodayIso(Date.now()).slice(0, 7));
  const [bills, setBills] = useState<UtilityBill[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | UtilityBillStatus>('all');
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ period });
      if (propertyFilter) qs.set('propertyId', propertyFilter);
      const res = await fetch(`/api/utilities?${qs.toString()}`);
      if (!res.ok) throw new Error(await readError(res, 'Could not load utility bills'));
      const data = await res.json();
      setBills(data.bills || []);
      setLoadError(null);
    } catch (e: unknown) {
      setLoadError(errorMessage(e, 'Could not load utility bills'));
    } finally {
      setLoading(false);
    }
  }, [period, propertyFilter]);

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

  const live = bills.filter((b) => b.status !== 'void');
  const billedPaise = live.reduce((s, b) => s + b.totalPaise, 0);
  const chargedPaise = live.reduce(
    (s, b) => s + b.allocations.filter((a) => a.status === 'applied').reduce((x, a) => x + a.sharePaise, 0),
    0
  );
  const actionCount = live.filter((b) => b.status === 'draft' || b.status === 'partial').length;
  const visible = filter === 'all' ? bills : bills.filter((b) => b.status === filter);
  const openBill = openId ? bills.find((b) => b.id === openId) || null : null;

  const replaceBill = (bill: UtilityBill) =>
    setBills((list) => (list.some((b) => b.id === bill.id) ? list.map((b) => (b.id === bill.id ? bill : b)) : [bill, ...list]));

  return (
    <div className="space-y-5">
      <PageHeader
        icon="bolt"
        tint="amber"
        title="Utilities"
        highlight="& Split"
        subtitle="Record power, water and internet bills and split them fairly into rent."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> New bill
          </Button>
        }
      />

      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" aria-label="Previous month" onClick={() => setPeriod((p) => shiftPeriod(p, -1))}>
          <ChevronLeft />
        </Button>
        <label className="sr-only" htmlFor="util-month">
          Billing month
        </label>
        <input
          id="util-month"
          type="month"
          className="field h-11 min-w-0 flex-1 rounded-full px-4 text-center font-bold sm:max-w-[220px] sm:flex-none"
          value={period}
          onChange={(e) => e.target.value && setPeriod(e.target.value)}
        />
        <Button variant="outline" size="icon" aria-label="Next month" onClick={() => setPeriod((p) => shiftPeriod(p, 1))}>
          <ChevronRight />
        </Button>
      </div>

      {loading ? (
        <StatGridSkeleton count={4} />
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 stagger">
          <StatTile icon="bolt" tint="amber" label="Bills" value={live.length} caption={formatPeriodLabel(period)} />
          <StatTile icon="wallet-orange" tint="peach" label="Total Billed" value={rupeeText(billedPaise)} />
          <StatTile icon="rupee" tint="mint" label="Added to Rent" value={rupeeText(chargedPaise)} />
          <StatTile icon="alert" tint="rose" label="Needs Action" value={actionCount} />
        </div>
      )}

      {loadError && !loading && (
        <InfoBanner
          tone="danger"
          title="Couldn't load bills"
          description={loadError}
          action={
            <Button variant="outline" size="sm" onClick={load}>
              Try again
            </Button>
          }
        />
      )}

      {!loading && actionCount > 0 && (
        <InfoBanner
          tone="warning"
          title={`${actionCount} bill${actionCount === 1 ? '' : 's'} not fully applied`}
          description="Open a bill to review the split and add it to residents' rent."
        />
      )}

      <FilterChips<'all' | UtilityBillStatus>
        options={[
          { value: 'all', label: 'All', count: bills.length },
          { value: 'draft', label: 'Not applied', count: bills.filter((b) => b.status === 'draft').length },
          { value: 'partial', label: 'Partly applied', count: bills.filter((b) => b.status === 'partial').length },
          { value: 'applied', label: 'Applied', count: bills.filter((b) => b.status === 'applied').length },
          { value: 'void', label: 'Voided', count: bills.filter((b) => b.status === 'void').length },
        ]}
        value={filter}
        onChange={setFilter}
      />

      {loading ? (
        <ListSkeleton rows={4} />
      ) : visible.length === 0 ? (
        <div className="app-card">
          <EmptyState
            icon3d="bolt"
            tint="amber"
            title={filter === 'all' ? `No bills for ${formatPeriodLabel(period)}` : 'No bills in this filter'}
            description="Record an electricity, water or internet bill and PGPass shows exactly how it's split before anything is charged."
            action={
              filter === 'all' ? (
                <Button onClick={() => setCreating(true)}>
                  <Plus className="h-4 w-4" /> New bill
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <SectionCard title={`${formatPeriodLabel(period)} bills`} icon="report" action={<span className="chip font-mono-numbers">{visible.length}</span>}>
          <ul className="divide-y divide-line stagger">
            {visible.map((b) => {
              const tv = TYPE_VISUAL[b.type] || TYPE_VISUAL.other;
              const m = STATUS_META[b.status];
              return (
                <li key={b.id}>
                  <ActivityRow
                    icon={tv.icon}
                    tint={tv.tint}
                    title={b.scope === 'room' ? `Room ${b.roomNumber}` : 'Whole PG'}
                    subtitle={
                      <span className="flex min-w-0 items-center gap-1.5 pt-0.5">
                        <Badge variant={m.badge} dot className="shrink-0">
                          {m.label}
                        </Badge>
                        <span className="truncate">
                          {UTILITY_TYPE_LABELS[b.type]} · {UTILITY_RULE_LABELS[b.rule]} · {b.allocations.length} resident
                          {b.allocations.length === 1 ? '' : 's'}
                          {b.provider ? ` · ${b.provider}` : ''}
                        </span>
                      </span>
                    }
                    trailing={
                      <span className={`font-mono-numbers text-[14.5px] font-extrabold ${b.status === 'void' ? 'text-faint line-through' : 'text-ink'}`}>
                        {rupeeText(b.totalPaise)}
                      </span>
                    }
                    onClick={() => setOpenId(b.id)}
                  />
                </li>
              );
            })}
          </ul>
        </SectionCard>
      )}

      {creating && (
        <NewBillDrawer
          period={period}
          rooms={rooms}
          propertyId={selectedPropertyId || undefined}
          onClose={() => setCreating(false)}
          onSaved={(bill) => {
            setCreating(false);
            if (bill.period === period) replaceBill(bill);
            else setPeriod(bill.period);
            setOpenId(bill.id);
          }}
        />
      )}
      {openBill && <BillDetailDrawer bill={openBill} onClose={() => setOpenId(null)} onChanged={replaceBill} />}
    </div>
  );
}

export default function UtilitiesPage() {
  return (
    <OwnerOnlyGuard>
      <UtilitiesView />
    </OwnerOnlyGuard>
  );
}
