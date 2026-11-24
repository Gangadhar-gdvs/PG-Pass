import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler, AppError } from '@/lib/server/api/withErrorHandler';
import { withAuth, AuthContext } from '@/lib/server/api/withAuth';
import { adminDb } from '@/lib/server/firebase-admin';
import { recordEvent } from '@/lib/server/services/systemLogs.service';
import { invalidatePgFeatures } from '@/lib/server/auth/entitlements';
import { ALL_PG_FEATURES } from '@/lib/constants/permissions';
import { Timestamp } from 'firebase-admin/firestore';

// GET /api/admin/features?ownerId=... — current per-PG feature flags (admin).
export const GET = withErrorHandler(
  withAuth(
    async (req: NextRequest) => {
      const ownerId = req.nextUrl.searchParams.get('ownerId');
      if (!ownerId) throw new AppError(400, 'ownerId is required');
      const snap = await adminDb.collection('owners').doc(ownerId).get();
      if (!snap.exists) throw new AppError(404, 'Owner not found');
      const features = (snap.data()?.features as Record<string, boolean>) || {};
      // Fill defaults (enabled) for any feature not explicitly set.
      const resolved: Record<string, boolean> = {};
      for (const f of ALL_PG_FEATURES) resolved[f] = features[f] !== false;
      return NextResponse.json({ ownerId, features: resolved });
    },
    { roles: ['admin'] }
  )
);

// PATCH /api/admin/features — admin enables/disables a feature for one PG.
// Body: { ownerId, feature, enabled }
export const PATCH = withErrorHandler(
  withAuth(
    async (req: NextRequest, ctx: { auth: AuthContext }) => {
      let body: { ownerId?: string; feature?: string; enabled?: boolean };
      try {
        body = await req.json();
      } catch {
        throw new AppError(400, 'Invalid JSON body');
      }
      const { ownerId, feature } = body;
      if (!ownerId || !feature) throw new AppError(400, 'ownerId and feature are required');
      if (!(ALL_PG_FEATURES as string[]).includes(feature)) {
        throw new AppError(400, 'Unknown feature');
      }

      const ref = adminDb.collection('owners').doc(ownerId);
      const snap = await ref.get();
      if (!snap.exists) throw new AppError(404, 'Owner not found');

      const enabled = body.enabled !== false;
      const now = Timestamp.now();
      await ref.set({ features: { [feature]: enabled }, updatedAt: now }, { merge: true });

      // Mirror onto the PRIMARY property doc (id == ownerId) so the discovery
      // query — which scans `properties` — can filter without an owner join.
      await adminDb
        .collection('properties')
        .doc(ownerId)
        .set({ features: { [feature]: enabled }, updatedAt: now }, { merge: true })
        .catch(() => {});

      invalidatePgFeatures(ownerId);

      await recordEvent({
        category: 'account',
        message: `Admin ${enabled ? 'enabled' : 'disabled'} feature "${feature}" for PG`,
        actorUid: ctx.auth.uid,
        ownerId,
        targetId: feature,
        details: { enabled },
      }).catch(() => {});

      return NextResponse.json({ success: true, ownerId, feature, enabled });
    },
    { roles: ['admin'] }
  )
);
