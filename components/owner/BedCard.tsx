'use client';

import React from 'react';
import { Bed, RentRecord } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency, getWhatsAppLink } from '@/lib/utils';
import { Avatar } from '@/components/ui/avatar';
import { Icon3D, type Tint } from '@/components/brand/Icon3D';
import {
  UserPlus,
  Send,
  Check,
  Eye,
  ChevronRight,
  Snowflake,
} from 'lucide-react';

interface BedCardProps {
  bed: Bed;
  rentRecord?: RentRecord;
  ownerName: string;
  pgName: string;
  ownerUpi: string;
  onAddTenant: (bed: Bed) => void;
  onMarkPaid: (bed: Bed, record?: RentRecord) => void;
  onVerifyProof: (bed: Bed, record: RentRecord) => void;
  onVacate: (bed: Bed) => void;
  onSelectBed?: (bed: Bed) => void;
}

/**
 * Round white 44px icon button used on pastel bed tiles / rows (the kit has no
 * icon-only button). `title` doubles as the accessible name.
 */
/**
 * Keyboard activation for clickable tiles/rows (Enter / Space), ignoring key
 * events that bubble up from buttons inside the tile.
 */
export function activateOnKey(handler: () => void) {
  return (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handler();
    }
  };
}

export function TileIconButton({
  title,
  onClick,
  className = '',
  children,
}: {
  title: string;
  onClick: (e: React.MouseEvent) => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className={`grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white bg-white/85 shadow-[0_6px_14px_-8px_rgba(70,40,160,0.45)] transition-colors hover:bg-white press [&>svg]:h-4 [&>svg]:w-4 ${className}`}
    >
      {children}
    </button>
  );
}

export function BedCard({
  bed,
  rentRecord,
  ownerName,
  pgName,
  ownerUpi,
  onAddTenant,
  onMarkPaid,
  onVerifyProof,
  onSelectBed,
}: BedCardProps) {
  const isVacant = bed.status === 'vacant';
  const isGuest = bed.status === 'guest';
  // Payment status is per-SELECTED-MONTH and must come ONLY from that month's
  // rent record — never from the bed's denormalized current status, which would
  // bleed the same state across every month (the "shows same data for all dates"
  // bug). An occupied bed with no record for the selected period has no bill
  // that month (e.g. a month before move-in, or rent not generated yet).
  const isPaid = rentRecord?.status === 'paid';
  const isVerify = rentRecord?.status === 'verify';
  const noBill = !isVacant && !isGuest && !rentRecord;

  // Tile tint encodes the status (guest = sky, distinct from monthly tenants):
  // paid → mint · due → peach · verify → violet · vacant / no bill → slate.
  const tint: Tint = isVacant
    ? 'slate'
    : isGuest
    ? 'sky'
    : isPaid
    ? 'mint'
    : isVerify
    ? 'violet'
    : noBill
    ? 'slate'
    : 'peach';

  const handleSendReminder = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!bed.tenantPhone) return;

    const message = `Namaste ${bed.tenantName || 'Resident'} ji 🙏,\n\nFriendly reminder from ${pgName}: rent of ${formatCurrency(
      bed.monthlyRent
    )} for Bed ${bed.bedLabel} is due.\n\nPlease pay to UPI: ${ownerUpi || 'our PG UPI'}.\n\nThank you,\n${ownerName || 'PG Management'}`;

    const link = getWhatsAppLink(bed.tenantPhone, message);
    window.open(link, '_blank');
  };

  const openTile = () => (onSelectBed ? onSelectBed(bed) : isVacant ? onAddTenant(bed) : undefined);

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Bed ${bed.bedLabel}${isVacant ? ', vacant' : bed.tenantName ? `, ${bed.tenantName}` : ''} — open details`}
      onClick={openTile}
      onKeyDown={activateOnKey(openTile)}
      className={`tint-card tint-${tint} @container group relative flex h-full cursor-pointer flex-col gap-2.5 p-3 text-left press lift focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
        isVacant ? 'border-dashed border-line-strong' : ''
      }`}
    >
      {/* Bed label + status */}
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <span className="flex min-w-0 items-center gap-1.5">
          <Icon3D name="bed" size={24} />
          <span className="truncate font-mono-numbers text-[15px] font-extrabold tracking-[-0.01em] text-ink">
            {bed.bedLabel}
          </span>
        </span>
        {isVacant ? (
          <Badge variant="vacant">Vacant</Badge>
        ) : isGuest ? (
          <Badge variant="cyan" dot>Guest</Badge>
        ) : isPaid ? (
          <Badge variant="paid" dot>Paid</Badge>
        ) : isVerify ? (
          <Badge variant="verify" dot>Verify</Badge>
        ) : noBill ? (
          <Badge variant="default">No bill</Badge>
        ) : (
          <Badge variant="pending" dot>Due</Badge>
        )}
      </div>

      {(bed.sharingType || bed.acType === 'ac') && (
        <div className="flex flex-wrap gap-1">
          {bed.sharingType && (
            <span className="rounded-full bg-white/75 px-2 py-0.5 text-[11px] font-semibold text-ink-2">
              {bed.sharingType === '1' ? 'Single' : `${bed.sharingType}-Share`}
            </span>
          )}
          {bed.acType === 'ac' && (
            <span className="inline-flex items-center gap-1 rounded-full bg-info-bg px-2 py-0.5 text-[11px] font-semibold text-info-ink">
              <Snowflake className="h-3 w-3" />
              AC
            </span>
          )}
        </div>
      )}

      {/* Resident or vacant info */}
      <div className="min-w-0 flex-1">
        {isVacant ? (
          <div>
            <span className="block text-xs font-medium text-muted">Available Unit</span>
            <span className="font-mono-numbers text-sm font-extrabold text-ink">
              {formatCurrency(bed.monthlyRent)}/mo
            </span>
          </div>
        ) : (
          <div className="flex min-w-0 items-center gap-2">
            <Avatar name={bed.tenantName || 'R'} size="sm" />
            <div className="min-w-0">
              <span className="block truncate text-[13px] font-bold text-ink">{bed.tenantName}</span>
              <span className="block font-mono-numbers text-[11.5px] font-medium text-muted">
                {formatCurrency(bed.monthlyRent)}/mo
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-1.5 border-t border-white/80 pt-2.5">
        {isVacant ? (
          <Button
            variant="outline"
            className="w-full"
            onClick={(e) => {
              e.stopPropagation();
              onAddTenant(bed);
            }}
          >
            <UserPlus className="h-4 w-4" />
            <span>
              Assign<span className="sr-only @[11rem]:not-sr-only"> Resident</span>
            </span>
          </Button>
        ) : (
          <>
            {isVerify && rentRecord && (
              <TileIconButton
                title="Verify Proof"
                className="text-brand-700"
                onClick={(e) => {
                  e.stopPropagation();
                  onVerifyProof(bed, rentRecord);
                }}
              >
                <Eye />
              </TileIconButton>
            )}

            {/* Rent actions only when there IS a bill this month (guests are billed
                via guest stays; "No bill" beds have nothing to remind or mark). */}
            {!isPaid && !isGuest && !noBill && rentRecord && (
              <>
                <TileIconButton
                  title="Send WhatsApp Reminder"
                  className="text-success-ink"
                  onClick={handleSendReminder}
                >
                  <Send />
                </TileIconButton>
                <TileIconButton
                  title="Mark Rent as Paid"
                  className="text-brand-700"
                  onClick={(e) => {
                    e.stopPropagation();
                    onMarkPaid(bed, rentRecord);
                  }}
                >
                  <Check strokeWidth={2.6} />
                </TileIconButton>
              </>
            )}

            <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-ink-2/50 transition-colors group-hover:text-brand" />
          </>
        )}
      </div>
    </div>
  );
}
