'use client';

import React, { useState } from 'react';
import { Bed, RentRecord } from '@/types';
import { BedCard } from './BedCard';
import { Search, Layers } from 'lucide-react';
import { TabBar } from '@/components/ui/tab-bar';
import { EmptyState } from '@/components/ui/empty-state';

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
}: BedGridProps) {
  const [selectedFloor, setSelectedFloor] = useState<string>('all');
  const [activeFilter, setActiveFilter] = useState<'all' | 'paid' | 'pending' | 'verify' | 'vacant'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const recordMap = new Map<string, RentRecord>();
  rentRecords.forEach((r) => recordMap.set(r.bedId, r));

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

    const record = recordMap.get(b.id);
    const isPaid = b.status === 'paid' || record?.status === 'paid';
    const isVerify = b.status === 'verify' || record?.status === 'verify';
    const isVacant = b.status === 'vacant';
    const isPending = !isVacant && !isPaid && !isVerify;

    if (activeFilter === 'paid' && !isPaid) return false;
    if (activeFilter === 'verify' && !isVerify) return false;
    if (activeFilter === 'pending' && !isPending) return false;
    if (activeFilter === 'vacant' && !isVacant) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchLabel = b.bedLabel.toLowerCase().includes(q);
      const matchTenant = b.tenantName?.toLowerCase().includes(q) || false;
      const matchRoom = b.roomNumber.toLowerCase().includes(q);
      return matchLabel || matchTenant || matchRoom;
    }

    return true;
  });

  const displayFloors =
    selectedFloor === 'all'
      ? Array.from(new Set(filteredBeds.map((b) => b.floor))).sort((a, b) => a - b)
      : [Number(selectedFloor)];

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

        {/* Filter Controls */}
        <div className="flex items-center gap-2">
          <select
            value={activeFilter}
            onChange={(e) => setActiveFilter(e.target.value as any)}
            className="h-9 rounded-[8px] border border-[#E2E8F0] bg-white px-3 text-xs font-semibold text-[#09090B] focus:border-[#D97706] focus:outline-none"
          >
            <option value="all">All Units</option>
            <option value="pending">Pending Rent</option>
            <option value="verify">Proof Verification</option>
            <option value="paid">Settled</option>
            <option value="vacant">Available Beds</option>
          </select>

          <div className="relative flex-1 sm:w-52">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search bed, room, resident..."
              className="w-full h-9 pl-8 pr-3 rounded-[8px] border border-[#E2E8F0] text-xs text-[#09090B] placeholder:text-[#94A3B8] bg-white focus:border-[#D97706] focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Bento Bed Layout Grid */}
      {filteredBeds.length === 0 ? (
        <EmptyState
          icon={<Layers className="w-6 h-6 text-[#64748B]" />}
          title="No units match the filter"
          description="Adjust the floor selection or search filter to see more beds."
        />
      ) : (
        <div className="space-y-6">
          {displayFloors.map((floorNum) => {
            const floorBeds = filteredBeds.filter((b) => b.floor === floorNum);
            if (floorBeds.length === 0) return null;

            return (
              <div key={floorNum} className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                    Floor {floorNum} · {floorBeds.length} Units
                  </h3>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  {floorBeds.map((bed) => (
                    <BedCard
                      key={bed.id}
                      bed={bed}
                      rentRecord={recordMap.get(bed.id)}
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
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
