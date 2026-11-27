import 'server-only';
import { adminDb } from '../firebase-admin';
import { AppError } from '../api/withErrorHandler';
import { recordEvent } from './systemLogs.service';
import { invalidatePgFeatures } from '../auth/entitlements';
import { ALL_PG_FEATURES } from '@/lib/constants/permissions';
import { Timestamp } from 'firebase-admin/firestore';

/**
 * Admin-only per-PG feature flag management. Owns all Firestore access for the
 * `/api/admin/features` route so the route stays a thin auth + shape layer.
 */
export class AdminPgService {
  /** Current feature flags for a PG, with defaults (enabled) filled in. */
  async getFeatures(ownerId: string): Promise<Record<string, boolean>> {
    const snap = await adminDb.collection('owners').doc(ownerId).get();
    if (!snap.exists) throw new AppError(404, 'Owner not found');
    const features = (snap.data()?.features as Record<string, boolean>) || {};
    const resolved: Record<string, boolean> = {};
    for (const f of ALL_PG_FEATURES) resolved[f] = features[f] !== false;
    return resolved;
  }

  /**
   * Enable/disable one feature for a PG. Mirrors the flag onto the PRIMARY
   * property doc (id == ownerId) so the discovery query — which scans
   * `properties` — can filter without an owner join. Invalidates the feature
   * cache and writes an audit event.
   */
  async setFeature(params: {
    ownerId: string;
    feature: string;
    enabled: boolean;
    actorUid: string;
  }): Promise<void> {
    const { ownerId, feature, enabled, actorUid } = params;
    if (!(ALL_PG_FEATURES as string[]).includes(feature)) {
      throw new AppError(400, 'Unknown feature');
    }
    const ref = adminDb.collection('owners').doc(ownerId);
    const snap = await ref.get();
    if (!snap.exists) throw new AppError(404, 'Owner not found');

    const now = Timestamp.now();
    await ref.set({ features: { [feature]: enabled }, updatedAt: now }, { merge: true });
    await adminDb
      .collection('properties')
      .doc(ownerId)
      .set({ features: { [feature]: enabled }, updatedAt: now }, { merge: true })
      .catch(() => {});

    invalidatePgFeatures(ownerId);

    await recordEvent({
      category: 'account',
      message: `Admin ${enabled ? 'enabled' : 'disabled'} feature "${feature}" for PG`,
      actorUid,
      ownerId,
      targetId: feature,
      details: { enabled },
    }).catch(() => {});
  }
}

export const adminPgService = new AdminPgService();
