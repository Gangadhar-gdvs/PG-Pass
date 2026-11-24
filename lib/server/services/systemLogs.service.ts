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

export async function fetchSystemLogs(limitCount = 100, levelFilter?: string) {
  let query: FirebaseFirestore.Query = adminDb
    .collection('system_logs')
    .orderBy('createdAt', 'desc')
    .limit(limitCount);

  if (levelFilter && levelFilter !== 'all') {
    query = query.where('level', '==', levelFilter);
  }

  const snapshot = await query.get();
  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      level: data.level || 'info',
      source: data.source || 'server',
      message: data.message || '',
      code: data.code || '',
      route: data.route || '',
      details: data.details || null,
      stack: data.stack || '',
      userAgent: data.userAgent || '',
      requestId: data.requestId || '',
      createdAt: data.createdAt?.toDate?.()?.toISOString?.() || data.timestampIso || new Date().toISOString(),
    };
  });
}
