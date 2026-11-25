'use client';

import React, { useState } from 'react';
import { useOwnerSession } from '@/hooks/useOwner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Building,
  User,
  CreditCard,
  Layers,
  Sparkles,
  Check,
  Plus,
  Minus,
  Utensils,
  Wifi,
  Zap,
  Shirt,
  Shield,
  ArrowUpDown,
  Car,
  Droplet,
  Flame,
  Refrigerator,
  CheckCircle2,
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
import { formatCurrency } from '@/lib/utils';
import { validateUpi, sanitizeText } from '@/lib/security';
import toast from 'react-hot-toast';

interface PropertySetupWizardProps {
  initialOwnerPhone: string;
  existingOwner?: Owner | null;
  onCancel?: () => void;
  onComplete: (ownerData: any) => void;
}

interface FloorPlan {
  floorNumber: number;
  isAcFloor: boolean;
  roomCounts: Record<SharingType, number>;
}

export function PropertySetupWizard({
  initialOwnerPhone,
  existingOwner,
  onCancel,
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

      const updatedOwner = await ownerRes.json();

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
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Setup encountered an error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-3xl bg-white border border-[#E2E8F0] rounded-[14px] shadow-sm overflow-hidden text-left">
        {/* Top Progress Header */}
        <div className="border-b border-[#E2E8F0] p-6 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-[8px] bg-[#D97706] text-white flex items-center justify-center font-bold">
                <Building className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-base font-bold text-[#09090B]">
                  PG Property Setup Wizard
                </h1>
                <p className="text-xs text-[#64748B]">
                  Configure your room sharing formats, pricing, building facilities, and inventory.
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[11px] font-mono font-bold text-[#D97706] uppercase tracking-wider block">
                Step {step} of 4
              </span>
              <span className="text-xs font-semibold text-[#09090B]">
                {step === 1 && 'Property Identity'}
                {step === 2 && 'Building Facilities'}
                {step === 3 && 'Room Formats & Pricing'}
                {step === 4 && 'Floor Layout Matrix'}
              </span>
            </div>
          </div>

          {/* Stepper Dots */}
          <div className="flex items-center gap-2 mt-4">
            {[1, 2, 3, 4].map((s) => (
              <div
                key={s}
                className={`h-1.5 flex-1 rounded-full transition-all ${
                  s <= step ? 'bg-[#D97706]' : 'bg-[#E2E8F0]'
                }`}
              />
            ))}
          </div>
        </div>

        {/* STEP 1: PROPERTY IDENTITY */}
        {step === 1 && (
          <div className="p-6 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="PG / Coliving Property Name"
                placeholder="e.g. Skyline Luxury Coliving"
                value={pgName}
                onChange={(e) => setPgName(e.target.value)}
                required
              />
              <Input
                label="Owner / Property Manager Name"
                placeholder="e.g. Property Manager Name"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                required
              />
            </div>

            <Input
              label="Complete Property Address & Locality"
              placeholder="e.g. Plot 42, Hitech City Main Rd, Madhapur, Hyderabad, 500081"
              value={pgAddress}
              onChange={(e) => setPgAddress(e.target.value)}
            />

            <Input
              label="Direct Rent UPI ID (VPA)"
              placeholder="e.g. payments@bank"
              value={upiId}
              onChange={(e) => setUpiId(e.target.value)}
              helperText="Residents pay directly to this UPI. Zero payment gateway fees."
              required
            />

            {/* PG Category */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#09090B] block">
                Property Category / Guest Policy
              </label>
              <div className="grid grid-cols-3 gap-2.5">
                {[
                  { id: 'gents', label: "Men's PG", desc: 'Gents only accommodation' },
                  { id: 'ladies', label: "Women's PG", desc: 'Ladies only accommodation' },
                  { id: 'coliving', label: 'Unisex Coliving', desc: 'Working professionals / couples' },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setPgCategory(cat.id as PgCategory)}
                    className={`p-3 rounded-[8px] border text-left transition-all cursor-pointer ${
                      pgCategory === cat.id
                        ? 'border-[#D97706] bg-[#FEF3C7]/40 ring-1 ring-[#D97706]'
                        : 'border-[#CBD5E1] bg-white hover:bg-[#F8FAFC]'
                    }`}
                  >
                    <span className="text-xs font-bold text-[#09090B] block">{cat.label}</span>
                    <span className="text-[10px] text-[#64748B] block mt-0.5">{cat.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Food Plan */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#09090B] block">
                Food Facility Included in Rent
              </label>
              <div className="grid grid-cols-3 gap-2.5">
                {[
                  { id: '3_meals', label: '3 Meals Daily', desc: 'Breakfast, Lunch & Dinner' },
                  { id: '2_meals', label: '2 Meals', desc: 'Breakfast & Dinner' },
                  { id: 'no_food', label: 'Without Food', desc: 'Self cooking or external' },
                ].map((fp) => (
                  <button
                    key={fp.id}
                    type="button"
                    onClick={() => setFoodPlan(fp.id as FoodPlan)}
                    className={`p-3 rounded-[8px] border text-left transition-all cursor-pointer ${
                      foodPlan === fp.id
                        ? 'border-[#D97706] bg-[#FEF3C7]/40 ring-1 ring-[#D97706]'
                        : 'border-[#CBD5E1] bg-white hover:bg-[#F8FAFC]'
                    }`}
                  >
                    <span className="text-xs font-bold text-[#09090B] block">{fp.label}</span>
                    <span className="text-[10px] text-[#64748B] block mt-0.5">{fp.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Cuisine & Notice Period */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {foodPlan !== 'no_food' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#09090B] block">Food Style / Menu</label>
                  <select
                    value={foodCuisine}
                    onChange={(e) => setFoodCuisine(e.target.value as FoodCuisine)}
                    className="w-full h-9 rounded-[8px] border border-[#CBD5E1] bg-white px-3 text-xs text-[#09090B] focus:outline-none focus:border-[#D97706]"
                  >
                    <option value="both">North & South Indian Menu</option>
                    <option value="south">South Indian Style</option>
                    <option value="north">North Indian Style</option>
                  </select>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#09090B] block">Move-out Notice Period</label>
                <select
                  value={noticePeriodDays}
                  onChange={(e) => setNoticePeriodDays(Number(e.target.value))}
                  className="w-full h-9 rounded-[8px] border border-[#CBD5E1] bg-white px-3 text-xs text-[#09090B] focus:outline-none focus:border-[#D97706]"
                >
                  <option value={15}>15 Days Notice</option>
                  <option value={30}>30 Days Notice (Standard)</option>
                </select>
              </div>
            </div>

            <div className="pt-4 border-t border-[#E2E8F0] flex justify-end">
              <Button
                variant="solid"
                onClick={() => {
                  if (validateStep1()) setStep(2);
                }}
              >
                Next: Building Facilities →
              </Button>
            </div>
          </div>
        )}

        {/* STEP 2: PG AMENITIES */}
        {step === 2 && (
          <div className="p-6 space-y-5">
            <div>
              <h2 className="text-sm font-bold text-[#09090B]">
                Whole-Building Amenities & Services
              </h2>
              <p className="text-xs text-[#64748B]">
                Select the facilities available to all residents across your property.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {PG_AMENITIES_LIST.map((item) => {
                const isSelected = selectedPgAmenities.includes(item.id);
                return (
                  <div
                    key={item.id}
                    onClick={() => togglePgAmenity(item.id)}
                    className={`p-3 rounded-[8px] border flex items-center justify-between transition-all cursor-pointer select-none ${
                      isSelected
                        ? 'border-[#D97706] bg-[#FEF3C7]/40'
                        : 'border-[#CBD5E1] bg-white hover:bg-[#F8FAFC]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-4 h-4 rounded-[4px] border flex items-center justify-center ${
                          isSelected ? 'bg-[#D97706] border-[#D97706] text-white' : 'border-[#94A3B8]'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                      <span className="text-xs font-medium text-[#09090B]">{item.label}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-4 border-t border-[#E2E8F0] flex items-center justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>
                ← Back
              </Button>
              <Button variant="solid" onClick={() => setStep(3)}>
                Next: Room Formats & Pricing →
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3: SHARING FORMATS & PRICING */}
        {step === 3 && (
          <div className="p-6 space-y-5">
            <div>
              <h2 className="text-sm font-bold text-[#09090B]">
                Room Formats, Capacity & Monthly Pricing
              </h2>
              <p className="text-xs text-[#64748B]">
                Select which sharing options you offer and customize the monthly rent for each.
              </p>
            </div>

            {/* Formats Grid */}
            <div className="space-y-3">
              {SHARING_FORMATS.map((fmt) => {
                const isEnabled = enabledFormats[fmt.sharing];
                return (
                  <div
                    key={fmt.sharing}
                    className={`p-3.5 rounded-[10px] border transition-all ${
                      isEnabled
                        ? 'border-[#D97706] bg-[#FEF3C7]/20 shadow-xs'
                        : 'border-[#CBD5E1] bg-[#F8FAFC] opacity-75'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={isEnabled}
                          onChange={(e) =>
                            setEnabledFormats((prev) => ({
                              ...prev,
                              [fmt.sharing]: e.target.checked,
                            }))
                          }
                          className="mt-1 h-4 w-4 rounded border-[#CBD5E1] text-[#D97706] focus:ring-[#D97706] cursor-pointer"
                        />
                        <div>
                          <span className="text-xs font-bold text-[#09090B] block">
                            {fmt.label} ({fmt.capacity} {fmt.capacity === 1 ? 'Bed' : 'Beds'})
                          </span>
                          <span className="text-[11px] text-[#64748B] block mt-0.5">
                            {fmt.description}
                          </span>
                        </div>
                      </div>

                      {isEnabled && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-[#64748B] font-semibold whitespace-nowrap">
                            Monthly Rent:
                          </span>
                          <div className="relative w-32">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-[#64748B] font-bold">
                              ₹
                            </span>
                            <input
                              type="number"
                              value={rents[fmt.sharing]}
                              placeholder="Enter rent"
                              min={0}
                              onChange={(e) =>
                                setRents((prev) => ({
                                  ...prev,
                                  [fmt.sharing]: e.target.value === '' ? '' : Number(e.target.value),
                                }))
                              }
                              className="w-full h-8.5 pl-6 pr-2 rounded-[6px] border border-[#CBD5E1] text-xs font-mono font-bold text-[#09090B] bg-white focus:outline-none focus:border-[#D97706] placeholder:font-sans placeholder:font-normal placeholder:text-[#94A3B8]"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* AC Surcharge */}
            <div className="p-3.5 bg-white border border-[#CBD5E1] rounded-[10px] flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-[#09090B] block">
                  AC Room Monthly Surcharge
                </span>
                <span className="text-[11px] text-[#64748B] block">
                  Additional rent added automatically when a floor or room has Air Conditioning.
                </span>
              </div>
              <div className="relative w-32">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-[#64748B] font-bold">
                  +₹
                </span>
                <input
                  type="number"
                  value={acSurcharge}
                  placeholder="e.g. 1500"
                  min={0}
                  onChange={(e) =>
                    setAcSurcharge(e.target.value === '' ? '' : Number(e.target.value))
                  }
                  className="w-full h-8.5 pl-8 pr-2 rounded-[6px] border border-[#CBD5E1] text-xs font-mono font-bold text-[#09090B] bg-white focus:outline-none focus:border-[#D97706]"
                />
              </div>
            </div>

            {/* Room Amenities */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-[#09090B] block">
                Standard In-Room Amenities
              </label>
              <div className="flex flex-wrap gap-2">
                {ROOM_AMENITIES_LIST.map((am) => {
                  const isChecked = selectedRoomAmenities.includes(am.id);
                  return (
                    <button
                      key={am.id}
                      type="button"
                      onClick={() => toggleRoomAmenity(am.id)}
                      className={`px-3 py-1.5 rounded-[6px] text-xs font-medium border transition-colors flex items-center gap-1.5 cursor-pointer ${
                        isChecked
                          ? 'border-[#D97706] bg-[#FEF3C7] text-[#92400E] font-bold'
                          : 'border-[#CBD5E1] bg-white text-[#475569] hover:bg-[#F8FAFC]'
                      }`}
                    >
                      {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                      <span>{am.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-4 border-t border-[#E2E8F0] flex items-center justify-between">
              <Button variant="outline" onClick={() => setStep(2)}>
                ← Back
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
              >
                Next: Floor Layout Matrix →
              </Button>
            </div>
          </div>
        )}

        {/* STEP 4: FLOOR LAYOUT MATRIX */}
        {step === 4 && (
          <div className="p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-[#09090B]">
                  Floor-by-Floor Inventory Matrix
                </h2>
                <p className="text-xs text-[#64748B]">
                  Set how many rooms of each format exist on each floor of your building.
                </p>
              </div>

              {/* Total Floors selector */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-[#64748B]">Total Floors:</span>
                <div className="flex items-center border border-[#CBD5E1] rounded-[6px] bg-white">
                  <button
                    type="button"
                    onClick={() => handleFloorsCountChange(totalFloorsCount - 1)}
                    className="p-1.5 hover:bg-[#F1F5F9] text-[#64748B]"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="px-3 font-mono font-bold text-xs text-[#09090B]">
                    {totalFloorsCount}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleFloorsCountChange(totalFloorsCount + 1)}
                    className="p-1.5 hover:bg-[#F1F5F9] text-[#64748B]"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Floor Cards */}
            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
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
                  <div
                    key={fl.floorNumber}
                    className="p-4 rounded-[10px] border border-[#E2E8F0] bg-white space-y-3 shadow-xs"
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-[#E2E8F0]">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-[#09090B] uppercase tracking-wider">
                          Floor {fl.floorNumber}
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-[4px] bg-[#F1F5F9] text-[#475569] font-bold">
                          {floorRoomSum} Rooms · {floorBedSum} Beds
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => toggleFloorAc(fl.floorNumber)}
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-[6px] border transition-colors cursor-pointer flex items-center gap-1 ${
                          fl.isAcFloor
                            ? 'bg-[#E0F2FE] text-[#0369A1] border-[#BAE6FD]'
                            : 'bg-white text-[#64748B] border-[#CBD5E1] hover:bg-[#F8FAFC]'
                        }`}
                      >
                        <Zap className="w-3 h-3" />
                        <span>{fl.isAcFloor ? 'AC Floor (+₹' + (Number(acSurcharge) || 0) + ')' : 'Non-AC'}</span>
                      </button>
                    </div>

                    {/* Room count counters */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                      {activeFormatsList.map((fmt) => {
                        const count = fl.roomCounts[fmt.sharing] || 0;
                        return (
                          <div
                            key={fmt.sharing}
                            className="p-2.5 rounded-[6px] bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-between"
                          >
                            <div>
                              <span className="text-[11px] font-bold text-[#09090B] block">
                                {fmt.label}
                              </span>
                              <span className="text-[10px] text-[#64748B] font-mono">
                                {Number(rents[fmt.sharing]) > 0
                                  ? formatCurrency(
                                      (Number(rents[fmt.sharing]) || 0) +
                                        (fl.isAcFloor ? Number(acSurcharge) || 0 : 0)
                                    )
                                  : 'Set rent'}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => updateRoomCount(fl.floorNumber, fmt.sharing, -1)}
                                className="w-6 h-6 rounded-[4px] bg-white border border-[#CBD5E1] flex items-center justify-center text-[#64748B] hover:bg-[#E2E8F0]"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="w-5 text-center font-mono font-bold text-xs text-[#09090B]">
                                {count}
                              </span>
                              <button
                                type="button"
                                onClick={() => updateRoomCount(fl.floorNumber, fmt.sharing, 1)}
                                className="w-6 h-6 rounded-[4px] bg-white border border-[#CBD5E1] flex items-center justify-center text-[#64748B] hover:bg-[#E2E8F0]"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Live Total HUD */}
            <div className="p-4 rounded-[10px] bg-[#0F172A] text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
              <div className="flex items-center gap-4 text-xs">
                <div>
                  <span className="text-[10px] text-[#94A3B8] uppercase tracking-wider block">
                    Floors
                  </span>
                  <span className="font-mono font-bold text-base">{totalFloorsCount}</span>
                </div>
                <div className="border-l border-slate-700 pl-4">
                  <span className="text-[10px] text-[#94A3B8] uppercase tracking-wider block">
                    Total Rooms
                  </span>
                  <span className="font-mono font-bold text-base">{totalCalculations.totalRooms}</span>
                </div>
                <div className="border-l border-slate-700 pl-4">
                  <span className="text-[10px] text-[#94A3B8] uppercase tracking-wider block">
                    Total Beds
                  </span>
                  <span className="font-mono font-bold text-base text-[#F59E0B]">
                    {totalCalculations.totalBeds} Units
                  </span>
                </div>
              </div>

              <div className="sm:text-right">
                <span className="text-[10px] text-[#94A3B8] uppercase tracking-wider block">
                  Full Monthly Revenue Potential
                </span>
                <span className="font-mono font-extrabold text-base text-[#10B981]">
                  {formatCurrency(totalCalculations.totalMonthlyPotential)}/mo
                </span>
              </div>
            </div>

            <div className="pt-4 border-t border-[#E2E8F0] flex items-center justify-between">
              <Button variant="outline" onClick={() => setStep(3)} disabled={submitting}>
                ← Back
              </Button>
              <Button
                variant="solid"
                loading={submitting}
                onClick={handleFinalSubmit}
                className="bg-[#10B981] hover:bg-[#059669] text-white"
              >
                <CheckCircle2 className="w-4 h-4 mr-1.5" />
                <span>Create & Generate {totalCalculations.totalBeds} Units</span>
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
