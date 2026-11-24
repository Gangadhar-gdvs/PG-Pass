/**
 * Client-Side Error & Diagnostic Reporter
 * Transmits runtime errors to /api/logs for real-time admin monitoring.
 */

export interface ClientErrorPayload {
  message: string;
  code?: string;
  route?: string;
  details?: Record<string, unknown> | string;
  error?: unknown;
}

export async function reportClientError(payload: ClientErrorPayload): Promise<void> {
  try {
    const stack = payload.error instanceof Error ? payload.error.stack : undefined;
    const body = {
      level: 'error',
      source: 'client',
      message: payload.message,
      code: payload.code,
      route: payload.route || (typeof window !== 'undefined' ? window.location.pathname : ''),
      details: payload.details,
      stack,
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : '',
    };

    if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
      await fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        keepalive: true,
      });
    }
  } catch (loggingErr) {
    // Fail silently on the client so user experience is never degraded
    console.warn('Could not transmit error report:', loggingErr);
  }
}
