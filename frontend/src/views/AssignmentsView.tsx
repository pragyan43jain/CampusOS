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
} from 'lucide-react';
import { Assignment, SubjectAssignmentGroup, UnifiedAssignmentsDashboard } from '../types';
import { CampusAPI } from '../services/api';
import { TeamsLoginModal } from '../components/TeamsLoginModal';
import { LMSLoginModal } from '../components/LMSLoginModal';
import { MetricCard } from '../components/MetricCard';

interface AssignmentsViewProps {
  assignments?: Assignment[];
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

  // Flatten & Enrich assignments
  const allAssignments = useMemo(() => {
    const list: EnrichedAssignment[] = [];
    if (dashboard && dashboard.subjects && dashboard.subjects.length > 0) {
      dashboard.subjects.forEach((subj) => {
        subj.assignments.forEach((a) => {
          list.push({
            ...a,
            subject: subj.courseTitle,
            subjectName: subj.courseTitle,
            courseCode: a.courseCode || subj.courseCode,
            facultyName: subj.faculty,
          });
        });
      });
      if (dashboard.unmatchedAssignments) {
        dashboard.unmatchedAssignments.forEach((a) => {
          list.push({
            ...a,
            subject: a.courseTitle || a.courseCode || 'General Task',
            subjectName: a.courseTitle || a.courseCode || 'General Task',
            courseCode: a.courseCode || 'GENERAL',
            facultyName: a.faculty,
          });
        });
      }
      if (list.length > 0) return list;
    }
    return (_assignments || []).map((a) => ({
      ...a,
      subject: a.courseTitle || a.subject || a.courseCode || 'Course',
      subjectName: a.courseTitle || a.subject || a.courseCode || 'Course',
      courseCode: a.courseCode || 'COURSE',
    }));
  }, [dashboard, _assignments]);

  const handleToggle = (a: EnrichedAssignment) => {
    const isDone = isAssignmentDone(a);
    const nextStatus = isDone ? 'Pending' : 'Submitted';
    onToggleStatus(a.id, isDone ? 'Submitted' : 'Pending');

    if (dashboard && dashboard.subjects) {
      setDashboard({
        ...dashboard,
        subjects: dashboard.subjects.map((s) => ({
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
          if (!matchTitle && !matchCourse && !matchSubject) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortOrder === 'DUE_SOON') {
          return (a.dueDate || '').localeCompare(b.dueDate || '');
        }
        return (a.courseCode || '').localeCompare(b.courseCode || '');
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
          value={dashboard?.subjects ? dashboard.subjects.length : 0}
          subtext="Teams &amp; LMS course channels"
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
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="custom-select-control"
              style={{ height: '44px' }}
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING">Pending Only</option>
              <option value="SUBMITTED">Submitted / Done Only</option>
            </select>

            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as any)}
              className="custom-select-control"
              style={{ height: '44px' }}
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
            {filteredAssignments.map((a) => {
              const isDone = isAssignmentDone(a);
              const isOverdue = !isDone && (Boolean(a.isOverdue) || (a.displayStatus || '').toUpperCase() === 'OVERDUE');
              const isDueSoon = !isDone && !isOverdue && (Boolean(a.isDueSoon) || (a.displayStatus || '').toUpperCase() === 'DUE SOON');

              return (
                <div
                  key={a.id}
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

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.80rem', fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--accent-cyan)' }}>
                          {a.courseCode || 'COURSE'}
                        </span>
                        <span className={`status-badge ${a.source?.toUpperCase().includes('TEAMS') ? 'info' : 'warning'}`}>
                          {a.source?.toUpperCase().includes('TEAMS') ? 'Teams' : 'Moodle LMS'}
                        </span>
                        {a.subject && (
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            • {a.subject}
                          </span>
                        )}
                      </div>

                      <div style={{ fontSize: '1.02rem', fontWeight: 700, color: isDone ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: isDone ? 'line-through' : 'none' }}>
                        {a.title}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: isDone ? 'var(--text-muted)' : isOverdue ? 'var(--accent-crimson)' : isDueSoon ? 'var(--accent-orange)' : 'var(--text-secondary)' }}>
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
