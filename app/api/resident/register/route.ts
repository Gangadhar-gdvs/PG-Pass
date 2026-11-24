import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/server/firebase-admin';
import { withErrorHandler, AppError } from '@/lib/server/api/withErrorHandler';
import { withRateLimit } from '@/lib/server/api/withRateLimit';
import { residentsService } from '@/lib/server/services/residents.service';

/**
 * Register the signed-in Firebase user as a resident. Called right after
 * sign-up/sign-in: the client passes a fresh ID token; we verify it, set the
 * resident claim + profile, and the client then re-fetches its token (to pick up
 * the claim) and calls POST /api/auth/session.
 */
export const POST = withErrorHandler(
  withRateLimit(
    async (req: NextRequest) => {
      let body: { idToken?: string; name?: string; phone?: string; email?: string };
      try {
        body = await req.json();
      } catch {
        throw new AppError(400, 'Invalid JSON body');
      }
      if (!body.idToken) throw new AppError(400, 'Missing idToken');
      if (!body.name || !body.phone) throw new AppError(400, 'Name and phone are required');

      let decoded;
      try {
        decoded = await adminAuth.verifyIdToken(body.idToken, true);
      } catch {
        throw new AppError(401, 'Invalid or expired ID token');
      }

      const resident = await residentsService.register(decoded.uid, {
        name: body.name,
        phone: body.phone,
        email: body.email || decoded.email,
      });

      return NextResponse.json({ success: true, resident }, { status: 201 });
    },
    { tier: 'sensitive', key: 'ip', maxRequests: 10, windowSeconds: 60 }
  )
);
