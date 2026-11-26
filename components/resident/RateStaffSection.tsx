'use client';

import React, { useState } from 'react';
import { Star } from 'lucide-react';
import toast from 'react-hot-toast';
import { errorMessage } from '@/lib/utils';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { SectionCard } from '@/components/ui/dashboard-kit';

interface StaffRow {
  uid: string;
  name: string;
  ratingAvg: number;
  ratingCount: number;
}

function StarsInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="-ml-2 flex items-center">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className="grid h-11 w-11 cursor-pointer place-items-center rounded-full transition-transform hover:bg-brand-50 active:scale-90"
          aria-label={`${n} star`}
        >
          <Star
            className={`h-7 w-7 ${n <= value ? 'fill-warning text-warning' : 'text-line-strong'}`}
            strokeWidth={1.8}
          />
        </button>
      ))}
    </div>
  );
}

/** Residents rate individual staff/wardens of their PG (1-5 + optional note). */
export function RateStaffSection({ staff }: { staff: StaffRow[] }) {
  const [openUid, setOpenUid] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  if (!staff || staff.length === 0) return null;

  const submit = async (staffUid: string) => {
    if (rating < 1) {
      toast.error('Pick a star rating');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/reviews/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffUid, rating, note: note.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not submit rating');
      toast.success('Thanks for rating!');
      setOpenUid(null);
      setRating(0);
      setNote('');
    } catch (e: unknown) {
      toast.error(errorMessage(e, 'Could not submit rating'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SectionCard title="Rate Staff & Wardens" icon="staff">
      <div className="divide-y divide-line stagger">
        {staff.map((s) => (
          <div key={s.uid} className="py-3 first:pt-0 last:pb-0">
            <div className="flex items-center gap-3">
              <Avatar name={s.name} size="md" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14.5px] font-bold text-ink">{s.name}</div>
                {s.ratingCount > 0 ? (
                  <div className="mt-0.5 flex items-center gap-1 text-[12.5px] font-bold text-ink-2">
                    <Star className="h-3.5 w-3.5 fill-warning text-warning" /> {s.ratingAvg}
                    <span className="font-medium text-muted">({s.ratingCount})</span>
                  </div>
                ) : (
                  <div className="mt-0.5 text-[12.5px] font-medium text-muted">No ratings yet</div>
                )}
              </div>
              {openUid !== s.uid && (
                <Button
                  variant="soft"
                  size="md"
                  onClick={() => {
                    setOpenUid(s.uid);
                    setRating(0);
                    setNote('');
                  }}
                >
                  <Star className="h-4 w-4" /> Rate
                </Button>
              )}
            </div>

            {openUid === s.uid && (
              <div className="well mt-3 space-y-3 p-3.5 animate-pop">
                <StarsInput value={rating} onChange={setRating} />
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  maxLength={500}
                  placeholder="Optional note about this staff member…"
                  aria-label={`Note about ${s.name}`}
                />
                <div className="flex gap-2">
                  <Button variant="solid" size="md" onClick={() => submit(s.uid)} disabled={busy} className="flex-1">
                    {busy ? 'Submitting…' : 'Submit'}
                  </Button>
                  <Button variant="outline" size="md" onClick={() => setOpenUid(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
