import { StudentProfile } from '../types';

export interface PlacementEligibilityResult {
  cgpa: number | null;
  cgpaDisplay: string;
  standingArrears: number;
  standingArrearsDisplay: string;
  isEligible: boolean;
  isSuperDreamEligible: boolean;
  isDreamEligible: boolean;
  tier: 'Super Dream' | 'Dream' | 'Core' | 'Unavailable';
  tierDisplay: string;
  ctcRange: string;
  statusText: string;
  variant: 'emerald' | 'cyan' | 'blue' | 'neutral' | 'crimson';
}

/**
 * Single source of truth for institutional placement eligibility.
 * Evaluates verified academic data from VTOP and calculates tier thresholds.
 */
export function calculatePlacementEligibility(
  student?: StudentProfile | null
): PlacementEligibilityResult {
  if (
    !student ||
    student.cgpa === null ||
    student.cgpa === undefined ||
    typeof student.cgpa !== 'number' ||
    isNaN(student.cgpa)
  ) {
    return {
      cgpa: null,
      cgpaDisplay: 'Unavailable',
      standingArrears: 0,
      standingArrearsDisplay: 'Unavailable',
      isEligible: false,
      isSuperDreamEligible: false,
      isDreamEligible: false,
      tier: 'Unavailable',
      tierDisplay: 'VTOP synchronization required',
      ctcRange: 'Requires verified CGPA',
      statusText: 'Sync VTOP profile to calculate eligibility',
      variant: 'neutral',
    };
  }

  const cgpa = Number(student.cgpa);
  const arrears = (student as any).standingArrears ?? (student as any).arrears ?? 0;

  if (arrears > 0) {
    return {
      cgpa,
      cgpaDisplay: cgpa.toFixed(2),
      standingArrears: arrears,
      standingArrearsDisplay: `${arrears} Active Arrear${arrears > 1 ? 's' : ''}`,
      isEligible: false,
      isSuperDreamEligible: false,
      isDreamEligible: false,
      tier: 'Core',
      tierDisplay: 'Arrears Clearance Required',
      ctcRange: 'Clear standing arrears for eligibility',
      statusText: `Standing arrears (${arrears}) restrict Dream/Super Dream eligibility`,
      variant: 'crimson',
    };
  }

  if (cgpa >= 8.0) {
    return {
      cgpa,
      cgpaDisplay: cgpa.toFixed(2),
      standingArrears: 0,
      standingArrearsDisplay: '0 Active Arrears',
      isEligible: true,
      isSuperDreamEligible: true,
      isDreamEligible: true,
      tier: 'Super Dream',
      tierDisplay: 'Super Dream & Dream Tier Eligible',
      ctcRange: 'CTC Range: 10 LPA to 50+ LPA',
      statusText: '✓ Exceeds 8.00 Super Dream cutoff',
      variant: 'emerald',
    };
  }

  if (cgpa >= 7.0) {
    return {
      cgpa,
      cgpaDisplay: cgpa.toFixed(2),
      standingArrears: 0,
      standingArrearsDisplay: '0 Active Arrears',
      isEligible: true,
      isSuperDreamEligible: false,
      isDreamEligible: true,
      tier: 'Dream',
      tierDisplay: 'Dream & Regular Tier Eligible',
      ctcRange: 'CTC Range: 6 LPA to 10 LPA',
      statusText: '✓ Exceeds 7.00 Dream cutoff',
      variant: 'cyan',
    };
  }

  return {
    cgpa,
    cgpaDisplay: cgpa.toFixed(2),
    standingArrears: 0,
    standingArrearsDisplay: '0 Active Arrears',
    isEligible: true,
    isSuperDreamEligible: false,
    isDreamEligible: false,
    tier: 'Core',
    tierDisplay: 'Regular & Core Tier Eligible',
    ctcRange: 'CTC Range: 3.5 LPA to 6 LPA',
    statusText: 'Eligible for Regular & Core drives',
    variant: 'blue',
  };
}
