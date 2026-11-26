import 'server-only';
import { adminDb } from '../firebase-admin';
import { Tenant, Bed } from '@/types';
import { AppError } from '../api/withErrorHandler';
import { BED_STATUS, ACCOUNT_STATUS, RENT_STATUS } from '@/lib/constants/status';
import {
  MAX_LIST_LIMIT,
  SOFT_DELETE_UNDO_DAYS,
  PORTAL_TOKEN_TTL_DAYS,
} from '@/lib/constants/limits';
import { generatePortalToken, hashToken } from '../security/tokens';
import { rentDueDate, tsToMillis } from '@/lib/utils';
import { env } from '@/lib/env';
import { Timestamp } from 'firebase-admin/firestore';

export interface CreateTenantInput {
  bedId: string;
  propertyId?: string; // defaults to ownerId (primary property)
  name: string;
  phone: string;
  idProofType: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelation?: string;
  securityDepositPaise: number;
  depositPaidPaise?: number;
  moveInDate: string;
  initialRentAmountPaise?: number;
}

export class TenantsService {
  async listTenants(
    ownerId: string,
    includeDeleted = false,
    limitCount = 50,
    startAfterId?: string
  ): Promise<Tenant[]> {
    const safeLimit = Math.min(limitCount, MAX_LIST_LIMIT);
    let q = adminDb
      .collection('tenants')
      .where('ownerId', '==', ownerId)
      .orderBy('createdAt', 'desc')
      .limit(safeLimit);

    if (startAfterId) {
      const cursor = await adminDb.collection('tenants').doc(startAfterId).get();
      if (cursor.exists) {
        q = q.startAfter(cursor);
      }
    }

    const snap = await q.get();
    let tenants = snap.docs.map((d) => ({ ...d.data(), id: d.id } as Tenant));

    if (!includeDeleted) {
      tenants = tenants.filter((t) => !t.deletedAt);
    }

    return tenants;
  }

  async getTenant(tenantId: string, ownerId: string): Promise<Tenant> {
    const doc = await adminDb.collection('tenants').doc(tenantId).get();
    if (!doc.exists) {
      throw new AppError(404, 'Tenant not found');
    }
    const data = doc.data() as Tenant;
    if (data.ownerId !== ownerId) {
      throw new AppError(403, 'Unauthorized tenant access');
    }
    return { ...data, id: doc.id };
  }

  /**
   * Atomic bed booking + tenant creation + portal token generation + initial rent record.
   */
  async createTenant(ownerId: string, input: CreateTenantInput) {
    // Owner read + quota count are independent → run in parallel.
    const [ownerDoc, activeCountSnap] = await Promise.all([
      adminDb.collection('owners').doc(ownerId).get(),
      adminDb
        .collection('tenants')
        .where('ownerId', '==', ownerId)
        .where('deletedAt', '==', null)
        .count()
        .get(),
    ]);
    if (!ownerDoc.exists) {
      throw new AppError(404, 'Owner profile not found');
    }
    const ownerData = ownerDoc.data()!;
    const maxTenants = ownerData.maxTenants ?? 20;

    if (activeCountSnap.data().count >= maxTenants) {
      throw new AppError(
        403,
        `Tenant quota reached (${maxTenants} tenants). Please upgrade your plan in Billing.`
      );
    }

    const rawPortalToken = generatePortalToken();
    const tokenHash = hashToken(rawPortalToken);
    const tenantRef = adminDb.collection('tenants').doc();
    const bedRef = adminDb.collection('beds').doc(input.bedId);
    const portalTokenRef = adminDb.collection('portal_tokens').doc(tokenHash);

    const phoneCleaned = input.phone.replace(/\D/g, '');
    const phoneLast4 = phoneCleaned.slice(-4);
    const depositPaid = input.depositPaidPaise ?? 0;

    let createdTenant: Tenant;
    const now = Timestamp.now();
    const tokenExpiresAt = new Date();
    tokenExpiresAt.setDate(tokenExpiresAt.getDate() + PORTAL_TOKEN_TTL_DAYS);

    // Atomic transaction: assert bed is vacant and update bed + tenant simultaneously
    await adminDb.runTransaction(async (transaction) => {
      const bedDoc = await transaction.get(bedRef);
      if (!bedDoc.exists) {
        throw new AppError(404, 'Selected bed not found');
      }

      const bedData = bedDoc.data() as Bed;
      if (bedData.ownerId !== ownerId) {
        throw new AppError(403, 'Unauthorized bed assignment');
      }

      if (bedData.status !== BED_STATUS.VACANT) {
        throw new AppError(
          409,
          `Bed ${bedData.roomNumber}-${bedData.bedLabel} is already occupied or in maintenance.`
        );
      }

      createdTenant = {
        id: tenantRef.id,
        ownerId,
        propertyId: input.propertyId || bedData.propertyId || ownerId,
        ownerName: ownerData.name,
        bedId: input.bedId,
        roomNumber: bedData.roomNumber,
        bedLabel: bedData.bedLabel,
        name: input.name.trim(),
        phone: phoneCleaned,
        phoneLast4,
        idProofType: input.idProofType,
        emergencyContactName: input.emergencyContactName?.trim() || undefined,
        emergencyContactPhone: input.emergencyContactPhone?.replace(/\D/g, '') || undefined,
        emergencyContactRelation: input.emergencyContactRelation?.trim() || undefined,
        accountStatus: ACCOUNT_STATUS.ACTIVE,
        securityDepositPaise: input.securityDepositPaise,
        depositPaidPaise: depositPaid,
        moveInDate: input.moveInDate,
        // Persist the raw portal token on the owner-scoped tenant doc so the
        // owner can re-share the resident pass link any time after creation
        // (only the hash is kept server-side in portal_tokens, so the raw value
        // is unrecoverable otherwise). Access is still gated by the last-4 PIN
        // + lockout — the token alone is not sufficient to view the portal.
        token: rawPortalToken,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
      };

      // 1. Create tenant doc
      transaction.set(tenantRef, createdTenant);

      // 2. Mark bed occupied
      transaction.update(bedRef, {
        status: BED_STATUS.OCCUPIED,
        tenantId: tenantRef.id,
        tenantName: input.name.trim(),
        tenantPhone: phoneCleaned,
        updatedAt: now,
      });

      // 3. Store hashed portal token
      transaction.set(portalTokenRef, {
        tokenHash,
        tenantId: tenantRef.id,
        ownerId,
        expiresAt: Timestamp.fromDate(tokenExpiresAt),
        singleUse: false,
        usedAt: null,
        revokedAt: null,
        createdAt: now,
      });

      // 4. Initial deposit ledger entry if deposit was paid at move-in
      if (depositPaid > 0) {
        const depositRef = adminDb.collection('deposits').doc();
        transaction.set(depositRef, {
          id: depositRef.id,
          ownerId,
          tenantId: tenantRef.id,
          type: 'installment',
          amountPaise: depositPaid,
          reason: 'Initial security deposit payment at move-in',
          recordedBy: ownerId,
          createdAt: now,
        });
      }

      // 5. Initial rent record for current period
      const currentPeriod = new Date().toISOString().slice(0, 7); // YYYY-MM
      const rentAmount = input.initialRentAmountPaise ?? bedData.rentAmountPaise;
      const rentRef = adminDb.collection('rent_records').doc(`${tenantRef.id}_${currentPeriod}`);

      transaction.set(rentRef, {
        id: rentRef.id,
        ownerId,
        propertyId: input.propertyId || bedData.propertyId || ownerId,
        tenantId: tenantRef.id,
        period: currentPeriod,
        roomNumber: bedData.roomNumber, // Snapshotted
        bedLabel: bedData.bedLabel,     // Snapshotted
        lineItems: [{ label: 'Base Rent', amountPaise: rentAmount }],
        prorated: false,
        amountDuePaise: rentAmount,
        amountPaidPaise: 0,
        status: RENT_STATUS.PENDING,
        dueDate: rentDueDate(currentPeriod, ownerData.rentDueDay),
        createdAt: now,
        updatedAt: now,
      });
    });

    const appUrl = env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    // Canonical share path is /t/<token> (matches the owner UI copy button and
    // the /t/[token] route); /portal/[token] renders the same view as a legacy alias.
    const portalUrl = `${appUrl}/t/${rawPortalToken}`;

    return {
      tenant: createdTenant!,
      rawPortalToken,
      portalUrl,
    };
  }

  /**
   * 7-day reversible soft-delete: frees bed, retains data for undo.
   */
  async softDeleteTenant(tenantId: string, ownerId: string, deletedBy: string) {
    const tenant = await this.getTenant(tenantId, ownerId);
    if (tenant.deletedAt) {
      throw new AppError(400, 'Resident is already deleted');
    }

    const tenantRef = adminDb.collection('tenants').doc(tenantId);
    const bedRef = adminDb.collection('beds').doc(tenant.bedId);

    await adminDb.runTransaction(async (transaction) => {
      // Mark tenant soft-deleted
      transaction.update(tenantRef, {
        deletedAt: Timestamp.now(),
        deletedBy,
        updatedAt: Timestamp.now(),
      });

      // Free bed
      transaction.update(bedRef, {
        status: BED_STATUS.VACANT,
        tenantId: null,
        tenantName: null,
        tenantPhone: null,
        updatedAt: Timestamp.now(),
      });
    });

    return { success: true };
  }

  /**
   * Restores a soft-deleted tenant within 7 days.
   */
  async restoreTenant(tenantId: string, ownerId: string, newBedId?: string) {
    const tenant = await this.getTenant(tenantId, ownerId);
    if (!tenant.deletedAt) {
      throw new AppError(400, 'Tenant is not deleted');
    }

    // Verify 7-day undo window
    const deletedTimeMs = tsToMillis(tenant.deletedAt);
    const daysSinceDelete = (Date.now() - deletedTimeMs) / (1000 * 60 * 60 * 24);
    if (daysSinceDelete > SOFT_DELETE_UNDO_DAYS) {
      throw new AppError(
        400,
        `Cannot restore resident: ${SOFT_DELETE_UNDO_DAYS}-day undo window has expired.`
      );
    }

    const targetBedId = newBedId || tenant.bedId;
    const bedRef = adminDb.collection('beds').doc(targetBedId);
    const tenantRef = adminDb.collection('tenants').doc(tenantId);

    await adminDb.runTransaction(async (transaction) => {
      const bedDoc = await transaction.get(bedRef);
      if (!bedDoc.exists) {
        throw new AppError(404, 'Bed not found');
      }

      const bedData = bedDoc.data() as Bed;
      if (bedData.status !== BED_STATUS.VACANT) {
        throw new AppError(409, `Target bed ${bedData.roomNumber}-${bedData.bedLabel} is currently occupied.`);
      }

      transaction.update(bedRef, {
        status: BED_STATUS.OCCUPIED,
        tenantId,
        tenantName: tenant.name,
        tenantPhone: tenant.phone,
        updatedAt: Timestamp.now(),
      });

      transaction.update(tenantRef, {
        bedId: targetBedId,
        roomNumber: bedData.roomNumber,
        bedLabel: bedData.bedLabel,
        deletedAt: null,
        deletedBy: null,
        updatedAt: Timestamp.now(),
      });
    });

    return this.getTenant(tenantId, ownerId);
  }

  /**
   * Official move-out settlement: marks moveOutDate, frees bed, revokes tokens.
   */
  async moveOutTenant(
    tenantId: string,
    ownerId: string,
    params: {
      moveOutDate: string;
      depositDeductionsPaise?: number;
      deductionReason?: string;
      refundPaise?: number;
    }
  ) {
    const tenant = await this.getTenant(tenantId, ownerId);

    // Block double move-out (would create duplicate deduction/refund records).
    if (tenant.moveOutDate) {
      throw new AppError(400, 'This resident has already been moved out.');
    }
    // Guard: deductions + refund cannot exceed the deposit actually paid.
    const deductions = params.depositDeductionsPaise || 0;
    const refund = params.refundPaise || 0;
    const depositPaid = tenant.depositPaidPaise ?? tenant.securityDepositPaise ?? 0;
    if (deductions + refund > depositPaid) {
      throw new AppError(
        400,
        `Deductions + refund (₹${Math.round((deductions + refund) / 100)}) exceed the deposit on file (₹${Math.round(
          depositPaid / 100
        )}).`
      );
    }

    const tenantRef = adminDb.collection('tenants').doc(tenantId);
    const bedRef = adminDb.collection('beds').doc(tenant.bedId);
    const now = Timestamp.now();

    // Read active portal tokens BEFORE the transaction (Firestore txns can't run
    // queries). They're revoked INSIDE the transaction below so freeing the bed,
    // suspending the tenant, and killing portal access all commit atomically —
    // a crash can no longer leave a moved-out resident with a live portal link.
    const tokensSnap = await adminDb
      .collection('portal_tokens')
      .where('tenantId', '==', tenantId)
      .get();

    await adminDb.runTransaction(async (transaction) => {
      // 1. Free bed
      transaction.update(bedRef, {
        status: BED_STATUS.VACANT,
        tenantId: null,
        tenantName: null,
        tenantPhone: null,
        updatedAt: now,
      });

      // 2. Update tenant status
      transaction.update(tenantRef, {
        moveOutDate: params.moveOutDate,
        accountStatus: ACCOUNT_STATUS.SUSPENDED,
        updatedAt: now,
      });

      // 3. Record deposit deduction if any
      if (params.depositDeductionsPaise && params.depositDeductionsPaise > 0) {
        const deductionRef = adminDb.collection('deposits').doc();
        transaction.set(deductionRef, {
          id: deductionRef.id,
          ownerId,
          propertyId: tenant.propertyId || ownerId,
          tenantId,
          type: 'deduction',
          amountPaise: params.depositDeductionsPaise,
          reason: params.deductionReason || 'Move-out damage/notice deduction',
          recordedBy: ownerId,
          createdAt: now,
        });
      }

      // 4. Record deposit refund if any — starts as a pending obligation that
      //    the owner later marks 'issued' once actually paid out.
      if (params.refundPaise && params.refundPaise > 0) {
        const refundRef = adminDb.collection('deposits').doc();
        transaction.set(refundRef, {
          id: refundRef.id,
          ownerId,
          propertyId: tenant.propertyId || ownerId,
          tenantId,
          tenantName: tenant.name,
          type: 'refund',
          amountPaise: params.refundPaise,
          reason: 'Security deposit final refund',
          refundStatus: 'pending',
          recordedBy: ownerId,
          createdAt: now,
        });
      }

      // 5. Revoke all active portal tokens — atomically with the move-out.
      tokensSnap.docs.forEach((doc) => {
        transaction.update(doc.ref, { revokedAt: now });
      });
    });

    // 6. Owner-facing notification with the settlement summary, so the owner
    //    has a record (and can share a refund/deduction breakdown with the
    //    tenant — the UI builds a WhatsApp message from this).
    const refundPaise = params.refundPaise || 0;
    const deductionsPaise = params.depositDeductionsPaise || 0;
    const notifRef = adminDb.collection('owner_notifications').doc();
    await notifRef.set({
      id: notifRef.id,
      ownerId,
      type: 'moveout',
      message: `Move-out settled for ${tenant.name} (Bed ${tenant.bedLabel || ''}). Refund ₹${Math.round(
        refundPaise / 100
      )}, deductions ₹${Math.round(deductionsPaise / 100)}.`,
      status: 'unread',
      createdAt: now,
    });

    return {
      success: true,
      settlement: {
        tenantName: tenant.name,
        tenantPhone: tenant.phone,
        bedLabel: tenant.bedLabel || '',
        moveOutDate: params.moveOutDate,
        refundPaise,
        deductionsPaise,
        deductionReason: params.deductionReason || '',
      },
    };
  }
}

export const tenantsService = new TenantsService();
