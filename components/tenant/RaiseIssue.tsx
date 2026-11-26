'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dropdown } from '@/components/ui/dropdown';
import { CheckCircle2 } from 'lucide-react';
import { Textarea } from '@/components/ui/input';
import { IconTile } from '@/components/brand/Icon3D';
import toast from 'react-hot-toast';
import { errorMessage, readApiError } from '@/lib/utils';

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
        throw new Error(await readApiError(res, 'Could not submit'));
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
    <section className="app-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <IconTile icon="wrench" tint="sky" size={48} />
          <span className="text-[15.5px] font-bold leading-snug text-ink">Report a Problem</span>
        </div>
        {!open && (
          <Button size="md" variant="soft" onClick={() => setOpen(true)} className="max-[379px]:w-full">
            Raise Issue
          </Button>
        )}
      </div>

      {submitted && !open && (
        <p className="mt-3 flex items-center gap-1.5 text-[12.5px] font-semibold text-success-ink">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
          <span>Your last issue was sent. Raise another if needed.</span>
        </p>
      )}

      {open && (
        <form onSubmit={submit} className="mt-4 space-y-3 animate-pop">
          <Dropdown
            label="Category"
            id="issue-cat"
            value={category}
            onChange={setCategory}
            options={CATEGORIES.map((c) => ({ value: c.value, label: c.label }))}
          />
          <Textarea
            id="issue-desc"
            label="What's the problem?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            maxLength={1000}
            placeholder="e.g. Tap in the bathroom is leaking continuously"
          />
          <div className="flex items-center gap-2">
            <Button type="submit" size="md" variant="solid" loading={submitting} className="flex-1">
              Submit Issue
            </Button>
            <Button type="button" size="md" variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
