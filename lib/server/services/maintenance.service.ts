import 'server-only';
import { adminDb } from '../firebase-admin';
import { AppError } from '../api/withErrorHandler';
import { MaintenanceTicket, MaintenanceCategory, MaintenanceStatus, Tenant } from '@/types';
import { MAX_LIST_LIMIT } from '@/lib/constants/limits';
import { Timestamp, Query, QueryDocumentSnapshot } from 'firebase-admin/firestore';

const VALID_CATEGORIES: MaintenanceCategory[] = [
  'plumbing',
  'electrical',
  'wifi',
  'furniture',
  'cleaning',
  'appliance',
  'other',
];

export class MaintenanceService {
  /**
   * Tenant raises a ticket (called after portal session verification). Snapshots
   * tenant/bed identity so the owner view is self-contained.
   */
  async createTicket(params: {
    ownerId: string;
    tenantId: string;
    category: string;
    description: string;
    photoId?: string;
  }): Promise<MaintenanceTicket> {
    const category = (VALID_CATEGORIES as string[]).includes(params.category)
      ? (params.category as MaintenanceCategory)
      : 'other';
    const description = params.description.trim().slice(0, 1000);
    if (description.length < 3) {
      throw new AppError(400, 'Please describe the issue (at least a few words)');
    }

    const tenantSnap = await adminDb.collection('tenants').doc(params.tenantId).get();
    const tenant: Partial<Tenant> = tenantSnap.exists ? (tenantSnap.data() as Tenant) : {};

    const ref = adminDb.collection('maintenance_tickets').doc();
    const now = Timestamp.now();
    const ticket: MaintenanceTicket = {
      id: ref.id,
      ownerId: params.ownerId,
      propertyId: tenant.propertyId || params.ownerId,
      tenantId: params.tenantId,
      tenantName: tenant.name,
      bedLabel: tenant.bedLabel,
      roomNumber: tenant.roomNumber,
      category,
      description,
      photoId: params.photoId,
      status: 'open',
      createdAt: now,
      updatedAt: now,
    };

    await ref.set(ticket);
    return ticket;
  }

  async listForOwner(
    ownerId: string,
    status?: MaintenanceStatus,
    limitCount = 50
  ): Promise<MaintenanceTicket[]> {
    const safeLimit = Math.min(limitCount, MAX_LIST_LIMIT);
    let q: Query = adminDb.collection('maintenance_tickets').where('ownerId', '==', ownerId);

    if (status) q = q.where('status', '==', status);
    q = q.orderBy('createdAt', 'desc').limit(safeLimit);

    const snap = await q.get();
    return snap.docs.map(
      (d: QueryDocumentSnapshot) => ({ ...d.data(), id: d.id } as MaintenanceTicket)
    );
  }

  async listForTenant(ownerId: string, tenantId: string, limitCount = 20): Promise<MaintenanceTicket[]> {
    const safeLimit = Math.min(limitCount, MAX_LIST_LIMIT);
    const snap = await adminDb
      .collection('maintenance_tickets')
      .where('ownerId', '==', ownerId)
      .where('tenantId', '==', tenantId)
      .orderBy('createdAt', 'desc')
      .limit(safeLimit)
      .get();
    return snap.docs.map((d) => ({ ...d.data(), id: d.id } as MaintenanceTicket));
  }

  /** Owner/staff transitions a ticket's status. */
  async updateStatus(
    ticketId: string,
    ownerId: string,
    status: MaintenanceStatus,
    actorUid: string,
    resolutionNote?: string
  ): Promise<MaintenanceTicket> {
    const ref = adminDb.collection('maintenance_tickets').doc(ticketId);
    const snap = await ref.get();
    if (!snap.exists) throw new AppError(404, 'Ticket not found');
    const data = snap.data() as MaintenanceTicket;
    if (data.ownerId !== ownerId) throw new AppError(403, 'Unauthorized');

    const now = Timestamp.now();
    const update: Partial<MaintenanceTicket> = { status, updatedAt: now };
    if (status === 'resolved') {
      update.resolvedBy = actorUid;
      update.resolvedAt = now;
      if (resolutionNote) update.resolutionNote = resolutionNote.trim().slice(0, 500);
    }

    await ref.update(update);
    return { ...data, ...update, id: ticketId };
  }
}

export const maintenanceService = new MaintenanceService();
