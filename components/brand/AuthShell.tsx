import * as React from 'react';
import Link from 'next/link';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { Logo } from './Logo';
import { Icon3D } from './Icon3D';
import { Illustration, type IllustrationName } from './Illustration';

/**
 * Shared layout for sign-in screens (owner, resident, admin) in the reference
 * style: lavender canvas, logo, big navy headline with a gradient phrase +
 * swoosh, 3D check bullets and a 3D scene; the form sits in a frosted card.
 * Phones: logo → art → card. Desktop: brand column left, card right.
 */
export function AuthShell({
  eyebrow,
  title,
  highlight,
  description,
  bullets = [],
  illustration = 'hero-landing',
  backHref = '/',
  backLabel = 'Back to Home',
  children,
  footnote = 'Secure, encrypted session',
}: {
  eyebrow: React.ReactNode;
  title: React.ReactNode;
  highlight: React.ReactNode;
  description?: React.ReactNode;
  bullets?: string[];
  illustration?: IllustrationName;
  backHref?: string;
  backLabel?: string;
  children: React.ReactNode;
  footnote?: React.ReactNode;
}) {
  return (
    // Phones: everything (logo row, headline, form) fits one screen — sized to
    // the dynamic viewport so mobile browser bars don't force a scroll. The
    // description, bullets and 3D scene only appear from `md` up.
    <div className="min-h-[100dvh] w-full overflow-x-clip">
      <div
        className="mx-auto flex min-h-[100dvh] w-full max-w-6xl flex-col px-4 sm:px-6 lg:px-10"
        style={{
          paddingTop: 'max(0.75rem, env(safe-area-inset-top))',
          paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))',
        }}
      >
        {/* Top row */}
        <div className="flex items-center justify-between py-1 md:py-2">
          <Link href="/" aria-label="PGPass home" className="press">
            <span className="inline-flex items-center rounded-full bg-white/70 border border-white px-3 py-1.5 md:px-3.5 md:py-2 shadow-[0_10px_24px_-14px_rgba(70,40,160,0.45)]">
              <span className="md:hidden"><Logo size={30} /></span>
              <span className="hidden md:inline"><Logo size={34} /></span>
            </span>
          </Link>
          <Link
            href={backHref}
            className="inline-flex h-11 items-center gap-1.5 rounded-full bg-white/80 border border-white px-4 text-[13px] font-bold text-ink-2 shadow-[0_8px_18px_-10px_rgba(70,40,160,0.4)] hover:text-brand-700 press"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden min-[380px]:inline">{backLabel}</span>
          </Link>
        </div>

        <div className="grid flex-1 grid-cols-1 content-center items-center gap-4 py-3 md:grid-cols-[1.05fr_1fr] md:content-normal md:gap-10 lg:gap-16 md:py-10">
          {/* Brand column */}
          <div className="relative">
            <span className="hidden md:inline-flex items-center gap-1.5 rounded-full bg-[image:var(--grad-brand)] px-3.5 py-1.5 text-[13px] font-bold text-white shadow-[var(--shadow-brand)]">
              <ShieldCheck className="h-4 w-4" /> {eyebrow}
            </span>
            <h1 className="text-[23px] min-[380px]:text-[25px] sm:text-[34px] md:mt-4 md:text-[40px] lg:text-[46px] font-extrabold leading-[1.1] md:leading-[1.06] tracking-[-0.035em] text-ink">
              {title}
              <br />
              <span className="swoosh text-gradient">{highlight}</span>
            </h1>
            {description && (
              <p className="mt-6 hidden md:block max-w-md text-[15px] font-medium leading-relaxed text-ink-2">{description}</p>
            )}
            {bullets.length > 0 && (
              <ul className="mt-5 hidden md:block space-y-2.5">
                {bullets.map((b) => (
                  <li key={b} className="flex items-center gap-2.5 text-sm font-semibold text-ink-2">
                    <Icon3D name="check" size={24} />
                    {b}
                  </li>
                ))}
              </ul>
            )}
            <div className="relative mt-4 hidden md:flex md:justify-start">
              <Illustration
                name={illustration}
                width={illustration === 'hero-landing' ? 330 : 420}
                priority
                float
                className="w-[62%] max-w-[240px] md:w-auto md:max-w-full"
              />
            </div>
          </div>

          {/* Form card */}
          <div className="relative w-full md:max-w-[460px] md:justify-self-end">
            <div aria-hidden className="pointer-events-none absolute -inset-6 rounded-[40px] bg-[radial-gradient(60%_60%_at_70%_20%,rgba(190,160,255,0.45),transparent_70%)] blur-2xl" />
            <div className="app-card relative rounded-[26px] p-5 sm:p-8 shadow-[var(--shadow-float)]">{children}</div>
            <div className="mt-3 md:mt-4 hidden sm:flex items-center justify-center gap-1.5 text-xs font-semibold text-muted">
              <ShieldCheck className="h-4 w-4 text-success" />
              <span>{footnote}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Full-screen loader on the canvas (session establishing / redirects). */
export function AuthLoader({ title = 'Signing you in…', subtitle = 'Loading your dashboard' }: { title?: string; subtitle?: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center">
      <span className="relative grid h-20 w-20 place-items-center">
        <span className="absolute inset-0 rounded-full border-[5px] border-brand-100" />
        <span className="absolute inset-0 rounded-full border-[5px] border-transparent border-t-brand animate-spin" />
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white shadow-[0_10px_20px_-12px_rgba(70,40,160,0.5)]">
          <Logo size={30} showWordmark={false} />
        </span>
      </span>
      <span className="mt-5 text-base font-extrabold text-ink">{title}</span>
      {subtitle && <span className="mt-1 text-[13px] font-medium text-muted">{subtitle}</span>}
    </div>
  );
}
