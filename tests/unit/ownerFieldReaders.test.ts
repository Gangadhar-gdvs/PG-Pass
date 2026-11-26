import { describe, it, expect } from 'vitest';
import { depositPaidRupees, ownerPlanTier } from '@/lib/utils';
import { PLAN_TIER } from '@/lib/constants/status';

describe('depositPaidRupees', () => {
  it('reads the canonical paise field the server writes', () => {
    expect(depositPaidRupees({ depositPaidPaise: 750000 })).toBe(7500);
  });

  it('prefers paise over the legacy rupee field when both exist', () => {
    expect(depositPaidRupees({ depositPaidPaise: 500000, depositPaid: 9999 })).toBe(5000);
  });

  it('falls back to the legacy rupee field for old docs', () => {
    expect(depositPaidRupees({ depositPaid: 6000 })).toBe(6000);
  });

  it('treats a recorded zero as zero (not as missing)', () => {
    expect(depositPaidRupees({ depositPaidPaise: 0, depositPaid: 6000 })).toBe(0);
  });

  it('is 0 for missing, null, negative or non-finite values', () => {
    expect(depositPaidRupees(null)).toBe(0);
    expect(depositPaidRupees({})).toBe(0);
    expect(depositPaidRupees({ depositPaidPaise: -100 })).toBe(0);
    expect(depositPaidRupees({ depositPaidPaise: Number.NaN })).toBe(0);
  });
});

describe('ownerPlanTier', () => {
  it('reads `plan`, which is what owner creation and upgrade approval write', () => {
    expect(ownerPlanTier({ plan: PLAN_TIER.PRO })).toBe(PLAN_TIER.PRO);
  });

  it('accepts the legacy `planTier` alias', () => {
    expect(ownerPlanTier({ planTier: PLAN_TIER.GROWTH })).toBe(PLAN_TIER.GROWTH);
  });

  it('prefers `plan` when both are present', () => {
    expect(ownerPlanTier({ plan: PLAN_TIER.PRO, planTier: PLAN_TIER.FREE })).toBe(PLAN_TIER.PRO);
  });

  it('falls back to Free for missing or unknown tiers', () => {
    expect(ownerPlanTier(null)).toBe(PLAN_TIER.FREE);
    expect(ownerPlanTier({})).toBe(PLAN_TIER.FREE);
    expect(ownerPlanTier({ plan: 'platinum' })).toBe(PLAN_TIER.FREE);
  });
});
