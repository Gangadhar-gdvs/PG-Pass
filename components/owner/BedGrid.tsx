'use client';

import React, { useState } from 'react';
import { Bed, RentRecord } from '@/types';
import { BedCard } from './BedCard';
import { RoomCard, RoomData } from './RoomCard';
import { Search, Layers, Building, LayoutGrid, Grid3X3 } from 'lucide-react';
import { TabBar } from '@/components/ui/tab-bar';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { Dropdown } from '@/components/ui/dropdown';

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
  const [activeFilter, setActiveFilter] = useState<'all' | 'paid' | 'pending' | 'verify' | 'vacant'>('all');
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
    <div className="space-y-4 text-left">
      {/* Top Filter HUD Control Bar */}
      <div className="bg-white border border-[#E2E8F0] rounded-[12px] p-3 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Floor Pills */}
        <TabBar
          tabs={floorTabs}
          activeTab={selectedFloor}
          onChange={setSelectedFloor}
          variant="pill"
        />

        {/* Filter Controls — on small screens the selects go in a 2-col grid,
            the search spans full width, and the view toggle sits on its own row,
            so nothing overflows the viewport. */}
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap sm:items-center gap-2">
          {/* Status Filter */}
          <Dropdown
            aria-label="Filter by status"
            value={activeFilter}
            onChange={(v) => setActiveFilter(v as 'all' | 'paid' | 'pending' | 'verify' | 'vacant')}
            containerClassName="w-full sm:w-40"
            className="h-11 text-xs font-semibold"
            options={[
              { value: 'all', label: 'All Statuses' },
              { value: 'pending', label: 'Pending Rent' },
              { value: 'verify', label: 'Proof Verification' },
              { value: 'paid', label: 'Settled' },
              { value: 'vacant', label: 'Available Beds' },
            ]}
          />

          {/* Sharing Format Filter */}
          <Dropdown
            aria-label="Filter by sharing format"
            value={sharingFilter}
            onChange={setSharingFilter}
            containerClassName="w-full sm:w-40"
            className="h-11 text-xs font-semibold"
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
            containerClassName="w-full sm:w-36"
            className="h-11 text-xs font-semibold"
            options={[
              { value: 'all', label: 'All Climate' },
              { value: 'ac', label: 'AC Only' },
              { value: 'non-ac', label: 'Non-AC Only' },
            ]}
          />

          <div className="relative col-span-1 sm:flex-1 sm:w-48">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search bed, room…"
              className="w-full h-11 pl-8 pr-3 rounded-[8px] border border-[#E2E8F0] text-xs text-[#09090B] placeholder:text-[#94A3B8] bg-white focus:border-[#D97706] focus:outline-none"
            />
          </div>

          {/* View Mode Toggle: Room Grouping vs Flat Beds */}
          <div className="col-span-2 sm:col-span-1 flex items-center justify-center bg-[#F1F5F9] p-0.5 rounded-[8px] border border-[#E2E8F0] shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('rooms')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-[6px] transition-all flex items-center gap-1.5 ${
                viewMode === 'rooms'
                  ? 'bg-white text-[#D97706] shadow-2xs font-bold'
                  : 'text-[#64748B] hover:text-[#09090B]'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Rooms</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('beds')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-[6px] transition-all flex items-center gap-1.5 ${
                viewMode === 'beds'
                  ? 'bg-white text-[#D97706] shadow-2xs font-bold'
                  : 'text-[#64748B] hover:text-[#09090B]'
              }`}
            >
              <Grid3X3 className="w-3.5 h-3.5" />
              <span>Beds</span>
            </button>
          </div>
        </div>
      </div>

      {/* Bento Bed Layout Grid */}
      {beds.length === 0 ? (
        <div className="border border-dashed border-[#CBD5E1] rounded-[14px] p-8 sm:p-12 text-center bg-[#F8FAFC]">
          <div className="w-12 h-12 rounded-full bg-[#FEF3C7] text-[#D97706] flex items-center justify-center mx-auto mb-3">
            <Building className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-[#09090B]">No Beds Configured in Inventory</h3>
          <p className="text-xs text-[#64748B] mt-1 max-w-md mx-auto">
            You haven&apos;t generated your room inventory yet. Configure your floor-by-floor sharing formats (Single, 2-share to 6-share) and pricing to generate your bed units.
          </p>
          {onConfigureRooms && (
            <div className="mt-4">
              <Button
                size="sm"
                variant="solid"
                className="bg-[#D97706] hover:bg-[#B45309] text-white text-xs"
                onClick={onConfigureRooms}
              >
                <Layers className="w-3.5 h-3.5 mr-1.5" />
                <span>Configure Rooms & Generate Inventory</span>
              </Button>
            </div>
          )}
        </div>
      ) : filteredBeds.length === 0 ? (
        <EmptyState
          icon={<Layers className="w-6 h-6 text-[#64748B]" />}
          title="No units match the filter"
          description="Adjust the floor selection or search filter to see more beds."
        />
      ) : (
        <div className="space-y-8">
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
              <div key={floorNum} className="space-y-3.5">
                {/* Floor Header Bar with Telemetry */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[#E2E8F0]">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-extrabold text-[#09090B] tracking-tight">
                      Floor {floorNum}
                    </h3>
                    <span className="text-[11px] font-semibold text-[#64748B] bg-[#F1F5F9] px-2 py-0.5 rounded-[6px]">
                      {roomsList.length} Rooms · {floorBeds.length} Beds
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#059669] bg-[#ECFDF5] px-2 py-0.5 rounded-[5px] border border-[#A7F3D0]">
                      🟢 {floorVacantCount} Vacant
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#64748B] bg-[#F8FAFC] px-2 py-0.5 rounded-[5px] border border-[#E2E8F0]">
                      👥 {floorOccupiedCount} Occupied
                    </span>
                  </div>
                </div>

                {/* ROOM-CENTRIC VIEW */}
                {viewMode === 'rooms' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
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
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
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
            <button
              type="button"
              onClick={() => setFloorsShown((n) => n + 3)}
              className="w-full h-11 rounded-[8px] border border-[#CBD5E1] bg-white text-xs font-semibold text-[#334155] hover:bg-[#F8FAFC] transition-colors"
            >
              Show more floors ({allFloors.length - displayFloors.length} left) · or pick a floor above
            </button>
          )}
        </div>
      )}
    </div>
  );
}
