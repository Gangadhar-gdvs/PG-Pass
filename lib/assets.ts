/**
 * Room inventory / assets: pure helpers shared by assets.service and the
 * owner UI. No Firestore, no implicit clock (callers pass `todayIso`).
 */
import type { Asset, AssetCategory, AssetCondition, AssetHistoryEntry } from '@/types';

export const ASSET_CATEGORIES = ['furniture', 'appliance', 'electrical', 'bedding', 'other'] as const;
export const ASSET_CONDITIONS = ['good', 'fair', 'damaged', 'missing'] as const;
export const ASSET_LOCATIONS = ['room', 'common'] as const;

export const ASSET_CATEGORY_LABELS: Record<AssetCategory, string> = {
  furniture: 'Furniture',
  appliance: 'Appliance',
  electrical: 'Electrical',
  bedding: 'Bedding',
  other: 'Other',
};

export const ASSET_CONDITION_LABELS: Record<AssetCondition, string> = {
  good: 'Good',
  fair: 'Fair',
  damaged: 'Damaged',
  missing: 'Missing',
};

export const MAX_ASSET_QUANTITY = 999;
/** Warranty is "expiring soon" when it ends within this many days. */
export const WARRANTY_SOON_DAYS = 30;

const DAY_MS = 86_400_000;

/** Today's calendar date in Asia/Kolkata (UTC+5:30) as YYYY-MM-DD. */
export function istTodayIso(nowMs: number): string {
  return new Date(nowMs + 330 * 60_000).toISOString().slice(0, 10);
}

/** Add `days` to a YYYY-MM-DD date. */
export function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) + days * DAY_MS).toISOString().slice(0, 10);
}

export type WarrantyStatus = 'none' | 'active' | 'expiring' | 'expired';

/** Warranty state relative to `todayIso` (ISO strings compare lexically). */
export function warrantyStatus(warrantyUntil: string | null | undefined, todayIso: string): WarrantyStatus {
  if (!warrantyUntil) return 'none';
  if (warrantyUntil < todayIso) return 'expired';
  if (warrantyUntil <= addDaysIso(todayIso, WARRANTY_SOON_DAYS)) return 'expiring';
  return 'active';
}

export const needsAttention = (condition: AssetCondition) => condition === 'damaged' || condition === 'missing';

export interface AssetSummary {
  /** Number of asset lines (e.g. "Study table ×2" counts once). */
  entries: number;
  /** Sum of quantities across lines. */
  totalQuantity: number;
  byCondition: Record<AssetCondition, number>;
  /** Lines marked damaged or missing. */
  needsAttention: number;
  /** Lines whose warranty ends within WARRANTY_SOON_DAYS (not yet expired). */
  warrantyExpiringSoon: number;
}

export function summarizeAssets(
  assets: Array<Pick<Asset, 'condition' | 'quantity' | 'warrantyUntil'>>,
  todayIso: string
): AssetSummary {
  const byCondition: Record<AssetCondition, number> = { good: 0, fair: 0, damaged: 0, missing: 0 };
  let totalQuantity = 0;
  let attention = 0;
  let expiring = 0;
  for (const a of assets) {
    byCondition[a.condition] = (byCondition[a.condition] || 0) + 1;
    totalQuantity += a.quantity || 0;
    if (needsAttention(a.condition)) attention++;
    if (warrantyStatus(a.warrantyUntil, todayIso) === 'expiring') expiring++;
  }
  return {
    entries: assets.length,
    totalQuantity,
    byCondition,
    needsAttention: attention,
    warrantyExpiringSoon: expiring,
  };
}

export interface AssetPatch {
  name?: string;
  category?: AssetCategory;
  quantity?: number;
  condition?: AssetCondition;
  purchaseDate?: string | null;
  warrantyUntil?: string | null;
  notes?: string | null;
}

/**
 * Diff an edit against the current asset and produce the history entries to
 * APPEND (never rewrite): one for a condition change, one for a quantity
 * change, and one "updated" entry for any other field edits.
 */
export function historyEntriesFor(
  current: Pick<Asset, 'name' | 'category' | 'quantity' | 'condition' | 'purchaseDate' | 'warrantyUntil' | 'notes'>,
  patch: AssetPatch,
  actor: { uid: string; role: string },
  atIso: string,
  note?: string | null
): AssetHistoryEntry[] {
  const base = { at: atIso, by: actor.uid, byRole: actor.role, note: note?.trim() || null };
  const entries: AssetHistoryEntry[] = [];
  if (patch.condition !== undefined && patch.condition !== current.condition) {
    entries.push({
      ...base,
      action: 'condition',
      fromCondition: current.condition,
      toCondition: patch.condition,
      fromQuantity: null,
      toQuantity: null,
      fields: null,
    });
  }
  if (patch.quantity !== undefined && patch.quantity !== current.quantity) {
    entries.push({
      ...base,
      action: 'quantity',
      fromCondition: null,
      toCondition: null,
      fromQuantity: current.quantity,
      toQuantity: patch.quantity,
      fields: null,
    });
  }
  const other = (['name', 'category', 'purchaseDate', 'warrantyUntil', 'notes'] as const).filter((k) => {
    if (patch[k] === undefined) return false;
    return (patch[k] ?? null) !== (current[k] ?? null);
  });
  if (other.length > 0) {
    entries.push({
      ...base,
      action: 'updated',
      fromCondition: null,
      toCondition: null,
      fromQuantity: null,
      toQuantity: null,
      fields: other,
    });
  }
  return entries;
}
