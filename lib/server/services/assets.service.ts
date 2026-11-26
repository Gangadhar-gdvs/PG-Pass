import 'server-only';
import { adminDb } from '../firebase-admin';
import { AppError } from '../api/withErrorHandler';
import { propertiesService } from './properties.service';
import { historyEntriesFor, summarizeAssets, istTodayIso, type AssetPatch, type AssetSummary } from '@/lib/assets';
import { tsToDate } from '@/lib/utils';
import type { Asset, AssetCategory, AssetCondition, AssetHistoryEntry, AssetLocation, Timestampish } from '@/types';
import { Timestamp } from 'firebase-admin/firestore';

/**
 * Room inventory / assets (MVP checklist). Per-room or PG-common items with a
 * condition and an APPEND-ONLY change history (condition / quantity / edits /
 * delete), so damage and missing items always leave a trail. Soft-delete only.
 */

export interface AssetActor {
  uid: string;
  role: string;
}

export interface CreateAssetInput {
  propertyId?: string;
  location: AssetLocation;
  roomNumber?: string;
  name: string;
  category: AssetCategory;
  quantity: number;
  condition?: AssetCondition;
  purchaseDate?: string | null;
  warrantyUntil?: string | null;
  notes?: string;
}

export type UpdateAssetInput = AssetPatch & { note?: string };

const COLLECTION = 'assets';
const LIST_LIMIT = 500;

function isoOf(v: Timestampish | null | undefined): string | null {
  const d = tsToDate(v ?? null);
  return d ? d.toISOString() : null;
}

export function toAssetDTO(a: Asset): Asset {
  return {
    id: a.id,
    ownerId: a.ownerId,
    propertyId: a.propertyId,
    location: a.location,
    roomNumber: a.roomNumber ?? null,
    name: a.name,
    category: a.category,
    quantity: a.quantity,
    condition: a.condition,
    purchaseDate: a.purchaseDate ?? null,
    warrantyUntil: a.warrantyUntil ?? null,
    notes: a.notes ?? null,
    history: a.history || [],
    createdBy: a.createdBy,
    deletedAt: isoOf(a.deletedAt),
    createdAt: isoOf(a.createdAt) ?? undefined,
    updatedAt: isoOf(a.updatedAt) ?? undefined,
  };
}

export class AssetsService {
  private async resolvePropertyId(ownerId: string, propertyId?: string): Promise<string> {
    if (!propertyId || propertyId === ownerId) return ownerId;
    const property = await propertiesService.getProperty(ownerId, propertyId);
    return property.id;
  }

  /** Active (non-deleted) assets, grouped-friendly order: room, then name. */
  async list(ownerId: string, propertyId?: string): Promise<{ assets: Asset[]; summary: AssetSummary }> {
    // Requires index assets(ownerId, deletedAt, createdAt DESC).
    const snap = await adminDb
      .collection(COLLECTION)
      .where('ownerId', '==', ownerId)
      .where('deletedAt', '==', null)
      .orderBy('createdAt', 'desc')
      .limit(LIST_LIMIT)
      .get();
    const assets = snap.docs
      .map((d) => ({ ...d.data(), id: d.id }) as Asset)
      .filter((a) => !propertyId || a.propertyId === propertyId)
      .sort(
        (a, b) =>
          (a.location === b.location ? 0 : a.location === 'common' ? 1 : -1) ||
          (a.roomNumber || '').localeCompare(b.roomNumber || '', undefined, { numeric: true }) ||
          a.name.localeCompare(b.name)
      )
      .map(toAssetDTO);
    return { assets, summary: summarizeAssets(assets, istTodayIso(Date.now())) };
  }

  private async getActive(ownerId: string, assetId: string): Promise<Asset> {
    const snap = await adminDb.collection(COLLECTION).doc(assetId).get();
    if (!snap.exists) throw new AppError(404, 'Item not found');
    const asset = { ...snap.data(), id: snap.id } as Asset;
    if (asset.ownerId !== ownerId) throw new AppError(403, 'Unauthorized');
    if (asset.deletedAt) throw new AppError(404, 'Item not found');
    return asset;
  }

  async get(ownerId: string, assetId: string): Promise<Asset> {
    return toAssetDTO(await this.getActive(ownerId, assetId));
  }

  async create(ownerId: string, actor: AssetActor, input: CreateAssetInput): Promise<Asset> {
    const propertyId = await this.resolvePropertyId(ownerId, input.propertyId);
    const roomNumber = input.location === 'room' ? (input.roomNumber || '').trim() : null;
    if (input.location === 'room' && !roomNumber) throw new AppError(400, 'Choose the room this item is in');
    if (!Number.isInteger(input.quantity) || input.quantity < 1) {
      throw new AppError(400, 'Quantity must be at least 1');
    }

    const ref = adminDb.collection(COLLECTION).doc();
    const now = Timestamp.now();
    const condition = input.condition || 'good';
    const created: AssetHistoryEntry = {
      at: now.toDate().toISOString(),
      by: actor.uid,
      byRole: actor.role,
      action: 'created',
      fromCondition: null,
      toCondition: condition,
      fromQuantity: null,
      toQuantity: input.quantity,
      fields: null,
      note: null,
    };
    const asset: Asset = {
      id: ref.id,
      ownerId,
      propertyId,
      location: input.location,
      roomNumber,
      name: input.name.trim(),
      category: input.category,
      quantity: input.quantity,
      condition,
      purchaseDate: input.purchaseDate || null,
      warrantyUntil: input.warrantyUntil || null,
      notes: input.notes?.trim() || null,
      history: [created],
      createdBy: actor.uid,
      deletedAt: null, // explicit so `where('deletedAt','==',null)` matches
      createdAt: now,
      updatedAt: now,
    };
    await ref.set(asset);
    return toAssetDTO(asset);
  }

  /** Edit fields; appends history entries for condition / quantity / other changes. */
  async update(ownerId: string, actor: AssetActor, assetId: string, input: UpdateAssetInput): Promise<Asset> {
    if (input.quantity !== undefined && (!Number.isInteger(input.quantity) || input.quantity < 0)) {
      throw new AppError(400, 'Quantity cannot be negative');
    }
    const ref = adminDb.collection(COLLECTION).doc(assetId);
    const now = Timestamp.now();
    let updated!: Asset;

    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new AppError(404, 'Item not found');
      const asset = { ...snap.data(), id: snap.id } as Asset;
      if (asset.ownerId !== ownerId) throw new AppError(403, 'Unauthorized');
      if (asset.deletedAt) throw new AppError(404, 'Item not found');

      const patch: AssetPatch = {};
      if (input.name !== undefined) patch.name = input.name.trim();
      if (input.category !== undefined) patch.category = input.category;
      if (input.quantity !== undefined) patch.quantity = input.quantity;
      if (input.condition !== undefined) patch.condition = input.condition;
      if (input.purchaseDate !== undefined) patch.purchaseDate = input.purchaseDate || null;
      if (input.warrantyUntil !== undefined) patch.warrantyUntil = input.warrantyUntil || null;
      if (input.notes !== undefined) patch.notes = input.notes?.trim() || null;

      const purchase = patch.purchaseDate !== undefined ? patch.purchaseDate : asset.purchaseDate;
      const warranty = patch.warrantyUntil !== undefined ? patch.warrantyUntil : asset.warrantyUntil;
      if (purchase && warranty && warranty < purchase) {
        throw new AppError(400, 'Warranty end date cannot be before the purchase date');
      }

      const entries = historyEntriesFor(asset, patch, actor, now.toDate().toISOString(), input.note);
      if (entries.length === 0) {
        updated = asset; // no-op edit — nothing to write
        return;
      }
      const write = { ...patch, history: [...(asset.history || []), ...entries], updatedAt: now };
      tx.update(ref, write);
      updated = { ...asset, ...write } as Asset;
    });

    return toAssetDTO(updated);
  }

  /** Soft delete — the record and its history stay for audit. */
  async softDelete(ownerId: string, actor: AssetActor, assetId: string, note?: string): Promise<void> {
    const ref = adminDb.collection(COLLECTION).doc(assetId);
    const now = Timestamp.now();
    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new AppError(404, 'Item not found');
      const asset = { ...snap.data(), id: snap.id } as Asset;
      if (asset.ownerId !== ownerId) throw new AppError(403, 'Unauthorized');
      if (asset.deletedAt) throw new AppError(404, 'Item not found');
      const entry: AssetHistoryEntry = {
        at: now.toDate().toISOString(),
        by: actor.uid,
        byRole: actor.role,
        action: 'deleted',
        fromCondition: null,
        toCondition: null,
        fromQuantity: null,
        toQuantity: null,
        fields: null,
        note: note?.trim() || null,
      };
      tx.update(ref, {
        deletedAt: now,
        deletedBy: actor.uid,
        updatedAt: now,
        history: [...(asset.history || []), entry],
      });
    });
  }
}

export const assetsService = new AssetsService();
