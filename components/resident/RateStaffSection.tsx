'use client';

import React, { useState } from 'react';
import { Star, UserCheck } from 'lucide-react';
import toast from 'react-hot-toast';

interface StaffRow {
  uid: string;
  name: string;
  ratingAvg: number;
  ratingCount: number;
}

function StarsInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" onClick={() => onChange(n)} className="cursor-pointer" aria-label={`${n} star`}>
          <Star className={`w-5 h-5 ${n <= value ? 'fill-amber-500 text-amber-500' : 'text-slate-300'}`} />
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
    } catch (e: any) {
      toast.error(e.message || 'Could not submit rating');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section>
      <h2 className="text-sm font-extrabold text-slate-900 mb-2 px-1">Rate Staff & Wardens</h2>
      <div className="space-y-2 stagger">
        {staff.map((s) => (
          <div key={s.uid} className="app-card p-3.5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-[14px] accent-soft-bg flex items-center justify-center shrink-0">
                <UserCheck className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-slate-900 truncate">{s.name}</div>
                {s.ratingCount > 0 ? (
                  <div className="text-[11px] font-semibold text-amber-600 flex items-center gap-0.5">
                    <Star className="w-3 h-3 fill-amber-500 text-amber-500" /> {s.ratingAvg} ({s.ratingCount})
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-400">No ratings yet</div>
                )}
              </div>
              {openUid !== s.uid && (
                <button
                  onClick={() => {
                    setOpenUid(s.uid);
                    setRating(0);
                    setNote('');
                  }}
                  className="text-xs font-bold accent-text press"
                >
                  Rate
                </button>
              )}
            </div>

            {openUid === s.uid && (
              <div className="mt-3 space-y-2 animate-pop">
                <StarsInput value={rating} onChange={setRating} />
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  maxLength={500}
                  placeholder="Optional note about this staff member…"
                  className="w-full px-3 py-2 rounded-[12px] border-2 border-slate-200 text-sm focus:border-[color:var(--accent)] focus:outline-none resize-none"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => submit(s.uid)}
                    disabled={busy}
                    className="flex-1 h-10 rounded-full accent-bg text-sm font-bold disabled:opacity-60 press"
                  >
                    {busy ? 'Submitting…' : 'Submit'}
                  </button>
                  <button
                    onClick={() => setOpenUid(null)}
                    className="h-10 px-4 rounded-full border-2 border-slate-200 text-sm font-bold text-slate-600 press"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
