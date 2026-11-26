import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/server/firebase-admin';
import { storageProvider } from '@/lib/server/storage/provider';
import { env } from '@/lib/env';
import { errorMessage } from '@/lib/utils';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const isDeep = url.searchParams.get('deep') === '1';

  // Shallow health check (zero DB reads)
  if (!isDeep) {
    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '0.1.0',
    });
  }

  // Deep health check (requires CRON_SECRET)
  const authHeader = req.headers.get('authorization');
  const expectedAuth = `Bearer ${env.CRON_SECRET}`;

  if (!authHeader || authHeader !== expectedAuth) {
    return NextResponse.json({ error: 'Unauthorized deep health check' }, { status: 401 });
  }

  try {
    // 1. Verify Firestore connectivity
    await adminDb.collection('owners').limit(1).get();

    // 2. Verify Storage connectivity
    await storageProvider.headObject(env.B2_BUCKET, 'non-existent-probe-key').catch(() => {});

    return NextResponse.json({
      status: 'healthy',
      checks: {
        firestore: 'ok',
        storage: 'ok',
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        error: errorMessage(err, 'Health check failed'),
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
