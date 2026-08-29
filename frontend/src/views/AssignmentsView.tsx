import React, { useState, useEffect, useMemo } from 'react';
import {
  Layers,
  CheckCircle2,
  Clock,
  ExternalLink,
  RefreshCw,
  AlertTriangle,
  Search,
} from 'lucide-react';
import { Assignment, SubjectAssignmentGroup, UnifiedAssignmentsDashboard, AcademicAccount } from '../types';
import { CampusAPI } from '../services/api';
import { TeamsLoginModal } from '../components/TeamsLoginModal';
import { LMSLoginModal } from '../components/LMSLoginModal';
import { MetricCard } from '../components/MetricCard';

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
    const [syncingAll, setSyncingAll] = useState(false);
  const [syncingTeams, setSyncingTeams] = useState(false);
  const [syncingLMS, setSyncingLMS] = useState(false);
  
  // Filter & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'ALL' | 'TEAMS' | 'LMS'>('ALL');
  const [sortOrder, setSortOrder] = useState<'DUE_SOON' | 'COURSE'>('DUE_SOON');

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
      
    } finally {
      
    }
  };

  useEffect(() => {
    loadUnifiedData();
  }, []);

  const handleRefreshAll = async () => {
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
      } else {
        await loadUnifiedData();
      }
    } catch (err: any) {
      
    } finally {
      setSyncingAll(false);
    }
  };

  const handleToggleAssignmentStatus = async (id: string, currentlyDone: boolean) => {
    const nextStatus = currentlyDone ? 'Pending' : 'Submitted';
    const nextAppStatus = currentlyDone ? 'PENDING' : 'DONE';

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

  // 1. Flatten all assignments
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

  // 2. Filtered list
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

      return true;
    });
  }, [allVerifiedAssignments, searchQuery, sourceFilter]);

  // 3. Two Major Columns: Pending vs Completed
  const completedAssignments = useMemo(() => {
    const list = filteredAssignments.filter((a) =>
      Boolean(
        a.isDone ||
        (a.status || '').toUpperCase() === 'DONE' ||
        (a.displayStatus || '').toUpperCase() === 'DONE' ||
        (a.status || '').toUpperCase() === 'SUBMITTED' ||
        (a.displayStatus || '').toUpperCase() === 'SUBMITTED'
      )
    );
    return list.sort((x, y) => {
      const xTime = x.submittedAt ? new Date(x.submittedAt).getTime() : 0;
      const yTime = y.submittedAt ? new Date(y.submittedAt).getTime() : 0;
      return yTime - xTime;
    });
  }, [filteredAssignments]);

  const pendingAssignments = useMemo(() => {
    const list = filteredAssignments.filter((a) =>
      !Boolean(
        a.isDone ||
        (a.status || '').toUpperCase() === 'DONE' ||
        (a.displayStatus || '').toUpperCase() === 'DONE' ||
        (a.status || '').toUpperCase() === 'SUBMITTED' ||
        (a.displayStatus || '').toUpperCase() === 'SUBMITTED'
      )
    );
    return list.sort((x, y) => {
      if (sortOrder === 'COURSE') {
        return (x.courseCode || '').localeCompare(y.courseCode || '');
      }
      const xOverdue = Boolean(x.isOverdue || (x.displayStatus || '').toUpperCase() === 'OVERDUE');
      const yOverdue = Boolean(y.isOverdue || (y.displayStatus || '').toUpperCase() === 'OVERDUE');
      if (xOverdue && !yOverdue) return -1;
      if (!xOverdue && yOverdue) return 1;
      return (x.dueDate || '').localeCompare(y.dueDate || '');
    });
  }, [filteredAssignments, sortOrder]);

  const teamsAccount: AcademicAccount = dashboard?.connectedAccounts?.teams || { connected: false };
  const lmsAccount: AcademicAccount = dashboard?.connectedAccounts?.lms || { connected: false };
  const isAnyAccountConnected = teamsAccount.connected || lmsAccount.connected;

  const totalVerifiedCount = allVerifiedAssignments.length;
  const totalCompletedCount = allVerifiedAssignments.filter((a) => a.isDone || (a.status || '').toUpperCase() === 'DONE').length;
  const totalPendingCount = allVerifiedAssignments.filter((a) => !a.isDone && (a.status || '').toUpperCase() !== 'DONE').length;
  const totalOverdueCount = allVerifiedAssignments.filter((a) => !a.isDone && (a.isOverdue || (a.displayStatus || '').toUpperCase() === 'OVERDUE')).length;

  return (
    <div className="page-container">
      {/* Header & Platform Connections Banner */}
      <div
        className="card"
        style={{
          background: 'var(--brand-gradient-soft)',
          border: '1px solid var(--border-medium)',
          padding: '24px 28px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span className="status-badge info" style={{ fontSize: '0.7rem' }}>
                Multi-Platform Aggregator
              </span>
              <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                {dashboard?.currentSemester?.name || 'Fall Semester 2026-27'}
              </span>
            </div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>
              Academic Assignment Dashboard
            </h2>
            <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', marginTop: '2px', maxWidth: '640px' }}>
              Aggregated assignments, digital submissions, and deadline tracks from Microsoft Teams and VIT Moodle LMS.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={handleRefreshAll}
              disabled={syncingAll || !isAnyAccountConnected}
              className="btn btn-primary btn-sm"
            >
              <RefreshCw size={14} className={syncingAll ? 'animate-spin' : ''} />
              <span>{syncingAll ? 'Syncing...' : 'Sync Assignments'}</span>
            </button>
          </div>
        </div>

        {/* Dedicated Connected Academic Platform Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '14px', marginTop: '20px' }}>
          {/* Card 1: Microsoft Teams */}
          <div
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '16px 18px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h4 style={{ fontSize: '0.96rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Microsoft Teams
                  </h4>
                  <span className={`status-badge ${teamsAccount.connected ? 'safe' : 'neutral'}`} style={{ fontSize: '0.68rem', padding: '1px 6px' }}>
                    {teamsAccount.connected ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                  {teamsAccount.connected ? teamsAccount.email : 'University Microsoft O365 account'}
                </p>
              </div>

              <a
                href="https://teams.microsoft.com"
                target="_blank"
                rel="noreferrer"
                style={{ color: 'var(--text-muted)', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '3px' }}
              >
                <span>Portal</span>
                <ExternalLink size={11} />
              </a>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              {teamsAccount.connected ? (
                <>
                  <button onClick={handleSyncTeams} disabled={syncingTeams} className="btn btn-outline btn-sm" style={{ padding: '4px 10px', fontSize: '0.76rem' }}>
                    <RefreshCw size={12} className={syncingTeams ? 'animate-spin' : ''} />
                    <span>{syncingTeams ? 'Syncing...' : 'Re-sync'}</span>
                  </button>
                  <button onClick={handleDisconnectTeams} className="btn btn-danger btn-sm" style={{ padding: '4px 10px', fontSize: '0.76rem' }}>
                    Disconnect
                  </button>
                </>
              ) : (
                <button onClick={() => setIsTeamsModalOpen(true)} className="btn btn-secondary btn-sm" style={{ width: '100%', fontSize: '0.8rem' }}>
                  Connect Teams
                </button>
              )}
            </div>
          </div>

          {/* Card 2: VIT LMS */}
          <div
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '16px 18px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h4 style={{ fontSize: '0.96rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    VIT Moodle LMS
                  </h4>
                  <span className={`status-badge ${lmsAccount.connected ? 'safe' : 'neutral'}`} style={{ fontSize: '0.68rem', padding: '1px 6px' }}>
                    {lmsAccount.connected ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                  {lmsAccount.connected ? lmsAccount.username : 'VIT Moodle VTOP credentials'}
                </p>
              </div>

              <a
                href="https://lms.vit.ac.in"
                target="_blank"
                rel="noreferrer"
                style={{ color: 'var(--text-muted)', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '3px' }}
              >
                <span>Portal</span>
                <ExternalLink size={11} />
              </a>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              {lmsAccount.connected ? (
                <>
                  <button onClick={handleSyncLMS} disabled={syncingLMS} className="btn btn-outline btn-sm" style={{ padding: '4px 10px', fontSize: '0.76rem' }}>
                    <RefreshCw size={12} className={syncingLMS ? 'animate-spin' : ''} />
                    <span>{syncingLMS ? 'Syncing...' : 'Re-sync'}</span>
                  </button>
                  <button onClick={handleDisconnectLMS} className="btn btn-danger btn-sm" style={{ padding: '4px 10px', fontSize: '0.76rem' }}>
                    Disconnect
                  </button>
                </>
              ) : (
                <button onClick={() => setIsLMSModalOpen(true)} className="btn btn-secondary btn-sm" style={{ width: '100%', fontSize: '0.8rem' }}>
                  Connect LMS
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="metrics-stat-grid">
        <MetricCard
          label="Total Verified"
          value={totalVerifiedCount}
          subtext="Coursework tasks indexed"
          icon={<Layers size={18} />}
          variant="blue"
        />
        <MetricCard
          label="Pending Submission"
          value={totalPendingCount}
          subtext="Awaiting completion"
          icon={<Clock size={18} />}
          variant={totalPendingCount > 0 ? 'amber' : 'emerald'}
        />
        <MetricCard
          label="Completed Tasks"
          value={totalCompletedCount}
          subtext="Successfully submitted"
          icon={<CheckCircle2 size={18} />}
          variant="emerald"
        />
        <MetricCard
          label="Overdue Assignments"
          value={totalOverdueCount}
          subtext={totalOverdueCount === 0 ? 'Zero overdue coursework' : 'Immediate submission required'}
          icon={<AlertTriangle size={18} />}
          variant={totalOverdueCount === 0 ? 'emerald' : 'crimson'}
        />
      </div>

      {/* Search & Filter Bar */}
      <div
        className="card"
        style={{
          padding: '14px 20px',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '220px' }}>
          <Search size={16} color="var(--text-muted)" />
          <input
            type="text"
            placeholder="Search assignments by subject, title, or instructor..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field"
            style={{ padding: '8px 12px', fontSize: '0.84rem' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>Source:</span>
            {(['ALL', 'TEAMS', 'LMS'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSourceFilter(s)}
                className={`btn btn-sm ${sourceFilter === s ? 'btn-primary' : 'btn-outline'}`}
              >
                {s}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>Sort:</span>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as any)}
              className="select-dropdown"
              style={{ padding: '6px 10px', fontSize: '0.78rem' }}
            >
              <option value="DUE_SOON">Due Soonest</option>
              <option value="COURSE">By Course Code</option>
            </select>
          </div>
        </div>
      </div>

      {/* Two Major Columns: PENDING vs COMPLETED */}
      {!isAnyAccountConnected ? (
        <div className="empty-state-card">
          <div className="empty-state-icon-box">
            <Layers size={24} />
          </div>
          <h4 className="empty-state-title">No Academic Accounts Connected</h4>
          <p className="empty-state-desc">
            Connect Microsoft Teams or VIT LMS above to pull and aggregate course assignments, deadlines, and digital files.
          </p>
        </div>
      ) : allVerifiedAssignments.length === 0 ? (
        <div className="empty-state-card">
          <div className="empty-state-icon-box">
            <CheckCircle2 size={24} />
          </div>
          <h4 className="empty-state-title">No Assignments Found for Current Semester</h4>
          <p className="empty-state-desc">
            All connected accounts are synchronized, but no assignments were published by instructors for this semester cycle.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px' }}>
          {/* COLUMN 1: PENDING ASSIGNMENTS */}
          <div className="card" style={{ gap: '14px' }}>
            <div className="card-header-bar" style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px', marginBottom: '4px' }}>
              <div>
                <h3 className="card-title">
                  <Clock size={18} color="var(--warning-amber)" />
                  <span>Pending Assignments</span>
                </h3>
                <p className="card-description">{pendingAssignments.length} tasks awaiting submission</p>
              </div>
            </div>

            {pendingAssignments.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {pendingAssignments.map((a) => {
                  const isOverdue = Boolean(a.isOverdue || (a.displayStatus || '').toUpperCase() === 'OVERDUE');
                  return (
                    <div
                      key={a.id}
                      style={{
                        background: 'var(--bg-surface-elevated)',
                        border: `1px solid ${isOverdue ? 'var(--danger-border)' : 'var(--border-subtle)'}`,
                        borderRadius: 'var(--radius-md)',
                        padding: '14px 16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.76rem', fontWeight: 800, color: 'var(--brand-color)' }}>
                            {a.courseCode}
                          </span>
                          <span className={`status-badge ${isOverdue ? 'critical' : 'warning'}`} style={{ fontSize: '0.68rem', padding: '1px 6px' }}>
                            {isOverdue ? 'Overdue' : 'Pending'}
                          </span>
                          <span className="status-badge neutral" style={{ fontSize: '0.68rem', padding: '1px 6px' }}>
                            {a.source}
                          </span>
                        </div>

                        <input
                          type="checkbox"
                          checked={false}
                          onChange={() => handleToggleAssignmentStatus(a.id, false)}
                          title="Mark as completed"
                          style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--success-emerald)' }}
                        />
                      </div>

                      <h4 style={{ fontSize: '0.94rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                        {a.title}
                      </h4>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                        <span>Due: <b style={{ color: isOverdue ? 'var(--danger-crimson)' : 'var(--text-primary)' }}>{a.formattedDeadline || `${a.dueDate}, ${a.dueTime}`}</b></span>
                        {a.platformUrl || a.submissionUrl ? (
                          <a
                            href={a.platformUrl || a.submissionUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '3px 8px', fontSize: '0.72rem', gap: '4px' }}
                          >
                            <span>Submit</span>
                            <ExternalLink size={10} />
                          </a>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="empty-state-card" style={{ padding: '32px 16px' }}>
                <CheckCircle2 size={20} color="var(--success-emerald)" />
                <span style={{ fontSize: '0.86rem', color: 'var(--text-muted)' }}>All assignments completed!</span>
              </div>
            )}
          </div>

          {/* COLUMN 2: COMPLETED ASSIGNMENTS (Must remain visible) */}
          <div className="card" style={{ gap: '14px' }}>
            <div className="card-header-bar" style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px', marginBottom: '4px' }}>
              <div>
                <h3 className="card-title">
                  <CheckCircle2 size={18} color="var(--success-emerald)" />
                  <span>Completed Assignments</span>
                </h3>
                <p className="card-description">{completedAssignments.length} submitted coursework records</p>
              </div>
            </div>

            {completedAssignments.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {completedAssignments.map((a) => (
                  <div
                    key={a.id}
                    style={{
                      background: 'var(--bg-surface-elevated)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-md)',
                      padding: '14px 16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      opacity: 0.85,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.76rem', fontWeight: 800, color: 'var(--brand-color)' }}>
                          {a.courseCode}
                        </span>
                        <span className="status-badge safe" style={{ fontSize: '0.68rem', padding: '1px 6px' }}>
                          ✓ Done
                        </span>
                        <span className="status-badge neutral" style={{ fontSize: '0.68rem', padding: '1px 6px' }}>
                          {a.source}
                        </span>
                      </div>

                      <input
                        type="checkbox"
                        checked={true}
                        onChange={() => handleToggleAssignmentStatus(a.id, true)}
                        title="Unmark completed"
                        style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--success-emerald)' }}
                      />
                    </div>

                    <h4 style={{ fontSize: '0.94rem', fontWeight: 600, color: 'var(--text-secondary)', textDecoration: 'line-through', margin: 0 }}>
                      {a.title}
                    </h4>

                    <div style={{ fontSize: '0.76rem', color: 'var(--success-emerald)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <CheckCircle2 size={12} />
                      <span>Verified submitted</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state-card" style={{ padding: '32px 16px' }}>
                <Clock size={20} color="var(--text-muted)" />
                <span style={{ fontSize: '0.86rem', color: 'var(--text-muted)' }}>No completed assignments marked yet.</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      {isTeamsModalOpen && (
        <TeamsLoginModal
          isOpen={isTeamsModalOpen}
          onClose={() => setIsTeamsModalOpen(false)}
          onLoginSuccess={loadUnifiedData}
          initialEmail={studentEmail}
        />
      )}

      {isLMSModalOpen && (
        <LMSLoginModal
          isOpen={isLMSModalOpen}
          onClose={() => setIsLMSModalOpen(false)}
          onLoginSuccess={loadUnifiedData}
          initialUsername={studentRegNo}
        />
      )}
    </div>
  );
};

export default AssignmentsView;
