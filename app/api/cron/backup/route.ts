import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/server/api/withErrorHandler';
import { withCronAuth } from '@/lib/server/api/withCronAuth';
import { adminDb } from '@/lib/server/firebase-admin';
import { storageProvider } from '@/lib/server/storage/provider';
import { env } from '@/lib/env';
import zlib from 'zlib';
import crypto from 'crypto';

function encryptAes256Gcm(data: Buffer, keyHex: string): Buffer {
  const iv = crypto.randomBytes(12);
  const key = Buffer.from(keyHex.padEnd(64, '0').slice(0, 64), 'hex');
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]);
}

export const POST = withErrorHandler(
  withCronAuth(async () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const collectionsToBackup = [
      'owners',
      'beds',
      'tenants',
      'rent_records',
      'deposits',
      'movein_photos',
    ];

    const results: Record<string, number> = {};

    for (const colName of collectionsToBackup) {
      const snap = await adminDb.collection(colName).limit(1000).get();
      const records = snap.docs.map((d) => ({ _id: d.id, ...d.data() }));
      results[colName] = records.length;

      if (records.length > 0 && env.B2_BACKUP_BUCKET && env.BACKUP_ENCRYPTION_KEY) {
        // Serialize to NDJSON
        const ndjson = records.map((r) => JSON.stringify(r)).join('\n');
        const compressed = zlib.gzipSync(Buffer.from(ndjson, 'utf-8'));
        const encrypted = encryptAes256Gcm(compressed, env.BACKUP_ENCRYPTION_KEY);

        const backupKey = `backups/${todayStr}/${colName}.ndjson.gz.enc`;
        await storageProvider.mintPresignedPut(
          env.B2_BACKUP_BUCKET,
          backupKey,
          'application/octet-stream',
          300
        );
      }
    }

    return NextResponse.json({
      success: true,
      backupDate: todayStr,
      collectionCounts: results,
      encryptedToB2: Boolean(env.B2_BACKUP_BUCKET && env.BACKUP_ENCRYPTION_KEY),
    });
  })
);
