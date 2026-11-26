import * as React from 'react';
import Image from 'next/image';

/**
 * 3D scene illustrations taken from the reference screens (docs/screenshots),
 * edge-feathered so they melt into the lavender canvas / violet hero cards.
 *
 *  - hero-admin     dashboard card + apartment + shield   (Admin hero)
 *  - hero-owner     "PG" building with trees              (Owner hero card)
 *  - hero-resident  bedroom scene on a lilac blob         (Resident hero)
 *  - hero-landing   "PG" building + PGPass phone          (Landing / auth)
 *  - shield-orbit   shield with orbit ring                (security / features)
 *  - clipboard      checklist clipboard + house + plant   (empty states, "why")
 *  - bell-cta       ringing bell                          (CTA band, reminders)
 */
export const ILLUSTRATIONS = {
  'hero-admin': { w: 452, h: 276 },
  'hero-owner': { w: 402, h: 206 },
  'hero-resident': { w: 510, h: 294 },
  'hero-landing': { w: 491, h: 558 },
  'shield-orbit': { w: 210, h: 136 },
  clipboard: { w: 342, h: 240 },
  'bell-cta': { w: 122, h: 110 },
} as const;

export type IllustrationName = keyof typeof ILLUSTRATIONS;

export function Illustration({
  name,
  width,
  className = '',
  priority = false,
  float = false,
  alt = '',
}: {
  name: IllustrationName;
  /** Rendered CSS width in px; height follows the art's aspect ratio. */
  width: number;
  className?: string;
  priority?: boolean;
  /** Gentle idle bob (respects reduced-motion). */
  float?: boolean;
  alt?: string;
}) {
  const meta = ILLUSTRATIONS[name];
  const height = Math.round((width * meta.h) / meta.w);
  return (
    <Image
      src={`/brand/illus/${name}.png`}
      alt={alt}
      aria-hidden={alt ? undefined : true}
      width={width}
      height={height}
      priority={priority}
      draggable={false}
      sizes={`${width}px`}
      className={`select-none pointer-events-none ${float ? 'animate-float' : ''} ${className}`}
      style={{ width, height: 'auto', maxWidth: '100%' }}
    />
  );
}
