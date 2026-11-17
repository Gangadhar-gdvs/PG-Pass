import * as React from 'react';
import { cn } from '@/lib/utils';
import { BedStatus, RentStatus } from '@/types';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BedStatus | RentStatus | 'default' | 'neutral';
}

export function Badge({ className, variant = 'default', children, ...props }: BadgeProps) {
  const styles: Record<string, string> = {
    paid: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    pending: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
    verify: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    vacant: 'bg-slate-700/40 text-slate-400 border-slate-600/30',
    occupied: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    default: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
    neutral: 'bg-slate-800 text-slate-300 border-slate-700',
  };

  const dots: Record<string, string> = {
    paid: 'bg-emerald-400',
    pending: 'bg-rose-400',
    verify: 'bg-amber-400 animate-pulse',
    vacant: 'bg-slate-500',
    occupied: 'bg-blue-400',
    default: 'bg-indigo-400',
    neutral: 'bg-slate-400',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold border backdrop-blur-sm select-none',
        styles[variant] || styles.default,
        className
      )}
      {...props}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', dots[variant] || dots.default)} />
      {children}
    </span>
  );
}
