'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dropdown } from '@/components/ui/dropdown';
import { Wrench } from 'lucide-react';
import toast from 'react-hot-toast';
import { errorMessage } from '@/lib/utils';

const CATEGORIES = [
  { value: 'plumbing', label: 'Plumbing' },
  { value: 'electrical', label: 'Electrical' },
  { value: 'wifi', label: 'WiFi / Internet' },
  { value: 'furniture', label: 'Furniture' },
  { value: 'cleaning', label: 'Cleaning' },
  { value: 'appliance', label: 'Appliance' },
  { value: 'other', label: 'Other' },
];

export function RaiseIssue({ portalAuth }: { portalAuth: { token: string; pin: string } }) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState('plumbing');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (description.trim().length < 3) {
      toast.error('Please describe the issue');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: portalAuth.token,
          pin: portalAuth.pin,
          category,
          description: description.trim(),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Could not submit');
      }
      toast.success('Issue reported — your PG manager has been notified.');
      setSubmitted(true);
      setDescription('');
      setOpen(false);
    } catch (err: unknown) {
      toast.error(errorMessage(err, 'Could not submit'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-[12px] p-4 shadow-xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wrench className="w-4 h-4 text-[#D97706]" />
          <span className="text-sm font-bold text-[#09090B]">Report a Problem</span>
        </div>
        {!open && (
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            Raise Issue
          </Button>
        )}
      </div>

      {submitted && !open && (
        <p className="text-[11px] text-[#10B981] mt-2 font-semibold">
          Your last issue was sent. Raise another if needed.
        </p>
      )}

      {open && (
        <form onSubmit={submit} className="mt-3 space-y-3">
          <Dropdown
            label="Category"
            id="issue-cat"
            value={category}
            onChange={setCategory}
            options={CATEGORIES.map((c) => ({ value: c.value, label: c.label }))}
          />
          <div>
            <label htmlFor="issue-desc" className="text-[11px] font-semibold text-[#64748B] block mb-1">
              What&apos;s the problem?
            </label>
            <textarea
              id="issue-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="e.g. Tap in the bathroom is leaking continuously"
              className="w-full px-3 py-2 rounded-[8px] border border-[#CBD5E1] bg-white text-sm text-[#09090B] placeholder:text-[#94A3B8] focus:border-[#D97706] focus:outline-none resize-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button type="submit" size="sm" variant="solid" loading={submitting} className="flex-1">
              Submit Issue
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
