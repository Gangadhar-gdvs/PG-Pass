'use client';

import React, { useState } from 'react';
import { Bed, RentRecord } from '@/types';
import { BedCard } from './BedCard';
import { Search, Filter, Layers, Home } from 'lucide-react';

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
}: BedGridProps) {
  const [activeFilter, setActiveFilter] = useState<'all' | 'paid' | 'pending' | 'verify' | 'vacant'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Map rent records by bedId
  const recordMap = new Map<string, RentRecord>();
  rentRecords.forEach((r) => recordMap.set(r.bedId, r));

  // Filter beds based on active tab & search
  const filteredBeds = beds.filter((b) => {
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

  // Group filtered beds by Floor
  const floors = Array.from(new Set(filteredBeds.map((b) => b.floor))).sort((a, b) => a - b);

  return (
    <div className="space-y-6">
      {/* Controls Bar: Filter Chips + Search */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-stretch sm:items-center bg-slate-900/60 p-3 rounded-2xl border border-slate-800">
        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeFilter === 'all'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            All Beds ({beds.length})
          </button>
          <button
            onClick={() => setActiveFilter('pending')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeFilter === 'pending'
                ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            Pending
          </button>
          <button
            onClick={() => setActiveFilter('verify')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeFilter === 'verify'
                ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            Verify Proof
          </button>
          <button
            onClick={() => setActiveFilter('paid')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeFilter === 'paid'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            Paid
          </button>
          <button
            onClick={() => setActiveFilter('vacant')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeFilter === 'vacant'
                ? 'bg-slate-700 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            Vacant
          </button>
        </div>

        {/* Quick Search Input */}
        <div className="relative min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search bed or resident..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
          />
        </div>
      </div>

      {/* Bed Grid Display */}
      {filteredBeds.length === 0 ? (
        <div className="text-center py-12 bg-slate-900/30 border border-slate-800/80 rounded-2xl p-6">
          <Layers className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h4 className="text-sm font-bold text-white mb-1">No beds matching your criteria</h4>
          <p className="text-xs text-slate-400">Try switching your filter or clearing the search query.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {floors.map((floorNum) => {
            const floorBeds = filteredBeds.filter((b) => b.floor === floorNum);

            // Group floor beds by room
            const rooms = Array.from(new Set(floorBeds.map((b) => b.roomNumber))).sort();

            return (
              <div key={floorNum} className="space-y-4">
                {/* Floor Header */}
                <div className="flex items-center gap-2 border-b border-slate-800/80 pb-2">
                  <div className="w-6 h-6 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-xs font-black">
                    F{floorNum}
                  </div>
                  <h3 className="font-extrabold text-sm text-slate-200 tracking-wide">
                    Floor {floorNum}
                  </h3>
                  <span className="text-xs text-slate-500">
                    ({floorBeds.length} {floorBeds.length === 1 ? 'bed' : 'beds'})
                  </span>
                </div>

                {/* Rooms & Beds */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
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
