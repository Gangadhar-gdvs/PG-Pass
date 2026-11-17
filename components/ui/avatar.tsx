import { cn } from '@/lib/utils';

const colors = [
  'bg-indigo-600',
  'bg-violet-600',
  'bg-emerald-600',
  'bg-rose-600',
  'bg-amber-600',
  'bg-cyan-600',
  'bg-pink-600',
  'bg-teal-600',
];

export function Avatar({ name, className }: { name: string; className?: string }) {
  const safeName = name || 'User';
  const index = Math.abs(safeName.charCodeAt(0) % colors.length);
  const initials = safeName
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .substring(0, 2) || 'U';

  return (
    <div
      className={cn(
        'w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0 shadow-md select-none',
        colors[index],
        className
      )}
    >
      {initials}
    </div>
  );
}

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded-xl bg-slate-800/80', className)}
      {...props}
    />
  );
}
