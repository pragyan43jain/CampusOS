import React, { useState } from 'react';
import {
  Percent,
  GraduationCap,
  Award,
  BookOpen,
  Calendar,
  RefreshCw,
  Sparkles,
  MessageSquare,
  Clock,
} from 'lucide-react';
import { StudentProfile, TimetableSlot, DayOfWeek, Assignment } from '../types';
import { MetricCard } from '../components/MetricCard';
import { WeekSelector } from '../components/WeekSelector';
import { TimetableSlotCard } from '../components/TimetableSlotCard';

interface DashboardViewProps {
  student: StudentProfile;
  timetable: TimetableSlot[];
  assignments?: Assignment[];
  onOpenSyncModal?: () => void;
  teamsAccount?: any;
  lmsAccount?: any;
  onLinkTeams?: () => void;
  onLinkLMS?: () => void;
  onSyncAll?: () => void;
  syncingAll?: boolean;
  syncResultMsg?: string | null;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  student,
  timetable,
  assignments = [],
  onOpenSyncModal,
  teamsAccount,
  lmsAccount,
  onLinkTeams,
  onLinkLMS,
  onSyncAll,
  syncingAll = false,
  syncResultMsg,
}) => {
  const getTodayDayOfWeek = (): DayOfWeek => {
    const dayIndex = new Date().getDay();
    const map: Record<number, DayOfWeek> = {
      1: 'MON',
      2: 'TUE',
      3: 'WED',
      4: 'THU',
      5: 'FRI',
      6: 'SAT',
    };
    return map[dayIndex] || 'MON';
  };

  const [selectedDay, setSelectedDay] = useState<DayOfWeek>(getTodayDayOfWeek());

  const filteredSlots = timetable.filter((slot) => slot.day === selectedDay);

  const dayClassCounts: Record<DayOfWeek, number> = {
    MON: timetable.filter((s) => s.day === 'MON').length,
    TUE: timetable.filter((s) => s.day === 'TUE').length,
    WED: timetable.filter((s) => s.day === 'WED').length,
    THU: timetable.filter((s) => s.day === 'THU').length,
    FRI: timetable.filter((s) => s.day === 'FRI').length,
    SAT: timetable.filter((s) => s.day === 'SAT').length,
  };

  const dayTitles: Record<DayOfWeek, string> = {
    MON: 'Monday',
    TUE: 'Tuesday',
    WED: 'Wednesday',
    THU: 'Thursday',
    FRI: 'Friday',
    SAT: 'Saturday',
  };

  const attendance = student.overallAttendance;
  const hasAttendance = Boolean(
    attendance &&
    attendance.percentage !== null &&
    attendance.percentage !== undefined &&
    attendance.hasValidData !== false
  );
  const hasAttCounts = Boolean(
    attendance &&
    attendance.attended !== null &&
    attendance.attended !== undefined &&
    attendance.total !== null &&
    attendance.total !== undefined
  );

  const attPct = attendance?.percentage ?? 0;
  const attAttended = attendance?.attended ?? 0;
  const attTotal = attendance?.total ?? 0;

  const cgpaDisplay =
    student.cgpa !== null && student.cgpa !== undefined ? Number(student.cgpa).toFixed(2) : 'Unavailable';

  const earnedCredits = student.creditsEarned ?? null;
  const totalCredits = student.totalCreditsRequired || 160;
  const creditsPct = earnedCredits !== null && totalCredits > 0 ? Math.round((earnedCredits / totalCredits) * 100) : 0;
  const creditsDisplay = earnedCredits !== null ? `${earnedCredits} / ${totalCredits}` : 'Unavailable';

  const isAuth = Boolean(student?.regNo && student.regNo !== 'Not available');
  const studentFirstName = student?.name && student.name !== 'Student' && student.name !== 'Not connected'
    ? student.name.split(' ')[0]
    : (student?.regNo && student.regNo !== 'Not available' ? student.regNo : 'Student');

  const teamsConnected = Boolean(teamsAccount?.connected);
  const teamsFailed = Boolean(teamsAccount?.status === 'failed' || teamsAccount?.failed);

  const lmsConnected = Boolean(lmsAccount?.connected);
  const lmsFailed = Boolean(lmsAccount?.status === 'failed' || lmsAccount?.failed);

  const pendingAssignments = assignments.filter((a) => {
    const st = (a.displayStatus || a.status || '').toUpperCase().trim();
    const isDone = Boolean(a.isDone || a.isSubmitted || st === 'DONE' || st === 'SUBMITTED' || st === 'COMPLETED');
    return !isDone;
  });

  return (
    <div className="page-container">
      {/* 1. Header Greeting & Academic Overview Banner */}
      <div className="hero-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
          <div style={{ minWidth: 0, flex: '1 1 320px' }}>
            <div className="hero-eyebrow">
              <Sparkles size={14} />
              <span>{isAuth ? 'VTOP Verified Session' : 'Offline Mode'}</span>
              <span>•</span>
              <span style={{ color: 'var(--text-muted)' }}>
                {student.program || 'VIT Chennai'} • {student.semester ? `Semester ${student.semester}` : 'Fall 2026-27'}
              </span>
            </div>

            <h1 className="hero-heading" style={{ fontSize: 'clamp(1.8rem, 3vw, 2.4rem)', margin: '4px 0 8px 0' }}>
              Good day, {studentFirstName}
            </h1>
            <p className="hero-desc">
              Your centralized academic cockpit tracking class routines, 75% attendance defense buffers, and multi-portal assignments.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexShrink: 0 }}>
            <button
              onClick={onOpenSyncModal}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <RefreshCw size={15} />
              <span>Sync VTOP Hub</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Responsive 3-Metric Academic Statistics Grid */}
      <div className="metrics-stat-grid">
        {/* Card 1: Overall Attendance */}
        <MetricCard
          label="Overall Attendance"
          value={hasAttendance && attendance && attendance.percentage !== undefined ? `${attendance.percentage}%` : 'Unavailable'}
          subtext={hasAttendance && hasAttCounts ? `${attAttended} / ${attTotal} classes attended` : 'Sync attendance records'}
          icon={<Percent size={17} />}
          progressPercent={hasAttendance ? attPct : undefined}
          variant={hasAttendance ? (attPct >= 80 ? 'emerald' : attPct >= 75 ? 'amber' : 'crimson') : undefined}
          onClick={onOpenSyncModal}
        />

        {/* Card 2: Cumulative CGPA */}
        <MetricCard
          label="Cumulative CGPA"
          value={cgpaDisplay}
          subtext={
            student.cgpa !== null && student.cgpa !== undefined
              ? student.rank ? `Class Rank #${student.rank} • Verified Standing` : 'Verified VTOP Academic Standing'
              : 'Sync VTOP profile'
          }
          icon={<GraduationCap size={17} />}
          progressPercent={student.cgpa ? (student.cgpa / 10) * 100 : undefined}
          variant={student.cgpa ? "emerald" : undefined}
        />

        {/* Card 3: Degree Credits */}
        <MetricCard
          label="Degree Credits"
          value={creditsDisplay}
          subtext={earnedCredits !== null ? `${creditsPct}% degree completion` : 'Sync degree audit'}
          icon={<Award size={17} />}
          progressPercent={earnedCredits !== null ? creditsPct : undefined}
          variant={earnedCredits !== null ? "cyan" : undefined}
        />
      </div>

      {/* 3. Platform Integrations Row */}
      <div className="card">
        <div className="card-header-bar">
          <div>
            <h3 className="card-title">
              <Sparkles size={19} color="var(--accent-cyan)" />
              <span>Connected Academic Hubs</span>
            </h3>
            <p className="card-description">
              Cross-sync coursework from official learning systems into your unified dashboard.
            </p>
          </div>

          {(teamsConnected || lmsConnected) && (
            <button
              onClick={onSyncAll}
              disabled={syncingAll}
              className="btn btn-secondary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <RefreshCw size={14} className={syncingAll ? 'animate-spin' : ''} />
              <span>{syncingAll ? 'Syncing...' : 'Sync All'}</span>
            </button>
          )}
        </div>

        {syncResultMsg && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.82rem',
              backgroundColor: syncResultMsg.includes('✓') ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
              color: syncResultMsg.includes('✓') ? 'var(--accent-emerald)' : 'var(--accent-crimson)',
              border: `1px solid ${syncResultMsg.includes('✓') ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`,
              marginBottom: '16px',
            }}
          >
            {syncResultMsg}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
          {/* Teams Integration Box */}
          <div
            style={{
              padding: '18px 20px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--surface-input)',
              border: teamsFailed ? '1px solid rgba(239, 68, 68, 0.35)' : '1px solid var(--border-card)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              minWidth: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: 'rgba(76, 141, 255, 0.12)',
                  border: '1px solid rgba(76, 141, 255, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--accent-blue)',
                  flexShrink: 0,
                }}
              >
                <MessageSquare size={19} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '0.94rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  Microsoft Teams
                </div>
                <div
                  style={{
                    fontSize: '0.78rem',
                    color: teamsFailed ? 'var(--accent-crimson)' : teamsConnected ? 'var(--accent-emerald)' : 'var(--text-muted)',
                    fontWeight: 500,
                  }}
                >
                  {teamsFailed
                    ? 'Connection Failed • Click to retry'
                    : teamsConnected
                    ? 'Active • Course Assignments Synced'
                    : 'Not Connected'}
                </div>
              </div>
            </div>

            {teamsFailed ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                <span className="status-badge critical" style={{ fontSize: '0.74rem' }}>
                  Failed ⚠️
                </span>
                <button onClick={onLinkTeams} className="btn btn-secondary btn-sm" style={{ padding: '0 10px' }}>
                  Retry
                </button>
              </div>
            ) : teamsConnected ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                <span className="status-badge safe" style={{ fontSize: '0.74rem' }}>
                  Connected ✓
                </span>
              </div>
            ) : (
              <button onClick={onLinkTeams} className="btn btn-secondary btn-sm" style={{ flexShrink: 0 }}>
                Link Teams
              </button>
            )}
          </div>

          {/* LMS Integration Box */}
          <div
            style={{
              padding: '18px 20px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--surface-input)',
              border: lmsFailed ? '1px solid rgba(239, 68, 68, 0.35)' : '1px solid var(--border-card)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              minWidth: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: 'rgba(255, 120, 73, 0.12)',
                  border: '1px solid rgba(255, 120, 73, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--accent-orange)',
                  flexShrink: 0,
                }}
              >
                <BookOpen size={19} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '0.94rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  Moodle LMS
                </div>
                <div
                  style={{
                    fontSize: '0.78rem',
                    color: lmsFailed ? 'var(--accent-crimson)' : lmsConnected ? 'var(--accent-emerald)' : 'var(--text-muted)',
                    fontWeight: 500,
                  }}
                >
                  {lmsConnected
                    ? 'Active • Quizzes & Dropboxes Synced'
                    : lmsFailed
                    ? 'Connection Failed • Click to retry'
                    : 'Not Connected'}
                </div>
              </div>
            </div>

            {lmsConnected ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                <span className="status-badge safe" style={{ fontSize: '0.74rem' }}>
                  Connected ✓
                </span>
              </div>
            ) : lmsFailed ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                <span className="status-badge critical" style={{ fontSize: '0.74rem' }}>
                  Failed ⚠️
                </span>
                <button onClick={onLinkLMS} className="btn btn-secondary btn-sm" style={{ padding: '0 10px' }}>
                  Retry
                </button>
              </div>
            ) : (
              <button onClick={onLinkLMS} className="btn btn-secondary btn-sm" style={{ flexShrink: 0 }}>
                Link Moodle
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 4. Actionable Upcoming Deadlines & Urgencies */}
      {pendingAssignments.length > 0 && (
        <div className="card">
          <div className="card-header-bar">
            <div>
              <h3 className="card-title">
                <Clock size={19} color="var(--accent-orange)" />
                <span>Upcoming Deadlines ({pendingAssignments.length} Pending)</span>
              </h3>
              <p className="card-description">
                Submissions requiring your immediate attention from connected platforms.
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
            {pendingAssignments.slice(0, 3).map((item) => (
              <div
                key={item.id}
                style={{
                  padding: '16px 18px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--surface-input)',
                  border: '1px solid var(--border-card)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  minWidth: 0,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.76rem', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)', fontWeight: 700 }}>
                    {item.courseCode || 'COURSE'}
                  </span>
                  <span className={`status-badge ${item.source === 'TEAMS' ? 'info' : 'warning'}`}>
                    {item.source === 'TEAMS' ? 'Teams' : 'Moodle LMS'}
                  </span>
                </div>

                <div style={{ fontSize: '0.96rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.title}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.80rem', color: 'var(--accent-orange)' }}>
                  <Clock size={13} />
                  <span>Due: {item.dueDate || '11:59 PM'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. Daily Timetable Schedule & Day Selector */}
      <div className="card">
        <div className="card-header-bar">
          <div>
            <h3 className="card-title">
              <Calendar size={19} color="var(--accent-cyan)" />
              <span>Daily Class Schedule ({dayTitles[selectedDay]})</span>
            </h3>
            <p className="card-description">
              Live timetable slot allocation, classroom venues, and course instructors.
            </p>
          </div>

          <WeekSelector
            selectedDay={selectedDay}
            onSelectDay={setSelectedDay}
            dayClassCounts={dayClassCounts}
          />
        </div>

        {filteredSlots.length === 0 ? (
          <div className="empty-state-card">
            <div className="empty-state-icon">
              <Calendar size={26} />
            </div>
            <div className="empty-state-title">No scheduled classes for {dayTitles[selectedDay]}</div>
            <p className="empty-state-desc">
              Enjoy your study break or use this free time to work on pending assignments and AI study targets.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {filteredSlots.map((slot, idx) => (
              <TimetableSlotCard key={slot.id || idx} slot={slot} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
