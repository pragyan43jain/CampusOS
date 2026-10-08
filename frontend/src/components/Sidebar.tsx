import React, { useState } from 'react';
import {
  LayoutDashboard,
  Percent,
  Award,
  BookOpen,
  Calendar,
  Users,
  Layers,
  MessageSquare,
  CalendarDays,
  Briefcase,
  Code2,
  BrainCircuit,
  CreditCard,
  ShieldCheck,
  Settings,
  LogOut,
  ChevronDown,
  PanelLeftClose,
  PanelLeftOpen,
  Zap,
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
      className={`app-sidebar ${isCollapsed ? 'collapsed' : ''}`}
      aria-label="Application Sidebar"
    >
      {/* Brand Header */}
      <div className="sidebar-brand-block">
        <div
          className="brand-clickable"
          onClick={() => onSelectView('dashboard')}
          title={isCollapsed ? 'CampusOS Dashboard' : undefined}
        >
          <div className="brand-icon-box">
            <Zap size={18} strokeWidth={2.2} />
          </div>
          {!isCollapsed && (
            <div className="brand-info">
              <span className="brand-title">
                Campus<span className="brand-title-os">OS</span>
              </span>
              <span className="brand-subtitle">Academic Operating System</span>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={handleToggleCollapse}
          className="sidebar-collapse-toggle-btn"
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
        </button>
      </div>

      {/* Navigation Groups */}
      <nav className="sidebar-nav-list" aria-label="Main Navigation">
        {/* SECTION: OVERVIEW */}
        <div className="sidebar-group-block">
          {!isCollapsed && <div className="sidebar-section-header">OVERVIEW</div>}
          <button
            type="button"
            className={`nav-item-btn ${activeView === 'dashboard' ? 'active' : ''}`}
            onClick={() => onSelectView('dashboard')}
            title={isCollapsed ? 'Dashboard' : undefined}
          >
            <div className="nav-item-left">
              <LayoutDashboard size={17} strokeWidth={activeView === 'dashboard' ? 2.2 : 1.8} />
              {!isCollapsed && <span>Dashboard</span>}
            </div>
          </button>
        </div>

        {/* SECTION: ACADEMICS */}
        <div className="sidebar-group-block">
          {!isCollapsed && (
            <div
              className="sidebar-section-header clickable flex items-center justify-between"
              onClick={() => setIsAcademicsExpanded(!isAcademicsExpanded)}
            >
              <span>ACADEMICS</span>
              <ChevronDown
                size={12}
                className={`transition-transform duration-200 ${isAcademicsExpanded ? '' : '-rotate-90'}`}
              />
            </div>
          )}

          {(!isCollapsed ? isAcademicsExpanded : true) && (
            <>
              {/* Attendance */}
              <button
                type="button"
                className={`nav-item-btn ${activeView === 'academics' && academicsSubTab === 'attendance' ? 'active' : ''}`}
                onClick={() => {
                  onSelectView('academics');
                  onSelectAcademicsSubTab?.('attendance');
                }}
                title={isCollapsed ? 'Attendance' : undefined}
              >
                <div className="nav-item-left">
                  <Percent size={17} strokeWidth={activeView === 'academics' && academicsSubTab === 'attendance' ? 2.2 : 1.8} />
                  {!isCollapsed && <span>Attendance</span>}
                </div>
                {!isCollapsed && criticalAttendanceCount > 0 && (
                  <span className="nav-badge-pill alert">{criticalAttendanceCount}</span>
                )}
              </button>

              {/* Marks */}
              <button
                type="button"
                className={`nav-item-btn ${activeView === 'academics' && academicsSubTab === 'marks' ? 'active' : ''}`}
                onClick={() => {
                  onSelectView('academics');
                  onSelectAcademicsSubTab?.('marks');
                }}
                title={isCollapsed ? 'Marks' : undefined}
              >
                <div className="nav-item-left">
                  <Award size={17} strokeWidth={activeView === 'academics' && academicsSubTab === 'marks' ? 2.2 : 1.8} />
                  {!isCollapsed && <span>Marks</span>}
                </div>
              </button>

              {/* Courses */}
              <button
                type="button"
                className={`nav-item-btn ${activeView === 'academics' && academicsSubTab === 'courses' ? 'active' : ''}`}
                onClick={() => {
                  onSelectView('academics');
                  onSelectAcademicsSubTab?.('courses');
                }}
                title={isCollapsed ? 'Courses' : undefined}
              >
                <div className="nav-item-left">
                  <BookOpen size={17} strokeWidth={activeView === 'academics' && academicsSubTab === 'courses' ? 2.2 : 1.8} />
                  {!isCollapsed && <span>Courses</span>}
                </div>
              </button>

              {/* Timetable */}
              <button
                type="button"
                className={`nav-item-btn ${activeView === 'academics' && academicsSubTab === 'timetable' ? 'active' : ''}`}
                onClick={() => {
                  onSelectView('academics');
                  onSelectAcademicsSubTab?.('timetable');
                }}
                title={isCollapsed ? 'Timetable' : undefined}
              >
                <div className="nav-item-left">
                  <Calendar size={17} strokeWidth={activeView === 'academics' && academicsSubTab === 'timetable' ? 2.2 : 1.8} />
                  {!isCollapsed && <span>Timetable</span>}
                </div>
              </button>

              {/* Faculty */}
              <button
                type="button"
                className={`nav-item-btn ${activeView === 'academics' && academicsSubTab === 'faculty' ? 'active' : ''}`}
                onClick={() => {
                  onSelectView('academics');
                  onSelectAcademicsSubTab?.('faculty');
                }}
                title={isCollapsed ? 'Faculty' : undefined}
              >
                <div className="nav-item-left">
                  <Users size={17} strokeWidth={activeView === 'academics' && academicsSubTab === 'faculty' ? 2.2 : 1.8} />
                  {!isCollapsed && <span>Faculty</span>}
                </div>
              </button>
            </>
          )}
        </div>

        {/* SECTION: CAMPUS */}
        <div className="sidebar-group-block">
          {!isCollapsed && <div className="sidebar-section-header">CAMPUS</div>}

          {/* Assignments / LMS */}
          <button
            type="button"
            className={`nav-item-btn ${activeView === 'assignments' ? 'active' : ''}`}
            onClick={onOpenLMS || (() => onSelectView('assignments'))}
            title={isCollapsed ? 'Assignments & LMS' : undefined}
          >
            <div className="nav-item-left">
              <Layers size={17} strokeWidth={activeView === 'assignments' ? 2.2 : 1.8} />
              {!isCollapsed && <span>LMS & Coursework</span>}
            </div>
            {!isCollapsed && pendingAssignmentsCount > 0 && (
              <span className="nav-badge-pill">{pendingAssignmentsCount}</span>
            )}
          </button>

          {/* Teams Modal Trigger / Hub */}
          <button
            type="button"
            className="nav-item-btn"
            onClick={onOpenTeams || (() => onSelectView('assignments'))}
            title={isCollapsed ? 'Microsoft Teams' : undefined}
          >
            <div className="nav-item-left">
              <MessageSquare size={17} strokeWidth={1.8} />
              {!isCollapsed && <span>Microsoft Teams</span>}
            </div>
          </button>

          {/* Academic Calendar / Events */}
          <button
            type="button"
            className={`nav-item-btn ${activeView === 'academics' && academicsSubTab === 'calendar' ? 'active' : ''}`}
            onClick={() => {
              onSelectView('academics');
              onSelectAcademicsSubTab?.('calendar');
            }}
            title={isCollapsed ? 'Academic Calendar & Events' : undefined}
          >
            <div className="nav-item-left">
              <CalendarDays size={17} strokeWidth={1.8} />
              {!isCollapsed && <span>Events & Calendar</span>}
            </div>
          </button>

          {/* Fees & Ledger */}
          <button
            type="button"
            className={`nav-item-btn ${activeView === 'fees' ? 'active' : ''}`}
            onClick={() => onSelectView('fees')}
            title={isCollapsed ? 'Fees & Ledger' : undefined}
          >
            <div className="nav-item-left">
              <CreditCard size={17} strokeWidth={activeView === 'fees' ? 2.2 : 1.8} />
              {!isCollapsed && <span>Fees & Ledger</span>}
            </div>
          </button>
        </div>

        {/* SECTION: CAREER */}
        <div className="sidebar-group-block">
          {!isCollapsed && <div className="sidebar-section-header">CAREER</div>}

          {/* Placement Drives */}
          <button
            type="button"
            className={`nav-item-btn ${activeView === 'placements' ? 'active' : ''}`}
            onClick={() => onSelectView('placements')}
            title={isCollapsed ? 'Placement Hub' : undefined}
          >
            <div className="nav-item-left">
              <Briefcase size={17} strokeWidth={activeView === 'placements' ? 2.2 : 1.8} />
              {!isCollapsed && <span>Placement Hub</span>}
            </div>
          </button>

          {/* LeetCode Tracker */}
          <button
            type="button"
            className={`nav-item-btn ${activeView === 'placements' ? 'active' : ''}`}
            onClick={() => onSelectView('placements')}
            title={isCollapsed ? 'LeetCode Tracker' : undefined}
          >
            <div className="nav-item-left">
              <Code2 size={17} strokeWidth={1.8} />
              {!isCollapsed && <span>LeetCode DSA</span>}
            </div>
          </button>

          {/* AI Study Planner */}
          <button
            type="button"
            className={`nav-item-btn ${activeView === 'ai-planner' ? 'active' : ''}`}
            onClick={() => onSelectView('ai-planner')}
            title={isCollapsed ? 'AI Study Planner' : undefined}
          >
            <div className="nav-item-left">
              <BrainCircuit size={17} strokeWidth={activeView === 'ai-planner' ? 2.2 : 1.8} />
              {!isCollapsed && <span>AI Study Planner</span>}
            </div>
            {!isCollapsed && (
              <span className="nav-badge-pill ai-badge">AI</span>
            )}
          </button>
        </div>

        {/* SECTION: TOOLS */}
        <div className="sidebar-group-block">
          {!isCollapsed && <div className="sidebar-section-header">TOOLS</div>}

          {onOpenAdmin && (
            <button
              type="button"
              className="nav-item-btn"
              onClick={onOpenAdmin}
              title={isCollapsed ? 'Admin Analytics' : undefined}
            >
              <div className="nav-item-left">
                <ShieldCheck size={17} strokeWidth={1.8} />
                {!isCollapsed && <span>Analytics</span>}
              </div>
            </button>
          )}

          {onOpenFeatures && (
            <button
              type="button"
              className="nav-item-btn"
              onClick={onOpenFeatures}
              title={isCollapsed ? 'Settings & Feature Readiness' : undefined}
            >
              <div className="nav-item-left">
                <Settings size={17} strokeWidth={1.8} />
                {!isCollapsed && <span>Settings</span>}
              </div>
            </button>
          )}
        </div>
      </nav>

      {/* User Profile Footer */}
      <div className="sidebar-footer-block">
        <div
          className="sidebar-user-pill"
          onClick={onOpenProfile}
          title={isCollapsed ? `${displayName} (${regNo})` : 'View Profile & Settings'}
        >
          <div className="sidebar-user-avatar">
            {avatarInitials}
          </div>
          {!isCollapsed && (
            <div className="sidebar-user-info">
              <span className="sidebar-user-name">{displayName}</span>
              <span className="sidebar-user-reg">{regNo}</span>
            </div>
          )}
          {!isCollapsed && onLogout && (
            <button
              type="button"
              className="sidebar-user-logout-btn"
              onClick={(e) => {
                e.stopPropagation();
                onLogout();
              }}
              title="Sign Out"
              aria-label="Sign Out"
            >
              <LogOut size={15} />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
};
