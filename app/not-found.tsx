import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { Illustration } from '@/components/brand/Illustration';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10 text-center">
      <Link href="/" aria-label="PGPass home" className="mb-6 press">
        <span className="inline-flex items-center rounded-full bg-white/70 border border-white px-4 py-2.5 shadow-[0_10px_24px_-14px_rgba(70,40,160,0.45)]">
          <Logo size={36} />
        </span>
      </Link>
      <div className="app-card w-full max-w-md rounded-[30px] px-6 py-8 shadow-[var(--shadow-float)]">
        <Illustration name="clipboard" width={220} float className="mx-auto" />
        <p className="mt-2 text-[56px] font-extrabold leading-none tracking-[-0.04em] text-gradient">404</p>
        <h1 className="mt-2 text-xl font-extrabold text-ink">This page isn’t here</h1>
        <p className="mt-1.5 text-sm font-medium text-muted">
          The link may be old or mistyped. Let’s get you back on track.
        </p>
        <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:justify-center">
          <Link href="/" className="btn-pill">
            Go home <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/login" className="btn-soft">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
