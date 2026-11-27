'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useOwnerSession } from '@/hooks/useOwner';
import { useBeds } from '@/hooks/useBeds';
import { Button } from '@/components/ui/button';
import { Input, SearchInput, Textarea } from '@/components/ui/input';
import { Dropdown } from '@/components/ui/dropdown';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Drawer } from '@/components/ui/drawer';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { CardListSkeleton, StatGridSkeleton } from '@/components/ui/skeletons';
import { ActivityRow, FilterChips, InfoBanner, PageHeader, SectionCard, StatTile } from '@/components/ui/dashboard-kit';
import { type Icon3DName, type Tint } from '@/components/brand/Icon3D';
import { errorMessage, formatDateIN, readApiError } from '@/lib/utils';
import {
  ASSET_CATEGORY_LABELS,
  ASSET_CONDITION_LABELS,
  MAX_ASSET_QUANTITY,
  istTodayIso,
  warrantyStatus,
  type AssetSummary,
} from '@/lib/assets';
import { CalendarDays, Hash, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Asset, AssetCategory, AssetCondition, AssetHistoryEntry, AssetLocation } from '@/types';

/* ---------------- presentation maps ---------------- */

const CATEGORY_VISUAL: Record<AssetCategory, { icon: Icon3DName; tint: Tint }> = {
  furniture: { icon: 'bed', tint: 'violet' },
  appliance: { icon: 'tools-purple', tint: 'rose' },
  electrical: { icon: 'bolt', tint: 'amber' },
  bedding: { icon: 'bed-teal', tint: 'mint' },
  other: { icon: 'grid', tint: 'slate' },
};

const CONDITION_BADGE: Record<AssetCondition, NonNullable<BadgeProps['variant']>> = {
  good: 'paid',
  fair: 'cyan',
  damaged: 'pending',
  missing: 'danger',
};

const CATEGORY_OPTIONS = (Object.keys(ASSET_CATEGORY_LABELS) as AssetCategory[]).map((c) => ({
  value: c,
  label: ASSET_CATEGORY_LABELS[c],
}));
const CONDITIONS = Object.keys(ASSET_CONDITION_LABELS) as AssetCondition[];

const EMPTY_SUMMARY: AssetSummary = {
  entries: 0,
  totalQuantity: 0,
  byCondition: { good: 0, fair: 0, damaged: 0, missing: 0 },
  needsAttention: 0,
  warrantyExpiringSoon: 0,
};

// Server errors are `{ error, code, requestId }` — shared extractor (R-A3).
const readError = readApiError;

function historyText(h: AssetHistoryEntry): { title: string; icon: Icon3DName; tint: Tint } {
  switch (h.action) {
    case 'created': {
      const bad = h.toCondition === 'damaged' || h.toCondition === 'missing';
      return {
        title: `Added · qty ${h.toQuantity ?? '—'}${h.toCondition ? ` · ${ASSET_CONDITION_LABELS[h.toCondition]}` : ''}`,
        icon: bad ? 'alert' : 'check',
        tint: bad ? 'peach' : 'mint',
      };
    }
    case 'condition':
      return {
        title: `${h.fromCondition ? ASSET_CONDITION_LABELS[h.fromCondition] : '—'} → ${h.toCondition ? ASSET_CONDITION_LABELS[h.toCondition] : '—'}`,
        icon: h.toCondition === 'damaged' || h.toCondition === 'missing' ? 'alert' : 'check',
        tint: h.toCondition === 'damaged' || h.toCondition === 'missing' ? 'peach' : 'mint',
      };
    case 'quantity':
      return { title: `Quantity ${h.fromQuantity} → ${h.toQuantity}`, icon: 'grid', tint: 'indigo' };
    case 'deleted':
      return { title: 'Removed from inventory', icon: 'alert', tint: 'rose' };
    default:
      return { title: `Edited ${(h.fields || []).join(', ')}`, icon: 'doc', tint: 'sky' };
  }
}

/* ---------------- Add / edit sheet ---------------- */

function AssetDrawer({
  asset,
  rooms,
  propertyId,
  defaultRoom,
  todayIso,
  onClose,
  onSaved,
  onDeleted,
}: {
  asset: Asset | null; // null = create
  rooms: string[];
  propertyId?: string;
  defaultRoom?: string;
  todayIso: string;
  onClose: () => void;
  onSaved: (asset: Asset) => void;
  onDeleted: (id: string) => void;
}) {
  const editing = asset !== null;
  const [location, setLocation] = useState<AssetLocation>(asset?.location || (rooms.length > 0 ? 'room' : 'common'));
  const [roomNumber, setRoomNumber] = useState(asset?.roomNumber || defaultRoom || rooms[0] || '');
  const [name, setName] = useState(asset?.name || '');
  const [category, setCategory] = useState<AssetCategory>(asset?.category || 'furniture');
  const [quantity, setQuantity] = useState(String(asset?.quantity ?? 1));
  const [condition, setCondition] = useState<AssetCondition>(asset?.condition || 'good');
  const [purchaseDate, setPurchaseDate] = useState(asset?.purchaseDate || '');
  const [warrantyUntil, setWarrantyUntil] = useState(asset?.warrantyUntil || '');
  const [notes, setNotes] = useState(asset?.notes || '');
  const [changeNote, setChangeNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const qty = Number(quantity);
  const qtyError =
    !/^\d+$/.test(quantity.trim()) || qty > MAX_ASSET_QUANTITY || qty < (editing ? 0 : 1)
      ? `Enter a whole number from ${editing ? 0 : 1} to ${MAX_ASSET_QUANTITY}`
      : undefined;
  const nameError = name.trim().length > 0 && name.trim().length < 2 ? 'Name must be at least 2 characters' : undefined;
  const warrantyError =
    purchaseDate && warrantyUntil && warrantyUntil < purchaseDate ? 'Warranty cannot end before the purchase date' : undefined;
  const canSave =
    !saving && name.trim().length >= 2 && !qtyError && !warrantyError && (location === 'common' || !!roomNumber);

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const payload = editing
        ? {
            name: name.trim(),
            category,
            quantity: qty,
            condition,
            purchaseDate: purchaseDate || null,
            warrantyUntil: warrantyUntil || null,
            notes: notes.trim() || null,
            note: changeNote.trim() || undefined,
          }
        : {
            propertyId,
            location,
            roomNumber: location === 'room' ? roomNumber : undefined,
            name: name.trim(),
            category,
            quantity: qty,
            condition,
            purchaseDate: purchaseDate || null,
            warrantyUntil: warrantyUntil || null,
            notes: notes.trim() || undefined,
          };
      const res = await fetch(editing ? `/api/assets/${asset.id}` : '/api/assets', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await readError(res, 'Could not save the item'));
      const data = await res.json();
      toast.success(editing ? 'Item updated' : 'Item added');
      onSaved(data.asset as Asset);
    } catch (e: unknown) {
      toast.error(errorMessage(e, 'Could not save the item'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!asset) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/assets/${asset.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await readError(res, 'Could not remove the item'));
      toast.success('Item removed');
      onDeleted(asset.id);
    } catch (e: unknown) {
      toast.error(errorMessage(e, 'Could not remove the item'));
    } finally {
      setSaving(false);
      setConfirmDelete(false);
    }
  };

  const ws = warrantyStatus(warrantyUntil || null, todayIso);

  return (
    <>
      <Drawer
        isOpen
        onClose={onClose}
        title={editing ? asset.name : 'Add inventory item'}
        description={
          editing
            ? asset.location === 'room'
              ? `Room ${asset.roomNumber} · ${ASSET_CATEGORY_LABELS[asset.category]}`
              : `Common area · ${ASSET_CATEGORY_LABELS[asset.category]}`
            : 'Track what is in each room so damage and missing items have a trail'
        }
        width="md"
        footer={
          <div className="grid grid-cols-2 gap-2.5 sm:flex sm:justify-end">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" variant="solid" onClick={save} loading={saving} disabled={!canSave}>
              {editing ? 'Save changes' : 'Add item'}
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
            {!editing && (
              <>
                <div className="space-y-1.5">
                  <span className="text-[13px] font-semibold text-ink-2">Where is it?</span>
                  <FilterChips<AssetLocation>
                    options={[
                      { value: 'room', label: 'In a room' },
                      { value: 'common', label: 'Common area' },
                    ]}
                    value={location}
                    onChange={setLocation}
                  />
                </div>
                {location === 'room' &&
                  (rooms.length > 0 ? (
                    <Dropdown
                      label="Room"
                      value={roomNumber}
                      onChange={setRoomNumber}
                      options={rooms.map((r) => ({ value: r, label: `Room ${r}` }))}
                      disabled={saving}
                    />
                  ) : (
                    <InfoBanner tone="info" description="No rooms yet — add beds first, or record this as a common-area item." />
                  ))}
              </>
            )}
            <Input
              label="Item name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Study table, Ceiling fan, Mattress"
              maxLength={80}
              error={nameError}
              disabled={saving}
              required
            />
            <div className="grid grid-cols-1 gap-4 min-[400px]:grid-cols-2">
              <Dropdown label="Category" value={category} onChange={(v) => setCategory(v as AssetCategory)} options={CATEGORY_OPTIONS} disabled={saving} />
              <Input
                label="Quantity"
                inputMode="numeric"
                leading={<Hash />}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                error={qtyError}
                disabled={saving}
              />
            </div>
            <div className="space-y-1.5">
              <span className="text-[13px] font-semibold text-ink-2">Condition</span>
              <FilterChips<AssetCondition>
                options={CONDITIONS.map((c) => ({ value: c, label: ASSET_CONDITION_LABELS[c] }))}
                value={condition}
                onChange={setCondition}
              />
            </div>
            {editing && condition !== asset.condition && (
              <Input
                label="What happened? (optional)"
                value={changeNote}
                onChange={(e) => setChangeNote(e.target.value)}
                placeholder="e.g. Leg broken during move-out"
                maxLength={200}
                disabled={saving}
              />
            )}
          </div>

          <SectionCard title="Purchase & warranty" icon="calendar" bodyClassName="space-y-4">
            <div className="grid grid-cols-1 gap-4 min-[400px]:grid-cols-2">
              <Input label="Purchase date" type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} disabled={saving} />
              <Input
                label="Warranty until"
                type="date"
                value={warrantyUntil}
                onChange={(e) => setWarrantyUntil(e.target.value)}
                error={warrantyError}
                disabled={saving}
              />
            </div>
            {ws === 'expiring' && <InfoBanner tone="warning" description="Warranty ends within 30 days — raise any claim soon." />}
            {ws === 'expired' && <InfoBanner tone="info" description="Warranty has ended." />}
          </SectionCard>

          <Textarea
            label="Notes (optional)"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={300}
            disabled={saving}
          />

          {editing && asset.history.length > 0 && (
            <SectionCard title="History" icon="clock">
              <ul className="divide-y divide-line">
                {[...asset.history].reverse().map((h, i) => {
                  const t = historyText(h);
                  return (
                    <li key={`${h.at}-${i}`}>
                      <ActivityRow
                        icon={t.icon}
                        tint={t.tint}
                        title={t.title}
                        subtitle={`${h.byRole === 'staff' ? 'Staff' : 'Owner'}${h.note ? ` · ${h.note}` : ''}`}
                        trailing={<span className="font-mono-numbers">{formatDateIN(new Date(h.at))}</span>}
                      />
                    </li>
                  );
                })}
              </ul>
            </SectionCard>
          )}

          {editing && (
            <Button type="button" variant="ghost" className="w-full text-danger-ink hover:bg-danger-bg" onClick={() => setConfirmDelete(true)} disabled={saving}>
              <Trash2 className="h-4 w-4" /> Remove from inventory
            </Button>
          )}
        </form>
      </Drawer>
      <ConfirmDialog
        open={confirmDelete}
        title="Remove this item?"
        message="It disappears from the inventory list, but its history is kept for your records."
        confirmLabel="Remove"
        busy={saving}
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}

/* ---------------- Page ---------------- */

export default function InventoryPage() {
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
  const [todayIso] = useState(() => istTodayIso(Date.now()));

  const [assets, setAssets] = useState<Asset[]>([]);
  const [summary, setSummary] = useState<AssetSummary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | AssetCondition>('all');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Asset | null>(null);
  const [creating, setCreating] = useState<{ room?: string } | null>(null);

  // `silent` refreshes in place (after a save) without flashing the skeletons.
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const qs = propertyFilter ? `?propertyId=${encodeURIComponent(propertyFilter)}` : '';
      const res = await fetch(`/api/assets${qs}`);
      if (!res.ok) throw new Error(await readError(res, 'Could not load the inventory'));
      const data = await res.json();
      setAssets(data.assets || []);
      setSummary(data.summary || EMPTY_SUMMARY);
      setLoadError(null);
    } catch (e: unknown) {
      setLoadError(errorMessage(e, 'Could not load the inventory'));
    } finally {
      setLoading(false);
    }
  }, [propertyFilter]);

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

  const q = query.trim().toLowerCase();
  const visible = assets.filter(
    (a) =>
      (filter === 'all' || a.condition === filter) &&
      (!q ||
        a.name.toLowerCase().includes(q) ||
        (a.roomNumber || '').toLowerCase().includes(q) ||
        ASSET_CATEGORY_LABELS[a.category].toLowerCase().includes(q) ||
        (a.notes || '').toLowerCase().includes(q))
  );

  // Group by room (numeric order), common areas last. Server already sorts.
  const groups: Array<{ key: string; title: string; room?: string; items: Asset[] }> = [];
  for (const a of visible) {
    const key = a.location === 'common' ? '__common' : `room:${a.roomNumber}`;
    let g = groups.find((x) => x.key === key);
    if (!g) {
      g = { key, title: a.location === 'common' ? 'Common areas' : `Room ${a.roomNumber}`, room: a.roomNumber || undefined, items: [] };
      groups.push(g);
    }
    g.items.push(a);
  }

  const replaceAsset = (asset: Asset) => {
    setAssets((list) => (list.some((a) => a.id === asset.id) ? list.map((a) => (a.id === asset.id ? asset : a)) : [asset, ...list]));
  };

  return (
    <div className="space-y-5">
      <PageHeader
        icon="tools"
        tint="indigo"
        title="Room"
        highlight="Inventory"
        subtitle="What's in each room, its condition, and anything that needs fixing."
        actions={
          <Button onClick={() => setCreating({})}>
            <Plus className="h-4 w-4" /> Add item
          </Button>
        }
      />

      {loading ? (
        <StatGridSkeleton count={4} />
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 stagger">
          <StatTile icon="grid" tint="indigo" label="Items" value={summary.entries} caption={`${summary.totalQuantity} units`} />
          <StatTile icon="check" tint="mint" label="Good" value={summary.byCondition.good} />
          <StatTile icon="alert" tint="peach" label="Needs Attention" value={summary.needsAttention} />
          <StatTile icon="calendar-clock" tint="violet" label="Warranty ≤ 30 days" value={summary.warrantyExpiringSoon} />
        </div>
      )}

      {loadError && !loading && (
        <InfoBanner
          tone="danger"
          title="Couldn't load the inventory"
          description={loadError}
          action={
            <Button variant="outline" size="sm" onClick={() => load()}>
              Try again
            </Button>
          }
        />
      )}

      {!loading && summary.needsAttention > 0 && (
        <InfoBanner
          tone="warning"
          title={`${summary.needsAttention} item${summary.needsAttention === 1 ? '' : 's'} damaged or missing`}
          description="Repair, replace or recover them — every condition change is kept in the item's history."
        />
      )}

      <div className="space-y-3">
        <SearchInput
          placeholder="Search items, rooms or notes"
          aria-label="Search inventory"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <FilterChips<'all' | AssetCondition>
          options={[
            { value: 'all', label: 'All', count: summary.entries },
            ...CONDITIONS.map((c) => ({ value: c, label: ASSET_CONDITION_LABELS[c], count: summary.byCondition[c] })),
          ]}
          value={filter}
          onChange={setFilter}
        />
      </div>

      {loading ? (
        <CardListSkeleton rows={3} height="h-40" cols={2} />
      ) : groups.length === 0 ? (
        <div className="app-card">
          <EmptyState
            icon3d="tools"
            tint="indigo"
            title={assets.length === 0 ? 'No items recorded yet' : 'Nothing matches'}
            description={
              assets.length === 0
                ? 'Start a checklist for each room — beds, mattresses, fans, tables — so move-in and move-out inspections are quick.'
                : 'Try a different search or condition filter.'
            }
            action={
              assets.length === 0 ? (
                <Button onClick={() => setCreating({})}>
                  <Plus className="h-4 w-4" /> Add item
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2 stagger">
          {groups.map((g) => {
            const attention = g.items.filter((a) => a.condition === 'damaged' || a.condition === 'missing').length;
            return (
              <SectionCard
                key={g.key}
                title={g.title}
                icon={g.key === '__common' ? 'building' : 'bed'}
                action={
                  <span className="flex items-center gap-1.5">
                    {attention > 0 && (
                      <Badge variant="danger" dot>
                        {attention} to fix
                      </Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Add item to ${g.title}`}
                      onClick={() => setCreating({ room: g.room })}
                    >
                      <Plus />
                    </Button>
                  </span>
                }
              >
                <ul className="divide-y divide-line">
                  {g.items.map((a) => {
                    const v = CATEGORY_VISUAL[a.category] || CATEGORY_VISUAL.other;
                    const ws = warrantyStatus(a.warrantyUntil, todayIso);
                    return (
                      <li key={a.id}>
                        <ActivityRow
                          icon={v.icon}
                          tint={v.tint}
                          title={
                            <>
                              {a.name}
                              {a.quantity !== 1 && <span className="font-mono-numbers font-semibold text-muted"> ×{a.quantity}</span>}
                            </>
                          }
                          subtitle={
                            <span className="inline-flex items-center gap-1.5">
                              {ASSET_CATEGORY_LABELS[a.category]}
                              {ws === 'expiring' && (
                                <span className="inline-flex items-center gap-1 text-warning-ink">
                                  <ShieldCheck className="h-3.5 w-3.5" /> Warranty ends {formatDateIN(a.warrantyUntil)}
                                </span>
                              )}
                              {ws !== 'expiring' && a.purchaseDate && (
                                <span className="inline-flex items-center gap-1">
                                  <CalendarDays className="h-3.5 w-3.5" /> {formatDateIN(a.purchaseDate)}
                                </span>
                              )}
                            </span>
                          }
                          trailing={
                            <Badge variant={CONDITION_BADGE[a.condition]} dot>
                              {ASSET_CONDITION_LABELS[a.condition]}
                            </Badge>
                          }
                          onClick={() => setEditing(a)}
                        />
                      </li>
                    );
                  })}
                </ul>
              </SectionCard>
            );
          })}
        </div>
      )}

      {(creating || editing) && (
        <AssetDrawer
          asset={editing}
          rooms={rooms}
          propertyId={selectedPropertyId || undefined}
          defaultRoom={creating?.room}
          todayIso={todayIso}
          onClose={() => {
            setCreating(null);
            setEditing(null);
          }}
          onSaved={(asset) => {
            replaceAsset(asset);
            setCreating(null);
            setEditing(null);
            load(true); // refresh server-computed summary
          }}
          onDeleted={(id) => {
            setAssets((list) => list.filter((a) => a.id !== id));
            setEditing(null);
            load(true);
          }}
        />
      )}
    </div>
  );
}
