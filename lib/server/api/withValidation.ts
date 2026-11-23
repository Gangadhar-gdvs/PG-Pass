import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { ZodSchema, ZodError } from 'zod';
import { AppError, RouteHandler } from './withErrorHandler';

export function withValidation<T>(
  schema: ZodSchema<T>
): (
  handler: (req: NextRequest, ctx: any) => Promise<Response | NextResponse>
) => RouteHandler {
  return (handler) => {
    return async (req: NextRequest, ctx: any = {}) => {
      let body: any;

      if (req.method === 'GET') {
        const url = new URL(req.url);
        body = Object.fromEntries(url.searchParams.entries());
      } else {
        try {
          body = await req.json();
        } catch {
          throw new AppError(400, 'Invalid JSON payload');
        }
      }

      try {
        const validatedData = schema.parse(body);
        const enhancedCtx = {
          ...ctx,
          data: validatedData,
        };
        return handler(req, enhancedCtx);
      } catch (err: unknown) {
        if (err instanceof ZodError) {
          const formatted = err.issues
            .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
            .join('; ');
          throw new AppError(400, `Validation failed: ${formatted}`, 'VALIDATION_ERROR');
        }
        throw new AppError(400, 'Validation failed');
      }
    };
  };
}
