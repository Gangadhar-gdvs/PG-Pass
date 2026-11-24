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
  amountPaise: number;
  utrReference: string;
}

export class SubscriptionsService {
  async submitUpgrade(params: SubmitUpgradeParams): Promise<SubscriptionRequest> {
    const ownerDoc = await adminDb.collection('owners').doc(params.ownerId).get();
    if (!ownerDoc.exists) throw new AppError(404, 'Owner profile not found');

    const reqRef = adminDb.collection('subscription_requests').doc();
    const now = Timestamp.now();

    const requestDoc: SubscriptionRequest = {
      id: reqRef.id,
      ownerId: params.ownerId,
      requestedPlan: params.requestedPlan,
      billingCycle: params.billingCycle,
      amountPaise: params.amountPaise,
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
