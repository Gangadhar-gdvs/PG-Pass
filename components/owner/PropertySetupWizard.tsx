'use client';

import React, { useState } from 'react';
import { useOwnerSession } from '@/hooks/useOwner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dropdown } from '@/components/ui/dropdown';
import { Badge } from '@/components/ui/badge';
import { StatTile } from '@/components/ui/dashboard-kit';
import { Icon3D, IconBubble, IconTile, GlyphTile, type Icon3DName, type Tint } from '@/components/brand/Icon3D';
import { Illustration } from '@/components/brand/Illustration';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpDown,
  AtSign,
  Building2,
  Car,
  Check,
  CheckCircle2,
  Coffee,
  CookingPot,
  Droplet,
  Flame,
  MapPin,
  Minus,
  Plus,
  Refrigerator,
  Shield,
  Shirt,
  Snowflake,
  Sparkles,
  UserRound,
  Utensils,
  Wifi,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import {
  SHARING_FORMATS,
  PG_AMENITIES_LIST,
  ROOM_AMENITIES_LIST,
  SharingType,
  PgCategory,
  FoodPlan,
  FoodCuisine,
} from '@/lib/constants/amenities';
import { Owner } from '@/types';
import { formatCurrency, errorMessage } from '@/lib/utils';
import { validateUpi, sanitizeText } from '@/lib/security';
import toast from 'react-hot-toast';

/* ---------------- Presentation helpers (local to the wizard) ---------------- */

const WIZARD_STEPS = [
  { n: 1, label: 'Property Identity', short: 'Identity' },
  { n: 2, label: 'Building Facilities', short: 'Facilities' },
  { n: 3, label: 'Room Formats & Pricing', short: 'Pricing' },
  { n: 4, label: 'Floor Layout Matrix', short: 'Floors' },
] as const;

/** 3D icon + pastel tint per sharing type, reused in the pricing and floor steps. */
const SHARING_LOOK: Record<SharingType, { icon: Icon3DName; tint: Tint }> = {
  '1': { icon: 'bed', tint: 'violet' },
  '2': { icon: 'bed', tint: 'sky' },
  '3': { icon: 'bed-teal', tint: 'mint' },
  '4': { icon: 'users', tint: 'peach' },
  '5': { icon: 'users-purple', tint: 'indigo' },
  '6': { icon: 'residents', tint: 'rose' },
};

/** Lucide glyphs for the amenity catalogue (names come from PG_AMENITIES_LIST.icon). */
const AMENITY_GLYPHS: Record<string, LucideIcon> = {
  Wifi,
  Utensils,
  Zap,
  Shirt,
  Sparkles,
  Droplet,
  Shield,
  ArrowUpDown,
  Car,
  Refrigerator,
  Flame,
};

const AMENITY_TINT: Record<string, Tint> = {
  food: 'peach',
  utility: 'sky',
  safety: 'mint',
  comfort: 'violet',
};

const CATEGORY_LOOK: Record<string, { icon: Icon3DName; tint: Tint }> = {
  gents: { icon: 'person', tint: 'mint' },
  ladies: { icon: 'users-purple', tint: 'rose' },
  coliving: { icon: 'users', tint: 'sky' },
};

const FOOD_LOOK: Record<string, { glyph: LucideIcon; tint: Tint }> = {
  '3_meals': { glyph: Utensils, tint: 'peach' },
  '2_meals': { glyph: Coffee, tint: 'amber' },
  no_food: { glyph: CookingPot, tint: 'slate' },
};

const ROUND_BTN =
  'grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white bg-white/90 text-brand-700 shadow-[var(--shadow-tile)] transition-colors press hover:bg-white hover:text-brand-800';

/** Violet check (selected) or empty ring (not selected). */
function SelectMark({ selected, className = '' }: { selected: boolean; className?: string }) {
  return selected ? (
    <span
      aria-hidden="true"
      className={`grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[image:var(--grad-brand)] text-white shadow-[var(--shadow-brand)] ${className}`}
    >
      <Check className="h-3.5 w-3.5" strokeWidth={3} />
    </span>
  ) : (
    <span aria-hidden="true" className={`h-6 w-6 shrink-0 rounded-full border-2 border-line-strong bg-white ${className}`} />
  );
}

/** Glass section card with a 3D icon tile header — one per wizard block. */
function StepCard({
  icon,
  glyph,
  tint = 'violet',
  title,
  subtitle,
  action,
  children,
}: {
  icon?: Icon3DName;
  glyph?: LucideIcon;
  tint?: Tint;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="app-card p-4 sm:p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          {icon ? (
            <IconTile icon={icon} tint={tint} size={46} />
          ) : glyph ? (
            <GlyphTile icon={glyph} tone="peach" size={46} />
          ) : null}
          <div className="min-w-0">
            <h2 className="text-[16px] font-bold leading-snug tracking-[-0.015em] text-ink sm:text-[17px]">{title}</h2>
            {subtitle && <p className="mt-0.5 text-[12.5px] font-medium leading-relaxed text-muted sm:text-[13px]">{subtitle}</p>}
          </div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </section>
  );
}

/** Single-choice tile (category / food plan): row on phones, column tile on sm+. */
function ChoiceTile({
  selected,
  onClick,
  icon,
  tint,
  label,
  desc,
}: {
  selected: boolean;
  onClick: () => void;
  icon: Icon3DName | React.ReactNode;
  tint: Tint;
  label: string;
  desc: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`relative flex w-full min-h-[64px] items-center gap-3 rounded-2xl border p-3 text-left transition-all press sm:flex-col sm:items-start sm:gap-2.5 sm:p-3.5 ${
        selected
          ? 'border-brand-300 bg-brand-50 ring-1 ring-brand-300 shadow-[var(--shadow-tile)]'
          : 'border-white bg-white/70 shadow-[var(--shadow-tile)] hover:bg-white'
      }`}
    >
      <IconBubble icon={icon} tint={tint} size={42} />
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] font-bold leading-tight text-ink">{label}</span>
        <span className="mt-0.5 block text-xs font-medium leading-snug text-muted">{desc}</span>
      </span>
      <SelectMark selected={selected} className="sm:absolute sm:right-3 sm:top-3" />
    </button>
  );
}

/** Round white glass − / value / + stepper. */
function RoundStepper({
  value,
  onDecrement,
  onIncrement,
  decrementLabel,
  incrementLabel,
}: {
  value: number;
  onDecrement: () => void;
  onIncrement: () => void;
  decrementLabel: string;
  incrementLabel: string;
}) {
  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <button type="button" onClick={onDecrement} aria-label={decrementLabel} className={ROUND_BTN}>
        <Minus className="h-4 w-4" strokeWidth={2.6} />
      </button>
      <span className="w-7 text-center text-[16px] font-extrabold font-mono-numbers text-ink">{value}</span>
      <button type="button" onClick={onIncrement} aria-label={incrementLabel} className={ROUND_BTN}>
        <Plus className="h-4 w-4" strokeWidth={2.6} />
      </button>
    </div>
  );
}

interface PropertySetupWizardProps {
  initialOwnerPhone: string;
  existingOwner?: Owner | null;
  onCancel?: () => void;
  onComplete: (ownerData: Owner) => void;
}

interface FloorPlan {
  floorNumber: number;
  isAcFloor: boolean;
  roomCounts: Record<SharingType, number>;
}

export function PropertySetupWizard({
  initialOwnerPhone,
  existingOwner,
  onComplete,
}: PropertySetupWizardProps) {
  const { ownerId, properties, selectedPropertyId } = useOwnerSession();
  // When setting up a NON-primary property, tag the new beds with its id so they
  // are scoped correctly. For the primary (or single-property owners), leave it
  // undefined so beds stay owner-wide (matches legacy data).
  const targetPropertyId =
    properties.length > 1 && selectedPropertyId !== ownerId ? selectedPropertyId : undefined;

  // Step navigation (1: Info, 2: Amenities, 3: Sharing Formats & Pricing, 4: Floor Distribution)
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [submitting, setSubmitting] = useState(false);

  // Step 1: Property Identity
  const [pgName, setPgName] = useState(existingOwner?.pgName || '');
  const [ownerName, setOwnerName] = useState(existingOwner?.name || '');
  const [pgAddress, setPgAddress] = useState(existingOwner?.pgAddress || existingOwner?.address || '');
  const [upiId, setUpiId] = useState(existingOwner?.upiId || '');
  const [pgCategory, setPgCategory] = useState<PgCategory>(existingOwner?.pgCategory || 'coliving');
  const [foodPlan, setFoodPlan] = useState<FoodPlan>(existingOwner?.foodPlan || '3_meals');
  const [foodCuisine, setFoodCuisine] = useState<FoodCuisine>(existingOwner?.foodCuisine || 'both');
  const [noticePeriodDays, setNoticePeriodDays] = useState<number>(existingOwner?.noticePeriodDays || 30);

  // Step 2: PG Amenities
  const [selectedPgAmenities, setSelectedPgAmenities] = useState<string[]>(
    existingOwner?.pgAmenities && existingOwner.pgAmenities.length > 0
      ? existingOwner.pgAmenities
      : [
          'wifi',
          'food',
          'power_backup',
          'washing_machine',
          'cleaning',
          'ro_water',
          'cctv',
          'geyser',
        ]
  );

  // Step 3: Sharing Formats, Custom Pricing & Room Amenities
  const [enabledFormats, setEnabledFormats] = useState<Record<SharingType, boolean>>({
    '1': true,
    '2': true,
    '3': true,
    '4': false,
    '5': false,
    '6': false,
  });

  // No default prices — the owner enters their own rent per sharing type. Empty
  // string means "not yet entered"; inputs show a placeholder, never a value the
  // owner didn't choose.
  const [rents, setRents] = useState<Record<SharingType, number | ''>>({
    '1': '',
    '2': '',
    '3': '',
    '4': '',
    '5': '',
    '6': '',
  });

  const [acSurcharge, setAcSurcharge] = useState<number | ''>('');

  const [selectedRoomAmenities, setSelectedRoomAmenities] = useState<string[]>([
    'attached_washroom',
    'wooden_cupboard',
    'study_table',
    'bedside_socket',
  ]);

  // Step 4: Floor-by-Floor Distribution
  const [totalFloorsCount, setTotalFloorsCount] = useState<number>(2);
  const [floors, setFloors] = useState<FloorPlan[]>([
    {
      floorNumber: 1,
      isAcFloor: false,
      roomCounts: { '1': 1, '2': 2, '3': 1, '4': 0, '5': 0, '6': 0 },
    },
    {
      floorNumber: 2,
      isAcFloor: true,
      roomCounts: { '1': 0, '2': 3, '3': 1, '4': 0, '5': 0, '6': 0 },
    },
  ]);

  // Handle floors count change
  const handleFloorsCountChange = (count: number) => {
    const clamped = Math.max(1, Math.min(count, 15));
    setTotalFloorsCount(clamped);

    setFloors((prev) => {
      const next: FloorPlan[] = [];
      for (let i = 1; i <= clamped; i++) {
        const existing = prev.find((f) => f.floorNumber === i);
        if (existing) {
          next.push(existing);
        } else {
          next.push({
            floorNumber: i,
            isAcFloor: false,
            roomCounts: { '1': 0, '2': 2, '3': 1, '4': 0, '5': 0, '6': 0 },
          });
        }
      }
      return next;
    });
  };

  const updateRoomCount = (floorNum: number, sharing: SharingType, delta: number) => {
    setFloors((prev) =>
      prev.map((f) => {
        if (f.floorNumber !== floorNum) return f;
        const current = f.roomCounts[sharing] || 0;
        const updated = Math.max(0, Math.min(current + delta, 20));
        return {
          ...f,
          roomCounts: {
            ...f.roomCounts,
            [sharing]: updated,
          },
        };
      })
    );
  };

  const toggleFloorAc = (floorNum: number) => {
    setFloors((prev) =>
      prev.map((f) => (f.floorNumber === floorNum ? { ...f, isAcFloor: !f.isAcFloor } : f))
    );
  };

  // Toggle Amenity
  const togglePgAmenity = (id: string) => {
    setSelectedPgAmenities((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  };

  const toggleRoomAmenity = (id: string) => {
    setSelectedRoomAmenities((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  };

  // Calculations
  const activeFormatsList = SHARING_FORMATS.filter((fmt) => enabledFormats[fmt.sharing]);

  const totalCalculations = React.useMemo(() => {
    let totalRooms = 0;
    let totalBeds = 0;
    let totalMonthlyPotential = 0;

    floors.forEach((f) => {
      Object.entries(f.roomCounts).forEach(([sharingKey, count]) => {
        if (count > 0 && enabledFormats[sharingKey as SharingType]) {
          const cap = Number(sharingKey);
          const baseRent = Number(rents[sharingKey as SharingType]) || 0;
          const roomRentPerBed = f.isAcFloor ? baseRent + (Number(acSurcharge) || 0) : baseRent;

          totalRooms += count;
          totalBeds += count * cap;
          totalMonthlyPotential += count * cap * roomRentPerBed;
        }
      });
    });

    return { totalRooms, totalBeds, totalMonthlyPotential };
  }, [floors, enabledFormats, rents, acSurcharge]);

  // Step 1 Validation
  const validateStep1 = () => {
    const cleanPg = sanitizeText(pgName, 80);
    const cleanOwner = sanitizeText(ownerName, 60);

    if (!cleanPg || !cleanOwner) {
      toast.error('Please enter property name and owner name');
      return false;
    }

    const upiRes = validateUpi(upiId);
    if (!upiRes.valid) {
      toast.error(upiRes.error || 'Please enter a valid UPI ID (e.g. name@bank)');
      return false;
    }

    return true;
  };

  // Final Submission
  const handleFinalSubmit = async () => {
    if (totalCalculations.totalBeds === 0) {
      toast.error('Please configure at least 1 room with beds');
      return;
    }

    // Every enabled sharing type that is actually used on a floor must have a
    // rent entered — no hidden defaults are applied on the owner's behalf.
    const usedSharing = new Set<SharingType>();
    floors.forEach((fl) => {
      (Object.keys(fl.roomCounts) as SharingType[]).forEach((s) => {
        if ((fl.roomCounts[s] || 0) > 0) usedSharing.add(s);
      });
    });
    const missingRent = [...usedSharing].find((s) => !(Number(rents[s]) > 0));
    if (missingRent) {
      toast.error(`Please enter the monthly rent for ${missingRent}-sharing rooms before continuing`);
      return;
    }

    setSubmitting(true);
    try {
      const cleanPg = sanitizeText(pgName, 80);
      const cleanOwner = sanitizeText(ownerName, 60);
      const cleanAddress = sanitizeText(pgAddress, 200) || 'Prime Location';

      // 1. Create Owner Profile
      const ownerRes = await fetch('/api/owners', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: cleanOwner,
          phone: initialOwnerPhone.replace(/\D/g, '').slice(-10),
          pgName: cleanPg,
          address: cleanAddress,
          upiId: upiId.trim().toLowerCase(),
          pgCategory,
          foodPlan,
          foodCuisine: foodPlan !== 'no_food' ? foodCuisine : undefined,
          noticePeriodDays,
          pgAmenities: selectedPgAmenities,
          totalFloors: totalFloorsCount,
        }),
      });

      if (!ownerRes.ok) {
        const err = await ownerRes.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to save property profile');
      }

      const updatedOwner = (await ownerRes.json()) as Owner;

      // 2. Build Bed Objects List
      const generatedBeds: Array<{
        roomNumber: string;
        bedLabel: string;
        rentAmountPaise: number;
        floor: number;
        sharingType: SharingType;
        acType: 'ac' | 'non-ac';
        roomAmenities: string[];
      }> = [];

      floors.forEach((fl) => {
        let roomCounter = 1;
        activeFormatsList.forEach((fmt) => {
          const roomCount = fl.roomCounts[fmt.sharing] || 0;
          for (let r = 0; r < roomCount; r++) {
            const roomNum = `${fl.floorNumber}${String(roomCounter).padStart(2, '0')}`;
            const baseRent = Number(rents[fmt.sharing]) || 0;
            const finalRent = fl.isAcFloor ? baseRent + (Number(acSurcharge) || 0) : baseRent;
            const acType: 'ac' | 'non-ac' = fl.isAcFloor ? 'ac' : 'non-ac';

            for (let b = 1; b <= fmt.capacity; b++) {
              const bedLetter = String.fromCharCode(64 + b);
              generatedBeds.push({
                roomNumber: roomNum,
                bedLabel: `${roomNum}-${bedLetter}`,
                rentAmountPaise: Math.round(finalRent * 100),
                floor: fl.floorNumber,
                sharingType: fmt.sharing,
                acType,
                roomAmenities: selectedRoomAmenities,
              });
            }
            roomCounter++;
          }
        });
      });

      // 3. Batch Create Beds
      const bedsRes = await fetch('/api/beds/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          beds: generatedBeds,
          ...(targetPropertyId ? { propertyId: targetPropertyId } : {}),
        }),
      });

      if (!bedsRes.ok) {
        const err = await bedsRes.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to generate beds inventory');
      }

      toast.success(`Generated ${generatedBeds.length} beds across ${floors.length} floors!`);
      onComplete(updatedOwner);
    } catch (err: unknown) {
      console.error(err);
      toast.error(errorMessage(err, 'Setup encountered an error'));
    } finally {
      setSubmitting(false);
    }
  };


  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 py-2 text-left sm:py-4">
      {/* ---------------- Hero ---------------- */}
      <header className="relative flex items-center gap-2 sm:gap-6">
        <div className="relative z-10 min-w-0 flex-1 py-1">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[image:var(--grad-brand)] px-3.5 py-1.5 text-[12.5px] font-bold text-white shadow-[var(--shadow-brand)]">
            <Sparkles className="h-4 w-4" />
            Step {step} of 4
          </span>
          <h1 className="mt-3 text-[24px] font-extrabold leading-[1.1] tracking-[-0.03em] text-ink min-[380px]:text-[26px] sm:text-[34px]">
            PG Property <span className="text-gradient swoosh">Setup Wizard</span>
          </h1>
          <p className="mt-3.5 max-w-md text-[13px] font-medium leading-relaxed text-ink-2 sm:text-[15px]">
            Configure your room sharing formats, pricing, building facilities, and inventory.
          </p>
        </div>
        <div className="pointer-events-none relative w-[36%] max-w-[190px] shrink-0 sm:w-[30%]">
          <Illustration name="hero-landing" width={190} priority float />
        </div>
      </header>

      {/* ---------------- Step indicator ---------------- */}
      <nav aria-label="Setup progress" className="app-card px-2 py-4 sm:px-6">
        <ol className="flex items-start">
          {WIZARD_STEPS.map((s, i) => {
            const done = s.n < step;
            const active = s.n === step;
            return (
              <li
                key={s.n}
                aria-current={active ? 'step' : undefined}
                className="relative flex flex-1 flex-col items-center text-center"
              >
                {i > 0 && (
                  <span
                    aria-hidden="true"
                    className={`absolute top-[17px] left-[calc(-50%_+_24px)] right-[calc(50%_+_24px)] h-[3px] rounded-full transition-colors ${
                      s.n <= step ? 'bg-[image:var(--grad-brand)]' : 'bg-lilac-2'
                    }`}
                  />
                )}
                <span
                  className={`relative grid h-9 w-9 place-items-center rounded-full text-[13px] font-extrabold font-mono-numbers transition-all ${
                    done || active
                      ? 'bg-[image:var(--grad-brand)] text-white shadow-[var(--shadow-brand)]'
                      : 'border border-line-strong bg-white text-muted'
                  } ${active ? 'ring-4 ring-brand-100' : ''}`}
                >
                  {done ? <Check className="h-4 w-4" strokeWidth={3} /> : s.n}
                </span>
                <span
                  className={`mt-2 px-0.5 text-[11.5px] font-bold leading-tight sm:text-[12.5px] ${
                    active ? 'text-brand-700' : done ? 'text-ink-2' : 'text-muted'
                  }`}
                >
                  <span className="sm:hidden">{s.short}</span>
                  <span className="hidden sm:inline">{s.label}</span>
                  {done && <span className="sr-only"> (completed)</span>}
                </span>
              </li>
            );
          })}
        </ol>
      </nav>

      {/* ---------------- STEP 1: PROPERTY IDENTITY ---------------- */}
      {step === 1 && (
        <div key="step-1" className="space-y-4 animate-fade-up">
          <StepCard icon="house" tint="violet" title="Property Identity">
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input
                  label="PG / Coliving Property Name"
                  placeholder="e.g. Skyline Luxury Coliving"
                  value={pgName}
                  onChange={(e) => setPgName(e.target.value)}
                  leading={<Building2 />}
                  required
                />
                <Input
                  label="Owner / Property Manager Name"
                  placeholder="e.g. Property Manager Name"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  leading={<UserRound />}
                  required
                />
              </div>

              <Input
                label="Complete Property Address & Locality"
                placeholder="e.g. Plot 42, Hitech City Main Rd, Madhapur, Hyderabad, 500081"
                value={pgAddress}
                onChange={(e) => setPgAddress(e.target.value)}
                leading={<MapPin />}
              />

              <Input
                label="Direct Rent UPI ID (VPA)"
                placeholder="e.g. payments@bank"
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                helperText="Residents pay directly to this UPI. Zero payment gateway fees."
                leading={<AtSign />}
                required
              />
            </div>
          </StepCard>

          {/* PG Category + notice period */}
          <StepCard icon="users" tint="sky" title="Property Category / Guest Policy">
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3 stagger">
                {[
                  { id: 'gents', label: "Men's PG", desc: 'Gents only accommodation' },
                  { id: 'ladies', label: "Women's PG", desc: 'Ladies only accommodation' },
                  { id: 'coliving', label: 'Unisex Coliving', desc: 'Working professionals / couples' },
                ].map((cat) => (
                  <ChoiceTile
                    key={cat.id}
                    selected={pgCategory === cat.id}
                    onClick={() => setPgCategory(cat.id as PgCategory)}
                    icon={CATEGORY_LOOK[cat.id].icon}
                    tint={CATEGORY_LOOK[cat.id].tint}
                    label={cat.label}
                    desc={cat.desc}
                  />
                ))}
              </div>

              <Dropdown
                label="Move-out Notice Period"
                value={String(noticePeriodDays)}
                onChange={(v) => setNoticePeriodDays(Number(v))}
                options={[
                  { value: '15', label: '15 Days Notice' },
                  { value: '30', label: '30 Days Notice (Standard)' },
                ]}
              />
            </div>
          </StepCard>

          {/* Food plan + cuisine */}
          <StepCard glyph={Utensils} title="Food Facility Included in Rent">
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3 stagger">
                {[
                  { id: '3_meals', label: '3 Meals Daily', desc: 'Breakfast, Lunch & Dinner' },
                  { id: '2_meals', label: '2 Meals', desc: 'Breakfast & Dinner' },
                  { id: 'no_food', label: 'Without Food', desc: 'Self cooking or external' },
                ].map((fp) => {
                  const look = FOOD_LOOK[fp.id];
                  const FoodGlyph = look.glyph;
                  return (
                    <ChoiceTile
                      key={fp.id}
                      selected={foodPlan === fp.id}
                      onClick={() => setFoodPlan(fp.id as FoodPlan)}
                      icon={<FoodGlyph className="h-5 w-5" />}
                      tint={look.tint}
                      label={fp.label}
                      desc={fp.desc}
                    />
                  );
                })}
              </div>

              {foodPlan !== 'no_food' && (
                <Dropdown
                  label="Food Style / Menu"
                  value={foodCuisine}
                  onChange={(v) => setFoodCuisine(v as FoodCuisine)}
                  options={[
                    { value: 'both', label: 'North & South Indian Menu' },
                    { value: 'south', label: 'South Indian Style' },
                    { value: 'north', label: 'North Indian Style' },
                  ]}
                />
              )}
            </div>
          </StepCard>

          <div className="flex flex-col-reverse gap-2.5 pt-1 sm:flex-row sm:items-center sm:justify-end">
            <Button
              variant="solid"
              onClick={() => {
                if (validateStep1()) setStep(2);
              }}
              className="w-full sm:w-auto"
            >
              Next: Building Facilities
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ---------------- STEP 2: PG AMENITIES ---------------- */}
      {step === 2 && (
        <div key="step-2" className="space-y-4 animate-fade-up">
          <StepCard
            icon="building"
            tint="violet"
            title="Whole-Building Amenities & Services"
            subtitle="Select the facilities available to all residents across your property."
            action={<Badge variant="brand">{selectedPgAmenities.length} selected</Badge>}
          >
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 stagger">
              {PG_AMENITIES_LIST.map((item) => {
                const isSelected = selectedPgAmenities.includes(item.id);
                const Glyph = AMENITY_GLYPHS[item.icon] ?? Check;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => togglePgAmenity(item.id)}
                    aria-pressed={isSelected}
                    className={`flex min-h-[58px] w-full items-center gap-3 rounded-2xl border p-2.5 pr-3 text-left transition-all press select-none ${
                      isSelected
                        ? 'border-brand-300 bg-brand-50 ring-1 ring-brand-300 shadow-[var(--shadow-tile)]'
                        : 'border-white bg-white/70 shadow-[var(--shadow-tile)] hover:bg-white'
                    }`}
                  >
                    <IconBubble
                      icon={<Glyph className="h-[18px] w-[18px]" />}
                      tint={AMENITY_TINT[item.category] ?? 'violet'}
                      size={38}
                    />
                    <span
                      className={`min-w-0 flex-1 text-[13px] leading-snug ${
                        isSelected ? 'font-bold text-ink' : 'font-semibold text-ink-2'
                      }`}
                    >
                      {item.label}
                    </span>
                    <SelectMark selected={isSelected} />
                  </button>
                );
              })}
            </div>
          </StepCard>

          <div className="flex flex-col-reverse gap-2.5 pt-1 sm:flex-row sm:items-center sm:justify-between">
            <Button variant="outline" onClick={() => setStep(1)} className="w-full sm:w-auto">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <Button variant="solid" onClick={() => setStep(3)} className="w-full sm:w-auto">
              Next: Room Formats & Pricing
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ---------------- STEP 3: SHARING FORMATS & PRICING ---------------- */}
      {step === 3 && (
        <div key="step-3" className="space-y-4 animate-fade-up">
          <StepCard
            icon="bed"
            tint="sky"
            title="Room Formats, Capacity & Monthly Pricing"
            subtitle="Select which sharing options you offer and customize the monthly rent for each."
          >
            <div className="space-y-2.5 stagger">
              {SHARING_FORMATS.map((fmt) => {
                const isEnabled = enabledFormats[fmt.sharing];
                const look = SHARING_LOOK[fmt.sharing];
                return (
                  <div
                    key={fmt.sharing}
                    className={`p-3 transition-all sm:p-3.5 ${
                      isEnabled
                        ? `tint-card tint-${look.tint}`
                        : 'rounded-[16px] border border-white/80 bg-white/45'
                    }`}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isEnabled}
                          onChange={(e) =>
                            setEnabledFormats((prev) => ({
                              ...prev,
                              [fmt.sharing]: e.target.checked,
                            }))
                          }
                          className="h-5 w-5 shrink-0 cursor-pointer"
                        />
                        <span
                          className={`grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/80 shadow-[var(--shadow-tile)] transition-opacity ${
                            isEnabled ? '' : 'opacity-55 grayscale'
                          }`}
                        >
                          <Icon3D name={look.icon} size={28} />
                        </span>
                        <span className="min-w-0">
                          <span className={`block text-[14px] font-bold leading-tight ${isEnabled ? 'text-ink' : 'text-ink-2'}`}>
                            {fmt.label}{' '}
                            <span className="font-semibold text-muted">
                              ({fmt.capacity} {fmt.capacity === 1 ? 'Bed' : 'Beds'})
                            </span>
                          </span>
                          <span className="mt-0.5 block text-xs font-medium text-muted">{fmt.description}</span>
                        </span>
                      </label>

                      {isEnabled && (
                        <div className="w-full animate-pop sm:w-44 sm:shrink-0">
                          <Input
                            label="Monthly Rent"
                            type="number"
                            inputMode="numeric"
                            value={rents[fmt.sharing]}
                            placeholder="Enter rent"
                            min={0}
                            onChange={(e) =>
                              setRents((prev) => ({
                                ...prev,
                                [fmt.sharing]: e.target.value === '' ? '' : Number(e.target.value),
                              }))
                            }
                            leading={<span className="text-sm font-bold text-ink-2">₹</span>}
                            className="font-mono-numbers font-bold placeholder:font-normal"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* AC Surcharge */}
              <div className="tint-card tint-indigo flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-3.5">
                <div className="flex min-w-0 items-center gap-3">
                  <IconBubble icon={<Snowflake className="h-5 w-5" />} tint="sky" size={44} />
                  <div className="min-w-0">
                    <span className="block text-[14px] font-bold leading-tight text-ink">AC Room Monthly Surcharge</span>
                    <span className="mt-0.5 block text-xs font-medium text-muted">
                      Additional rent added automatically when a floor or room has Air Conditioning.
                    </span>
                  </div>
                </div>
                <div className="w-full sm:w-44 sm:shrink-0">
                  <Input
                    type="number"
                    inputMode="numeric"
                    aria-label="AC Room Monthly Surcharge"
                    value={acSurcharge}
                    placeholder="e.g. 1500"
                    min={0}
                    onChange={(e) => setAcSurcharge(e.target.value === '' ? '' : Number(e.target.value))}
                    leading={<span className="text-sm font-bold text-ink-2">+₹</span>}
                    className="font-mono-numbers font-bold placeholder:font-normal"
                  />
                </div>
              </div>
            </div>
          </StepCard>

          {/* Room Amenities */}
          <StepCard icon="star" tint="amber" title="Standard In-Room Amenities">
            <div className="flex flex-wrap gap-2">
              {ROOM_AMENITIES_LIST.map((am) => {
                const isChecked = selectedRoomAmenities.includes(am.id);
                return (
                  <button
                    key={am.id}
                    type="button"
                    onClick={() => toggleRoomAmenity(am.id)}
                    aria-pressed={isChecked}
                    className={`inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-[13px] transition-all press ${
                      isChecked
                        ? 'bg-brand-100 font-bold text-brand-700 ring-1 ring-brand-300'
                        : 'border border-white bg-white/75 font-semibold text-ink-2 shadow-[var(--shadow-tile)] hover:text-brand-700'
                    }`}
                  >
                    {isChecked ? (
                      <Check className="h-3.5 w-3.5" strokeWidth={3} />
                    ) : (
                      <Plus className="h-3.5 w-3.5 text-faint" strokeWidth={2.6} />
                    )}
                    <span>{am.label}</span>
                  </button>
                );
              })}
            </div>
          </StepCard>

          <div className="flex flex-col-reverse gap-2.5 pt-1 sm:flex-row sm:items-center sm:justify-between">
            <Button variant="outline" onClick={() => setStep(2)} className="w-full sm:w-auto">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <Button
              variant="solid"
              onClick={() => {
                if (activeFormatsList.length === 0) {
                  toast.error('Please select at least 1 room sharing format');
                  return;
                }
                setStep(4);
              }}
              className="w-full sm:w-auto"
            >
              Next: Floor Layout Matrix
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ---------------- STEP 4: FLOOR LAYOUT MATRIX ---------------- */}
      {step === 4 && (
        <div key="step-4" className="space-y-4 animate-fade-up">
          <StepCard
            icon="building"
            tint="violet"
            title="Floor-by-Floor Inventory Matrix"
            subtitle="Set how many rooms of each format exist on each floor of your building."
            action={
              <div className="flex items-center justify-between gap-3 rounded-full bg-lilac p-1 pl-4 ring-1 ring-line">
                <span className="text-[13px] font-semibold text-ink-2">Total Floors</span>
                <RoundStepper
                  value={totalFloorsCount}
                  onDecrement={() => handleFloorsCountChange(totalFloorsCount - 1)}
                  onIncrement={() => handleFloorsCountChange(totalFloorsCount + 1)}
                  decrementLabel="Remove a floor"
                  incrementLabel="Add a floor"
                />
              </div>
            }
          >
            {/* Floor panels */}
            <div className="-mx-1 max-h-[34rem] space-y-3 overflow-y-auto overscroll-contain px-1 py-1">
              {floors.map((fl) => {
                let floorRoomSum = 0;
                let floorBedSum = 0;
                Object.entries(fl.roomCounts).forEach(([shKey, cnt]) => {
                  if (cnt > 0 && enabledFormats[shKey as SharingType]) {
                    floorRoomSum += cnt;
                    floorBedSum += cnt * Number(shKey);
                  }
                });

                return (
                  <div key={fl.floorNumber} className="well space-y-3 p-2.5 sm:p-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-2.5">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <IconBubble icon="building" tint={fl.isAcFloor ? 'sky' : 'violet'} size={40} />
                        <div className="min-w-0">
                          <div className="text-[14.5px] font-extrabold leading-tight text-ink">Floor {fl.floorNumber}</div>
                          <div className="text-xs font-semibold text-muted font-mono-numbers">
                            {floorRoomSum} Rooms · {floorBedSum} Beds
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => toggleFloorAc(fl.floorNumber)}
                        aria-pressed={fl.isAcFloor}
                        className={`inline-flex min-h-11 items-center gap-1.5 rounded-full px-3.5 text-[12.5px] font-bold transition-all press ${
                          fl.isAcFloor
                            ? 'bg-info-bg text-info-ink ring-1 ring-info-line'
                            : 'border border-white bg-white/85 text-muted shadow-[var(--shadow-tile)] hover:text-brand-700'
                        }`}
                      >
                        {fl.isAcFloor ? <Snowflake className="h-3.5 w-3.5" /> : <Zap className="h-3.5 w-3.5" />}
                        <span>{fl.isAcFloor ? 'AC Floor (+₹' + (Number(acSurcharge) || 0) + ')' : 'Non-AC'}</span>
                      </button>
                    </div>

                    {/* Room count counters */}
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-2.5">
                      {activeFormatsList.map((fmt) => {
                        const count = fl.roomCounts[fmt.sharing] || 0;
                        const look = SHARING_LOOK[fmt.sharing];
                        const hasRent = Number(rents[fmt.sharing]) > 0;
                        return (
                          <div
                            key={fmt.sharing}
                            className={`tint-card tint-${look.tint} flex items-center justify-between gap-2 py-2 pl-3 pr-2`}
                          >
                            <div className="flex min-w-0 items-center gap-2.5">
                              <span className="hidden shrink-0 min-[380px]:grid">
                                <Icon3D name={look.icon} size={30} />
                              </span>
                              <div className="min-w-0">
                                <span className="block text-[13px] font-bold leading-tight text-ink">{fmt.label}</span>
                                <span
                                  className={`block text-[11.5px] font-semibold font-mono-numbers ${
                                    hasRent ? 'text-ink-2' : 'text-warning-ink'
                                  }`}
                                >
                                  {Number(rents[fmt.sharing]) > 0
                                    ? formatCurrency(
                                        (Number(rents[fmt.sharing]) || 0) +
                                          (fl.isAcFloor ? Number(acSurcharge) || 0 : 0)
                                      )
                                    : 'Set rent'}
                                </span>
                              </div>
                            </div>

                            <RoundStepper
                              value={count}
                              onDecrement={() => updateRoomCount(fl.floorNumber, fmt.sharing, -1)}
                              onIncrement={() => updateRoomCount(fl.floorNumber, fmt.sharing, 1)}
                              decrementLabel={`Fewer ${fmt.label} rooms on floor ${fl.floorNumber}`}
                              incrementLabel={`More ${fmt.label} rooms on floor ${fl.floorNumber}`}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Live summary */}
            <div className="well mt-4 space-y-2.5 p-2.5 sm:p-3.5">
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                <StatTile icon="building" tint="violet" label="Floors" value={totalFloorsCount} />
                <StatTile icon="house" tint="indigo" label="Total Rooms" value={totalCalculations.totalRooms} />
                <StatTile
                  icon="bed"
                  tint="sky"
                  label="Total Beds"
                  value={
                    <>
                      {totalCalculations.totalBeds}
                      <span className="ml-1 text-[11px] font-bold text-ink-2">Units</span>
                    </>
                  }
                />
              </div>
              <div className="tint-card tint-mint flex items-center gap-3 px-3 py-3 sm:px-4">
                <Icon3D name="rupee" size={36} />
                <span className="min-w-0 flex-1 text-[13px] font-semibold leading-tight text-ink-2">
                  Full Monthly Revenue Potential
                </span>
                <span className="shrink-0 text-[16px] font-extrabold font-mono-numbers text-success-ink sm:text-lg">
                  {formatCurrency(totalCalculations.totalMonthlyPotential)}/mo
                </span>
              </div>
            </div>
          </StepCard>

          <div className="flex flex-col-reverse gap-2.5 pt-1 sm:flex-row sm:items-center sm:justify-between">
            <Button variant="outline" onClick={() => setStep(3)} disabled={submitting} className="w-full sm:w-auto">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <Button
              variant="success"
              loading={submitting}
              onClick={handleFinalSubmit}
              className="w-full sm:w-auto"
            >
              {!submitting && <CheckCircle2 className="h-4 w-4" />}
              <span>Create & Generate {totalCalculations.totalBeds} Units</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
