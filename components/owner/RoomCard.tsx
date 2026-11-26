'use client';

import React from 'react';
import { Bed, RentRecord } from '@/types';
import { formatCurrency, getWhatsAppLink } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { IconTile, type Tint } from '@/components/brand/Icon3D';
import { TileIconButton } from './BedCard';
import {
  UserPlus,
  Send,
  Users,
  ChevronRight,
  Snowflake,
} from 'lucide-react';

export interface RoomData {
  roomNumber: string;
  floor: number;
  sharingType: '1' | '2' | '3' | '4' | '5' | '6';
  acType: 'ac' | 'non-ac';
  beds: Bed[];
  monthlyRent: number;
  vacantCount: number;
  occupiedCount: number;
  totalCapacity: number;
}

// Sharing-format labels. One violet badge style for every format (the system
// reserves green / orange / red for rent status), the label carries the type.
const SHARING_LABEL: Record<string, string> = {
  '1': 'Single Private',
  '2': '2-Share (Double)',
  '3': '3-Share (Triple)',
  '4': '4-Share (Quad)',
  '5': '5-Share',
  '6': '6-Share (Dorm)',
};

interface RoomCardProps {
  room: RoomData;
  /** Selected-month rent records keyed by tenantId (records link to residents,
   *  not beds — see BedGrid). Resolve a bed's record via its tenantId. */
  recordByTenant: Map<string, RentRecord>;
  ownerName: string;
  pgName: string;
  ownerUpi: string;
  onAddTenant: (bed: Bed) => void;
  onMarkPaid: (bed: Bed, record?: RentRecord) => void;
  onVerifyProof: (bed: Bed, record: RentRecord) => void;
  onVacate: (bed: Bed) => void;
  onSelectBed?: (bed: Bed) => void;
}

export function RoomCard({
  room,
  recordByTenant,
  ownerName,
  pgName,
  ownerUpi,
  onAddTenant,
  onSelectBed,
}: RoomCardProps) {
  const shareLabel = SHARING_LABEL[room.sharingType] || `${room.sharingType}-Share`;

  const isAllVacant = room.occupiedCount === 0;
  const isFull = room.vacantCount === 0;

  // Occupancy pill: empty → lilac, partly available → info blue, full → violet.
  const occupancyVariant: NonNullable<BadgeProps['variant']> = isAllVacant
    ? 'vacant'
    : isFull
    ? 'brand'
    : 'cyan';

  const handleSendReminder = (e: React.MouseEvent, bed: Bed) => {
    e.stopPropagation();
    if (!bed.tenantPhone) return;

    const message = `Namaste ${bed.tenantName || 'Resident'} ji 🙏,\n\nFriendly reminder from ${pgName}: rent of ${formatCurrency(
      bed.monthlyRent
    )} for Bed ${bed.bedLabel} (Room ${room.roomNumber}) is due.\n\nPlease pay to UPI: ${ownerUpi || 'our PG UPI'}.\n\nThank you,\n${ownerName || 'PG Management'}`;

    const link = getWhatsAppLink(bed.tenantPhone, message);
    window.open(link, '_blank');
  };

  return (
    <div className="app-card flex h-full flex-col gap-3.5 p-4 text-left sm:p-5">
      {/* ROOM HEADER */}
      <div className="flex items-start gap-3">
        <IconTile icon="house" tint="violet" size={44} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
            <h4 className="text-base font-extrabold tracking-[-0.015em] text-ink">
              Room {room.roomNumber}
            </h4>
            {/* Occupancy Status Pill */}
            <Badge variant={occupancyVariant} dot>
              {isAllVacant
                ? `All ${room.totalCapacity} Vacant`
                : isFull
                ? `Full (${room.totalCapacity}/${room.totalCapacity})`
                : `${room.vacantCount}/${room.totalCapacity} Available`}
            </Badge>
          </div>
          <span className="mt-0.5 block font-mono-numbers text-xs font-medium text-muted">
            Floor {room.floor} · {formatCurrency(room.monthlyRent)}/bed/mo
          </span>
        </div>
      </div>

      {/* Sharing format + climate */}
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="brand">
          <Users className="h-3 w-3" />
          <span>{shareLabel}</span>
        </Badge>
        <Badge variant={room.acType === 'ac' ? 'cyan' : 'default'}>
          {room.acType === 'ac' ? (
            <>
              <Snowflake className="h-3 w-3" />
              <span>AC</span>
            </>
          ) : (
            'Non-AC'
          )}
        </Badge>
      </div>

      {/* Visual Occupancy Progress Bar */}
      <div className="flex w-full items-center gap-1">
        {room.beds.map((bed) => {
          const isOccupied = bed.status !== 'vacant';
          return (
            <div
              key={bed.id}
              className={`h-2 flex-1 rounded-full transition-all ${
                isOccupied ? 'bg-[image:var(--grad-brand)]' : 'bg-lilac-2'
              }`}
              title={`${bed.bedLabel}: ${isOccupied ? bed.tenantName || 'Occupied' : 'Vacant'}`}
            />
          );
        })}
      </div>

      {/* BEDS LIST INSIDE THE ROOM */}
      <div className="space-y-2">
        {room.beds.map((bed) => {
          // Payment status comes ONLY from the selected month's record (not the
          // bed's month-agnostic denormalized status), so navigating months shows
          // real per-month data. An occupied bed with no record this month has no
          // bill for that period.
          const record = bed.tenantId ? recordByTenant.get(bed.tenantId) : undefined;
          const isVacant = bed.status === 'vacant';
          const isGuest = bed.status === 'guest';
          const isPaid = record?.status === 'paid';
          const isVerify = record?.status === 'verify';
          const noBill = !isVacant && !isGuest && !record;

          // Row tint encodes status: paid → mint · due → peach · verify → violet
          // · vacant / no bill → slate · guest → sky.
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

          return (
            <div
              key={bed.id}
              onClick={() => (onSelectBed ? onSelectBed(bed) : isVacant ? onAddTenant(bed) : undefined)}
              className={`tint-card tint-${tint} group/bed relative flex min-h-14 cursor-pointer items-center justify-between gap-2 py-2 pl-2.5 pr-2 press ${
                isVacant ? 'border-dashed border-line-strong' : ''
              }`}
            >
              {/* Bed Label & Resident Info */}
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/85 font-mono-numbers text-[13px] font-extrabold text-ink shadow-[0_4px_10px_-6px_rgba(70,40,160,0.45)]">
                  {bed.bedLabel.split('-')[1] || bed.bedLabel}
                </span>

                <div className="min-w-0">
                  {isVacant ? (
                    <div>
                      <span className="block truncate text-[13px] font-bold text-ink-2">
                        Available Bed
                      </span>
                      <span className="block font-mono-numbers text-[11.5px] font-medium text-muted">
                        {formatCurrency(bed.monthlyRent)}/mo
                      </span>
                    </div>
                  ) : (
                    <div>
                      <span className="block truncate text-[13px] font-bold text-ink">
                        {bed.tenantName || 'Resident'}
                      </span>
                      <span className="block truncate font-mono-numbers text-[11.5px] font-medium text-muted">
                        {bed.tenantPhone || 'No Phone'}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Status Badge & Actions */}
              <div className="flex shrink-0 items-center gap-1.5">
                {isVacant ? (
                  <Button
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddTenant(bed);
                    }}
                  >
                    <UserPlus className="h-4 w-4" />
                    <span>Assign</span>
                  </Button>
                ) : (
                  <>
                    {/* Status Pill */}
                    {isPaid ? (
                      <Badge variant="paid" dot>Paid</Badge>
                    ) : isVerify ? (
                      <Badge variant="verify" dot>Verify</Badge>
                    ) : noBill ? (
                      <Badge variant="default">No bill</Badge>
                    ) : (
                      <Badge variant="pending" dot>Due</Badge>
                    )}

                    {/* Quick WhatsApp Reminder — only when there's a due bill this month */}
                    {!isPaid && !isVerify && !noBill && bed.tenantPhone && (
                      <TileIconButton
                        title="Send WhatsApp Reminder"
                        className="text-success-ink"
                        onClick={(e) => handleSendReminder(e, bed)}
                      >
                        <Send />
                      </TileIconButton>
                    )}

                    <ChevronRight className="h-4 w-4 shrink-0 text-ink-2/50 transition-colors group-hover/bed:text-brand" />
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
