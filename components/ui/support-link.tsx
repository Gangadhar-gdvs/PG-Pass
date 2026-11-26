'use client';

import React from 'react';
import { env } from '@/lib/env';
import { LifeBuoy } from 'lucide-react';

/**
 * Support contact, shown only where a resident/owner would actually reach out
 * (resident panel, owner settings, auth errors). The address comes from
 * NEXT_PUBLIC_SUPPORT_EMAIL so it's env-configurable without code changes.
 */
export function SupportLink({
  subject = 'PGPass support request',
  className = '',
  compact = false,
}: {
  subject?: string;
  className?: string;
  compact?: boolean;
}) {
  const email = env.NEXT_PUBLIC_SUPPORT_EMAIL;
  const href = `mailto:${email}?subject=${encodeURIComponent(subject)}`;

  if (compact) {
    return (
      <a href={href} className={`accent-text font-semibold ${className}`}>
        {email}
      </a>
    );
  }

  return (
    <a
      href={href}
      className={`inline-flex items-center gap-2 rounded-full bg-white/70 border border-white px-4 py-2 text-[13px] font-semibold text-ink-2 shadow-[0_6px_16px_-10px_rgba(70,40,160,0.35)] hover:text-brand-700 press ${className}`}
    >
      <LifeBuoy className="w-4 h-4 text-brand" />
      <span>Need help? Contact support</span>
    </a>
  );
}
