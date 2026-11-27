'use client';

import { readApiError } from '@/lib/utils';

/**
 * Single client-side API layer ("middle layer" / interceptor) for every
 * browser → `/api/*` call. Instead of 100+ scattered `fetch()` calls each
 * re-implementing headers, JSON parsing and error handling, route everything
 * through here so cross-cutting behaviour is defined ONCE:
 *
 *   - JSON body + headers set consistently
 *   - non-ok responses throw a user-facing message (via readApiError)
 *   - 403 → PermissionDeniedError (UI shows "no access", not an outage)
 *   - 401 → session-expiry handling in one place (hook below)
 *
 * Usage:
 *   const { tasks } = await apiGet<{ tasks: Task[] }>('/api/tasks');
 *   await apiPost('/api/tasks', { title });
 *   await apiDelete(`/api/tasks/${id}`);
 */

export class PermissionDeniedError extends Error {
  constructor(message = 'permission-denied') {
    super(message);
    this.name = 'PermissionDeniedError';
  }
}

export class SessionExpiredError extends Error {
  constructor(message = 'Your session has expired. Please sign in again.') {
    super(message);
    this.name = 'SessionExpiredError';
  }
}

/** Response interceptors run on every API response before it resolves/throws. */
type ResponseInterceptor = (res: Response) => void | Promise<void>;
const responseInterceptors: ResponseInterceptor[] = [];

/** Register a cross-cutting response handler (e.g. redirect-to-login on 401). */
export function addResponseInterceptor(fn: ResponseInterceptor): () => void {
  responseInterceptors.push(fn);
  return () => {
    const i = responseInterceptors.indexOf(fn);
    if (i >= 0) responseInterceptors.splice(i, 1);
  };
}

async function request<T>(method: string, url: string, body?: unknown, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    method,
    ...init,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers || {}),
    },
    body: body !== undefined ? JSON.stringify(body) : init?.body,
  });

  for (const fn of responseInterceptors) {
    await fn(res);
  }

  if (res.status === 401) throw new SessionExpiredError();
  if (res.status === 403) throw new PermissionDeniedError();
  if (!res.ok) throw new Error(await readApiError(res, "Something went wrong. Please try again."));

  // 204 / empty body
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export const apiGet = <T = unknown>(url: string, init?: RequestInit) => request<T>('GET', url, undefined, init);
export const apiPost = <T = unknown>(url: string, body?: unknown, init?: RequestInit) => request<T>('POST', url, body, init);
export const apiPatch = <T = unknown>(url: string, body?: unknown, init?: RequestInit) => request<T>('PATCH', url, body, init);
export const apiPut = <T = unknown>(url: string, body?: unknown, init?: RequestInit) => request<T>('PUT', url, body, init);
export const apiDelete = <T = unknown>(url: string, init?: RequestInit) => request<T>('DELETE', url, undefined, init);
