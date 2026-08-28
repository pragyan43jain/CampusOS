import React, { useState, useEffect, useMemo } from 'react';
import { Assignment, SubjectAssignmentGroup, UnifiedAssignmentsDashboard, AcademicAccount } from '../types';
import { CampusAPI } from '../services/api';
import { TeamsLoginModal } from '../components/TeamsLoginModal';
import { LMSLoginModal } from '../components/LMSLoginModal';
import {
  CheckCircle2,
  Clock,
  ExternalLink,
  RefreshCw,
  Unlink,
  FolderSync,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Search,
  Layers,
  Columns3,
  ListFilter,
} from 'lucide-react';

interface AssignmentsViewProps {
  assignments?: Assignment[];
  onToggleStatus: (id: string, currentStatus: 'Pending' | 'Submitted') => void;
  onAssignmentsUpdated?: (newAssignments: Assignment[]) => void;
  studentEmail?: string;
  studentRegNo?: string;
}

interface EnrichedAssignment extends Assignment {
  subject?: string;
  subjectName?: string;
  facultyName?: string;
}

// Sub-component: Reusable Verified Assignment Card
const AssignmentCardItem: React.FC<{
  assignment: EnrichedAssignment;
  onToggle: (id: string, currentlyDone: boolean) => void;
  showSubjectTag?: boolean;
}> = ({ assignment, onToggle, showSubjectTag = true }) => {
  const isSubmitted = Boolean(
    assignment.isDone ||
    (assignment.status || '').toUpperCase() === 'DONE' ||
    (assignment.displayStatus || '').toUpperCase() === 'DONE' ||
    (assignment.status || '').toUpperCase() === 'SUBMITTED' ||
    (assignment.displayStatus || '').toUpperCase() === 'SUBMITTED'
  );
  const isUnavailable =
    (assignment.status || '').toUpperCase() === 'STATUS_UNAVAILABLE' ||
    (assignment.displayStatus || '').toUpperCase() === 'STATUS_UNAVAILABLE';
  const isOverdue = !isSubmitted && !isUnavailable && (assignment.isOverdue || (assignment.displayStatus || '').toUpperCase() === 'OVERDUE');
  const isDueSoon = !isSubmitted && !isUnavailable && !isOverdue && (assignment.isDueSoon || (assignment.displayStatus || '').toUpperCase() === 'DUE SOON');
  const isMerged = (assignment.source as string) === 'Teams + LMS' || ((assignment.sourceList?.length || 0) > 1);

  const subjectCode = assignment.courseCode || '';
  const subjectName = assignment.subject || assignment.subjectName || assignment.courseTitle || subjectCode;
  const faculty = assignment.faculty || assignment.facultyName;

  return (
    <div
      style={{
        background: isSubmitted ? 'rgba(34, 197, 94, 0.03)' : 'var(--bg-surface-elevated)',
        border: `1px solid ${isSubmitted ? 'rgba(34, 197, 94, 0.25)' : isOverdue ? 'rgba(239, 68, 68, 0.35)' : (isDueSoon ? 'rgba(245, 158, 11, 0.35)' : 'var(--border-subtle)')}`,
        borderRadius: 'var(--radius-lg)',
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        transition: 'all 0.2s ease',
        boxShadow: isOverdue ? '0 2px 10px rgba(239, 68, 68, 0.06)' : 'none',
      }}
    >
      {/* 1. Header Row: Subject, Faculty & Platform Badges */}
      {showSubjectTag && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.74rem',
                fontWeight: 900,
                padding: '2px 7px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--brand-bg)',
                color: 'var(--brand-color)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              {subjectCode}
            </span>
            <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              {subjectName}
            </span>
          </div>

          {faculty && (
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Faculty: <b>{faculty}</b>
            </span>
          )}
        </div>
      )}

      {/* 2. Main Content Row: Checkbox, Title & Status */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', flex: 1, minWidth: '220px' }}>
          <input
            type="checkbox"
            role="checkbox"
            aria-checked={isSubmitted}
            aria-label={
              isSubmitted
                ? `Assignment "${assignment.title}" completed in ${assignment.source}`
                : `Assignment "${assignment.title}" pending in ${assignment.source}`
            }
            checked={isSubmitted}
            onChange={() => onToggle(assignment.id, isSubmitted)}
            style={{
              width: '18px',
              height: '18px',
              accentColor: '#22c55e',
              marginTop: '3px',
              cursor: 'pointer',
              flexShrink: 0,
            }}
            title={isSubmitted ? "Completed (click to unmark)" : "Mark as completed"}
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {/* Badges Row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              {/* Source Badge */}
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 800,
                  padding: '2px 7px',
                  borderRadius: 'var(--radius-sm)',
                  background: isMerged
                    ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(2, 132, 199, 0.15) 100%)'
                    : assignment.source === 'Teams'
                    ? 'rgba(99, 102, 241, 0.12)'
                    : 'rgba(2, 132, 199, 0.12)',
                  color: isMerged ? '#4f46e5' : assignment.source === 'Teams' ? '#6366f1' : '#0284c7',
                  border: '1px solid var(--border-subtle)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px',
                }}
              >
                <span>{assignment.source === 'Teams' ? '💜' : assignment.source === 'LMS' ? '🎓' : '💜+🎓'}</span>
                <span>{isSubmitted ? `✓ ${assignment.source}` : assignment.source}</span>
              </span>

              {/* Status Pill */}
              {isSubmitted ? (
                <span style={{ fontSize: '0.7rem', fontWeight: 800, padding: '2px 7px', borderRadius: 'var(--radius-full)', background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', border: '1px solid rgba(34, 197, 94, 0.25)', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                  <CheckCircle2 size={11} />
                  <span>{assignment.isLate ? '✓ DONE (Submitted Late)' : '✓ DONE'}</span>
                </span>
              ) : isUnavailable ? (
                <span style={{ fontSize: '0.7rem', fontWeight: 800, padding: '2px 7px', borderRadius: 'var(--radius-full)', background: 'rgba(156, 163, 175, 0.12)', color: '#9ca3af', border: '1px solid rgba(156, 163, 175, 0.3)', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                  <AlertTriangle size={11} />
                  <span>Status Unavailable</span>
                </span>
              ) : isOverdue ? (
                <span style={{ fontSize: '0.7rem', fontWeight: 800, padding: '2px 7px', borderRadius: 'var(--radius-full)', background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                  <AlertTriangle size={11} />
                  <span>OVERDUE</span>
                </span>
              ) : isDueSoon ? (
                <span style={{ fontSize: '0.7rem', fontWeight: 800, padding: '2px 7px', borderRadius: 'var(--radius-full)', background: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.3)', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                  <span>🔥 Due Soon</span>
                </span>
              ) : (
                <span style={{ fontSize: '0.7rem', fontWeight: 800, padding: '2px 7px', borderRadius: 'var(--radius-full)', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.25)', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                  <Clock size={11} />
                  <span>PENDING</span>
                </span>
              )}

              {/* Relative Deadline Tag */}
              {assignment.relativeDeadline && !isSubmitted && (
                <span
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    color: isOverdue ? '#ef4444' : isDueSoon ? '#f59e0b' : 'var(--text-muted)',
                  }}
                >
                  • {assignment.relativeDeadline}
                </span>
              )}
            </div>

            {/* Title */}
            <h5
              style={{
                fontSize: '0.94rem',
                fontWeight: 800,
                margin: '2px 0 0',
                color: isSubmitted ? 'var(--text-secondary)' : 'var(--text-primary)',
                textDecoration: isSubmitted ? 'line-through' : 'none',
                opacity: isSubmitted ? 0.85 : 1,
                lineHeight: 1.35,
              }}
            >
              {assignment.title}
            </h5>

            {/* Instructions */}
            {assignment.instructions && (
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '3px 0 0', lineHeight: 1.4 }}>
                {assignment.instructions}
              </p>
            )}

            {/* Submission Confirmation Date */}
            {isSubmitted && assignment.submittedAt && (
              <span style={{ fontSize: '0.72rem', color: '#16a34a', fontWeight: 600, marginTop: '2px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <CheckCircle2 size={11} />
                Submitted: {new Date(assignment.submittedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        </div>

        {/* Right Side: Deadline & Direct Platform Action */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0 }}>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>
              {isSubmitted ? 'Completed' : 'Due:'}
            </span>
            <span style={{ fontSize: '0.8rem', fontWeight: 800, color: isSubmitted ? '#22c55e' : isOverdue ? '#ef4444' : 'var(--text-primary)' }}>
              {isSubmitted && assignment.submittedAt
                ? new Date(assignment.submittedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                : (assignment.formattedDeadline || `${assignment.dueDate || 'TBA'}, ${assignment.dueTime || '23:59'}`)}
            </span>
          </div>

          {/* Action Links */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            {isMerged ? (
              <>
                {assignment.teamsSubmissionUrl && (
                  <a
                    href={assignment.teamsSubmissionUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-outline"
                    style={{ fontSize: '0.72rem', padding: '4px 8px', color: '#6366f1', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '3px' }}
                    title="Open assignment in Microsoft Teams"
                  >
                    <span>Teams</span>
                    <ExternalLink size={11} />
                  </a>
                )}
                {assignment.lmsSubmissionUrl && (
                  <a
                    href={assignment.lmsSubmissionUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-outline"
                    style={{ fontSize: '0.72rem', padding: '4px 8px', color: '#0284c7', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '3px' }}
                    title="Open assignment in VIT LMS"
                  >
                    <span>LMS</span>
                    <ExternalLink size={11} />
                  </a>
                )}
              </>
            ) : assignment.platformUrl || assignment.submissionUrl ? (
              <a
                href={assignment.platformUrl || assignment.submissionUrl}
                target="_blank"
                rel="noreferrer"
                className="btn-outline"
                style={{
                  fontSize: '0.72rem',
                  padding: '4px 9px',
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px',
                  color: assignment.source === 'Teams' ? '#6366f1' : '#0284c7',
                }}
              >
                <span>{assignment.source === 'Teams' ? 'Open in Teams' : 'Open in LMS'}</span>
                <ExternalLink size={11} />
              </a>
            ) : (
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                Link unavailable
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export const AssignmentsView: React.FC<AssignmentsViewProps> = ({
  assignments: _assignments,
  onToggleStatus,
  onAssignmentsUpdated,
  studentEmail,
  studentRegNo,
}) => {
  // Modals
  const [isTeamsModalOpen, setIsTeamsModalOpen] = useState(false);
  const [isLMSModalOpen, setIsLMSModalOpen] = useState(false);

  // Accounts & Dashboard State
  const [dashboard, setDashboard] = useState<UnifiedAssignmentsDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncingTeams, setSyncingTeams] = useState(false);
  const [syncingLMS, setSyncingLMS] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  // View Mode: Two-Column (Completed vs Pending) vs Subject-Grouped View (Section 34)
  const [viewMode, setViewMode] = useState<'COLUMNS' | 'SUBJECTS'>('COLUMNS');

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'COMPLETED' | 'OVERDUE'>('ALL');
  const [sourceFilter, setSourceFilter] = useState<'ALL' | 'TEAMS' | 'LMS' | 'BOTH'>('ALL');

  // Accordion state for Subjects View
  const [expandedSubjects, setExpandedSubjects] = useState<Record<string, boolean>>({});

  // Fetch unified dashboard from backend
  const loadUnifiedData = async () => {
    try {
      setLoading(true);
      setSyncError(null);
      const data = await CampusAPI.getUnifiedAssignments();
      setDashboard(data);

      const initialOpen: Record<string, boolean> = {};
      data.subjects.forEach((s: SubjectAssignmentGroup) => {
        if (s.assignments && s.assignments.length > 0) {
          initialOpen[s.courseCode] = true;
        }
      });
      setExpandedSubjects((prev) => (Object.keys(prev).length > 0 ? { ...initialOpen, ...prev } : initialOpen));

      if (onAssignmentsUpdated && data.subjects) {
        const flatList: Assignment[] = [];
        data.subjects.forEach((s: SubjectAssignmentGroup) => flatList.push(...s.assignments));
        if (flatList.length > 0) {
          onAssignmentsUpdated(flatList);
        }
      }
    } catch (err: any) {
      console.error('Failed to load unified assignments:', err);
      setSyncError('Could not retrieve latest assignment data. Cached records remain visible.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUnifiedData();
  }, []);

  const toggleSubjectExpand = (courseCode: string) => {
    setExpandedSubjects((prev) => ({
      ...prev,
      [courseCode]: !prev[courseCode],
    }));
  };

  const handleRefreshAll = async () => {
    setSyncingAll(true);
    setSyncError(null);
    try {
      const res = await CampusAPI.syncAllAcademicAccounts();
      if (res.dashboard) {
        setDashboard(res.dashboard);
        if (onAssignmentsUpdated && res.dashboard.subjects) {
          const flatList: Assignment[] = [];
          res.dashboard.subjects.forEach((s: SubjectAssignmentGroup) => flatList.push(...s.assignments));
          onAssignmentsUpdated(flatList);
        }
      } else {
        await loadUnifiedData();
      }
    } catch (err: any) {
      setSyncError(err.message || 'Failed to refresh academic platforms.');
    } finally {
      setSyncingAll(false);
    }
  };

  const handleToggleAssignmentStatus = async (id: string, currentlyDone: boolean) => {
    const nextStatus = currentlyDone ? 'Pending' : 'Submitted';
    const nextAppStatus = currentlyDone ? 'PENDING' : 'DONE';

    // Optimistically update local dashboard state
    setDashboard((prev) => {
      if (!prev) return prev;
      const newSubjects = prev.subjects.map((sub) => {
        let changed = false;
        const newAssignments = sub.assignments.map((a) => {
          if (a.id === id) {
            changed = true;
            return {
              ...a,
              status: nextAppStatus as any,
              applicationStatus: nextAppStatus as any,
              displayStatus: nextAppStatus,
              isDone: !currentlyDone,
              isSubmitted: !currentlyDone,
              isOverdue: false,
              isDueSoon: false,
            };
          }
          return a;
        });
        if (!changed) return sub;
        const pCount = newAssignments.filter((a) => (a.displayStatus || a.status) !== 'DONE' && (a.displayStatus || a.status) !== 'Submitted').length;
        const sCount = newAssignments.filter((a) => (a.displayStatus || a.status) === 'DONE' || (a.displayStatus || a.status) === 'Submitted').length;
        return {
          ...sub,
          assignments: newAssignments,
          pendingCount: pCount,
          submittedCount: sCount,
        };
      });
      return {
        ...prev,
        subjects: newSubjects,
        totalPendingAssignments: newSubjects.reduce((acc, s) => acc + s.pendingCount, 0),
        totalSubmittedAssignments: newSubjects.reduce((acc, s) => acc + s.submittedCount, 0),
      };
    });

    try {
      onToggleStatus(id, nextStatus as 'Pending' | 'Submitted');
    } catch {
      // Handled
    }
  };

  const handleSyncTeams = async () => {
    setSyncingTeams(true);
    try {
      await CampusAPI.syncTeams();
      await loadUnifiedData();
    } catch {
      setSyncError('Failed to refresh Microsoft Teams.');
    } finally {
      setSyncingTeams(false);
    }
  };

  const handleDisconnectTeams = async () => {
    if (window.confirm('Are you sure you want to disconnect Microsoft Teams?')) {
      try {
        await CampusAPI.disconnectTeams();
        await loadUnifiedData();
      } catch (err) {
        console.error('Failed to disconnect Teams:', err);
      }
    }
  };

  const handleSyncLMS = async () => {
    setSyncingLMS(true);
    try {
      await CampusAPI.syncLMS();
      await loadUnifiedData();
    } catch {
      setSyncError('Failed to refresh VIT LMS.');
    } finally {
      setSyncingLMS(false);
    }
  };

  const handleDisconnectLMS = async () => {
    if (window.confirm('Are you sure you want to disconnect VIT LMS?')) {
      try {
        await CampusAPI.disconnectLMS();
        await loadUnifiedData();
      } catch (err) {
        console.error('Failed to disconnect LMS:', err);
      }
    }
  };

  // 1. Flattened verified assignments across all subjects
  const allVerifiedAssignments: EnrichedAssignment[] = useMemo(() => {
    if (!dashboard?.subjects) return [];
    const list: EnrichedAssignment[] = [];
    dashboard.subjects.forEach((sub) => {
      (sub.assignments || []).forEach((a) => {
        list.push({
          ...a,
          courseCode: a.courseCode || sub.courseCode,
          subject: a.subject || a.courseTitle || sub.courseTitle,
          subjectName: sub.courseTitle,
          faculty: a.faculty || sub.faculty,
          facultyName: sub.faculty,
        });
      });
    });
    return list;
  }, [dashboard]);

  // 2. Filtered verified assignments (Search + Platform Source Filter)
  const filteredAssignments = useMemo(() => {
    return allVerifiedAssignments.filter((a) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        (a.courseCode && a.courseCode.toLowerCase().includes(q)) ||
        (a.subject && a.subject.toLowerCase().includes(q)) ||
        (a.faculty && a.faculty.toLowerCase().includes(q)) ||
        (a.title && a.title.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      if (sourceFilter === 'TEAMS' && a.source !== 'Teams' && !a.sourceList?.includes('Teams')) return false;
      if (sourceFilter === 'LMS' && a.source !== 'LMS' && !a.sourceList?.includes('LMS')) return false;
      if (sourceFilter === 'BOTH' && a.source !== 'Teams + LMS' && (a.sourceList?.length || 0) < 2) return false;

      return true;
    });
  }, [allVerifiedAssignments, searchQuery, sourceFilter]);

  // 3. Two Primary Columns: COMPLETED (Section 35) and PENDING (Section 36)
  const completedColumnAssignments = useMemo(() => {
    const list = filteredAssignments.filter((a) =>
      Boolean(
        a.isDone ||
        (a.status || '').toUpperCase() === 'DONE' ||
        (a.displayStatus || '').toUpperCase() === 'DONE' ||
        (a.status || '').toUpperCase() === 'SUBMITTED' ||
        (a.displayStatus || '').toUpperCase() === 'SUBMITTED'
      )
    );
    // Sort completed: newest submitted first
    return list.sort((x, y) => {
      const xTime = x.submittedAt ? new Date(x.submittedAt).getTime() : 0;
      const yTime = y.submittedAt ? new Date(y.submittedAt).getTime() : 0;
      return yTime - xTime;
    });
  }, [filteredAssignments]);

  const pendingColumnAssignments = useMemo(() => {
    const list = filteredAssignments.filter((a) =>
      !Boolean(
        a.isDone ||
        (a.status || '').toUpperCase() === 'DONE' ||
        (a.displayStatus || '').toUpperCase() === 'DONE' ||
        (a.status || '').toUpperCase() === 'SUBMITTED' ||
        (a.displayStatus || '').toUpperCase() === 'SUBMITTED'
      )
    );
    // Sort pending: Overdue first, then nearest deadline
    return list.sort((x, y) => {
      const xOverdue = Boolean(x.isOverdue || (x.displayStatus || '').toUpperCase() === 'OVERDUE');
      const yOverdue = Boolean(y.isOverdue || (y.displayStatus || '').toUpperCase() === 'OVERDUE');
      if (xOverdue && !yOverdue) return -1;
      if (!xOverdue && yOverdue) return 1;
      return (x.dueDate || '').localeCompare(y.dueDate || '');
    });
  }, [filteredAssignments]);

  // 4. Filtered Subjects for Subject Grouped View
  const filteredSubjects = useMemo(() => {
    if (!dashboard) return [];
    return dashboard.subjects.filter((sub) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        sub.courseCode.toLowerCase().includes(q) ||
        sub.courseTitle.toLowerCase().includes(q) ||
        (sub.faculty && sub.faculty.toLowerCase().includes(q)) ||
        sub.assignments.some((a) => a.title.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      if (statusFilter === 'PENDING' && sub.pendingCount === 0) return false;
      if (statusFilter === 'COMPLETED' && sub.submittedCount === 0) return false;
      if (statusFilter === 'OVERDUE' && sub.overdueCount === 0) return false;

      if (sourceFilter === 'TEAMS' && !sub.teamsMatched) return false;
      if (sourceFilter === 'LMS' && !sub.lmsMatched) return false;
      if (sourceFilter === 'BOTH' && (!sub.teamsMatched || !sub.lmsMatched)) return false;

      return true;
    });
  }, [dashboard, searchQuery, statusFilter, sourceFilter]);

  const teamsAccount: AcademicAccount = dashboard?.connectedAccounts?.teams || { connected: false };
  const lmsAccount: AcademicAccount = dashboard?.connectedAccounts?.lms || { connected: false };
  const isAnyAccountConnected = teamsAccount.connected || lmsAccount.connected;
  const currentSemName = dashboard?.currentSemester?.name || 'Fall Semester 2026-27';

  // Counts calculated directly from verified dataset (Section 39)
  const totalVerifiedCount = allVerifiedAssignments.length;
  const totalCompletedCount = allVerifiedAssignments.filter(
    (a) => a.isDone || (a.status || '').toUpperCase() === 'DONE' || (a.displayStatus || '').toUpperCase() === 'DONE'
  ).length;
  const totalPendingCount = allVerifiedAssignments.filter(
    (a) => !a.isDone && (a.status || '').toUpperCase() !== 'DONE' && (a.displayStatus || '').toUpperCase() !== 'DONE'
  ).length;
  const totalOverdueCount = allVerifiedAssignments.filter(
    (a) => !a.isDone && (a.isOverdue || (a.displayStatus || '').toUpperCase() === 'OVERDUE')
  ).length;

  if (loading && !dashboard) {
    return (
      <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
        <RefreshCw size={28} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 14px', display: 'block' }} />
        <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
          Loading Academic Assignments...
        </h4>
        <p style={{ fontSize: '0.84rem', margin: '4px 0 0' }}>
          Aggregating verified coursework from Microsoft Teams & VIT LMS
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* 1. Header & Platform Connections Banner */}
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-medium)',
          borderRadius: 'var(--radius-xl)',
          padding: '24px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '18px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 style={{ fontSize: '1.45rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Layers size={24} color="var(--brand-color)" />
                <span>Academic Assignment Dashboard</span>
              </h2>
              <span
                style={{
                  background: 'var(--brand-bg)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--brand-color)',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  padding: '3px 10px',
                  borderRadius: 'var(--radius-full)',
                }}
              >
                📅 {currentSemName}
              </span>
            </div>
            <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', marginTop: '5px', margin: 0 }}>
              Complete verified task inboxes from <b>Microsoft Teams</b> and <b>VIT LMS</b>.
            </p>
          </div>

          {/* Global Refresh Button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {dashboard?.lastSynced && (
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Last synchronized: <b>{new Date(dashboard.lastSynced).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</b>
              </span>
            )}
            <button
              onClick={handleRefreshAll}
              disabled={syncingAll || !isAnyAccountConnected}
              className="btn-outline"
              style={{
                fontSize: '0.84rem',
                fontWeight: 700,
                padding: '8px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '7px',
              }}
              title="Refresh assignments across Teams & LMS"
            >
              <RefreshCw size={15} style={{ animation: syncingAll ? 'spin 1s linear infinite' : 'none' }} />
              <span>{syncingAll ? 'Refreshing All...' : 'Refresh Assignments'}</span>
            </button>
          </div>
        </div>

        {/* Sync Error Banner if any */}
        {syncError && (
          <div
            style={{
              padding: '12px 16px',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: 'var(--radius-md)',
              color: '#ef4444',
              fontSize: '0.84rem',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={17} />
              <span>{syncError}</span>
            </div>
            <button onClick={handleRefreshAll} style={{ background: 'none', border: 'none', color: '#ef4444', fontWeight: 800, cursor: 'pointer', textDecoration: 'underline' }}>
              Try Again
            </button>
          </div>
        )}

        {/* Dedicated Connected Academic Platform Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
          {/* Card 1: Microsoft Teams */}
          <div
            style={{
              background: 'var(--bg-surface-elevated)',
              border: `1px solid ${teamsAccount.connected ? 'rgba(99, 102, 241, 0.3)' : 'var(--border-subtle)'}`,
              borderRadius: 'var(--radius-lg)',
              padding: '16px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.2rem',
                    flexShrink: 0,
                  }}
                >
                  💜
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h4 style={{ fontSize: '0.98rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                      Microsoft Teams
                    </h4>
                    {teamsAccount.connected ? (
                      <span style={{ fontSize: '0.7rem', fontWeight: 800, padding: '2px 7px', borderRadius: 'var(--radius-full)', background: 'var(--success-bg)', color: 'var(--success-emerald)', border: '1px solid var(--success-border)' }}>
                        ✓ Connected
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.7rem', fontWeight: 800, padding: '2px 7px', borderRadius: 'var(--radius-full)', background: 'var(--bg-surface)', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}>
                        ✕ Not Connected
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                    {teamsAccount.connected ? (
                      <span>{teamsAccount.email} • <b>{teamsAccount.matchedCount || 0} subjects verified</b></span>
                    ) : (
                      <span>Sign in with university Microsoft account</span>
                    )}
                  </p>
                </div>
              </div>

              <a
                href="https://www.microsoft.com/en-in/microsoft-teams/log-in"
                target="_blank"
                rel="noreferrer"
                style={{ color: 'var(--text-muted)', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '3px', textDecoration: 'none' }}
                title="Open official Microsoft Teams portal"
              >
                <span>Portal</span>
                <ExternalLink size={11} />
              </a>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              {teamsAccount.connected ? (
                <>
                  <button
                    onClick={handleSyncTeams}
                    disabled={syncingTeams}
                    className="btn-outline"
                    style={{ fontSize: '0.78rem', padding: '5px 10px' }}
                  >
                    <RefreshCw size={13} style={{ animation: syncingTeams ? 'spin 1s linear infinite' : 'none' }} />
                    <span>{syncingTeams ? 'Syncing...' : 'Re-sync'}</span>
                  </button>
                  <button
                    onClick={handleDisconnectTeams}
                    className="btn-outline"
                    style={{ fontSize: '0.78rem', padding: '5px 10px', color: 'var(--danger-crimson)' }}
                  >
                    <Unlink size={13} />
                    <span>Unlink</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setIsTeamsModalOpen(true)}
                  className="btn-primary"
                  style={{
                    fontSize: '0.8rem',
                    padding: '7px 14px',
                    background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                    border: 'none',
                    fontWeight: 800,
                  }}
                >
                  Connect Microsoft Teams
                </button>
              )}
            </div>
          </div>

          {/* Card 2: VIT LMS */}
          <div
            style={{
              background: 'var(--bg-surface-elevated)',
              border: `1px solid ${lmsAccount.connected ? 'rgba(2, 132, 199, 0.3)' : 'var(--border-subtle)'}`,
              borderRadius: 'var(--radius-lg)',
              padding: '16px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.2rem',
                    flexShrink: 0,
                  }}
                >
                  🎓
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h4 style={{ fontSize: '0.98rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                      VIT LMS (Moodle)
                    </h4>
                    {lmsAccount.connected ? (
                      <span style={{ fontSize: '0.7rem', fontWeight: 800, padding: '2px 7px', borderRadius: 'var(--radius-full)', background: 'var(--success-bg)', color: 'var(--success-emerald)', border: '1px solid var(--success-border)' }}>
                        ✓ Connected
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.7rem', fontWeight: 800, padding: '2px 7px', borderRadius: 'var(--radius-full)', background: 'var(--bg-surface)', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}>
                        ✕ Not Connected
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                    {lmsAccount.connected ? (
                      <span>{lmsAccount.username || lmsAccount.displayName} • <b>{lmsAccount.matchedCount || 0} subjects verified</b></span>
                    ) : (
                      <span>Connect with LMS credentials or session cookie</span>
                    )}
                  </p>
                </div>
              </div>

              <a
                href="https://lms.vit.ac.in"
                target="_blank"
                rel="noreferrer"
                style={{ color: 'var(--text-muted)', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '3px', textDecoration: 'none' }}
                title="Open official VIT LMS portal"
              >
                <span>Portal</span>
                <ExternalLink size={11} />
              </a>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              {lmsAccount.connected ? (
                <>
                  <button
                    onClick={handleSyncLMS}
                    disabled={syncingLMS}
                    className="btn-outline"
                    style={{ fontSize: '0.78rem', padding: '5px 10px' }}
                  >
                    <RefreshCw size={13} style={{ animation: syncingLMS ? 'spin 1s linear infinite' : 'none' }} />
                    <span>{syncingLMS ? 'Syncing...' : 'Re-sync'}</span>
                  </button>
                  <button
                    onClick={handleDisconnectLMS}
                    className="btn-outline"
                    style={{ fontSize: '0.78rem', padding: '5px 10px', color: 'var(--danger-crimson)' }}
                  >
                    <Unlink size={13} />
                    <span>Unlink</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setIsLMSModalOpen(true)}
                  className="btn-primary"
                  style={{
                    fontSize: '0.8rem',
                    padding: '7px 14px',
                    background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                    border: 'none',
                    fontWeight: 800,
                  }}
                >
                  Connect VIT LMS
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Metrics Summary Strip: Section 39 Requirement */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
          gap: '12px',
        }}
      >
        {/* Metric 1: Total Verified */}
        <div
          onClick={() => setStatusFilter('ALL')}
          style={{
            background: 'var(--bg-surface)',
            border: `1px solid ${statusFilter === 'ALL' ? 'var(--brand-color)' : 'var(--border-subtle)'}`,
            borderRadius: 'var(--radius-lg)',
            padding: '14px 18px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 700, display: 'block' }}>
            Total Verified
          </span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
            <span style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--text-primary)' }}>
              {totalVerifiedCount}
            </span>
            <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>assignments</span>
          </div>
        </div>

        {/* Metric 2: Completed / DONE */}
        <div
          onClick={() => setStatusFilter('COMPLETED')}
          style={{
            background: 'var(--bg-surface)',
            border: `1px solid ${statusFilter === 'COMPLETED' ? '#22c55e' : 'var(--border-subtle)'}`,
            borderRadius: 'var(--radius-lg)',
            padding: '14px 18px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          <span style={{ fontSize: '0.76rem', color: '#22c55e', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
            <CheckCircle2 size={13} />
            Completed
          </span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
            <span style={{ fontSize: '1.6rem', fontWeight: 900, color: '#22c55e' }}>
              {totalCompletedCount}
            </span>
            <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>submitted</span>
          </div>
        </div>

        {/* Metric 3: Pending */}
        <div
          onClick={() => setStatusFilter('PENDING')}
          style={{
            background: 'var(--bg-surface)',
            border: `1px solid ${statusFilter === 'PENDING' ? '#f59e0b' : 'var(--border-subtle)'}`,
            borderRadius: 'var(--radius-lg)',
            padding: '14px 18px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          <span style={{ fontSize: '0.76rem', color: '#f59e0b', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Clock size={13} />
            Pending
          </span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
            <span style={{ fontSize: '1.6rem', fontWeight: 900, color: '#f59e0b' }}>
              {totalPendingCount}
            </span>
            <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>in progress</span>
          </div>
        </div>

        {/* Metric 4: Overdue */}
        <div
          onClick={() => setStatusFilter('OVERDUE')}
          style={{
            background: 'var(--bg-surface)',
            border: `1px solid ${statusFilter === 'OVERDUE' ? '#ef4444' : 'var(--border-subtle)'}`,
            borderRadius: 'var(--radius-lg)',
            padding: '14px 18px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          <span style={{ fontSize: '0.76rem', color: '#ef4444', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
            <AlertTriangle size={13} />
            Overdue
          </span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
            <span style={{ fontSize: '1.6rem', fontWeight: 900, color: '#ef4444' }}>
              {totalOverdueCount}
            </span>
            <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>action needed</span>
          </div>
        </div>
      </div>

      {/* 3. Toolbar: View Mode Toggle, Search & Platform Filters */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '14px',
        }}
      >
        {/* Left: View Mode Toggle (Two Primary Columns vs By Subject) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ display: 'flex', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '2px' }}>
            <button
              onClick={() => setViewMode('COLUMNS')}
              style={{
                border: 'none',
                padding: '6px 12px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.8rem',
                fontWeight: viewMode === 'COLUMNS' ? 800 : 600,
                background: viewMode === 'COLUMNS' ? 'var(--brand-color)' : 'transparent',
                color: viewMode === 'COLUMNS' ? '#ffffff' : 'var(--text-secondary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Columns3 size={14} />
              <span>Two Columns ({totalPendingCount} Pending / {totalCompletedCount} Done)</span>
            </button>
            <button
              onClick={() => setViewMode('SUBJECTS')}
              style={{
                border: 'none',
                padding: '6px 12px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.8rem',
                fontWeight: viewMode === 'SUBJECTS' ? 800 : 600,
                background: viewMode === 'SUBJECTS' ? 'var(--brand-color)' : 'transparent',
                color: viewMode === 'SUBJECTS' ? '#ffffff' : 'var(--text-secondary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <ListFilter size={14} />
              <span>By Subject ({dashboard?.subjects?.length || 0})</span>
            </button>
          </div>
        </div>

        {/* Right: Search & Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Search Bar */}
          <div style={{ position: 'relative', width: '260px', maxWidth: '100%' }}>
            <Search size={15} style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search code, title, professor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '7px 10px 7px 34px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-medium)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)',
                fontSize: '0.82rem',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Platform Source Filter */}
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value as any)}
            style={{
              padding: '6px 10px',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-medium)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-primary)',
              fontSize: '0.78rem',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="ALL">All Platforms</option>
            <option value="TEAMS">Microsoft Teams</option>
            <option value="LMS">VIT LMS</option>
            <option value="BOTH">Both Teams & LMS</option>
          </select>
        </div>
      </div>

      {/* 4. Empty State: No Accounts Linked Yet */}
      {!isAnyAccountConnected && (
        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px dashed var(--border-medium)',
            borderRadius: 'var(--radius-xl)',
            padding: '48px 24px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '14px',
          }}
        >
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '16px',
              background: 'var(--brand-bg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.8rem',
            }}
          >
            📬
          </div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
            Assignments haven't been synchronized yet
          </h3>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', maxWidth: '480px', margin: 0, lineHeight: 1.5 }}>
            Connect your <b>Microsoft Teams</b> and <b>VIT LMS</b> accounts above to automatically aggregate coursework, submission deadlines, and direct submission links for <b>{currentSemName}</b>.
          </p>
          <div style={{ display: 'flex', gap: '12px', marginTop: '6px' }}>
            <button
              onClick={() => setIsTeamsModalOpen(true)}
              className="btn-primary"
              style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)', border: 'none', fontWeight: 800, padding: '10px 18px', fontSize: '0.85rem' }}
            >
              💜 Connect Microsoft Teams
            </button>
            <button
              onClick={() => setIsLMSModalOpen(true)}
              className="btn-primary"
              style={{ background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)', border: 'none', fontWeight: 800, padding: '10px 18px', fontSize: '0.85rem' }}
            >
              🎓 Connect VIT LMS
            </button>
          </div>
        </div>
      )}

      {/* 5. PRIMARY INTERFACE MODE 1: TWO COLUMNS (COMPLETED & PENDING) (Section 34, 35, 36) */}
      {isAnyAccountConnected && viewMode === 'COLUMNS' && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
            gap: '20px',
            alignItems: 'start',
          }}
        >
          {/* COLUMN 1: PENDING (Section 36) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Column Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 16px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-medium)',
                borderRadius: 'var(--radius-lg)',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={18} color="#f59e0b" />
                <h3 style={{ fontSize: '1.05rem', fontWeight: 900, margin: 0, color: 'var(--text-primary)' }}>
                  PENDING
                </h3>
                <span
                  style={{
                    fontSize: '0.78rem',
                    fontWeight: 900,
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-full)',
                    background: 'rgba(245, 158, 11, 0.12)',
                    color: '#f59e0b',
                    border: '1px solid rgba(245, 158, 11, 0.25)',
                  }}
                >
                  {pendingColumnAssignments.length}
                </span>
              </div>

              {pendingColumnAssignments.some((a) => a.isOverdue || (a.displayStatus || '').toUpperCase() === 'OVERDUE') && (
                <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#ef4444', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <AlertTriangle size={13} />
                  <span>{pendingColumnAssignments.filter((a) => a.isOverdue || (a.displayStatus || '').toUpperCase() === 'OVERDUE').length} Overdue</span>
                </span>
              )}
            </div>

            {/* Column List */}
            {pendingColumnAssignments.length > 0 ? (
              pendingColumnAssignments.map((assignment) => (
                <AssignmentCardItem
                  key={assignment.id}
                  assignment={assignment}
                  onToggle={handleToggleAssignmentStatus}
                  showSubjectTag={true}
                />
              ))
            ) : (
              <div
                style={{
                  padding: '36px 20px',
                  textAlign: 'center',
                  background: 'var(--bg-surface)',
                  border: '1px dashed var(--border-subtle)',
                  borderRadius: 'var(--radius-lg)',
                  color: 'var(--text-muted)',
                }}
              >
                <CheckCircle2 size={32} color="#22c55e" style={{ margin: '0 auto 10px' }} />
                <h5 style={{ fontSize: '0.98rem', fontWeight: 800, margin: '0 0 4px', color: 'var(--text-primary)' }}>
                  PENDING (0)
                </h5>
                <p style={{ fontSize: '0.84rem', margin: 0 }}>
                  No pending assignments. You are caught up across all enrolled subjects!
                </p>
              </div>
            )}
          </div>

          {/* COLUMN 2: COMPLETED (Section 35) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Column Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 16px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-medium)',
                borderRadius: 'var(--radius-lg)',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={18} color="#22c55e" />
                <h3 style={{ fontSize: '1.05rem', fontWeight: 900, margin: 0, color: 'var(--text-primary)' }}>
                  COMPLETED
                </h3>
                <span
                  style={{
                    fontSize: '0.78rem',
                    fontWeight: 900,
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-full)',
                    background: 'rgba(34, 197, 94, 0.12)',
                    color: '#22c55e',
                    border: '1px solid rgba(34, 197, 94, 0.25)',
                  }}
                >
                  {completedColumnAssignments.length}
                </span>
              </div>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                All verified submissions
              </span>
            </div>

            {/* Column List */}
            {completedColumnAssignments.length > 0 ? (
              completedColumnAssignments.map((assignment) => (
                <AssignmentCardItem
                  key={assignment.id}
                  assignment={assignment}
                  onToggle={handleToggleAssignmentStatus}
                  showSubjectTag={true}
                />
              ))
            ) : (
              <div
                style={{
                  padding: '36px 20px',
                  textAlign: 'center',
                  background: 'var(--bg-surface)',
                  border: '1px dashed var(--border-subtle)',
                  borderRadius: 'var(--radius-lg)',
                  color: 'var(--text-muted)',
                }}
              >
                <Clock size={32} color="var(--text-muted)" style={{ margin: '0 auto 10px' }} />
                <h5 style={{ fontSize: '0.98rem', fontWeight: 800, margin: '0 0 4px', color: 'var(--text-primary)' }}>
                  COMPLETED (0)
                </h5>
                <p style={{ fontSize: '0.84rem', margin: 0 }}>
                  No completed assignments yet.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 6. PRIMARY INTERFACE MODE 2: BY SUBJECT ACCORDION */}
      {isAnyAccountConnected && viewMode === 'SUBJECTS' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {filteredSubjects.length > 0 ? (
            filteredSubjects.map((subject: SubjectAssignmentGroup) => {
              const isExpanded = !!expandedSubjects[subject.courseCode];
              const hasPending = subject.pendingCount > 0;
              const hasOverdue = subject.overdueCount > 0;

              return (
                <div
                  key={subject.courseCode}
                  style={{
                    background: 'var(--bg-surface)',
                    border: `1px solid ${hasOverdue ? 'rgba(239, 68, 68, 0.35)' : (hasPending ? 'var(--border-medium)' : 'var(--border-subtle)')}`,
                    borderRadius: 'var(--radius-lg)',
                    overflow: 'hidden',
                    transition: 'box-shadow 0.2s ease',
                    boxShadow: hasOverdue ? '0 4px 16px rgba(239, 68, 68, 0.08)' : '0 2px 8px rgba(0, 0, 0, 0.08)',
                  }}
                >
                  {/* Subject Header Card */}
                  <div
                    onClick={() => toggleSubjectExpand(subject.courseCode)}
                    style={{
                      padding: '16px 20px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      cursor: 'pointer',
                      userSelect: 'none',
                      background: isExpanded ? 'var(--bg-surface-elevated)' : 'transparent',
                      borderBottom: isExpanded ? '1px solid var(--border-subtle)' : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      {/* Course Code Badge */}
                      <div
                        style={{
                          padding: '6px 12px',
                          background: 'var(--brand-bg)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 'var(--radius-md)',
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.88rem',
                          fontWeight: 900,
                          color: 'var(--brand-color)',
                          minWidth: '85px',
                          textAlign: 'center',
                        }}
                      >
                        {subject.courseCode}
                      </div>

                      <div>
                        {/* Subject Name */}
                        <h4 style={{ fontSize: '1.08rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                          {subject.courseTitle}
                        </h4>
                        {/* Faculty / Slot metadata */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '3px', flexWrap: 'wrap' }}>
                          {subject.faculty && (
                            <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                              Faculty: <b>{subject.faculty}</b>
                            </span>
                          )}
                          {subject.slot && (
                            <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                              • Slot: <b>{subject.slot}</b>
                            </span>
                          )}
                          {subject.type && (
                            <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                              • <b>{subject.type}</b>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right side badges & toggle */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      {/* Platform Badges */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        {subject.teamsMatched && (
                          <span
                            style={{
                              fontSize: '0.68rem',
                              fontWeight: 800,
                              padding: '2px 7px',
                              borderRadius: 'var(--radius-sm)',
                              background: 'rgba(99, 102, 241, 0.12)',
                              color: '#6366f1',
                              border: '1px solid rgba(99, 102, 241, 0.25)',
                            }}
                            title="Teams Matched"
                          >
                            Teams
                          </span>
                        )}
                        {subject.lmsMatched && (
                          <span
                            style={{
                              fontSize: '0.68rem',
                              fontWeight: 800,
                              padding: '2px 7px',
                              borderRadius: 'var(--radius-sm)',
                              background: 'rgba(2, 132, 199, 0.12)',
                              color: '#0284c7',
                              border: '1px solid rgba(2, 132, 199, 0.25)',
                            }}
                            title="LMS Matched"
                          >
                            LMS
                          </span>
                        )}
                      </div>

                      {/* Status Badges */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {subject.submittedCount > 0 && (
                          <span
                            style={{
                              fontSize: '0.74rem',
                              fontWeight: 800,
                              padding: '3px 8px',
                              borderRadius: 'var(--radius-full)',
                              background: 'rgba(34, 197, 94, 0.1)',
                              color: '#22c55e',
                              border: '1px solid rgba(34, 197, 94, 0.25)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <CheckCircle2 size={12} />
                            <span>{subject.submittedCount} Done</span>
                          </span>
                        )}
                        {hasOverdue && (
                          <span
                            style={{
                              fontSize: '0.74rem',
                              fontWeight: 800,
                              padding: '3px 8px',
                              borderRadius: 'var(--radius-full)',
                              background: 'rgba(239, 68, 68, 0.12)',
                              color: '#ef4444',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <AlertTriangle size={12} />
                            <span>{subject.overdueCount} Overdue</span>
                          </span>
                        )}
                        {hasPending && (
                          <span
                            style={{
                              fontSize: '0.74rem',
                              fontWeight: 800,
                              padding: '3px 8px',
                              borderRadius: 'var(--radius-full)',
                              background: 'rgba(245, 158, 11, 0.12)',
                              color: '#f59e0b',
                              border: '1px solid rgba(245, 158, 11, 0.3)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <Clock size={12} />
                            <span>{subject.pendingCount} Pending</span>
                          </span>
                        )}
                        {subject.assignments.length === 0 && (
                          <span
                            style={{
                              fontSize: '0.74rem',
                              fontWeight: 600,
                              padding: '3px 8px',
                              borderRadius: 'var(--radius-full)',
                              background: 'rgba(156, 163, 175, 0.1)',
                              color: 'var(--text-muted)',
                              border: '1px solid var(--border-subtle)',
                            }}
                          >
                            0 Assignments
                          </span>
                        )}
                      </div>

                      {/* Chevron */}
                      <div style={{ color: 'var(--text-muted)' }}>
                        {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Assignments Area */}
                  {isExpanded && (
                    <div style={{ padding: '16px 20px', background: 'var(--bg-surface)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {subject.assignments.length > 0 ? (
                        subject.assignments.map((assignment) => (
                          <AssignmentCardItem
                            key={assignment.id}
                            assignment={{
                              ...assignment,
                              courseCode: subject.courseCode,
                              subject: subject.courseTitle,
                              faculty: subject.faculty,
                            }}
                            onToggle={handleToggleAssignmentStatus}
                            showSubjectTag={false}
                          />
                        ))
                      ) : (
                        <div
                          style={{
                            padding: '16px',
                            textAlign: 'center',
                            color: subject.syncStatusNote?.includes('could not be verified') ? '#f59e0b' : 'var(--text-muted)',
                            fontSize: '0.84rem',
                            background: 'var(--bg-surface-elevated)',
                            borderRadius: 'var(--radius-md)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                          }}
                        >
                          {subject.syncStatusNote?.includes('could not be verified') ? (
                            <>
                              <AlertTriangle size={15} color="#f59e0b" />
                              <span>{subject.syncStatusNote}</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 size={15} color="var(--text-muted)" />
                              <span>{subject.syncStatusNote || 'No assignments found for this course.'}</span>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-medium)',
                borderRadius: 'var(--radius-xl)',
                padding: '36px 20px',
                textAlign: 'center',
                color: 'var(--text-secondary)',
              }}
            >
              <FolderSync size={32} color="var(--text-muted)" style={{ margin: '0 auto 10px' }} />
              <h4 style={{ fontSize: '1.1rem', fontWeight: 800, margin: '0 0 6px', color: 'var(--text-primary)' }}>
                No subjects match your selected filter
              </h4>
              <p style={{ fontSize: '0.84rem', margin: 0 }}>
                Try resetting your search query or switching to "All Platforms".
              </p>
            </div>
          )}
        </div>
      )}

      {/* Microsoft Teams Login Modal */}
      <TeamsLoginModal
        isOpen={isTeamsModalOpen}
        onClose={() => setIsTeamsModalOpen(false)}
        onLoginSuccess={() => loadUnifiedData()}
        initialEmail={teamsAccount.email || studentEmail || ''}
      />

      {/* VIT LMS Login Modal */}
      <LMSLoginModal
        isOpen={isLMSModalOpen}
        onClose={() => setIsLMSModalOpen(false)}
        onLoginSuccess={() => loadUnifiedData()}
        initialUsername={lmsAccount.username || studentRegNo || ''}
      />
    </div>
  );
};

export default AssignmentsView;
