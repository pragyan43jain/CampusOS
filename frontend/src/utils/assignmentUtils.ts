import type { Assignment } from '../types/index.ts';

export const getManualOverrides = (regNo?: string): Record<string, boolean> => {
  if (typeof window === 'undefined') return {};
  try {
    const reg = regNo || window.localStorage.getItem('campus_current_reg_no') || 'default';
    const raw = window.localStorage.getItem(`campus_manual_assignment_status_${reg}`);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

export const setManualOverride = (
  id: string,
  title: string | undefined,
  isDone: boolean,
  regNo?: string
): void => {
  if (typeof window === 'undefined') return;
  try {
    const reg = regNo || window.localStorage.getItem('campus_current_reg_no') || 'default';
    const key = `campus_manual_assignment_status_${reg}`;
    const raw = window.localStorage.getItem(key);
    const overrides = raw ? JSON.parse(raw) : {};
    overrides[id] = isDone;
    if (title) overrides[title] = isDone;
    if (id.startsWith('unified-')) {
      id.replace('unified-', '')
        .split('-')
        .forEach((p) => {
          if (p) overrides[p] = isDone;
        });
    }
    window.localStorage.setItem(key, JSON.stringify(overrides));
  } catch {}
};

/**
 * Robustly checks if an assignment is completed / turned in / submitted.
 * Prioritizes:
 * 1. User manual override for this student session.
 * 2. Explicit boolean flags (`isDone`, `isSubmitted`).
 * 3. Verified submission timestamp (`submittedAt`, `submittedDateTime`).
 * 4. Status string matching any "turned in", "submitted", "done", "completed", "returned", "released", "graded".
 * 5. Teams-specific submission states (`teamsSubmissionState`, `submissionStatus`).
 */
export const isAssignmentDone = (a: Assignment | any, regNo?: string): boolean => {
  if (!a) return false;

  // 1. Check manual localStorage overrides first
  const overrides = getManualOverrides(regNo);
  if (a.id && overrides[a.id] !== undefined) return Boolean(overrides[a.id]);
  if (a.title && overrides[a.title] !== undefined) return Boolean(overrides[a.title]);
  if (a.id && typeof a.id === 'string' && a.id.startsWith('unified-')) {
    const parts = a.id.replace('unified-', '').split('-');
    for (const p of parts) {
      if (p && overrides[p] !== undefined) return Boolean(overrides[p]);
    }
  }

  // 2. Direct boolean flags
  if (a.isDone === true || a.isSubmitted === true) return true;

  // 3. Submitted timestamp exists (unless explicit resubmission is required)
  const reassigned = Boolean(a.reassignedAt || a.reassignedDateTime);
  if (!reassigned) {
    const subAt = a.submittedAt || a.submittedDateTime || (a as any).turnInDateTime;
    if (subAt && typeof subAt === 'string' && subAt.trim() !== '') {
      return true;
    }
  }

  // 4. Status / applicationStatus / displayStatus / teamsSubmissionState / submissionStatus
  const candidateValues = [
    a.status,
    a.displayStatus,
    a.applicationStatus,
    a.teamsSubmissionState,
    a.submissionStatus,
    a.state,
    a.submissionState,
  ];

  for (const raw of candidateValues) {
    if (!raw || typeof raw !== 'string') continue;
    const clean = raw.trim().toUpperCase();
    if (!clean) continue;

    // Explicit completed tokens
    if (
      clean === 'DONE' ||
      clean === 'SUBMITTED' ||
      clean === 'COMPLETED' ||
      clean === 'TURNED IN' ||
      clean === 'TURNEDIN' ||
      clean === 'TURNED_IN' ||
      clean === 'TURNED-IN' ||
      clean === 'RETURNED' ||
      clean === 'RELEASED' ||
      clean === 'GRADED'
    ) {
      return true;
    }

    // Turned in variations (e.g. "TURNED IN LATE", "TURNED IN ON SEP 23")
    if (clean.includes('TURN') && !clean.includes('NOT') && !clean.includes('UNTURN')) {
      return true;
    }

    // Submitted variations (e.g. "SUBMITTED LATE", "SUBMITTED ON TIME")
    if (
      clean.includes('SUBMIT') &&
      !clean.includes('NOT') &&
      !clean.includes('UNSUBMIT') &&
      !clean.includes('RESUBMIT') &&
      !clean.includes('PENDING')
    ) {
      return true;
    }
  }

  return false;
};

/**
 * Extracts normalized epoch timestamp from an assignment for chronological sorting.
 * Supports sortKey, dueDateTime, dueDate (ISO or DD-MM-YYYY), uploadDate, and submittedAt.
 */
export const parseAssignmentDate = (a: any): number => {
  if (!a) return 0;
  if (a.sortKey && typeof a.sortKey === 'string' && !a.sortKey.startsWith('9999')) {
    const t = Date.parse(a.sortKey);
    if (!isNaN(t) && t > 0) return t;
  }
  if (a.dueDateTime && typeof a.dueDateTime === 'string') {
    const t = Date.parse(a.dueDateTime);
    if (!isNaN(t) && t > 0) return t;
  }
  if (a.dueDate && typeof a.dueDate === 'string' && a.dueDate !== 'TBA' && !a.dueDate.toLowerCase().includes('continuous')) {
    const raw = a.dueDate.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
      const timePart = a.dueTime ? `T${a.dueTime}:00` : (raw.includes('T') || raw.includes(' ') ? '' : 'T23:59:59');
      const t = Date.parse(raw.includes(' ') ? raw.replace(' ', 'T') : `${raw}${timePart}`);
      if (!isNaN(t) && t > 0) return t;
    }
    const dmy = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
    if (dmy) {
      const t = Date.parse(`${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}T23:59:59`);
      if (!isNaN(t) && t > 0) return t;
    }
    const t = Date.parse(raw);
    if (!isNaN(t) && t > 0) return t;
  }
  if (a.uploadDate && typeof a.uploadDate === 'string') {
    const t = Date.parse(a.uploadDate);
    if (!isNaN(t) && t > 0) return t;
  }
  if (a.submittedAt && typeof a.submittedAt === 'string') {
    const t = Date.parse(a.submittedAt);
    if (!isNaN(t) && t > 0) return t;
  }
  return 0;
};
