import 'server-only';
import { adminDb } from '../firebase-admin';
import { SubscriptionRequest } from '@/types';
import { AppError } from '../api/withErrorHandler';
import { SUBSCRIPTION_REQUEST_STATUS, PLAN_TIER, PlanTier } from '@/lib/constants/status';
import { PLAN_LIMITS } from '@/lib/constants/limits';
import { emailService, subscriptionApprovedEmail } from './email.service';
import { Timestamp } from 'firebase-admin/firestore';

export interface SubmitUpgradeParams {
  ownerId: string;
  requestedPlan: PlanTier;
  billingCycle: 'monthly' | 'yearly';
  utrReference: string;
}

/**
 * Canonical plan pricing in paise — the server source of truth. The amount is
 * NEVER taken from the client; it is looked up here so an owner can't submit an
 * upgrade for ₹1. (Yearly = 2 months free.)
 */
const PLAN_PRICES_PAISE: Record<string, { monthly: number; yearly: number }> = {
  [PLAN_TIER.GROWTH]: { monthly: 99900, yearly: 999000 },
  [PLAN_TIER.PRO]: { monthly: 199900, yearly: 1999000 },
};

export class SubscriptionsService {
  async submitUpgrade(params: SubmitUpgradeParams): Promise<SubscriptionRequest> {
    const ownerDoc = await adminDb.collection('owners').doc(params.ownerId).get();
    if (!ownerDoc.exists) throw new AppError(404, 'Owner profile not found');

    // Compute the price server-side; reject plans with no defined price.
    const pricing = PLAN_PRICES_PAISE[params.requestedPlan];
    if (!pricing) throw new AppError(400, 'This plan cannot be purchased.');
    const amountPaise = pricing[params.billingCycle];

    const reqRef = adminDb.collection('subscription_requests').doc();
    const now = Timestamp.now();

    const requestDoc: SubscriptionRequest = {
      id: reqRef.id,
      ownerId: params.ownerId,
      requestedPlan: params.requestedPlan,
      billingCycle: params.billingCycle,
      amountPaise, // server-computed, not client-supplied
      utrReference: params.utrReference.trim().toUpperCase(),
      status: SUBSCRIPTION_REQUEST_STATUS.PENDING,
      createdAt: now,
    };

    await reqRef.set(requestDoc);
    return requestDoc;
  }

  async approveUpgrade(reqId: string, adminUid: string): Promise<void> {
    const reqRef = adminDb.collection('subscription_requests').doc(reqId);
    const now = Timestamp.now();
    let ownerEmail: string | undefined;
    let approvedPlan: string | undefined;

    await adminDb.runTransaction(async (transaction) => {
      const reqDoc = await transaction.get(reqRef);
      if (!reqDoc.exists) throw new AppError(404, 'Subscription request not found');

      const reqData = reqDoc.data() as SubscriptionRequest;
      if (reqData.status !== SUBSCRIPTION_REQUEST_STATUS.PENDING) {
        throw new AppError(400, 'This request has already been reviewed');
      }

      const ownerRef = adminDb.collection('owners').doc(reqData.ownerId);
      const ownerDoc = await transaction.get(ownerRef);
      if (!ownerDoc.exists) throw new AppError(404, 'Owner profile not found');
      ownerEmail = ownerDoc.data()?.email;

      const targetPlan = reqData.requestedPlan;
      approvedPlan = targetPlan;
      const limits = PLAN_LIMITS[targetPlan] || PLAN_LIMITS.free;

      // Calculate expiration: 30 days for monthly, 365 days for yearly
      const days = reqData.billingCycle === 'yearly' ? 365 : 30;
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + days);

      // 1. Upgrade owner limits
      transaction.update(ownerRef, {
        plan: targetPlan,
        maxBeds: limits.maxBeds,
        maxTenants: limits.maxBeds,
        maxPhotos: limits.maxPhotos,
        maxStaff: limits.maxStaff,
        subscriptionExpiresAt: Timestamp.fromDate(expiresAt),
        updatedAt: now,
      });

      // 2. Mark subscription request approved
      transaction.update(reqRef, {
        status: SUBSCRIPTION_REQUEST_STATUS.APPROVED,
        reviewedBy: adminUid,
        reviewedAt: now,
      });

      // 3. Write immutable audit log
      const auditRef = adminDb.collection('audit_logs').doc();
      transaction.set(auditRef, {
        actorUid: adminUid,
        actorRole: 'admin',
        action: 'approve_subscription_upgrade',
        targetType: 'subscription_request',
        targetId: reqId,
        ownerId: reqData.ownerId,
        newPlan: targetPlan,
        createdAt: now,
      });

      // 4. Owner-facing notification so the owner learns the upgrade landed
      //    without having to refresh and guess.
      const notifRef = adminDb.collection('owner_notifications').doc();
      transaction.set(notifRef, {
        id: notifRef.id,
        ownerId: reqData.ownerId,
        type: 'subscription',
        message: `Your ${targetPlan} plan upgrade has been approved. New limits are active.`,
        status: 'unread',
        createdAt: now,
      });
    });

    // Best-effort owner email (no-op unless email provider is configured and the
    // owner has an email on file). Never blocks the approval.
    if (ownerEmail && approvedPlan) {
      const { subject, html } = subscriptionApprovedEmail({ plan: approvedPlan });
      await emailService.send({ to: ownerEmail, subject, html });
    }
  }
}

export const subscriptionsService = new SubscriptionsService();
