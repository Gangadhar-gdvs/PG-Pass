import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createLogger } from '../monitoring/logger';
import { recordSystemLog } from '../services/systemLogs.service';
import crypto from 'crypto';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export type RouteHandler = (
  req: NextRequest,
  ctx?: any
) => Promise<Response | NextResponse>;

export function withErrorHandler(handler: RouteHandler): RouteHandler {
  return async (req: NextRequest, ctx?: any) => {
    const requestId = crypto.randomUUID();
    const startTime = Date.now();
    const route = req.nextUrl?.pathname || req.url;
    const reqLogger = createLogger({ requestId, route });

    // Store requestId on the request context if possible
    (req as any).requestId = requestId;

    try {
      const response = await handler(req, ctx);
      const durationMs = Date.now() - startTime;
      reqLogger.info('Request succeeded', {
        status: response.status,
        durationMs,
      });

      // Add requestId header to outgoing response
      response.headers.set('X-Request-Id', requestId);
      return response;
    } catch (err: unknown) {
      const durationMs = Date.now() - startTime;

      if (err instanceof AppError) {
        reqLogger.warn(`Operational error: ${err.message}`, {
          statusCode: err.statusCode,
          code: err.code,
          durationMs,
        });

        return NextResponse.json(
          {
            error: err.message,
            code: err.code,
            requestId,
          },
          {
            status: err.statusCode,
            headers: { 'X-Request-Id': requestId },
          }
        );
      }

      // Zod validation errors → clean 400, not an opaque 500. Detected by shape
      // to avoid importing zod into this low-level handler.
      if (
        err &&
        typeof err === 'object' &&
        (err as any).name === 'ZodError' &&
        Array.isArray((err as any).issues)
      ) {
        const issues = (err as any).issues as Array<{ path?: (string | number)[]; message: string }>;
        const first = issues[0];
        const field = first?.path?.length ? `${first.path.join('.')}: ` : '';
        reqLogger.warn('Validation error', { durationMs, issues: issues.length });
        return NextResponse.json(
          {
            error: `${field}${first?.message || 'Invalid request'}`,
            code: 'VALIDATION_ERROR',
            requestId,
          },
          { status: 400, headers: { 'X-Request-Id': requestId } }
        );
      }

      const errorMessage =
        err instanceof Error ? err.message : 'Internal Server Error';
      const stack = err instanceof Error ? err.stack : undefined;

      reqLogger.error(`Unhandled exception: ${errorMessage}`, {
        durationMs,
        stack,
      });

      // Persist unhandled error to system_logs for admin dashboard
      recordSystemLog({
        level: 'error',
        source: 'server',
        message: errorMessage,
        code: 'INTERNAL_SERVER_ERROR',
        route,
        stack,
        requestId,
      }).catch(() => {});

      return NextResponse.json(
        {
          error: 'An internal error occurred. Please try again later.',
          requestId,
        },
        {
          status: 500,
          headers: { 'X-Request-Id': requestId },
        }
      );
    }
  };
}
