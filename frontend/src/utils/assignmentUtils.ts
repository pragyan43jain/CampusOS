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
 * Checks whether an assignment originates from or links to Microsoft Teams.
 */
export const isTeamsAssignment = (a: Assignment | any): boolean => {
  if (!a) return false;
  const src = String(a.source || '').toUpperCase();
  if (src.includes('TEAMS')) return true;
  if (Array.isArray(a.sourceList) && a.sourceList.some((s: string) => String(s).toUpperCase().includes('TEAMS'))) return true;
  if (typeof a.platformName === 'string' && a.platformName.toUpperCase().includes('TEAMS')) return true;
  if (typeof a.id === 'string' && (a.id.startsWith('teams-') || a.id.includes('-teams-'))) return true;
  if (a.teamsSubmissionState !== undefined || a.teamsCourseId !== undefined || a.matchedTeamName !== undefined) return true;
  return false;
};

/**
 * Robustly checks if an assignment is completed / turned in / submitted.
 * Prioritizes:
 * 1. User manual override for this specific assignment ID.
 * 2. Authentic Microsoft Teams submission state & timestamp:
 *    - If turned in in Teams ('submitted', 'turnedin', 'returned', 'released', valid submittedAt) -> DONE (true)
 *    - If confirmed not submitted in Teams ('working', 'notSubmitted', unsubmitted) -> PENDING (false)
 * 3. Verified submission timestamp (`submittedAt`, `submittedDateTime`).
 * 4. Status string matching "turned in", "submitted", "done", "completed", "returned", "released", "graded".
 * 5. Direct boolean flags (`isDone`, `isSubmitted`).
 */
export const isAssignmentDone = (a: Assignment | any, regNo?: string): boolean => {
  if (!a) return false;

  // 1. Direct explicit user manual override by exact assignment ID
  const overrides = getManualOverrides(regNo);
  if (a.id && overrides[a.id] !== undefined) {
    return Boolean(overrides[a.id]);
  }
  if (a.id && typeof a.id === 'string' && a.id.startsWith('unified-')) {
    const parts = a.id.replace('unified-', '').split('-');
    for (const p of parts) {
      if (p && overrides[p] !== undefined) return Boolean(overrides[p]);
    }
  }

  // 2. Authentic Microsoft Teams submission details check
  const isTeams = isTeamsAssignment(a);
  const rawTeamsState = String(
    a.teamsSubmissionState || a.submissionStatus || a.submissionState || ''
  ).trim().toLowerCase();

  const subAt = a.submittedAt || a.submittedDateTime || (a as any).turnInDateTime;
  const unSubAt = a.unsubmittedAt || a.unsubmittedDateTime;
  const hasValidSubmittedAt = Boolean(
    subAt &&
    typeof subAt === 'string' &&
    subAt.trim() !== '' &&
    (!unSubAt || (Date.parse(unSubAt) < Date.parse(subAt)))
  );

  const reassigned = Boolean(a.reassignedAt || a.reassignedDateTime || rawTeamsState === 'reassigned' || rawTeamsState === 'resubmissionrequired');

  if (isTeams) {
    // If explicit resubmission is required in Teams, it is not done
    if (reassigned) return false;

    // Check confirmed turned-in states in Teams
    const isTeamsTurnedIn =
      rawTeamsState === 'submitted' ||
      rawTeamsState === 'turnedin' ||
      rawTeamsState === 'turned_in' ||
      rawTeamsState === 'turned in' ||
      rawTeamsState === 'turned-in' ||
      rawTeamsState === 'completed' ||
      rawTeamsState === 'released' ||
      rawTeamsState === 'returned' ||
      rawTeamsState === 'graded' ||
      (rawTeamsState.includes('turn') && !rawTeamsState.includes('not') && !rawTeamsState.includes('unturn')) ||
      (rawTeamsState.includes('submit') && !rawTeamsState.includes('not') && !rawTeamsState.includes('unsubmit') && !rawTeamsState.includes('resubmit') && !rawTeamsState.includes('pending')) ||
      hasValidSubmittedAt;

    if (isTeamsTurnedIn) return true;

    // Confirmed unsubmitted in Teams
    if (
      rawTeamsState === 'working' ||
      rawTeamsState === 'notsubmitted' ||
      rawTeamsState === 'not_submitted' ||
      rawTeamsState === 'unsubmitted' ||
      rawTeamsState === 'pending'
    ) {
      return false;
    }
  }

  // 3. Submitted timestamp exists (unless explicit resubmission is required)
  if (!reassigned && hasValidSubmittedAt) {
    return true;
  }

  // 4. Check title override only if no conflicting platform state exists
  if (a.title && overrides[a.title] !== undefined) {
    return Boolean(overrides[a.title]);
  }

  // 5. Direct boolean flags
  if (a.isDone === true || a.isSubmitted === true) return true;

  // 6. Status / applicationStatus / displayStatus
  const candidateValues = [
    a.status,
    a.displayStatus,
    a.applicationStatus,
    a.state,
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

    // Turned in variations
    if (clean.includes('TURN') && !clean.includes('NOT') && !clean.includes('UNTURN')) {
      return true;
    }

    // Submitted variations
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
 * Returns canonical user-facing status label for an assignment.
 */
export const getAssignmentStatusLabel = (a: Assignment | any, regNo?: string): string => {
  const done = isAssignmentDone(a, regNo);
  const isTeams = isTeamsAssignment(a);
  if (done) {
    return isTeams ? 'Turned in' : 'Submitted';
  }
  const isOverdue = Boolean(a?.isOverdue) || String(a?.displayStatus || a?.status || '').toUpperCase() === 'OVERDUE';
  if (isOverdue) return 'Overdue';
  const isDueSoon = Boolean(a?.isDueSoon) || String(a?.displayStatus || a?.status || '').toUpperCase() === 'DUE SOON';
  if (isDueSoon) return 'Due Soon';
  return 'Pending';
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
