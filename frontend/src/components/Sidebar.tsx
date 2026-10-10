import React, { useState } from 'react';
import {
  LayoutDashboard,
  Percent,
  Award,
  BookOpen,
  Calendar,
  Layers,
  MessageSquare,
  CalendarDays,
  Briefcase,
  BrainCircuit,
  CreditCard,
  ShieldCheck,
  Settings,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  Clock,
  ChevronDown,
  FileText,
} from 'lucide-react';
import { AcademicsSubTab } from '../views/AcademicsView';
import { StudentProfile } from '../types';

export type NavView = 'dashboard' | 'academics' | 'assignments' | 'fees' | 'placements' | 'ai-planner';

interface SidebarProps {
  activeView: NavView;
  onSelectView: (view: NavView) => void;
  pendingAssignmentsCount: number;
  criticalAttendanceCount: number;
  academicsSubTab?: AcademicsSubTab;
  onSelectAcademicsSubTab?: (subTab: AcademicsSubTab) => void;
  onLogout?: () => void;
  onOpenAdmin?: () => void;
  onOpenFeatures?: () => void;
  student?: StudentProfile | null;
  onOpenProfile?: () => void;
  onOpenLMS?: () => void;
  onOpenTeams?: () => void;
  onOpenOD?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  onSelectView,
  pendingAssignmentsCount,
  criticalAttendanceCount,
  academicsSubTab = 'profile',
  onSelectAcademicsSubTab,
  onLogout,
  onOpenAdmin,
  onOpenFeatures,
  student,
  onOpenProfile,
  onOpenLMS,
  onOpenTeams,
  onOpenOD,
  isCollapsed: externalIsCollapsed,
  onToggleCollapse: externalToggleCollapse,
}) => {
  const [internalCollapsed, setInternalCollapsed] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('campusos_sidebar_collapsed') === 'true';
    }
    return false;
  });

  const isCollapsed = externalIsCollapsed !== undefined ? externalIsCollapsed : internalCollapsed;

  const handleToggleCollapse = () => {
    if (externalToggleCollapse) {
      externalToggleCollapse();
    } else {
      const next = !internalCollapsed;
      setInternalCollapsed(next);
      if (typeof window !== 'undefined') {
        localStorage.setItem('campusos_sidebar_collapsed', String(next));
      }
    }
  };

  const [isAcademicsExpanded, setIsAcademicsExpanded] = useState<boolean>(true);

  const formatTitleCase = (val: string): string => {
    if (!val) return '';
    const clean = val.trim();
    if (!clean) return '';
    const first = clean.split(' ')[0];
    if (/\d/.test(first)) return first.toUpperCase();
    return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
  };

  const savedUser = typeof window !== 'undefined' ? localStorage.getItem('campus_vtop_username') : '';
  const rawStudentName = (student?.name && student.name !== 'Student' && student.name !== 'Not connected')
    ? student.name
    : (student?.regNo && student.regNo !== 'Not available' ? student.regNo : (savedUser || 'Student'));

  const displayName = formatTitleCase(rawStudentName) || 'Student';
  const regNo = student?.regNo || (savedUser && /\d/.test(savedUser) ? savedUser.toUpperCase() : 'Sync Required');

  const avatarInitials = student?.name
    ? student.name
        .split(' ')
        .filter(Boolean)
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'OS';

  return (
    <aside
      className={`hidden lg:flex fixed left-0 top-0 h-full ${
        isCollapsed ? 'w-20' : 'w-64'
      } bg-surface-container-lowest border-r border-outline-variant/30 z-50 flex-col justify-between transition-all duration-200 select-none`}
      aria-label="Application Sidebar"
    >
      <div className="flex flex-col flex-1 min-h-0">
        {/* Top Brand Header */}
        <div className="h-16 px-4 border-b border-outline-variant/20 flex items-center justify-between shrink-0">
          <div
            className="flex items-center gap-2.5 cursor-pointer min-w-0"
            onClick={() => onSelectView('dashboard')}
            title="CampusOS Dashboard"
          >
            {isCollapsed ? (
              <img
                src="/campusos-emblem.png"
                alt="CampusOS Emblem"
                className="w-8 h-8 object-contain shrink-0"
              />
            ) : (
              <img
                src="/logo.png"
                alt="CampusOS - Unified platform"
                className="h-9 w-auto object-contain max-w-[170px]"
              />
            )}
          </div>

          {!isCollapsed ? (
            <div className="flex items-center gap-1.5">
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-surface-container text-on-surface-variant font-label-sm text-[11px] font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
                <span>Fall 24</span>
              </div>
              <button
                type="button"
                onClick={handleToggleCollapse}
                className="text-outline hover:text-on-surface p-1 rounded hover:bg-surface-container transition-colors"
                title="Collapse sidebar"
              >
                <PanelLeftClose size={15} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleToggleCollapse}
              className="text-outline hover:text-on-surface p-1 rounded hover:bg-surface-container transition-colors mx-auto"
              title="Expand sidebar"
            >
              <PanelLeftOpen size={16} />
            </button>
          )}
        </div>

        {/* Scrollable Navigation Groups */}
        <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
          {/* SECTION 1: ACADEMICS */}
          <div className="space-y-1">
            {!isCollapsed && (
              <div className="flex items-center justify-between px-2 py-1 font-label-sm text-[11px] uppercase tracking-wider text-outline font-semibold">
                <span>Academics</span>
                <button
                  type="button"
                  onClick={() => setIsAcademicsExpanded(!isAcademicsExpanded)}
                  className="text-outline hover:text-on-surface"
                >
                  <ChevronDown
                    size={13}
                    className={`transition-transform duration-200 ${isAcademicsExpanded ? '' : '-rotate-90'}`}
                  />
                </button>
              </div>
            )}

            <nav className="space-y-0.5">
              {/* Dashboard */}
              <button
                type="button"
                onClick={() => onSelectView('dashboard')}
                title={isCollapsed ? 'Academic Dashboard' : undefined}
                className={`w-full flex items-center ${
                  isCollapsed ? 'justify-center px-0' : 'gap-2.5 px-2.5'
                } py-2 transition-colors font-label-md text-label-md rounded text-left ${
                  activeView === 'dashboard'
                    ? 'bg-primary-container text-on-primary font-semibold shadow-sm'
                    : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                }`}
              >
                <LayoutDashboard size={18} className="shrink-0" />
                {!isCollapsed && <span>Dashboard</span>}
              </button>

              {(!isCollapsed ? isAcademicsExpanded : true) && (
                <>
                  {/* Attendance */}
                  <button
                    type="button"
                    onClick={() => {
                      onSelectView('academics');
                      onSelectAcademicsSubTab?.('attendance');
                    }}
                    title={isCollapsed ? 'Attendance Safety Engine' : undefined}
                    className={`w-full flex items-center ${
                      isCollapsed ? 'justify-center px-0' : 'justify-between px-2.5'
                    } py-2 transition-colors font-label-md text-label-md rounded text-left ${
                      activeView === 'academics' && academicsSubTab === 'attendance'
                        ? 'bg-primary-container text-on-primary font-semibold shadow-sm'
                        : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Percent size={18} className="shrink-0" />
                      {!isCollapsed && <span>Attendance</span>}
                    </div>
                    {!isCollapsed && (
                      <span className="font-tabular-data text-[11px] font-semibold text-secondary bg-secondary-fixed/50 px-1.5 py-0.5 rounded">
                        {criticalAttendanceCount > 0 ? `${criticalAttendanceCount} Critical` : 'Safe'}
                      </span>
                    )}
                  </button>

                  {/* Assignments */}
                  <button
                    type="button"
                    onClick={() => onSelectView('assignments')}
                    title={isCollapsed ? 'Assignments & Coursework' : undefined}
                    className={`w-full flex items-center ${
                      isCollapsed ? 'justify-center px-0' : 'justify-between px-2.5'
                    } py-2 transition-colors font-label-md text-label-md rounded text-left ${
                      activeView === 'assignments'
                        ? 'bg-primary-container text-on-primary font-semibold shadow-sm'
                        : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <FileText size={18} className="shrink-0" />
                      {!isCollapsed && <span>Assignments</span>}
                    </div>
                    {!isCollapsed && pendingAssignmentsCount > 0 && (
                      <span className="font-tabular-data text-[11px] font-semibold text-primary bg-primary-fixed px-1.5 py-0.5 rounded">
                        {pendingAssignmentsCount} Due
                      </span>
                    )}
                  </button>

                  {/* Marks Ledger */}
                  <button
                    type="button"
                    onClick={() => {
                      onSelectView('academics');
                      onSelectAcademicsSubTab?.('marks');
                    }}
                    title={isCollapsed ? 'Marks Ledger' : undefined}
                    className={`w-full flex items-center ${
                      isCollapsed ? 'justify-center px-0' : 'gap-2.5 px-2.5'
                    } py-2 transition-colors font-label-md text-label-md rounded text-left ${
                      activeView === 'academics' && academicsSubTab === 'marks'
                        ? 'bg-primary-container text-on-primary font-semibold shadow-sm'
                        : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                    }`}
                  >
                    <Award size={18} className="shrink-0" />
                    {!isCollapsed && <span>Marks Ledger</span>}
                  </button>

                  {/* Timetable */}
                  <button
                    type="button"
                    onClick={() => {
                      onSelectView('academics');
                      onSelectAcademicsSubTab?.('timetable');
                    }}
                    title={isCollapsed ? 'Class Timetable' : undefined}
                    className={`w-full flex items-center ${
                      isCollapsed ? 'justify-center px-0' : 'gap-2.5 px-2.5'
                    } py-2 transition-colors font-label-md text-label-md rounded text-left ${
                      activeView === 'academics' && academicsSubTab === 'timetable'
                        ? 'bg-primary-container text-on-primary font-semibold shadow-sm'
                        : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                    }`}
                  >
                    <Calendar size={18} className="shrink-0" />
                    {!isCollapsed && <span>Timetable</span>}
                  </button>

                  {/* Registered Courses */}
                  <button
                    type="button"
                    onClick={() => {
                      onSelectView('academics');
                      onSelectAcademicsSubTab?.('courses');
                    }}
                    title={isCollapsed ? 'Registered Courses' : undefined}
                    className={`w-full flex items-center ${
                      isCollapsed ? 'justify-center px-0' : 'gap-2.5 px-2.5'
                    } py-2 transition-colors font-label-md text-label-md rounded text-left ${
                      activeView === 'academics' && academicsSubTab === 'courses'
                        ? 'bg-primary-container text-on-primary font-semibold shadow-sm'
                        : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                    }`}
                  >
                    <BookOpen size={18} className="shrink-0" />
                    {!isCollapsed && <span>Courses</span>}
                  </button>
                </>
              )}
            </nav>
          </div>

          {/* SECTION 2: CAMPUS OPERATIONS */}
          <div className="space-y-1">
            {!isCollapsed && (
              <div className="px-2 py-1 font-label-sm text-[11px] uppercase tracking-wider text-outline font-semibold">
                Campus Operations
              </div>
            )}
            <nav className="space-y-0.5">
              {/* LMS Coursework */}
              <button
                type="button"
                onClick={onOpenLMS || (() => onSelectView('assignments'))}
                title={isCollapsed ? 'LMS Coursework Hub' : undefined}
                className={`w-full flex items-center ${
                  isCollapsed ? 'justify-center px-0' : 'justify-between px-2.5'
                } py-2 transition-colors font-label-md text-label-md rounded text-left ${
                  activeView === 'assignments'
                    ? 'bg-primary-container text-on-primary font-semibold shadow-sm'
                    : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Layers size={18} className="shrink-0" />
                  {!isCollapsed && <span>LMS Coursework</span>}
                </div>
                {!isCollapsed && pendingAssignmentsCount > 0 && (
                  <span className="font-tabular-data text-[11px] font-semibold text-primary bg-primary-fixed px-1.5 py-0.5 rounded">
                    {pendingAssignmentsCount} Due
                  </span>
                )}
              </button>

              {/* Microsoft Teams */}
              <button
                type="button"
                onClick={onOpenTeams || (() => onSelectView('assignments'))}
                title={isCollapsed ? 'Teams & Collaboration' : undefined}
                className="w-full flex items-center justify-between px-2.5 py-2 transition-colors font-label-md text-label-md rounded text-left text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
              >
                <div className="flex items-center gap-2.5">
                  <MessageSquare size={18} className="shrink-0" />
                  {!isCollapsed && <span>Teams Hub</span>}
                </div>
              </button>

              {/* Master Calendar */}
              <button
                type="button"
                onClick={() => {
                  onSelectView('academics');
                  onSelectAcademicsSubTab?.('calendar');
                }}
                title={isCollapsed ? 'Academic Master Calendar' : undefined}
                className={`w-full flex items-center ${
                  isCollapsed ? 'justify-center px-0' : 'gap-2.5 px-2.5'
                } py-2 transition-colors font-label-md text-label-md rounded text-left ${
                  activeView === 'academics' && academicsSubTab === 'calendar'
                    ? 'bg-primary-container text-on-primary font-semibold shadow-sm'
                    : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                }`}
              >
                <CalendarDays size={18} className="shrink-0" />
                {!isCollapsed && <span>Master Calendar</span>}
              </button>

              {/* OD / Leave Requests */}
              <button
                type="button"
                onClick={onOpenOD || (() => onSelectView('academics'))}
                title={isCollapsed ? 'On-Duty & Leave Requests' : undefined}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 transition-colors font-label-md text-label-md rounded text-left text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
              >
                <Clock size={18} className="shrink-0" />
                {!isCollapsed && <span>OD / Leave</span>}
              </button>

              {/* Fees & Ledger */}
              <button
                type="button"
                onClick={() => onSelectView('fees')}
                title={isCollapsed ? 'Financial Ledger & Dues' : undefined}
                className={`w-full flex items-center ${
                  isCollapsed ? 'justify-center px-0' : 'gap-2.5 px-2.5'
                } py-2 transition-colors font-label-md text-label-md rounded text-left ${
                  activeView === 'fees'
                    ? 'bg-primary-container text-on-primary font-semibold shadow-sm'
                    : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                }`}
              >
                <CreditCard size={18} className="shrink-0" />
                {!isCollapsed && <span>Fees & Dues</span>}
              </button>

              {/* Placements & Coding Benchmarks */}
              <button
                type="button"
                onClick={() => onSelectView('placements')}
                title={isCollapsed ? 'Placement Hub & LeetCode Benchmarks' : undefined}
                className={`w-full flex items-center ${
                  isCollapsed ? 'justify-center px-0' : 'gap-2.5 px-2.5'
                } py-2 transition-colors font-label-md text-label-md rounded text-left ${
                  activeView === 'placements'
                    ? 'bg-primary-container text-on-primary font-semibold shadow-sm'
                    : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                }`}
              >
                <Briefcase size={18} className="shrink-0" />
                {!isCollapsed && <span>Placements</span>}
              </button>
            </nav>
          </div>

          {/* SECTION 3: INTELLIGENCE & TOOLS */}
          <div className="space-y-1">
            {!isCollapsed && (
              <div className="px-2 py-1 font-label-sm text-[11px] uppercase tracking-wider text-outline font-semibold">
                Intelligence & Tools
              </div>
            )}
            <nav className="space-y-0.5">
              {/* AI Study Planner */}
              <button
                type="button"
                onClick={() => onSelectView('ai-planner')}
                title={isCollapsed ? 'AI Study Planner' : undefined}
                className={`w-full flex items-center ${
                  isCollapsed ? 'justify-center px-0' : 'justify-between px-2.5'
                } py-2 transition-colors font-label-md text-label-md rounded text-left ${
                  activeView === 'ai-planner'
                    ? 'bg-primary-container text-on-primary font-semibold shadow-sm'
                    : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <BrainCircuit size={18} className="shrink-0" />
                  {!isCollapsed && <span>AI Study Planner</span>}
                </div>
                {!isCollapsed && (
                  <span className="font-label-sm text-[10px] font-bold text-primary bg-primary-fixed px-1.5 py-0.5 rounded uppercase tracking-wider">
                    AI
                  </span>
                )}
              </button>

              {/* Performance Analytics */}
              {onOpenAdmin && (
                <button
                  type="button"
                  onClick={onOpenAdmin}
                  title={isCollapsed ? 'Institutional Analytics' : undefined}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 transition-colors font-label-md text-label-md rounded text-left text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
                >
                  <ShieldCheck size={18} className="shrink-0" />
                  {!isCollapsed && <span>Institutional Meta</span>}
                </button>
              )}

              {/* Settings */}
              {onOpenFeatures && (
                <button
                  type="button"
                  onClick={onOpenFeatures}
                  title={isCollapsed ? 'Settings & Readiness' : undefined}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 transition-colors font-label-md text-label-md rounded text-left text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
                >
                  <Settings size={18} className="shrink-0" />
                  {!isCollapsed && <span>Readiness Status</span>}
                </button>
              )}
            </nav>
          </div>
        </div>
      </div>

      {/* Footer Block */}
      <div className="p-2 border-t border-outline-variant/20 bg-surface-container-lowest shrink-0 space-y-2">
        {/* VTOP Direct Sync Pod */}
        {!isCollapsed ? (
          <div className="p-2 rounded bg-surface-container-low border border-outline-variant/30 flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-2 h-2 rounded-full bg-secondary shrink-0 animate-pulse" />
              <div className="flex flex-col min-w-0">
                <span className="font-label-sm text-[11px] font-semibold text-on-surface truncate">
                  VTOP Direct Sync
                </span>
                <span className="font-label-sm text-[10px] text-outline truncate font-tabular-data">
                  Active • Auto-syncs every 6h
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={onOpenLMS}
              className="text-on-surface-variant hover:text-on-surface p-1 rounded hover:bg-surface-container transition-colors shrink-0"
              title="Verify Auth Status"
            >
              <RefreshCw size={13} />
            </button>
          </div>
        ) : (
          <div className="flex justify-center p-1.5" title="VTOP Direct Sync Active">
            <div className="w-2.5 h-2.5 rounded-full bg-secondary animate-pulse" />
          </div>
        )}

        {/* User Profile Pill */}
        <div
          onClick={onOpenProfile}
          className={`flex items-center ${
            isCollapsed ? 'justify-center p-1' : 'justify-between px-2 py-1.5'
          } rounded-lg hover:bg-surface-container-low cursor-pointer transition-colors border border-transparent hover:border-outline-variant/20`}
          title={isCollapsed ? `${displayName} (${regNo})` : 'Student Profile & Settings'}
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-on-primary text-[11px] font-bold shrink-0">
              {avatarInitials}
            </div>
            {!isCollapsed && (
              <div className="flex flex-col min-w-0">
                <span className="font-label-sm text-[12px] font-semibold text-on-surface leading-tight truncate">
                  {displayName}
                </span>
                <span className="font-label-sm text-[10px] text-outline font-tabular-data truncate">
                  {regNo}
                </span>
              </div>
            )}
          </div>
          {!isCollapsed && onLogout && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onLogout();
              }}
              className="text-outline hover:text-error p-1 rounded hover:bg-error/10 transition-colors"
              title="Sign Out"
              aria-label="Sign Out"
            >
              <LogOut size={14} />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
};
