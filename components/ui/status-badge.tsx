import * as React from 'react';
import { Badge } from './badge';
import { statusMeta, type StatusDomain } from '@/lib/statusMeta';

export interface StatusBadgeProps {
  domain: StatusDomain;
  status: string | null | undefined;
  /** Show the leading colour dot (default true). */
  dot?: boolean;
  /** Override the computed label (variant/colour still come from the status). */
  label?: React.ReactNode;
  className?: string;
}

/**
 * Status pill driven by the single-source-of-truth `statusMeta` map. Use instead
 * of re-deriving `variant`/`label` from a status string in each page.
 *
 *   <StatusBadge domain="rent" status={record.status} />
 *   <StatusBadge domain="maintenance" status={ticket.status} />
 */
export function StatusBadge({ domain, status, dot = true, label, className }: StatusBadgeProps) {
  const meta = statusMeta(domain, status);
  return (
    <Badge variant={meta.variant} dot={dot} className={className}>
      {label ?? meta.label}
    </Badge>
  );
}
