import React, { useState, useEffect, useMemo } from 'react';
import {
  Layers,
  CheckCircle2,
  Clock,
  ExternalLink,
  RefreshCw,
  Search,
  BookOpen,
  CheckSquare,
  Square,
  AlertCircle,
  User,
} from 'lucide-react';
import { Assignment, SubjectAssignmentGroup, UnifiedAssignmentsDashboard, Course } from '../types';
import { CampusAPI } from '../services/api';
import { TeamsLoginModal } from '../components/TeamsLoginModal';
import { LMSLoginModal } from '../components/LMSLoginModal';
import { MetricCard } from '../components/MetricCard';

interface AssignmentsViewProps {
  assignments?: Assignment[];
  courses?: Course[];
  onToggleStatus: (id: string, currentStatus: 'Pending' | 'Submitted') => void;
  onAssignmentsUpdated?: (newAssignments: Assignment[]) => void;
  onLinkTeams?: () => void;
  onLinkLMS?: () => void;
  onSyncAll?: () => void;
  syncingAll?: boolean;
  teamsAccount?: any;
  lmsAccount?: any;
  studentEmail?: string;
  studentRegNo?: string;
}

interface EnrichedAssignment extends Assignment {
  subject?: string;
  subjectName?: string;
  facultyName?: string;
  professor?: string;
  lmsProfessor?: string;
}

const isAssignmentDone = (a: Assignment): boolean => {
  const st = (a.displayStatus || a.status || '').toUpperCase().trim();
  return Boolean(
    a.isDone ||
    a.isSubmitted ||
    st === 'DONE' ||
    st === 'SUBMITTED' ||
    st === 'COMPLETED'
  );
};

export const AssignmentsView: React.FC<AssignmentsViewProps> = ({
  assignments: _assignments,
  courses = [],
  onToggleStatus,
  onAssignmentsUpdated,
  onLinkTeams: _onLinkTeams,
  onLinkLMS: _onLinkLMS,
  onSyncAll,
  syncingAll: externalSyncingAll,
  teamsAccount: _teamsAccount,
  lmsAccount: _lmsAccount,
  studentEmail,
  studentRegNo,
}) => {
  // Modals
  const [isTeamsModalOpen, setIsTeamsModalOpen] = useState(false);
  const [isLMSModalOpen, setIsLMSModalOpen] = useState(false);

  // Accounts & Dashboard State
  const [dashboard, setDashboard] = useState<UnifiedAssignmentsDashboard | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'ALL' | 'TEAMS' | 'LMS'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'SUBMITTED'>('ALL');
  const [sortOrder, setSortOrder] = useState<'DUE_SOON' | 'COURSE'>('DUE_SOON');

  const isSyncing = externalSyncingAll || syncingAll;

  // Fetch unified dashboard from backend
  const loadUnifiedData = async () => {
    try {
      const data = await CampusAPI.getUnifiedAssignments();
      setDashboard(data);

      if (onAssignmentsUpdated && data.subjects) {
        const flatList: Assignment[] = [];
        data.subjects.forEach((s: SubjectAssignmentGroup) => flatList.push(...s.assignments));
        if (flatList.length > 0) {
          onAssignmentsUpdated(flatList);
        }
      }
    } catch (err: any) {
      console.error('Failed to load unified assignments:', err);
    }
  };

  useEffect(() => {
    loadUnifiedData();
  }, [_assignments]);

  const handleRefreshAll = async () => {
    if (onSyncAll) {
      onSyncAll();
      await loadUnifiedData();
      return;
    }
    setSyncingAll(true);
    try {
      const res = await CampusAPI.syncAllAcademicAccounts();
      if (res.dashboard) {
        setDashboard(res.dashboard);
        if (onAssignmentsUpdated && res.dashboard.subjects) {
          const flatList: Assignment[] = [];
          res.dashboard.subjects.forEach((s: SubjectAssignmentGroup) => flatList.push(...s.assignments));
          onAssignmentsUpdated(flatList);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSyncingAll(false);
    }
  };

  // Flatten & Enrich assignments with verified subject & faculty data
  const allAssignments = useMemo(() => {
    const findFaculty = (
      courseCode?: string,
      courseTitle?: string,
      fallbackFaculty?: string,
      lmsProfessor?: string,
      professor?: string
    ) => {
      const explicitProf = lmsProfessor || professor || fallbackFaculty;
      if (explicitProf && explicitProf.trim() && explicitProf !== 'Faculty unassigned') {
        return explicitProf.trim();
      }
      if (courses && courses.length > 0) {
        const found = courses.find((c) =>
          (courseCode && c.code && c.code.toUpperCase() === courseCode.toUpperCase()) ||
          (courseTitle && c.title && c.title.toLowerCase() === courseTitle.toLowerCase())
        );
        if (found?.faculty) return found.faculty;
      }
      return fallbackFaculty || 'Faculty unassigned';
    };

    const list: EnrichedAssignment[] = [];
    if (dashboard && dashboard.subjects && dashboard.subjects.length > 0) {
      dashboard.subjects.forEach((subj) => {
        subj.assignments.forEach((a) => {
          const prof = findFaculty(
            a.courseCode || subj.courseCode,
            a.courseTitle || subj.courseTitle,
            a.faculty || subj.faculty,
            (a as any).lmsProfessor,
            (a as any).professor
          );
          list.push({
            ...a,
            subject: subj.courseTitle,
            subjectName: subj.courseTitle,
            courseCode: a.courseCode || subj.courseCode,
            facultyName: prof,
            professor: prof,
            lmsProfessor: (a as any).lmsProfessor || prof,
          });
        });
      });
      if (dashboard.unmatchedAssignments) {
        dashboard.unmatchedAssignments.forEach((a) => {
          const prof = findFaculty(
            a.courseCode,
            a.courseTitle,
            a.faculty,
            (a as any).lmsProfessor,
            (a as any).professor
          );
          list.push({
            ...a,
            subject: a.courseTitle || a.courseCode || 'General Task',
            subjectName: a.courseTitle || a.courseCode || 'General Task',
            courseCode: a.courseCode || 'GENERAL',
            facultyName: prof,
            professor: prof,
            lmsProfessor: (a as any).lmsProfessor || prof,
          });
        });
      }
      if (list.length > 0) return list;
    }
    return (_assignments || []).map((a) => {
      const prof = findFaculty(
        a.courseCode,
        a.courseTitle || a.subject,
        a.faculty,
        (a as any).lmsProfessor,
        (a as any).professor
      );
      return {
        ...a,
        subject: a.courseTitle || a.subject || a.courseCode || 'Course',
        subjectName: a.courseTitle || a.subject || a.courseCode || 'Course',
        courseCode: a.courseCode || 'COURSE',
        facultyName: prof,
        professor: prof,
        lmsProfessor: (a as any).lmsProfessor || prof,
      };
    });
  }, [dashboard, _assignments, courses]);

  const handleToggle = (a: EnrichedAssignment) => {
    const isDone = isAssignmentDone(a);
    const nextStatus = isDone ? 'Pending' : 'Submitted';
    onToggleStatus(a.id, isDone ? 'Submitted' : 'Pending');

    if (dashboard) {
      setDashboard({
        ...dashboard,
        subjects: (dashboard.subjects || []).map((s) => ({
          ...s,
          assignments: s.assignments.map((item) =>
            item.id === a.id
              ? {
                  ...item,
                  status: nextStatus,
                  displayStatus: nextStatus === 'Submitted' ? 'DONE' : 'PENDING',
                  applicationStatus: nextStatus === 'Submitted' ? 'DONE' : 'PENDING',
                  isDone: nextStatus === 'Submitted',
                  isSubmitted: nextStatus === 'Submitted',
                }
              : item
          ),
        })),
        unmatchedAssignments: (dashboard.unmatchedAssignments || []).map((item) =>
          item.id === a.id
            ? {
                ...item,
                status: nextStatus,
                displayStatus: nextStatus === 'Submitted' ? 'DONE' : 'PENDING',
                applicationStatus: nextStatus === 'Submitted' ? 'DONE' : 'PENDING',
                isDone: nextStatus === 'Submitted',
                isSubmitted: nextStatus === 'Submitted',
              }
            : item
        ),
      });
    }
  };

  // Filtered & Sorted
  const filteredAssignments = useMemo(() => {
    return allAssignments
      .filter((a) => {
        const srcUpper = (a.source || '').toUpperCase();
        if (sourceFilter === 'TEAMS' && !srcUpper.includes('TEAMS')) return false;
        if (sourceFilter === 'LMS' && !srcUpper.includes('LMS')) return false;

        const isDone = isAssignmentDone(a);
        if (statusFilter === 'PENDING' && isDone) return false;
        if (statusFilter === 'SUBMITTED' && !isDone) return false;

        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchTitle = (a.title || '').toLowerCase().includes(q);
          const matchCourse = (a.courseCode || '').toLowerCase().includes(q);
          const matchSubject = (a.subject || '').toLowerCase().includes(q);
          const matchFaculty = (a.facultyName || '').toLowerCase().includes(q);
          if (!matchTitle && !matchCourse && !matchSubject && !matchFaculty) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const doneA = isAssignmentDone(a);
        const doneB = isAssignmentDone(b);

        // 1. Pending assignments strictly on top, completed assignments strictly at the bottom
        if (!doneA && doneB) return -1;
        if (doneA && !doneB) return 1;

        // 2. Secondary sort within the same status partition
        if (sortOrder === 'DUE_SOON') {
          const keyA = (a as any).sortKey || (a.dueDate && a.dueDate.trim() ? a.dueDate.trim() : '9999-99-99');
          const keyB = (b as any).sortKey || (b.dueDate && b.dueDate.trim() ? b.dueDate.trim() : '9999-99-99');
          return keyA.localeCompare(keyB);
        }
        return (a.courseCode || a.subject || '').localeCompare(b.courseCode || b.subject || '');
      });
  }, [allAssignments, sourceFilter, statusFilter, searchQuery, sortOrder]);

  const pendingCount = useMemo(() => {
    return allAssignments.filter((a) => !isAssignmentDone(a)).length;
  }, [allAssignments]);

  const completedCount = useMemo(() => {
    return allAssignments.filter((a) => isAssignmentDone(a)).length;
  }, [allAssignments]);

  return (
    <div className="page-container">
      {/* 1. Header Banner */}
      <div className="hero-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div className="hero-eyebrow">
              <Layers size={14} />
              <span>UNIFIED DEADLINE RADAR</span>
              <span>•</span>
              <span style={{ color: 'var(--text-muted)' }}>MICROSOFT TEAMS &amp; MOODLE LMS</span>
            </div>
            <h2 className="hero-heading">Assignments &amp; Submissions</h2>
            <p className="hero-desc">
              Direct digital extraction of homework deadlines, quiz timers, and project submissions across all connected platforms.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={handleRefreshAll}
              disabled={isSyncing}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
              <span>{isSyncing ? 'Syncing...' : 'Sync All Platforms'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Summary Metrics Grid */}
      <div className="metrics-stat-grid">
        <MetricCard
          label="Pending Submissions"
          value={pendingCount}
          subtext={pendingCount > 0 ? `${pendingCount} tasks requiring action` : 'All tasks completed'}
          icon={<Clock size={17} />}
          variant={pendingCount > 0 ? 'amber' : 'emerald'}
        />
        <MetricCard
          label="Completed &amp; Turned In"
          value={completedCount}
          subtext="Verified digital submissions"
          icon={<CheckCircle2 size={17} />}
          variant="emerald"
        />
        <MetricCard
          label="Connected Subjects"
          value={dashboard?.subjects ? dashboard.subjects.filter((s) => s.teamsMatched || s.lmsMatched).length : 0}
          subtext={
            dashboard?.subjects && dashboard.subjects.some((s) => s.teamsMatched || s.lmsMatched)
              ? "Teams & LMS synced channels"
              : "No external platforms connected"
          }
          icon={<BookOpen size={17} />}
          variant="cyan"
        />
      </div>

      {/* 3. Filter & Search Control Bar */}
      <div className="card" style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          {/* Search Input */}
          <div style={{ position: 'relative', flex: 1, minWidth: '260px' }}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search assignments or course code..."
              className="input-field"
              style={{ paddingLeft: '38px', height: '44px' }}
            />
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '14px', color: 'var(--text-muted)' }} />
          </div>

          {/* Platform Source Tabs */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {(['ALL', 'TEAMS', 'LMS'] as const).map((src) => (
              <button
                key={src}
                className={`btn btn-sm ${sourceFilter === src ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setSourceFilter(src)}
              >
                {src === 'ALL' ? 'All Platforms' : src === 'TEAMS' ? 'Teams' : 'Moodle LMS'}
              </button>
            ))}
          </div>

          {/* Status & Sort Dropdowns */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="custom-select-control"
              style={{ height: '44px', minWidth: '140px' }}
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING">Pending Only</option>
              <option value="SUBMITTED">Submitted / Done Only</option>
            </select>

            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as any)}
              className="custom-select-control"
              style={{ height: '44px', minWidth: '160px' }}
            >
              <option value="DUE_SOON">Sort: Due Soonest</option>
              <option value="COURSE">Sort: By Course</option>
            </select>
          </div>
        </div>
      </div>

      {/* 4. Assignment Cards Stream */}
      <div className="card">
        <div className="card-header-bar">
          <h3 className="card-title">
            <Layers size={19} color="var(--accent-cyan)" />
            <span>Assignment Ledger ({filteredAssignments.length} Items)</span>
          </h3>
        </div>

        {filteredAssignments.length === 0 ? (
          <div className="empty-state-card">
            <div className="empty-state-icon">
              <CheckCircle2 size={26} color="var(--accent-emerald)" />
            </div>
            <div className="empty-state-title">No Assignments Found</div>
            <p className="empty-state-desc">
              You are completely caught up! No pending deadlines match your current search and filters.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {filteredAssignments.map((a, idx) => {
              const isDone = isAssignmentDone(a);
              const isOverdue = !isDone && (Boolean(a.isOverdue) || (a.displayStatus || '').toUpperCase() === 'OVERDUE');
              const isDueSoon = !isDone && !isOverdue && (Boolean(a.isDueSoon) || (a.displayStatus || '').toUpperCase() === 'DUE SOON');
              const showCompletedHeader = isDone && idx > 0 && !isAssignmentDone(filteredAssignments[idx - 1]);

              return (
                <React.Fragment key={a.id}>
                  {showCompletedHeader && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        margin: '14px 0 6px 0',
                        padding: '10px 4px',
                        borderTop: '1px dashed var(--border-medium)',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          color: 'var(--text-muted)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.6px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <CheckCircle2 size={14} color="var(--accent-emerald)" />
                        Completed &amp; Submitted Tasks ({completedCount})
                      </span>
                      <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }} />
                    </div>
                  )}

                  <div
                    style={{
                    padding: '20px 24px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--surface-input)',
                    border: '1px solid var(--border-card)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '16px',
                    transition: 'all var(--transition-fast)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1, minWidth: '280px' }}>
                    <button
                      onClick={() => handleToggle(a)}
                      style={{ color: isDone ? 'var(--accent-emerald)' : 'var(--text-muted)', cursor: 'pointer' }}
                      title={isDone ? 'Mark as Pending' : 'Mark as Submitted'}
                      aria-label="Toggle submission status"
                    >
                      {isDone ? <CheckSquare size={22} /> : <Square size={22} />}
                    </button>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.80rem', fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--accent-cyan)' }}>
                          {a.courseCode || 'COURSE'}
                        </span>
                        <span className={`status-badge ${a.source?.toUpperCase().includes('TEAMS') ? 'info' : 'warning'}`}>
                          {a.source?.toUpperCase().includes('TEAMS') ? 'Teams' : 'Moodle LMS'}
                        </span>
                        {a.facultyName && a.facultyName !== 'Faculty unassigned' && (
                          <span
                            style={{
                              fontSize: '0.74rem',
                              color: 'var(--accent-purple)',
                              background: 'rgba(181, 117, 255, 0.10)',
                              border: '1px solid rgba(181, 117, 255, 0.25)',
                              padding: '2px 8px',
                              borderRadius: '12px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                            title={`Assigned by: ${a.facultyName}`}
                          >
                            <User size={11} />
                            <span>
                              {a.source?.toUpperCase().includes('LMS')
                                ? a.facultyName.startsWith('Dr.') || a.facultyName.startsWith('Prof.')
                                  ? a.facultyName
                                  : `Prof. ${a.facultyName}`
                                : a.facultyName}
                            </span>
                          </span>
                        )}
                      </div>

                      <div style={{ fontSize: '1.02rem', fontWeight: 700, color: isDone ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: isDone ? 'line-through' : 'none', wordBreak: 'break-word', lineHeight: 1.4 }}>
                        {a.title}
                      </div>

                      {/* Explicit Assignment - Subject - Faculty Details */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', fontSize: '0.80rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '3px 9px',
                          borderRadius: '6px',
                          background: 'rgba(45, 231, 211, 0.08)',
                          border: '1px solid rgba(45, 231, 211, 0.20)',
                          color: 'var(--text-primary)',
                          fontSize: '0.78rem',
                          fontWeight: 550,
                        }}>
                          <BookOpen size={12} color="var(--accent-cyan)" />
                          <span style={{ color: 'var(--accent-cyan)', fontWeight: 700 }}>Subject:</span>
                          <span>{a.subject || a.courseTitle || a.courseCode || 'General Course'}</span>
                        </span>

                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '3px 9px',
                          borderRadius: '6px',
                          background: 'rgba(181, 117, 255, 0.08)',
                          border: '1px solid rgba(181, 117, 255, 0.20)',
                          color: 'var(--text-primary)',
                          fontSize: '0.78rem',
                          fontWeight: 550,
                        }}>
                          <User size={12} color="var(--accent-purple)" />
                          <span style={{ color: 'var(--accent-purple)', fontWeight: 700 }}>
                            {a.source?.toUpperCase().includes('LMS') ? 'LMS Professor:' : 'Faculty:'}
                          </span>
                          <span>{a.facultyName || a.professor || a.faculty || 'Faculty unassigned'}</span>
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.80rem', color: isDone ? 'var(--text-muted)' : isOverdue ? 'var(--accent-crimson)' : isDueSoon ? 'var(--accent-orange)' : 'var(--text-secondary)', marginTop: '2px' }}>
                        {isOverdue ? <AlertCircle size={13} /> : <Clock size={13} />}
                        <span>
                          {isDone
                            ? `Completed (Due: ${a.dueDate || '11:59 PM'})`
                            : isOverdue
                            ? `Overdue: ${a.dueDate || 'Passed'}`
                            : `Deadline: ${a.dueDate || '11:59 PM'}`}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span className={`status-badge ${isDone ? 'safe' : isOverdue ? 'critical' : 'warning'}`}>
                      {isDone ? 'Submitted ✓' : isOverdue ? 'Overdue' : isDueSoon ? 'Due Soon' : 'Pending'}
                    </span>

                    {a.submissionUrl && (
                      <a
                        href={a.submissionUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-secondary btn-sm"
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', textDecoration: 'none' }}
                      >
                        <span>Open Portal</span>
                        <ExternalLink size={13} />
                      </a>
                    )}
                  </div>
                </div>
              </React.Fragment>
            );
          })}
          </div>
        )}
      </div>

      {/* Account Login Modals */}
      {isTeamsModalOpen && (
        <TeamsLoginModal
          isOpen={isTeamsModalOpen}
          onClose={() => setIsTeamsModalOpen(false)}
          onLoginSuccess={() => {
            setIsTeamsModalOpen(false);
            loadUnifiedData();
          }}
          initialEmail={studentEmail}
        />
      )}

      {isLMSModalOpen && (
        <LMSLoginModal
          isOpen={isLMSModalOpen}
          onClose={() => setIsLMSModalOpen(false)}
          onLoginSuccess={() => {
            setIsLMSModalOpen(false);
            loadUnifiedData();
          }}
          initialRegNo={studentRegNo}
        />
      )}
    </div>
  );
};
