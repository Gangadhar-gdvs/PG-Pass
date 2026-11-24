import 'server-only';
import { adminDb } from '../firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

export interface SystemLogEntry {
  level: 'info' | 'warn' | 'error';
  source: 'client' | 'server';
  message: string;
  code?: string;
  route?: string;
  details?: Record<string, unknown> | string;
  stack?: string;
  userAgent?: string;
  requestId?: string;
}

export async function recordSystemLog(entry: SystemLogEntry): Promise<string | null> {
  try {
    const docRef = await adminDb.collection('system_logs').add({
      level: entry.level || 'error',
      source: entry.source || 'server',
      message: entry.message || 'Unknown error',
      code: entry.code || null,
      route: entry.route || null,
      details: entry.details || null,
      stack: entry.stack || null,
      userAgent: entry.userAgent || null,
      requestId: entry.requestId || null,
      createdAt: Timestamp.now(),
      timestampIso: new Date().toISOString(),
    });
    return docRef.id;
  } catch (err) {
    console.error('CRITICAL: Failed to write to system_logs:', err);
    return null;
  }
}

export type EventCategory =
  | 'payment' // rent confirmed, partial, reversed
  | 'refund' // deposit refund issued
  | 'security' // lockouts, suspensions, failed logins
  | 'account' // staff invite/revoke, account suspend/reactivate
  | 'tenant' // move-in / move-out
  | 'guest' // check-in / check-out
  | 'discovery' // join request decisions
  | 'quota' // plan-limit rejections
  | 'comms' // email/SMS delivery results
  | 'cron' // backup / cleanup / metrics runs
  | 'system';

export interface EventEntry {
  category: EventCategory;
  message: string;
  level?: 'info' | 'warn' | 'error';
  ownerId?: string;
  actorUid?: string;
  targetId?: string;
  amountPaise?: number;
  details?: Record<string, unknown>;
}

/**
 * Unified business/security event logger. Writes to the SAME `system_logs`
 * stream the admin dashboard already reads, so every meaningful event (payments,
 * refunds, suspensions, lockouts, quota hits, comms failures, cron runs) is
 * visible in one place — no more events hidden only in audit_logs. Best-effort:
 * never throws into business logic.
 */
export async function recordEvent(entry: EventEntry): Promise<void> {
  try {
    await adminDb.collection('system_logs').add({
      level: entry.level || 'info',
      source: 'server',
      kind: 'event',
      category: entry.category,
      message: entry.message,
      ownerId: entry.ownerId || null,
      actorUid: entry.actorUid || null,
      targetId: entry.targetId || null,
      amountPaise: entry.amountPaise ?? null,
      details: entry.details || null,
      createdAt: Timestamp.now(),
      timestampIso: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Failed to record event:', err);
  }
}

export async function fetchSystemLogs(limitCount = 100, levelFilter?: string, category?: string) {
  let query: FirebaseFirestore.Query = adminDb
    .collection('system_logs')
    .orderBy('createdAt', 'desc')
    .limit(limitCount);

  // category filter takes precedence (single-field index), else level filter.
  if (category && category !== 'all') {
    query = query.where('category', '==', category);
  } else if (levelFilter && levelFilter !== 'all') {
    query = query.where('level', '==', levelFilter);
  }

  const snapshot = await query.get();
  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      kind: data.kind || 'log', // 'event' = business/security, 'log' = technical
      category: data.category || null,
      level: data.level || 'info',
      source: data.source || 'server',
      message: data.message || '',
      code: data.code || '',
      route: data.route || '',
      ownerId: data.ownerId || null,
      actorUid: data.actorUid || null,
      targetId: data.targetId || null,
      amountPaise: data.amountPaise ?? null,
      details: data.details || null,
      stack: data.stack || '',
      userAgent: data.userAgent || '',
      requestId: data.requestId || '',
      createdAt: data.createdAt?.toDate?.()?.toISOString?.() || data.timestampIso || new Date().toISOString(),
    };
  });
}
