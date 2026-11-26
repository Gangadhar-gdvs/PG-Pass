'use client';

import React, { useState } from 'react';
import { Bed, RentRecord } from '@/types';
import { BedCard } from './BedCard';
import { RoomCard, RoomData } from './RoomCard';
import { Layers, LayoutGrid, Grid3X3 } from 'lucide-react';
import { TabBar } from '@/components/ui/tab-bar';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { Dropdown } from '@/components/ui/dropdown';
import { SearchInput } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { FilterChips, SectionHeader } from '@/components/ui/dashboard-kit';
import { IconBubble } from '@/components/brand/Icon3D';

interface BedGridProps {
  beds: Bed[];
  rentRecords: RentRecord[];
  ownerName: string;
  pgName: string;
  ownerUpi: string;
  onAddTenant: (bed: Bed) => void;
  onMarkPaid: (bed: Bed, record?: RentRecord) => void;
  onVerifyProof: (bed: Bed, record: RentRecord) => void;
  onVacate: (bed: Bed) => void;
  onSelectBed?: (bed: Bed) => void;
  onConfigureRooms?: () => void;
}

type StatusFilter = 'all' | 'paid' | 'pending' | 'verify' | 'vacant';

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All Statuses' },
  { value: 'pending', label: 'Pending Rent' },
  { value: 'verify', label: 'Proof Verification' },
  { value: 'paid', label: 'Settled' },
  { value: 'vacant', label: 'Available Beds' },
];

/** Rooms ⇄ Beds segmented toggle (pill track like TabBar, with glyphs). */
function ViewToggle({
  value,
  onChange,
}: {
  value: 'rooms' | 'beds';
  onChange: (v: 'rooms' | 'beds') => void;
}) {
  const options = [
    { id: 'rooms' as const, label: 'Rooms', Icon: LayoutGrid },
    { id: 'beds' as const, label: 'Beds', Icon: Grid3X3 },
  ];
  return (
    <div role="group" aria-label="View mode" className="app-card flex shrink-0 items-center gap-1 rounded-full p-1">
      {options.map(({ id, label, Icon }) => {
        const active = value === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            aria-pressed={active}
            className={`inline-flex h-10 items-center justify-center gap-1.5 rounded-full px-3 text-[13px] font-bold transition-all press ${
              active
                ? 'bg-[image:var(--grad-brand)] text-white shadow-[0_8px_18px_-8px_rgba(106,43,234,0.6),inset_0_1px_0_rgba(255,255,255,0.3)]'
                : 'text-muted hover:bg-brand-50 hover:text-brand-700'
            }`}
          >
            <Icon className="h-4 w-4" />
            <span className="sr-only min-[380px]:not-sr-only">{label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Floor group heading: 3D bubble, floor name, counts and occupancy badges. */
function FloorHeader({
  floor,
  rooms,
  beds,
  vacant,
  occupied,
}: {
  floor: number;
  rooms: number;
  beds: number;
  vacant: number;
  occupied: number;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
      <div className="flex min-w-0 items-center gap-2.5">
        <IconBubble icon="building" tint="violet" size={40} />
        <div className="min-w-0">
          <h3 className="text-base font-extrabold tracking-[-0.015em] text-ink">Floor {floor}</h3>
          <p className="text-xs font-medium text-muted">
            {rooms} Rooms · {beds} Beds
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <Badge variant="vacant" dot>
          {vacant} Vacant
        </Badge>
        <Badge variant="brand" dot>
          {occupied} Occupied
        </Badge>
      </div>
    </div>
  );
}

export function BedGrid({
  beds,
  rentRecords,
  ownerName,
  pgName,
  ownerUpi,
  onAddTenant,
  onMarkPaid,
  onVerifyProof,
  onVacate,
  onSelectBed,
  onConfigureRooms,
}: BedGridProps) {
  const [selectedFloor, setSelectedFloor] = useState<string>('all');
  // Windowing: in the "all floors" view, render floors incrementally so a large
  // PG (100+ beds) doesn't mount every bed card at once on mobile.
  const [floorsShown, setFloorsShown] = useState(3);
  const [activeFilter, setActiveFilter] = useState<StatusFilter>('all');
  const [sharingFilter, setSharingFilter] = useState<string>('all');
  const [acFilter, setAcFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'rooms' | 'beds'>('rooms');

  // Rent records are linked to a resident, not a bed — their doc id is
  // `${tenantId}_${period}` and they store `tenantId` (never a reliable `bedId`).
  // So key the per-period record map by tenantId and resolve each bed's record
  // via the bed's current tenantId. (Keying by bedId silently matched nothing,
  // which is why status used to fall back to the month-agnostic bed.status.)
  const recordByTenant = new Map<string, RentRecord>();
  rentRecords.forEach((r) => {
    if (r.tenantId) recordByTenant.set(r.tenantId, r);
  });
  const recordFor = (b: Bed): RentRecord | undefined =>
    b.tenantId ? recordByTenant.get(b.tenantId) : undefined;

  const uniqueFloors = Array.from(new Set(beds.map((b) => b.floor))).sort((a, b) => a - b);

  const floorTabs = [
    { id: 'all', label: 'All Floors', count: beds.length },
    ...uniqueFloors.map((fl) => ({
      id: String(fl),
      label: `Floor ${fl}`,
      count: beds.filter((b) => b.floor === fl).length,
    })),
  ];

  const filteredBeds = beds.filter((b) => {
    if (selectedFloor !== 'all' && String(b.floor) !== selectedFloor) {
      return false;
    }

    // Payment status for the filter comes from the SELECTED month's record
    // (resolved via the bed's tenant), not the bed's month-agnostic status.
    // Guests are billed separately (no monthly rent record) so they're excluded
    // from the paid/pending/verify rent filters entirely.
    const record = recordFor(b);
    const isVacant = b.status === 'vacant';
    const isGuest = b.status === 'guest';
    const isPaid = record?.status === 'paid';
    const isVerify = record?.status === 'verify';
    const isPending = !isVacant && !isGuest && !isPaid && !isVerify;

    if (activeFilter === 'paid' && !isPaid) return false;
    if (activeFilter === 'verify' && !isVerify) return false;
    if (activeFilter === 'pending' && !isPending) return false;
    if (activeFilter === 'vacant' && !isVacant) return false;

    if (sharingFilter !== 'all' && b.sharingType !== sharingFilter) {
      return false;
    }

    if (acFilter !== 'all') {
      if (acFilter === 'ac' && b.acType !== 'ac') return false;
      if (acFilter === 'non-ac' && b.acType === 'ac') return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchLabel = b.bedLabel.toLowerCase().includes(q);
      const matchTenant = b.tenantName?.toLowerCase().includes(q) || false;
      const matchRoom = b.roomNumber.toLowerCase().includes(q);
      return matchLabel || matchTenant || matchRoom;
    }

    return true;
  });

  const allFloors =
    selectedFloor === 'all'
      ? Array.from(new Set(filteredBeds.map((b) => b.floor))).sort((a, b) => a - b)
      : [Number(selectedFloor)];
  // Only window the "all floors" view; a single selected floor renders fully.
  const displayFloors = selectedFloor === 'all' ? allFloors.slice(0, floorsShown) : allFloors;
  const hasMoreFloors = selectedFloor === 'all' && allFloors.length > displayFloors.length;

  return (
    <section className="space-y-4 text-left" aria-label="Bed inventory">
      <SectionHeader
        title="Bed Inventory"
        icon="bed"
        action={<ViewToggle value={viewMode} onChange={setViewMode} />}
      />

      {/* Filters: search + sharing / climate, floor tabs, status chips */}
      <div className="space-y-3">
        <div className="flex flex-col gap-2.5 md:flex-row md:items-center">
          <SearchInput
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search bed, room…"
            aria-label="Search bed, room or resident"
            containerClassName="md:flex-1"
          />
          <div className="grid grid-cols-2 gap-2.5 md:flex md:shrink-0">
            {/* Sharing Format Filter */}
            <Dropdown
              aria-label="Filter by sharing format"
              value={sharingFilter}
              onChange={setSharingFilter}
              containerClassName="w-full md:w-44"
              options={[
                { value: 'all', label: 'All Sharing' },
                { value: '1', label: 'Single (1-Share)' },
                { value: '2', label: '2-Sharing' },
                { value: '3', label: '3-Sharing' },
                { value: '4', label: '4-Sharing' },
                { value: '5', label: '5-Sharing' },
                { value: '6', label: '6-Sharing' },
              ]}
            />

            {/* AC Filter */}
            <Dropdown
              aria-label="Filter by climate"
              value={acFilter}
              onChange={setAcFilter}
              containerClassName="w-full md:w-40"
              options={[
                { value: 'all', label: 'All Climate' },
                { value: 'ac', label: 'AC Only' },
                { value: 'non-ac', label: 'Non-AC Only' },
              ]}
            />
          </div>
        </div>

        {/* Floor Pills */}
        <TabBar
          tabs={floorTabs}
          activeTab={selectedFloor}
          onChange={setSelectedFloor}
          variant="pill"
          className="w-fit"
        />

        {/* Status Filter */}
        <div role="group" aria-label="Filter by status">
          <FilterChips options={STATUS_OPTIONS} value={activeFilter} onChange={setActiveFilter} />
        </div>
      </div>

      {/* Bed layout */}
      {beds.length === 0 ? (
        <div className="app-card">
          <EmptyState
            illustration="clipboard"
            title="No Beds Configured in Inventory"
            description="You haven’t generated your room inventory yet. Configure your floor-by-floor sharing formats (Single, 2-share to 6-share) and pricing to generate your bed units."
            action={
              onConfigureRooms ? (
                <Button onClick={onConfigureRooms}>
                  <Layers className="h-4 w-4" />
                  <span>
                    Configure Rooms<span className="hidden min-[440px]:inline"> &amp; Generate Inventory</span>
                  </span>
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : filteredBeds.length === 0 ? (
        <div className="app-card">
          <EmptyState
            icon3d="bed"
            title="No units match the filter"
            description="Adjust the floor selection or search filter to see more beds."
          />
        </div>
      ) : (
        <div className="space-y-6">
          {displayFloors.map((floorNum) => {
            const floorBeds = filteredBeds.filter((b) => b.floor === floorNum);
            if (floorBeds.length === 0) return null;

            // Group beds by room
            const roomMap = new Map<string, Bed[]>();
            floorBeds.forEach((bed) => {
              const list = roomMap.get(bed.roomNumber) || [];
              list.push(bed);
              roomMap.set(bed.roomNumber, list);
            });

            const roomsList: RoomData[] = Array.from(roomMap.entries())
              .map(([roomNumber, roomBeds]) => {
                const sortedBeds = [...roomBeds].sort((a, b) =>
                  a.bedLabel.localeCompare(b.bedLabel)
                );
                const vacantCount = sortedBeds.filter((b) => b.status === 'vacant').length;
                const occupiedCount = sortedBeds.length - vacantCount;
                const refBed = sortedBeds[0];
                const countStr = String(sortedBeds.length);
                const derivedSharing: RoomData['sharingType'] =
                  countStr === '1' ||
                  countStr === '2' ||
                  countStr === '3' ||
                  countStr === '4' ||
                  countStr === '5' ||
                  countStr === '6'
                    ? countStr
                    : '2';

                return {
                  roomNumber,
                  floor: floorNum,
                  sharingType: refBed.sharingType || derivedSharing,
                  acType: refBed.acType || 'non-ac',
                  beds: sortedBeds,
                  monthlyRent: refBed.monthlyRent,
                  vacantCount,
                  occupiedCount,
                  totalCapacity: sortedBeds.length,
                };
              })
              .sort((a, b) => a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true }));

            const floorVacantCount = floorBeds.filter((b) => b.status === 'vacant').length;
            const floorOccupiedCount = floorBeds.length - floorVacantCount;

            return (
              <div key={floorNum} className="space-y-3">
                <FloorHeader
                  floor={floorNum}
                  rooms={roomsList.length}
                  beds={floorBeds.length}
                  vacant={floorVacantCount}
                  occupied={floorOccupiedCount}
                />

                {/* ROOM-CENTRIC VIEW */}
                {viewMode === 'rooms' ? (
                  <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                    {roomsList.map((room) => (
                      <RoomCard
                        key={room.roomNumber}
                        room={room}
                        recordByTenant={recordByTenant}
                        ownerName={ownerName}
                        pgName={pgName}
                        ownerUpi={ownerUpi}
                        onAddTenant={onAddTenant}
                        onMarkPaid={onMarkPaid}
                        onVerifyProof={onVerifyProof}
                        onVacate={onVacate}
                        onSelectBed={onSelectBed}
                      />
                    ))}
                  </div>
                ) : (
                  /* RAW BEDS GRID */
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                    {floorBeds.map((bed) => (
                      <BedCard
                        key={bed.id}
                        bed={bed}
                        rentRecord={recordFor(bed)}
                        ownerName={ownerName}
                        pgName={pgName}
                        ownerUpi={ownerUpi}
                        onAddTenant={onAddTenant}
                        onMarkPaid={onMarkPaid}
                        onVerifyProof={onVerifyProof}
                        onVacate={onVacate}
                        onSelectBed={onSelectBed}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {hasMoreFloors && (
            <Button variant="outline" size="full" onClick={() => setFloorsShown((n) => n + 3)}>
              Show more floors ({allFloors.length - displayFloors.length} left)
              <span className="hidden sm:inline"> · or pick a floor above</span>
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
