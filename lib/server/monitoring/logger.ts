import 'server-only';
import { env } from '@/lib/env';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export interface LogContext {
  requestId?: string;
  route?: string;
  uid?: string;
  role?: string;
  durationMs?: number;
  [key: string]: unknown;
}

function redactValue(key: string, value: unknown): unknown {
  if (typeof value !== 'string') return value;

  const lowerKey = key.toLowerCase();
  if (
    lowerKey.includes('token') ||
    lowerKey.includes('secret') ||
    lowerKey.includes('cookie') ||
    lowerKey.includes('password') ||
    lowerKey.includes('pin') ||
    lowerKey.includes('authorization') ||
    lowerKey.includes('presigned')
  ) {
    return '[REDACTED]';
  }

  if (lowerKey.includes('phone')) {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length >= 4) {
      return '*'.repeat(cleaned.length - 2) + cleaned.slice(-2);
    }
    return '[REDACTED]';
  }

  return value;
}

function sanitizeObject(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      result[k] = sanitizeObject(v as Record<string, unknown>);
    } else {
      result[k] = redactValue(k, v);
    }
  }
  return result;
}

export class Logger {
  private baseContext: LogContext;

  constructor(baseContext: LogContext = {}) {
    this.baseContext = baseContext;
  }

  private shouldLog(level: LogLevel): boolean {
    const currentLevel = (env.LOG_LEVEL || 'info') as LogLevel;
    const currentPriority = LOG_LEVEL_PRIORITY[currentLevel] ?? 1;
    const targetPriority = LOG_LEVEL_PRIORITY[level] ?? 1;
    return targetPriority >= currentPriority;
  }

  private write(level: LogLevel, message: string, extra?: Record<string, unknown>) {
    if (!this.shouldLog(level)) return;

    const payload = {
      level,
      timestamp: new Date().toISOString(),
      message,
      ...this.baseContext,
      ...(extra ? sanitizeObject(extra) : {}),
    };

    const serialized = JSON.stringify(payload);
    if (level === 'error') {
      console.error(serialized);
    } else if (level === 'warn') {
      console.warn(serialized);
    } else {
      console.log(serialized);
    }
  }

  debug(message: string, extra?: Record<string, unknown>) {
    this.write('debug', message, extra);
  }

  info(message: string, extra?: Record<string, unknown>) {
    this.write('info', message, extra);
  }

  warn(message: string, extra?: Record<string, unknown>) {
    this.write('warn', message, extra);
  }

  error(message: string, extra?: Record<string, unknown>) {
    this.write('error', message, extra);
  }

  child(extraContext: LogContext): Logger {
    return new Logger({ ...this.baseContext, ...extraContext });
  }
}

export function createLogger(meta?: LogContext): Logger {
  return new Logger(meta);
}

export const logger = new Logger();
