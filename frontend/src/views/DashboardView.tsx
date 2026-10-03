import React, { useState, useEffect } from 'react';
import {
  GraduationCap,
  BookOpen,
  Calendar,
  RefreshCw,
  Sparkles,
  MessageSquare,
  Clock,
  User,
  ClipboardList,
  CreditCard,
  Code2,
  Building,
  BrainCircuit,
  ShieldCheck,
  RotateCcw,
} from 'lucide-react';
import {
  StudentProfile,
  TimetableSlot,
  DayOfWeek,
  Assignment,
  FeeItem,
  PlacementDrive,
  AIStudyTask,
  HostelDetails,
  DSACategory,
} from '../types';
import { CampusAPI } from '../services/api';
import { NavView } from '../components/Sidebar';
import { BentoGrid } from '../components/ui/bento-grid';
import { BentoCard } from '../components/ui/bento-card';
import { WeekSelector } from '../components/WeekSelector';
import { TimetableSlotCard } from '../components/TimetableSlotCard';
import { getSessionGreeting, cycleNextGreeting, isGreetingValidForPeriod, getTimePeriod } from '../utils/greeting';

interface DashboardViewProps {
  student: StudentProfile;
  timetable: TimetableSlot[];
  assignments?: Assignment[];
  fees?: FeeItem[];
  placements?: PlacementDrive[];
  dsaTopics?: DSACategory[];
  aiTasks?: AIStudyTask[];
  onSync?: () => void;
  syncing?: boolean;
  onOpenSyncModal?: () => void;
  teamsAccount?: any;
  lmsAccount?: any;
  onLinkTeams?: () => void;
  onLinkLMS?: () => void;
  onSyncAll?: () => void;
  syncingAll?: boolean;
  syncResultMsg?: string | null;
  onSelectView?: (view: NavView) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  student,
  timetable,
  assignments = [],
  fees = [],
  placements: _placements = [],
  dsaTopics: _dsaTopics = [],
  aiTasks = [],
  onSync,
  syncing = false,
  onOpenSyncModal,
  teamsAccount,
  lmsAccount,
  onLinkTeams,
  onLinkLMS,
  onSyncAll,
  syncingAll = false,
  syncResultMsg,
  onSelectView,
}) => {
  const getTodayDayOfWeek = (): DayOfWeek => {
    const dayIndex = new Date().getDay();
    const map: Record<number, DayOfWeek> = {
      0: 'SUN',
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
    SUN: timetable.filter((s) => s.day === 'SUN').length,
  };

  const dayTitles: Record<DayOfWeek, string> = {
    MON: 'Monday',
    TUE: 'Tuesday',
    WED: 'Wednesday',
    THU: 'Thursday',
    FRI: 'Friday',
    SAT: 'Saturday',
    SUN: 'Sunday',
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

  const latestSemCgpa = student?.semesterGpa && student.semesterGpa.length > 0
    ? student.semesterGpa[student.semesterGpa.length - 1].cgpa
    : null;
  const resolvedCgpa = (student.cgpa !== null && student.cgpa !== undefined) ? student.cgpa : latestSemCgpa;
  const cgpaDisplay =
    resolvedCgpa !== null && resolvedCgpa !== undefined && !isNaN(Number(resolvedCgpa))
      ? Number(resolvedCgpa).toFixed(2)
      : 'Unavailable';

  const earnedCredits = student.creditsEarned ?? null;
  const registeredCreds = student.registeredCredits ?? null;
  const creditsDisplay = earnedCredits !== null ? `${earnedCredits} Credits` : (registeredCreds ? `${registeredCreds} Credits` : 'Unavailable');
  const creditsSubtext = earnedCredits !== null
    ? (registeredCreds ? `${registeredCreds} credits registered this semester` : 'Cumulative earned credits')
    : (registeredCreds ? 'Current semester registered' : 'Sync VTOP profile');

  const isAuth = Boolean(student?.regNo && student.regNo !== 'Not available');

  // Format Name / Username into clean Title Case (e.g. "PRAGYAN" -> "Pragyan")
  const formatTitleCase = (val: string): string => {
    if (!val) return '';
    const clean = val.trim();
    if (!clean) return '';
    const first = clean.split(' ')[0];
    if (/\d/.test(first)) {
      return first.toUpperCase();
    }
    return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
  };

  const savedUser = typeof window !== 'undefined' ? localStorage.getItem('campus_vtop_username') : '';
  const rawName = (student?.name && student.name !== 'Student' && student.name !== 'Not connected')
    ? student.name
    : (student?.regNo && student.regNo !== 'Not available'
        ? student.regNo
        : (savedUser || 'Student'));

  const studentDisplayName = formatTitleCase(rawName) || 'Student';

  // Dynamic Claude-inspired greeting state (checks time of day + playful return variations)
  const [greeting, setGreeting] = useState<string>(() => getSessionGreeting(studentDisplayName));

  useEffect(() => {
    setGreeting(getSessionGreeting(studentDisplayName));
  }, [studentDisplayName]);

  // Auto-refresh greeting when the time period transitions or tab regains visibility
  useEffect(() => {
    const checkGreetingPeriod = () => {
      const currentPeriod = getTimePeriod(new Date().getHours());
      if (!isGreetingValidForPeriod(greeting, currentPeriod)) {
        const fresh = getSessionGreeting(studentDisplayName, true);
        setGreeting(fresh);
      }
    };

    // Periodically re-evaluate (every 60s)
    const interval = setInterval(checkGreetingPeriod, 60 * 1000);

    // Also check when tab becomes visible again
    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        checkGreetingPeriod();
      }
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    return () => {
      clearInterval(interval);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    };
  }, [greeting, studentDisplayName]);

  const handleCycleGreeting = () => {
    const next = cycleNextGreeting(greeting, studentDisplayName);
    setGreeting(next);
    try {
      const currentPeriod = getTimePeriod(new Date().getHours());
      sessionStorage.setItem(
        `campus_session_greeting_${studentDisplayName}`,
        JSON.stringify({
          greeting: next,
          period: currentPeriod,
          date: new Date().toDateString(),
          timestamp: Date.now(),
        })
      );
    } catch (e) {}
  };

  const teamsConnected = Boolean(teamsAccount?.connected);
  const teamsFailed = Boolean(teamsAccount?.status === 'failed' || teamsAccount?.failed);

  const lmsConnected = Boolean(lmsAccount?.connected);
  const lmsFailed = Boolean(lmsAccount?.status === 'failed' || lmsAccount?.failed);

  const pendingAssignments = assignments.filter((a) => {
    let isDone = Boolean(a.isDone || a.isSubmitted);
    const st = (a.displayStatus || a.status || '').toUpperCase().trim();
    if (st === 'DONE' || st === 'SUBMITTED' || st === 'COMPLETED') {
      isDone = true;
    }
    if (typeof window !== 'undefined') {
      try {
        const reg = student?.regNo || window.localStorage.getItem('campus_current_reg_no') || 'default';
        const raw = window.localStorage.getItem(`campus_manual_assignment_status_${reg}`);
        if (raw) {
          const overrides = JSON.parse(raw);
          if (a.id && overrides[a.id] !== undefined) isDone = overrides[a.id];
          else if (a.title && overrides[a.title] !== undefined) isDone = overrides[a.title];
          else if (a.id && a.id.startsWith('unified-')) {
            for (const p of a.id.replace('unified-', '').split('-')) {
              if (p && overrides[p] !== undefined) {
                isDone = overrides[p];
                break;
              }
            }
          }
        }
      } catch (e) {}
    }
    return !isDone;
  });

  // --- Live Dynamic Data for Bento Grid Hub ---
  // 1. Live Hostel Details
  const [hostelDetails, setHostelDetails] = useState<HostelDetails | null>(null);

  useEffect(() => {
    let isMounted = true;
    CampusAPI.getHostelDetails()
      .then((data) => {
        if (isMounted && data) {
          setHostelDetails(data);
        }
      })
      .catch((err) => {
        console.warn('[DashboardView] Could not load hostel details:', err);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const activeHostelInfo = {
    gender: hostelDetails?.hostelInfo?.gender || student?.gender || 'Male',
    blockName: hostelDetails?.hostelInfo?.blockName || student?.blockName || '',
    roomNo: hostelDetails?.hostelInfo?.roomNo || student?.roomNo || '',
    messInfo: hostelDetails?.hostelInfo?.messInfo || student?.messInfo || '',
    isHosteller: hostelDetails?.hostelInfo?.isHosteller ?? student?.isHosteller,
  };

  const rawBlock = activeHostelInfo.blockName || '';
  const rawRoom = activeHostelInfo.roomNo || '';
  const rawMess = activeHostelInfo.messInfo || '';

  // Presence of an allotted block or room means the student is a hosteller
  const hasHostelAllotment = Boolean(
    (rawBlock && rawBlock.trim() && !rawBlock.toLowerCase().includes('day scholar')) ||
    (rawRoom && rawRoom.trim() && !rawRoom.toLowerCase().includes('day scholar'))
  );

  const isHosteller = hasHostelAllotment || Boolean(activeHostelInfo.isHosteller ?? false);

  const getCleanBlockName = (block?: string | null, hosteller?: boolean | null): string => {
    if (block && block.trim() && !block.toLowerCase().includes('day scholar')) {
      const clean = block.trim();
      const parenMatch = clean.match(/\(\s*([A-Za-z0-9]+)\s*-\s*Block\s*\)/i);
      if (parenMatch) return `Block ${parenMatch[1].toUpperCase()}`;
      const blockLetterMatch = clean.match(/\b([A-Za-z0-9]+)\s+Block\b/i);
      if (blockLetterMatch) return `Block ${blockLetterMatch[1].toUpperCase()}`;
      const letterBlockMatch = clean.match(/\bBlock\s+([A-Za-z0-9]+)\b/i);
      if (letterBlockMatch) return `Block ${letterBlockMatch[1].toUpperCase()}`;
      if (clean.length <= 16) return clean;
      const firstWord = clean.split(' ')[0];
      return firstWord ? `Block ${firstWord.toUpperCase()}` : 'Hostel';
    }
    if (hosteller === false) return 'Day Scholar';
    return 'Hostel';
  };

  const getCleanRoom = (room?: string | null, hosteller?: boolean | null): string => {
    if (room && room.trim() && !room.toLowerCase().includes('day scholar')) {
      const clean = room.trim();
      return clean.toLowerCase().startsWith('room') ? clean : `Room ${clean}`;
    }
    if (hosteller === false) return 'Day Scholar';
    return 'Room Allotted';
  };

  const getCleanMessAndLeave = (
    mess?: string | null,
    hosteller?: boolean | null,
    leaveHistory?: any[]
  ): string => {
    if (mess && mess.trim() && !mess.toLowerCase().includes('transit')) {
      const upper = mess.toUpperCase();
      let messLabel = 'Mess Allotted';
      if (upper.includes('NON')) messLabel = 'Non-Veg Mess';
      else if (upper.includes('SPECIAL') || upper.includes('FOOD')) messLabel = 'Special Mess';
      else if (upper.includes('VEG')) messLabel = 'Veg Mess';
      else messLabel = mess.split('-')[0].trim();
      const hasApprovedLeave = leaveHistory?.some(
        (l) => l.status === 'REQUEST APPROVED' || l.status === 'APPROVED'
      );
      return `${messLabel} • ${hasApprovedLeave ? 'Pass Approved' : 'Pass Ready'}`;
    }
    if (hosteller === false) return 'Off-Campus • Transit Access';
    return 'Mess Allotted • Pass Ready';
  };

  const displayBlockName = getCleanBlockName(rawBlock, isHosteller);
  const displayRoom = getCleanRoom(rawRoom, isHosteller);
  const displayMessAndLeave = getCleanMessAndLeave(rawMess, isHosteller, hostelDetails?.leaveHistory);

  // 2. Pending Fee Balance Calculation
  const pendingDuesTotal = fees
    .filter((f) => f.status === 'Pending' || ((f.pendingAmount ?? 0) > 0))
    .reduce((sum, f) => sum + (f.pendingAmount ?? f.amount ?? 0), 0);

  // 4. AI Planner Tasks
  const highUrgencyTasks = aiTasks.filter((t) => t.urgency === 'HIGH');
  const examTasks = aiTasks.filter((t) => t.type === 'Exam Preparation');

  return (
    <div className="page-container">
      {/* 1. Header Greeting & Academic Overview Banner */}
      <div className="hero-card card-hover">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
          <div style={{ minWidth: 0, flex: '1 1 320px' }}>
            <div className="hero-eyebrow">
              <Sparkles size={14} color="var(--accent-emerald)" />
              <span style={{ color: 'var(--accent-emerald)', fontWeight: 700 }}>{isAuth ? 'VTOP VERIFIED SESSION' : 'OFFLINE MODE'}</span>
              <span>•</span>
              <span style={{ color: 'var(--text-muted)' }}>
                {student.program || 'UG'} • {student.semester ? `SEMESTER ${student.semester}` : 'SEMESTER FALL SEMESTER 2026-27'}
              </span>
            </div>

            <h1
              className="hero-heading interactive-heading"
              style={{
                fontSize: 'clamp(1.8rem, 3vw, 2.4rem)',
                margin: '4px 0 8px 0',
                cursor: 'pointer',
                userSelect: 'none',
              }}
              onClick={handleCycleGreeting}
              title="Click to shuffle intro greeting"
            >
              {greeting}
            </h1>
            <p className="hero-desc">
              Your centralized academic cockpit tracking class routines, 75% attendance defense buffers, and multi-portal assignments.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexShrink: 0 }}>
            <button
              onClick={onSync || onOpenSyncModal}
              disabled={syncing}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              title="Sync latest academic data directly from VTOP and connected platforms"
            >
              <RefreshCw size={15} className={syncing ? 'animate-spin' : ''} />
              <span>{syncing ? 'Syncing...' : 'Sync VTOP Hub'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Bento Grid Interactive Hub (Spectrum UI 21st.dev / arihantcodes) */}
      <div className="w-full mb-6">
        <div className="flex items-center justify-between mb-3 px-1">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-2">
              <Sparkles size={14} className="text-emerald-400" />
              <span>CampusOS Bento Hub</span>
            </h2>
          </div>
          <span className="text-xs text-neutral-400 hidden sm:inline">
            Click any module to launch the complete system view
          </span>
        </div>

        <BentoGrid>
          {/* Card 1: VTOP Academics & Attendance (2 cols) */}
          <BentoCard
            colSpan={2}
            tilt={true}
            borderAnim={true}
            title="VTOP Academics & Attendance"
            description="Real-time 75% attendance defense buffer, class routines & verified CGPA"
            icon={<GraduationCap size={20} className="text-emerald-400" />}
            badge={
              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border flex items-center gap-1.5 ${
                cgpaDisplay !== 'Unavailable'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/25'
              }`}>
                <ShieldCheck size={12} /> {cgpaDisplay !== 'Unavailable' ? `${cgpaDisplay} CGPA` : 'Sync CGPA'}
              </span>
            }
            onClick={() => onSelectView?.('academics')}
            ctaText="Open Full Academics & Timetable"
          >
            <div className="grid grid-cols-3 gap-2 sm:gap-3 my-2 pt-1">
              <div className="p-3 rounded-xl bg-[#181818] border border-[#262626] flex flex-col justify-between">
                <div className="text-xs text-neutral-400 font-medium">Attendance</div>
                <div className="text-xl md:text-2xl font-bold font-mono text-emerald-400 mt-1">
                  {hasAttendance && attendance && attendance.percentage !== undefined ? `${attPct}%` : 'Unavailable'}
                </div>
                <div className="text-[11px] text-neutral-400 truncate mt-1">
                  {hasAttendance && hasAttCounts ? `${attAttended}/${attTotal} attended` : 'VTOP verified'}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[#181818] border border-[#262626] flex flex-col justify-between">
                <div className="text-xs text-neutral-400 font-medium">Cumulative CGPA</div>
                <div className="text-xl md:text-2xl font-bold font-mono text-white mt-1">
                  {cgpaDisplay}
                </div>
                <div className="text-[11px] text-neutral-400 truncate mt-1">
                  {student.rank ? `Rank #${student.rank}` : '10.0 Scale'}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[#181818] border border-[#262626] flex flex-col justify-between">
                <div className="text-xs text-neutral-400 font-medium">Credits Earned</div>
                <div className="text-xl md:text-2xl font-bold font-mono text-white mt-1">
                  {creditsDisplay}
                </div>
                <div className="text-[11px] text-neutral-400 truncate mt-1">
                  {creditsSubtext}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs px-1 pt-1 text-neutral-400">
              <span className="flex items-center gap-1.5 text-emerald-400 font-medium text-[11px] sm:text-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                75% Attendance Defense Buffer Active
              </span>
              <span className="text-[11px] text-neutral-400">
                {timetable.length} classes scheduled weekly
              </span>
            </div>
          </BentoCard>

          {/* Card 2: Assignments & Deadlines (2 cols) */}
          <BentoCard
            colSpan={2}
            tilt={true}
            title="Assignments & Deadlines"
            description="Unified Moodle LMS quizzes, Microsoft Teams tasks & submission status"
            icon={<ClipboardList size={20} className="text-blue-400" />}
            badge={
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/25 flex items-center gap-1.5">
                <Clock size={12} /> {pendingAssignments.length} Pending
              </span>
            }
            onClick={() => onSelectView?.('assignments')}
            ctaText="Manage All Assignments"
          >
            <div className="space-y-2 my-2">
              {pendingAssignments.length > 0 ? (
                pendingAssignments.slice(0, 2).map((item) => (
                  <div
                    key={item.id}
                    className="p-2.5 rounded-xl bg-[#181818] border border-[#262626] flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/30">
                          {item.courseCode || 'TASK'}
                        </span>
                        <span className="text-xs font-semibold text-white truncate">
                          {item.title}
                        </span>
                      </div>
                      <div className="text-[11px] text-neutral-400 mt-1 flex items-center gap-2">
                        <span>{item.source === 'TEAMS' ? 'Teams Assignment' : 'Moodle LMS'}</span>
                        <span>•</span>
                        <span className="text-amber-400 flex items-center gap-1">
                          <Clock size={10} /> Due {item.dueDate || '11:59 PM'}
                        </span>
                      </div>
                    </div>
                    <span className="text-xs text-neutral-400 shrink-0">Pending</span>
                  </div>
                ))
              ) : (
                <div className="p-3.5 rounded-xl bg-[#181818] border border-[#262626] text-center text-xs text-neutral-400">
                  All assignments up to date! Zero pending submissions.
                </div>
              )}
            </div>

            <div className="flex items-center justify-between text-xs px-1 pt-1 text-neutral-400">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1 text-[11px]">
                  <span className={`w-1.5 h-1.5 rounded-full ${teamsConnected ? 'bg-emerald-400' : 'bg-neutral-500'}`} />
                  Teams: {teamsConnected ? 'Synced' : 'Unlinked'}
                </span>
                <span className="flex items-center gap-1 text-[11px]">
                  <span className={`w-1.5 h-1.5 rounded-full ${lmsConnected ? 'bg-emerald-400' : 'bg-neutral-500'}`} />
                  LMS: {lmsConnected ? 'Synced' : 'Unlinked'}
                </span>
              </div>
              <span className="text-[11px] text-neutral-400">Synced across course hubs</span>
            </div>
          </BentoCard>

          {/* Card 3: Fees & Ledger (1 col) */}
          <BentoCard
            colSpan={1}
            tilt={true}
            title="Fees & Ledger"
            description="Tuition, hostel & mess balance"
            icon={<CreditCard size={20} className="text-amber-400" />}
            badge={
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                  pendingDuesTotal > 0
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/25'
                    : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25'
                }`}
              >
                {pendingDuesTotal > 0
                  ? `₹${pendingDuesTotal.toLocaleString('en-IN')} Due`
                  : fees.length > 0
                  ? `${fees.length} Receipts`
                  : 'Cleared'}
              </span>
            }
            onClick={() => onSelectView?.('fees')}
            ctaText="View Fee Receipts"
          >
            <div className="p-3 rounded-xl bg-[#181818] border border-[#262626] my-2">
              <div className="text-xs text-neutral-400">Pending Dues</div>
              <div
                className={`text-2xl font-bold font-mono mt-1 ${
                  pendingDuesTotal > 0 ? 'text-amber-400' : 'text-emerald-400'
                }`}
              >
                ₹{pendingDuesTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-[11px] text-neutral-400 mt-1 truncate">
                {pendingDuesTotal > 0
                  ? `${fees.length} receipts • Outstanding dues`
                  : fees.length > 0
                  ? `${fees.length} receipts verified`
                  : 'All semester receipts settled'}
              </div>
            </div>
          </BentoCard>

          {/* Card 4: LeetCode (1 col) */}
          <BentoCard
            colSpan={1}
            tilt={true}
            title="LeetCode"
            description="Problem statistics & topic practice"
            icon={<Code2 size={20} className="text-amber-400" />}
            badge={
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold border bg-amber-500/10 text-amber-400 border-amber-500/25">
                {typeof window !== 'undefined' && localStorage.getItem('campusos_leetcode_username')
                  ? `@${localStorage.getItem('campusos_leetcode_username')}`
                  : 'Link Account'}
              </span>
            }
            onClick={() => onSelectView?.('placements')}
            ctaText="Open LeetCode Hub"
          >
            <div className="p-3 rounded-xl bg-[#181818] border border-[#262626] my-2">
              <div className="text-xs text-neutral-400">
                {typeof window !== 'undefined' && localStorage.getItem('campusos_leetcode_username')
                  ? 'Connected Profile'
                  : 'LeetCode Account'}
              </div>
              <div className="text-xl sm:text-2xl font-bold font-mono text-white mt-1 truncate">
                {typeof window !== 'undefined' && localStorage.getItem('campusos_leetcode_username')
                  ? `@${localStorage.getItem('campusos_leetcode_username')}`
                  : 'Link Account'}
              </div>
              <div className="text-[11px] text-amber-300/80 mt-1 truncate">
                {typeof window !== 'undefined' && localStorage.getItem('campusos_leetcode_username')
                  ? 'Live problem statistics & contest matrix'
                  : 'Connect profile for algorithmic stats'}
              </div>
            </div>
          </BentoCard>

          {/* Card 5: Hostel & Living (1 col) */}
          <BentoCard
            colSpan={1}
            tilt={true}
            title="Hostel & Living"
            description="Room allotment, mess & leave pass"
            icon={<Building size={20} className="text-cyan-400" />}
            badge={
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                  !isHosteller
                    ? 'bg-blue-500/10 text-blue-400 border-blue-500/25'
                    : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/25'
                }`}
              >
                {displayBlockName}
              </span>
            }
            onClick={() => onSelectView?.('hostel')}
            ctaText="View Hostel Details"
          >
            <div className="p-3 rounded-xl bg-[#181818] border border-[#262626] my-2">
              <div className="text-xs text-neutral-400">
                {!isHosteller ? 'Campus Living' : 'Room & Mess'}
              </div>
              <div className="text-base sm:text-lg font-bold text-white mt-1 truncate">
                {displayRoom}
              </div>
              <div className="text-[11px] text-cyan-300/80 mt-1 truncate">
                {displayMessAndLeave}
              </div>
            </div>
          </BentoCard>

          {/* Card 6: AI Study Planner (1 col) */}
          <BentoCard
            colSpan={1}
            tilt={true}
            title="AI Study Planner"
            description="Predictive revision & daily schedule"
            icon={<BrainCircuit size={20} className="text-pink-400" />}
            badge={
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-pink-500/15 text-pink-400 border border-pink-500/30">
                {aiTasks && aiTasks.length > 0 ? `${aiTasks.length} Targets` : 'AI Active'}
              </span>
            }
            onClick={() => onSelectView?.('ai-planner')}
            ctaText="Launch AI Engine"
          >
            <div className="p-3 rounded-xl bg-[#181818] border border-[#262626] my-2">
              <div className="text-xs text-neutral-400">Study Engine</div>
              <div className="text-base sm:text-lg font-bold text-white mt-1 truncate">
                {aiTasks && aiTasks.length > 0 ? `${aiTasks.length} Tasks Ready` : 'Schedule Synced'}
              </div>
              <div className="text-[11px] text-pink-300/80 mt-1 truncate">
                {aiTasks && aiTasks.length > 0
                  ? highUrgencyTasks.length > 0
                    ? `${highUrgencyTasks.length} priority sprint${highUrgencyTasks.length > 1 ? 's' : ''} • Optimal buffer`
                    : examTasks.length > 0
                    ? `${examTasks.length} exam revision target${examTasks.length > 1 ? 's' : ''} • Buffer active`
                    : `${aiTasks.length} revision targets • Exam buffer on`
                  : 'All study targets on track'}
              </div>
            </div>
          </BentoCard>
        </BentoGrid>
      </div>

      {/* 3. Platform Integrations Row */}
      <div className="card card-hover">
        <div className="card-header-bar">
          <div>
            <h3 className="card-title">
              <Sparkles size={19} color="var(--accent-emerald)" />
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

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: '16px' }}>
          {/* Teams Integration Box */}
          <div
            className="hub-card card card-hover hover-trigger"
            style={{
              padding: '18px 20px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--surface-input)',
              border: teamsFailed ? '1px solid rgba(239, 68, 68, 0.35)' : '1px solid var(--border-card)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
              minWidth: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: '180px', flex: '1 1 180px' }}>
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
                <button
                  type="button"
                  onClick={onLinkTeams}
                  className="btn btn-secondary btn-sm"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '0 10px',
                    height: '28px',
                    fontSize: '0.74rem',
                    cursor: 'pointer',
                  }}
                  title="Reset or re-enter Microsoft Teams credentials"
                >
                  <RotateCcw size={12} />
                  <span>Reset</span>
                </button>
              </div>
            ) : (
              <button onClick={onLinkTeams} className="btn btn-secondary btn-sm" style={{ flexShrink: 0 }}>
                Link Teams
              </button>
            )}
          </div>

          {/* LMS Integration Box */}
          <div
            className="hub-card card card-hover hover-trigger"
            style={{
              padding: '18px 20px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--surface-input)',
              border: lmsFailed ? '1px solid rgba(239, 68, 68, 0.35)' : '1px solid var(--border-card)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
              minWidth: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: '180px', flex: '1 1 180px' }}>
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
                <button
                  type="button"
                  onClick={onLinkLMS}
                  className="btn btn-secondary btn-sm"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '0 10px',
                    height: '28px',
                    fontSize: '0.74rem',
                    cursor: 'pointer',
                  }}
                  title="Reset or re-enter Moodle LMS credentials"
                >
                  <RotateCcw size={12} />
                  <span>Reset</span>
                </button>
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
                Link LMS
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 4. Actionable Upcoming Deadlines & Urgencies */}
      {pendingAssignments.length > 0 && (
        <div className="card card-hover">
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
                className="card-hover"
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
                  <span style={{ fontSize: '0.76rem', fontFamily: 'var(--font-mono)', color: 'var(--accent-emerald)', fontWeight: 700 }}>
                    {item.courseCode || 'COURSE'}
                  </span>
                  <span className={`status-badge ${item.source === 'TEAMS' ? 'info' : 'warning'}`}>
                    {item.source === 'TEAMS' ? 'Teams' : 'Moodle LMS'}
                  </span>
                </div>

                <div style={{ fontSize: '0.96rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.title}
                </div>

                {(() => {
                  const isLms = item.source === 'LMS';
                  const rawPoster = (item as any).postedBy || (item as any).lmsProfessor || (item as any).facultyName || (item as any).faculty || (item as any).professor;
                  const pName = rawPoster && rawPoster !== 'LMS Instructor' && rawPoster !== 'Faculty unassigned'
                    ? rawPoster
                    : item.faculty || (item as any).facultyName || 'Faculty unassigned';
                  if (!pName || pName === 'Faculty unassigned' || pName === 'LMS Instructor') return null;
                  const formattedName = isLms && !pName.startsWith('Dr.') && !pName.startsWith('Prof.') ? `Prof. ${pName}` : pName;
                  return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.76rem', color: 'var(--accent-purple)' }}>
                      <User size={12} />
                      <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {formattedName}
                      </span>
                    </div>
                  );
                })()}

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
      <div className="card card-hover">
        <div className="card-header-bar">
          <div>
            <h3 className="card-title">
              <Calendar size={19} color="var(--accent-emerald)" />
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
              Enjoy your study break or use this free time to work on pending assignments.
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
