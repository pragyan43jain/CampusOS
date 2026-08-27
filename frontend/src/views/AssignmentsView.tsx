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
} from 'lucide-react';

interface AssignmentsViewProps {
  assignments?: Assignment[];
  onToggleStatus: (id: string, currentStatus: 'Pending' | 'Submitted') => void;
  onAssignmentsUpdated?: (newAssignments: Assignment[]) => void;
  studentEmail?: string;
  studentRegNo?: string;
}

export const AssignmentsView: React.FC<AssignmentsViewProps> = ({
  assignments: _assignments,
  onToggleStatus,
  onAssignmentsUpdated,
  studentEmail,
  studentRegNo,
}) => {
  // Navigation & Modals
  const [isTeamsModalOpen, setIsTeamsModalOpen] = useState(false);
  const [isLMSModalOpen, setIsLMSModalOpen] = useState(false);

  // Accounts & Dashboard State
  const [dashboard, setDashboard] = useState<UnifiedAssignmentsDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncingTeams, setSyncingTeams] = useState(false);
  const [syncingLMS, setSyncingLMS] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'COMPLETED' | 'OVERDUE'>('ALL');
  const [sourceFilter, setSourceFilter] = useState<'ALL' | 'TEAMS' | 'LMS' | 'BOTH'>('ALL');

  // Accordion open/close state per subject
  const [expandedSubjects, setExpandedSubjects] = useState<Record<string, boolean>>({});

  // Fetch unified dashboard from backend
  const loadUnifiedData = async () => {
    try {
      setLoading(true);
      setSyncError(null);
      const data = await CampusAPI.getUnifiedAssignments();
      setDashboard(data);

      // Default expand all subjects that have assignments so completed and pending tasks remain visible
      const initialOpen: Record<string, boolean> = {};
      data.subjects.forEach((s: SubjectAssignmentGroup) => {
        if (s.assignments && s.assignments.length > 0) {
          initialOpen[s.courseCode] = true;
        }
      });
      setExpandedSubjects((prev) => (Object.keys(prev).length > 0 ? { ...initialOpen, ...prev } : initialOpen));

      // Sync with parent assignments state if handler provided
      if (onAssignmentsUpdated && data.subjects) {
        const flatList: Assignment[] = [];
        data.subjects.forEach((s: SubjectAssignmentGroup) => flatList.push(...s.assignments));
        if (flatList.length > 0) {
          onAssignmentsUpdated(flatList);
        }
      }
    } catch (err: any) {
      console.error('Failed to load unified assignments:', err);
      setSyncError('Could not retrieve latest assignment data. Previously cached records remain visible.');
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

    // Optimistically update local dashboard state for instant feedback
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
    } catch (err: any) {
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
    } catch (err: any) {
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

  // Filtered subjects computation
  const filteredSubjects = useMemo(() => {
    if (!dashboard) return [];
    return dashboard.subjects.filter((sub) => {
      // 1. Search Query
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        sub.courseCode.toLowerCase().includes(q) ||
        sub.courseTitle.toLowerCase().includes(q) ||
        (sub.faculty && sub.faculty.toLowerCase().includes(q)) ||
        sub.assignments.some((a) => a.title.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      // 2. Status Filter
      if (statusFilter === 'PENDING' && sub.pendingCount === 0) return false;
      if (statusFilter === 'COMPLETED' && sub.submittedCount === 0) return false;
      if (statusFilter === 'OVERDUE' && sub.overdueCount === 0) return false;

      // 3. Source Filter
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

  // Section 14 Verified Counts Breakdown: Total, Completed, Pending, Overdue
  const totalVerifiedAssignments =
    dashboard?.totalAssignments ??
    dashboard?.subjects?.reduce((acc, s) => acc + (s.assignments?.length || 0), 0) ??
    0;
  const totalCompletedAssignments =
    dashboard?.totalSubmittedAssignments ??
    dashboard?.subjects?.reduce((acc, s) => acc + (s.submittedCount || 0), 0) ??
    0;
  const totalPendingAssignments =
    dashboard?.totalPendingAssignments ??
    dashboard?.subjects?.reduce((acc, s) => acc + (s.pendingCount || 0), 0) ??
    0;
  const totalOverdueAssignments =
    dashboard?.totalOverdueAssignments ??
    dashboard?.subjects?.reduce((acc, s) => acc + (s.overdueCount || 0), 0) ??
    0;

  if (loading && !dashboard) {
    return (
      <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
        <RefreshCw size={28} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 14px', display: 'block' }} />
        <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
          Loading Academic Assignments...
        </h4>
        <p style={{ fontSize: '0.84rem', margin: '4px 0 0' }}>
          Aggregating coursework from Microsoft Teams & VIT LMS
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* 1. Header & Academic Accounts Connection Section */}
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
                <span>Academic Assignment Inbox</span>
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
              Unified task inbox aggregating authentic coursework from <b>Microsoft Teams</b> and <b>VIT LMS</b>.
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

        {/* Dedicated "Connect Academic Accounts" Cards */}
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
                      <span>{teamsAccount.email} • <b>{teamsAccount.matchedCount || 0} subjects matched</b></span>
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
                      <span>{lmsAccount.username || lmsAccount.displayName} • <b>{lmsAccount.matchedCount || 0} subjects matched</b></span>
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

      {/* 2. Metrics Summary Strip: Section 14 Requirement */}
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
              {totalVerifiedAssignments}
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
              {totalCompletedAssignments}
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
              {totalPendingAssignments}
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
              {totalOverdueAssignments}
            </span>
            <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>action needed</span>
          </div>
        </div>
      </div>

      {/* 3. Filter & Search Toolbar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '14px',
        }}
      >
        {/* Search Bar */}
        <div style={{ position: 'relative', width: '280px', maxWidth: '100%' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search subject code or title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px 8px 36px',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-medium)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-primary)',
              fontSize: '0.84rem',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Filter Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Status Filter */}
          <div style={{ display: 'flex', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '2px' }}>
            <button
              onClick={() => setStatusFilter('ALL')}
              style={{
                border: 'none',
                padding: '6px 12px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.78rem',
                fontWeight: statusFilter === 'ALL' ? 800 : 600,
                background: statusFilter === 'ALL' ? 'var(--brand-color)' : 'transparent',
                color: statusFilter === 'ALL' ? '#ffffff' : 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              All Assignments ({totalVerifiedAssignments})
            </button>
            <button
              onClick={() => setStatusFilter('PENDING')}
              style={{
                border: 'none',
                padding: '6px 12px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.78rem',
                fontWeight: statusFilter === 'PENDING' ? 800 : 600,
                background: statusFilter === 'PENDING' ? '#f59e0b' : 'transparent',
                color: statusFilter === 'PENDING' ? '#ffffff' : 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              Pending ({totalPendingAssignments})
            </button>
            <button
              onClick={() => setStatusFilter('COMPLETED')}
              style={{
                border: 'none',
                padding: '6px 12px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.78rem',
                fontWeight: statusFilter === 'COMPLETED' ? 800 : 600,
                background: statusFilter === 'COMPLETED' ? '#22c55e' : 'transparent',
                color: statusFilter === 'COMPLETED' ? '#ffffff' : 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              Completed ({totalCompletedAssignments})
            </button>
            <button
              onClick={() => setStatusFilter('OVERDUE')}
              style={{
                border: 'none',
                padding: '6px 12px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.78rem',
                fontWeight: statusFilter === 'OVERDUE' ? 800 : 600,
                background: statusFilter === 'OVERDUE' ? '#ef4444' : 'transparent',
                color: statusFilter === 'OVERDUE' ? '#ffffff' : 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              Overdue ({totalOverdueAssignments})
            </button>
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

      {/* 3. Empty State: No Accounts Linked Yet */}
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
            Connect your <b>Microsoft Teams</b> and <b>VIT LMS</b> accounts above to automatically aggregate class tasks, submission deadlines, and direct submission links for <b>{currentSemName}</b>.
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

      {/* 4. Empty State: Genuinely Caught Up */}
      {isAnyAccountConnected && dashboard && dashboard.totalPendingAssignments === 0 && dashboard.subjects.length > 0 && statusFilter !== 'ALL' && (
        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--success-border)',
            borderRadius: 'var(--radius-xl)',
            padding: '40px 24px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '16px',
              background: 'var(--success-bg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.6rem',
              color: 'var(--success-emerald)',
            }}
          >
            🎉
          </div>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
            No pending assignments
          </h3>
          <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', maxWidth: '440px', margin: 0 }}>
            You're currently caught up across your connected academic platforms for {currentSemName}. All submitted work is recorded.
          </p>
        </div>
      )}

      {/* 5. Primary Interface: "Subject first, assignment second, source third" */}
      {filteredSubjects.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {filteredSubjects.map((subject: SubjectAssignmentGroup) => {
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
                    {/* Platform Integration Badges */}
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
                          title={subject.teamsChannelName ? `Teams: ${subject.teamsChannelName}` : 'Teams: Matched'}
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
                          title={subject.lmsCourseName ? `LMS: ${subject.lmsCourseName}` : 'LMS: Matched'}
                        >
                          LMS
                        </span>
                      )}
                    </div>

                    {/* Subject Status Badges */}
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
                          <span>{subject.submittedCount} Completed</span>
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

                    {/* Expand/Collapse Chevron */}
                    <div style={{ color: 'var(--text-muted)' }}>
                      {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </div>
                  </div>
                </div>

                {/* Expanded Assignments Area */}
                {isExpanded && (
                  <div style={{ padding: '16px 20px', background: 'var(--bg-surface)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {(() => {
                      const visibleAssignments = subject.assignments.filter((assignment) => {
                        const isSubmitted = Boolean(
                          assignment.isDone ||
                          (assignment.status || '').toUpperCase() === 'DONE' ||
                          (assignment.displayStatus || '').toUpperCase() === 'DONE' ||
                          (assignment.status || '').toUpperCase() === 'SUBMITTED' ||
                          (assignment.displayStatus || '').toUpperCase() === 'SUBMITTED'
                        );
                        const isOverdue = !isSubmitted && (assignment.isOverdue || (assignment.displayStatus || '').toUpperCase() === 'OVERDUE');

                        if (statusFilter === 'PENDING') return !isSubmitted;
                        if (statusFilter === 'COMPLETED') return isSubmitted;
                        if (statusFilter === 'OVERDUE') return isOverdue;
                        return true; // 'ALL' shows EVERYTHING! (Section 5 requirement)
                      });

                      return visibleAssignments.length > 0 ? (
                        visibleAssignments.map((assignment) => {
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

                          return (
                            <div
                              key={assignment.id}
                              style={{
                                background: isSubmitted ? 'rgba(34, 197, 94, 0.03)' : 'var(--bg-surface-elevated)',
                                border: `1px solid ${isSubmitted ? 'rgba(34, 197, 94, 0.2)' : isOverdue ? 'rgba(239, 68, 68, 0.3)' : (isDueSoon ? 'rgba(245, 158, 11, 0.3)' : 'var(--border-subtle)')}`,
                                borderRadius: 'var(--radius-md)',
                                padding: '14px 18px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'flex-start',
                                flexWrap: 'wrap',
                                gap: '14px',
                              }}
                            >
                              {/* Left Side: Checkbox & Info */}
                              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flex: 1, minWidth: '260px' }}>
                                <input
                                  type="checkbox"
                                  role="checkbox"
                                  aria-checked={isSubmitted}
                                  aria-label={
                                    isSubmitted
                                      ? `Assignment "${assignment.title}" completed and verified in ${assignment.source}`
                                      : `Assignment "${assignment.title}" pending in ${assignment.source}`
                                  }
                                  checked={isSubmitted}
                                  onChange={() => handleToggleAssignmentStatus(assignment.id, isSubmitted)}
                                  style={{
                                    width: '18px',
                                    height: '18px',
                                    accentColor: '#22c55e',
                                    marginTop: '3px',
                                    cursor: 'pointer',
                                  }}
                                  title={isSubmitted ? "Marked as completed" : "Mark as completed"}
                                />

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  {/* Badges Row */}
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                    {/* Source Badge */}
                                    <span
                                      style={{
                                        fontSize: '0.72rem',
                                        fontWeight: 800,
                                        padding: '2px 8px',
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
                                        gap: '4px',
                                      }}
                                    >
                                      <span>{assignment.source === 'Teams' ? '💜' : assignment.source === 'LMS' ? '🎓' : '💜+🎓'}</span>
                                      <span>{assignment.source}</span>
                                    </span>

                                    {/* Status Pill */}
                                    {isSubmitted ? (
                                      <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '2px 8px', borderRadius: 'var(--radius-full)', background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', border: '1px solid rgba(34, 197, 94, 0.25)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                        <CheckCircle2 size={12} />
                                        <span>{assignment.isLate ? 'DONE (Submitted Late)' : 'DONE'}</span>
                                      </span>
                                    ) : isUnavailable ? (
                                      <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '2px 8px', borderRadius: 'var(--radius-full)', background: 'rgba(156, 163, 175, 0.12)', color: '#9ca3af', border: '1px solid rgba(156, 163, 175, 0.3)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                        <AlertTriangle size={12} />
                                        <span>Status Unavailable</span>
                                      </span>
                                    ) : isOverdue ? (
                                      <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '2px 8px', borderRadius: 'var(--radius-full)', background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                                        ⚠️ Overdue
                                      </span>
                                    ) : isDueSoon ? (
                                      <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '2px 8px', borderRadius: 'var(--radius-full)', background: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                                        🔥 Due Soon
                                      </span>
                                    ) : (
                                      <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '2px 8px', borderRadius: 'var(--radius-full)', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.25)' }}>
                                        ⏳ Pending
                                      </span>
                                    )}

                                    {/* Relative Deadline Tag */}
                                    {assignment.relativeDeadline && !isSubmitted && (
                                      <span
                                        style={{
                                          fontSize: '0.72rem',
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
                                      fontSize: '1rem',
                                      fontWeight: 800,
                                      margin: '3px 0 0',
                                      color: isSubmitted ? 'var(--text-secondary)' : 'var(--text-primary)',
                                      textDecoration: isSubmitted ? 'line-through' : 'none',
                                      opacity: isSubmitted ? 0.85 : 1,
                                    }}
                                  >
                                    {assignment.title}
                                  </h5>

                                  {/* Instructions / Description */}
                                  {assignment.instructions && (
                                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '4px 0 0', lineHeight: 1.45 }}>
                                      {assignment.instructions}
                                    </p>
                                  )}

                                  {/* Submission Confirmation Date */}
                                  {isSubmitted && assignment.submittedAt && (
                                    <span style={{ fontSize: '0.74rem', color: '#16a34a', fontWeight: 600, marginTop: '3px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                      <CheckCircle2 size={12} />
                                      Submitted: {new Date(assignment.submittedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Right Side: Exact Deadline & Direct Action Links */}
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', minWidth: '180px' }}>
                                <div style={{ textAlign: 'right' }}>
                                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block' }}>
                                    {isSubmitted ? 'Completed:' : 'Deadline:'}
                                  </span>
                                  <span style={{ fontSize: '0.84rem', fontWeight: 800, color: isSubmitted ? '#22c55e' : isOverdue ? '#ef4444' : 'var(--text-primary)' }}>
                                    {isSubmitted && assignment.submittedAt
                                      ? new Date(assignment.submittedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                                      : (assignment.formattedDeadline || `${assignment.dueDate}, ${assignment.dueTime}`)}
                                  </span>
                                </div>

                                {/* Direct Submission Buttons: Keep open in LMS/Teams accessible */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                                  {isMerged ? (
                                    <>
                                      {assignment.teamsSubmissionUrl && (
                                        <a
                                          href={assignment.teamsSubmissionUrl}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="btn-outline"
                                          style={{ fontSize: '0.74rem', padding: '5px 9px', color: '#6366f1', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
                                          title="Open assignment in Microsoft Teams"
                                        >
                                          <span>Open Teams</span>
                                          <ExternalLink size={12} />
                                        </a>
                                      )}
                                      {assignment.lmsSubmissionUrl && (
                                        <a
                                          href={assignment.lmsSubmissionUrl}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="btn-outline"
                                          style={{ fontSize: '0.74rem', padding: '5px 9px', color: '#0284c7', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
                                          title="Open assignment in VIT LMS"
                                        >
                                          <span>Open LMS</span>
                                          <ExternalLink size={12} />
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
                                        fontSize: '0.76rem',
                                        padding: '5px 10px',
                                        textDecoration: 'none',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        color: assignment.source === 'Teams' ? '#6366f1' : '#0284c7',
                                      }}
                                    >
                                      <span>{assignment.source === 'Teams' ? 'Open in Teams' : 'Open in LMS'}</span>
                                      <ExternalLink size={12} />
                                    </a>
                                  ) : (
                                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                                      Link unavailable
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })
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
                              <span>{subject.assignments.length > 0 ? 'No assignments match the selected status filter.' : (subject.syncStatusNote || 'No assignments found.')}</span>
                            </>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* No Subjects Match Current Filter */
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
            Try resetting your search query or switching to "All Subjects".
          </p>
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
