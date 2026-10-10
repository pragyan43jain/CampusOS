import React, { useState } from 'react';
import {
  RefreshCw,
  Bell,
  Menu,
  Search,
  CheckCircle2,
  Calendar,
  ChevronDown,
  User,
} from 'lucide-react';
import { StudentProfile } from '../types';
import { ThemeSwitcher, THEMES, ThemeType, ThemeOption } from './ThemeSwitcher';
import { NotificationPanel } from './NotificationPanel';

export { THEMES, ThemeSwitcher };
export type { ThemeType, ThemeOption };

interface HeaderProps {
  student: StudentProfile | null;
  activeView: string;
  currentTheme?: ThemeType;
  onSelectTheme?: (t: ThemeType) => void;
  onRefresh?: () => void;
  onSync?: () => void;
  onOpenVtopModal: () => void;
  onOpenProfileModal?: () => void;
  syncing: boolean;
  onToggleMobileMenu?: () => void;
  onLogout?: () => void;
  onOpenFeatures?: () => void;
  pendingAssignmentsCount?: number;
  criticalAttendanceCount?: number;
  onNavigate?: (view: string, subTab?: string) => void;
  isCollapsed?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  student,
  activeView,
  currentTheme = 'cyber-dark',
  onSelectTheme,
  onSync,
  onOpenVtopModal,
  onOpenProfileModal,
  syncing,
  onToggleMobileMenu,
  pendingAssignmentsCount = 0,
  criticalAttendanceCount = 0,
  onNavigate,
  isCollapsed = false,
}) => {
  const [isNotifOpen, setIsNotifOpen] = useState<boolean>(false);
  const [isSemesterMenuOpen, setIsSemesterMenuOpen] = useState<boolean>(false);
  const [selectedSemester, setSelectedSemester] = useState<string>('Fall 2026-27');

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
    : (student?.regNo && student.regNo !== 'Not available'
        ? student.regNo
        : (savedUser || 'Student'));

  const studentDisplayName = formatTitleCase(rawStudentName) || 'Student';
  const studentRegNo = student?.regNo || (savedUser && /\d/.test(savedUser) ? savedUser.toUpperCase() : '24BLC1100');

  const avatarInitials = student?.name
    ? student.name
        .split(' ')
        .filter(Boolean)
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'OS';

  const unreadNotifCount = (pendingAssignmentsCount > 0 ? 1 : 0) + (criticalAttendanceCount > 0 ? 1 : 0) + 1;

  const getViewBreadcrumb = (): string => {
    switch (activeView) {
      case 'dashboard':
        return 'Dashboard';
      case 'academics':
        return 'Academic Ledger';
      case 'assignments':
        return 'LMS & Coursework';
      case 'fees':
        return 'Fees & Ledger';
      case 'placements':
        return 'Placement Hub';
      case 'ai-planner':
        return 'AI Study Planner';
      default:
        return 'Overview';
    }
  };

  const getDisplayBranch = (): string => {
    const raw = student?.branch || '';
    if (raw && !/school|vidyalaya|academy|board/i.test(raw)) {
      return raw;
    }
    const reg = (student?.regNo || '').toUpperCase();
    if (reg.includes('BLC')) return 'B.Tech ECE (VLSI)';
    if (reg.includes('BCE')) return 'B.Tech CSE';
    if (reg.includes('BCN')) return 'B.Tech CSE (Networks)';
    if (reg.includes('BAI')) return 'B.Tech CSE (AI & ML)';
    if (reg.includes('BDS')) return 'B.Tech CSE (Data Science)';
    if (reg.includes('BEE')) return 'B.Tech EEE';
    if (reg.includes('BME')) return 'B.Tech ME';
    return student?.program || 'B.Tech';
  };

  return (
    <header className={`fixed top-0 left-0 ${isCollapsed ? 'lg:left-20' : 'lg:left-64'} right-0 h-16 bg-surface-container-lowest/90 backdrop-blur-md border-b border-outline-variant/30 z-40 px-4 md:px-6 flex items-center justify-between transition-all duration-200`}>
      {/* Left: Hamburger (mobile), Breadcrumbs, Search Bar */}
      <div className="flex items-center gap-3 md:gap-4 min-w-0">
        {onToggleMobileMenu && (
          <button
            onClick={onToggleMobileMenu}
            className="lg:hidden p-1.5 rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors"
            aria-label="Open Navigation Drawer"
          >
            <Menu size={20} />
          </button>
        )}

        {/* Academic Breadcrumb Trail */}
        <div className="flex items-center gap-1.5 font-label-md text-label-md text-outline truncate text-[13px]">
          <span
            onClick={() => onNavigate?.('dashboard')}
            className="hover:text-on-surface transition-colors cursor-pointer font-medium flex items-center gap-1.5"
          >
            <img src="/campusos-emblem.png" alt="CampusOS" className="w-4 h-4 object-contain lg:hidden shrink-0" />
            <span>CampusOS</span>
          </span>
          <span className="text-outline-variant font-normal">/</span>
          <span className="text-on-surface font-semibold hidden sm:inline">
            {getDisplayBranch()}
          </span>
          <span className="text-outline-variant font-normal hidden sm:inline">/</span>
          <span className="text-primary font-semibold truncate">
            {getViewBreadcrumb()}
          </span>
        </div>

        {/* Global Search Bar (with ⌘K) */}
        <div className="hidden lg:flex items-center gap-2 bg-surface-container px-3 py-1.5 rounded border border-outline-variant/20 text-outline w-72 focus-within:border-primary/40 focus-within:ring-1 focus-within:ring-primary/20 transition-all">
          <Search size={16} className="text-on-surface-variant shrink-0" />
          <input
            type="text"
            placeholder="Search courses, faculty, slots..."
            className="bg-transparent border-none text-body-sm text-[13px] text-on-surface placeholder:text-outline focus:outline-none w-full"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                onNavigate?.('academics', 'courses');
              }
            }}
          />
          <kbd className="font-label-sm text-[10px] bg-surface-container-lowest px-1.5 py-0.5 rounded border border-outline-variant/40 text-outline shadow-sm shrink-0 font-tabular-data">
            ⌘K
          </kbd>
        </div>
      </div>

      {/* Right: Actions, Live Sync, Notifications, Semester, Theme, User */}
      <div className="flex items-center gap-2 md:gap-3 shrink-0">
        {/* VTOP Live Status Badge & Sync Action */}
        <button
          type="button"
          onClick={onSync || onOpenVtopModal}
          disabled={syncing}
          className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded bg-secondary-fixed/40 border border-secondary-fixed text-on-secondary-fixed font-label-sm text-[11px] font-semibold hover:bg-secondary-fixed/60 transition-colors shadow-sm disabled:opacity-70"
          title={syncing ? 'Synchronizing university records...' : 'Sync with VTOP portal'}
        >
          <RefreshCw size={13} className={`text-secondary ${syncing ? 'animate-spin' : ''}`} />
          <span>{syncing ? 'Syncing...' : 'VTOP Live'}</span>
        </button>

        {/* Notification Bell */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsNotifOpen((prev) => !prev)}
            className="relative p-2 rounded hover:bg-surface-container text-on-surface-variant hover:text-on-surface transition-colors"
            title="Notifications & Academic Alerts"
            aria-label="View notifications"
          >
            <Bell size={18} />
            {unreadNotifCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-error ring-2 ring-surface-container-lowest" />
            )}
          </button>
          <NotificationPanel
            isOpen={isNotifOpen}
            onClose={() => setIsNotifOpen(false)}
            pendingAssignmentsCount={pendingAssignmentsCount}
            attendanceCount={criticalAttendanceCount}
            onNavigate={(view, tab) => {
              setIsNotifOpen(false);
              onNavigate?.(view, tab);
            }}
          />
        </div>

        {/* Semester Selector Pill */}
        <div className="relative hidden md:block">
          <button
            type="button"
            onClick={() => setIsSemesterMenuOpen((prev) => !prev)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-outline-variant/40 hover:bg-surface-container text-on-surface-variant hover:text-on-surface font-label-md text-[12px] transition-colors"
          >
            <Calendar size={14} className="text-outline" />
            <span>{selectedSemester}</span>
            <ChevronDown size={13} className="text-outline" />
          </button>

          {isSemesterMenuOpen && (
            <div className="absolute right-0 mt-1 w-44 bg-surface-container-lowest border border-outline-variant/30 rounded-lg shadow-lg py-1 z-50">
              {['Fall 2026-27', 'Winter 2025-26', 'Fall 2025-26'].map((sem) => (
                <button
                  key={sem}
                  type="button"
                  onClick={() => {
                    setSelectedSemester(sem);
                    setIsSemesterMenuOpen(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-[12px] font-label-md flex items-center justify-between hover:bg-surface-container transition-colors ${
                    selectedSemester === sem ? 'text-primary font-semibold' : 'text-on-surface'
                  }`}
                >
                  <span>{sem}</span>
                  {selectedSemester === sem && <CheckCircle2 size={13} className="text-primary" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Theme Switcher */}
        {onSelectTheme && (
          <ThemeSwitcher
            currentTheme={currentTheme}
            onSelectTheme={onSelectTheme}
          />
        )}

        <div className="h-6 w-px bg-outline-variant/30 hidden sm:block" />

        {/* Student Identity Pod */}
        <div
          onClick={onOpenProfileModal}
          className="flex items-center gap-2 cursor-pointer p-1 rounded-lg hover:bg-surface-container transition-colors"
          title="Student Profile & Settings"
        >
          <div className="flex flex-col text-right hidden md:block">
            <span className="font-label-md text-[13px] text-on-surface font-semibold leading-tight">
              {studentDisplayName}
            </span>
            <span className="font-label-sm text-[10px] text-outline font-tabular-data">
              {studentRegNo}
            </span>
          </div>
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-on-primary text-[12px] font-bold shadow-sm">
            {avatarInitials || <User size={15} />}
          </div>
        </div>
      </div>
    </header>
  );
};
