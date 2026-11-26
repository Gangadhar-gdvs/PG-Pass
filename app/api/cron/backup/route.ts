import { NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/server/api/withErrorHandler';
import { withCronAuth } from '@/lib/server/api/withCronAuth';
import { adminDb } from '@/lib/server/firebase-admin';
import { storageProvider } from '@/lib/server/storage/provider';
import { recordEvent } from '@/lib/server/services/systemLogs.service';
import { env } from '@/lib/env';
import { QueryDocumentSnapshot } from 'firebase-admin/firestore';
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
    const uploadedBytes: Record<string, number> = {};
    const backupConfigured = Boolean(env.B2_BACKUP_BUCKET && env.BACKUP_ENCRYPTION_KEY);

    for (const colName of collectionsToBackup) {
      // Paginate the whole collection — a flat limit(1000) silently drops data
      // once a collection grows past 1000 docs, which defeats the backup.
      const PAGE = 1000;
      const lines: string[] = [];
      // Firestore QueryDocumentSnapshot cursor; typed loosely to avoid relying
      // on the global FirebaseFirestore namespace.
      let lastDoc: QueryDocumentSnapshot | undefined = undefined;

      for (;;) {
        let q = adminDb.collection(colName).orderBy('__name__').limit(PAGE);
        if (lastDoc) q = q.startAfter(lastDoc);
        const snap = await q.get();
        if (snap.empty) break;
        for (const d of snap.docs) {
          lines.push(JSON.stringify({ _id: d.id, ...d.data() }));
        }
        lastDoc = snap.docs[snap.docs.length - 1];
        if (snap.size < PAGE) break;
      }

      results[colName] = lines.length;

      if (lines.length > 0 && backupConfigured) {
        const ndjson = lines.join('\n');
        const compressed = zlib.gzipSync(Buffer.from(ndjson, 'utf-8'));
        const encrypted = encryptAes256Gcm(compressed, env.BACKUP_ENCRYPTION_KEY!);

        const backupKey = `backups/${todayStr}/${colName}.ndjson.gz.enc`;

        // Actually upload the encrypted blob. Previously a presigned URL was
        // minted and then discarded, so nothing was ever stored in B2.
        await storageProvider.putObject(
          env.B2_BACKUP_BUCKET!,
          backupKey,
          encrypted,
          'application/octet-stream'
        );

        // Verify the object exists and the byte count matches what we sent.
        const head = await storageProvider.headObject(env.B2_BACKUP_BUCKET!, backupKey);
        if (head.contentLength !== encrypted.length) {
          throw new Error(
            `Backup verification failed for ${colName}: sent ${encrypted.length} bytes, stored ${head.contentLength}`
          );
        }
        uploadedBytes[colName] = head.contentLength;
      }
    }

    const uploaded = backupConfigured && Object.keys(uploadedBytes).length > 0;
    await recordEvent({
      category: 'cron',
      level: uploaded || !backupConfigured ? 'info' : 'warn',
      message: `Nightly backup ${todayStr}: ${Object.values(results).reduce((a, b) => a + b, 0)} docs${
        uploaded ? ' · uploaded+verified to B2' : backupConfigured ? ' · NOT uploaded' : ' · B2 not configured'
      }`,
      details: { collectionCounts: results, uploadedBytes },
    });

    return NextResponse.json({
      success: true,
      backupDate: todayStr,
      collectionCounts: results,
      uploadedBytes,
      encryptedToB2: uploaded,
      backupConfigured,
    });
  })
);
