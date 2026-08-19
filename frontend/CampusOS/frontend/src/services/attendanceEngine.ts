import { AttendanceStats } from '../types';

/**
 * Calculates academic attendance metrics, including exact safe bunks or required catch-up classes to stay above 75%.
 */
export function calculateAttendance(attended: number, total: number): AttendanceStats {
  if (total <= 0) {
    return {
      attended: 0,
      total: 0,
      percentage: 100,
      safeToMiss: 0,
      needToAttend: 0,
      isCritical: false,
    };
  }

  const percentage = Number(((attended / total) * 100).toFixed(1));
  const isCritical = percentage < 75;

  let safeToMiss = 0;
  let needToAttend = 0;

  if (percentage >= 75) {
    // Formula: (attended) / (total + x) >= 0.75 => attended - 0.75*total >= 0.75*x => x <= (attended - 0.75*total)/0.75
    safeToMiss = Math.max(0, Math.floor((attended - 0.75 * total) / 0.75));
    needToAttend = 0;
  } else {
    // Formula: (attended + y) / (total + y) >= 0.75 => attended + y >= 0.75*total + 0.75*y => 0.25*y >= 0.75*total - attended => y >= (0.75*total - attended)/0.25
    needToAttend = Math.max(1, Math.ceil((0.75 * total - attended) / 0.25));
    safeToMiss = 0;
  }

  return {
    attended,
    total,
    percentage,
    safeToMiss,
    needToAttend,
    isCritical,
  };
}

/**
 * Simulate marking attendance for a specific subject
 */
export function simulateAttendanceChange(
  currentAttended: number,
  currentTotal: number,
  attendedNewClass: boolean
): AttendanceStats {
  const newAttended = attendedNewClass ? currentAttended + 1 : currentAttended;
  const newTotal = currentTotal + 1;
  return calculateAttendance(newAttended, newTotal);
}
