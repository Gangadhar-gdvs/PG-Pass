import { NextRequest, NextResponse } from 'next/server';
import { recordSystemLog } from '@/lib/server/services/systemLogs.service';
import { z } from 'zod';

const logPayloadSchema = z.object({
  level: z.enum(['info', 'warn', 'error']).default('error'),
  source: z.enum(['client', 'server']).default('client'),
  message: z.string().max(2000),
  code: z.string().max(100).optional(),
  route: z.string().max(300).optional(),
  details: z.any().optional(),
  stack: z.string().max(10000).optional(),
  userAgent: z.string().max(500).optional(),
});

export async function POST(req: NextRequest) {
  try {
    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const parsed = logPayloadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid log schema' }, { status: 400 });
    }

    const entry = parsed.data;
    const logId = await recordSystemLog({
      level: entry.level,
      source: entry.source,
      message: entry.message,
      code: entry.code,
      route: entry.route,
      details: entry.details,
      stack: entry.stack,
      userAgent: entry.userAgent || req.headers.get('user-agent') || undefined,
    });

    return NextResponse.json({ success: true, logId }, { status: 201 });
  } catch (err: any) {
    console.error('Failed to ingest log:', err);
    return NextResponse.json({ error: 'Logging failure' }, { status: 500 });
  }
}
