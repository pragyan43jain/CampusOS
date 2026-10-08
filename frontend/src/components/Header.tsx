import React, { useState } from 'react';
import {
  RefreshCw,
  Bell,
  Menu,
} from 'lucide-react';
import { StudentProfile } from '../types';
import { ThemeSwitcher, THEMES, ThemeType, ThemeOption } from './ThemeSwitcher';
import { RollText } from './ui/RollText';
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
}) => {
  const [isNotifOpen, setIsNotifOpen] = useState<boolean>(false);

  const formatTitleCase = (val: string): string => {
    if (!val) return '';
    const clean = val.trim();
    if (!clean) return '';
    const first = clean.split(' ')[0];
    if (/\d/.test(first)) return first.toUpperCase();
    return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
  };

  const getGreeting = (): string => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const savedUser = typeof window !== 'undefined' ? localStorage.getItem('campus_vtop_username') : '';
  const rawStudentName = (student?.name && student.name !== 'Student' && student.name !== 'Not connected')
    ? student.name
    : (student?.regNo && student.regNo !== 'Not available'
        ? student.regNo
        : (savedUser || 'Student'));

  const studentDisplayName = formatTitleCase(rawStudentName) || 'Student';
  const studentRegNo = student?.regNo || (savedUser && /\d/.test(savedUser) ? savedUser.toUpperCase() : 'Sync Required');

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

  const getSupportingText = (): string => {
    switch (activeView) {
      case 'dashboard':
        return 'Here is your academic overview for today.';
      case 'academics':
        return 'Course registry, live attendance margins, and examination marks.';
      case 'assignments':
        return 'Pending coursework and unified assignment submissions.';
      case 'fees':
        return 'University financial dues and payment receipts.';
      case 'placements':
        return 'Placement readiness and DSA algorithmic benchmarks.';
      case 'ai-planner':
        return 'AI-powered syllabus and study workload roadmap.';
      default:
        return 'University student academic workspace.';
    }
  };

  return (
    <header className="app-header">
      {/* Left: Greeting & Academic Supporting Context */}
      <div className="header-left-block">
        {onToggleMobileMenu && (
          <button
            onClick={onToggleMobileMenu}
            className="mobile-hamburger-btn"
            aria-label="Open Navigation Drawer"
          >
            <Menu size={18} />
          </button>
        )}
        <div className="header-greeting-block">
          <h1 className="header-greeting-title">
            {getGreeting()}, <span className="header-greeting-name">{studentDisplayName}</span>
          </h1>
          <p className="header-greeting-sub">
            {getSupportingText()}
          </p>
        </div>
      </div>

      {/* Right: Actions, Notifications, Sync, Theme, Profile */}
      <div className="header-right-actions">
        {/* Live Sync Action */}
        <button
          type="button"
          className="header-action-btn sync-btn"
          onClick={onSync || onOpenVtopModal}
          disabled={syncing}
          title={syncing ? 'Synchronizing university records...' : 'Sync with VTOP portal'}
        >
          <RefreshCw size={14} className={syncing ? 'animate-spin text-blue-500' : ''} />
          <span className="sync-btn-text">
            <RollText text={syncing ? 'Syncing...' : 'Sync'} />
          </span>
        </button>

        {/* Notifications Button with Dropdown Panel */}
        <div className="relative">
          <button
            type="button"
            className="header-action-icon-btn notif-btn"
            onClick={() => setIsNotifOpen(!isNotifOpen)}
            title="Notifications"
            aria-label="Notifications"
          >
            <Bell size={16} />
            {unreadNotifCount > 0 && (
              <span className="header-notif-dot" />
            )}
          </button>

          <NotificationPanel
            isOpen={isNotifOpen}
            onClose={() => setIsNotifOpen(false)}
            onNavigate={onNavigate}
            attendanceCount={criticalAttendanceCount}
            pendingAssignmentsCount={pendingAssignmentsCount}
            lastSyncedTime={student?.lastSynced}
          />
        </div>

        {/* Theme Switcher Dropdown */}
        {onSelectTheme && (
          <ThemeSwitcher
            currentTheme={currentTheme}
            onSelectTheme={onSelectTheme}
          />
        )}

        <div className="header-vertical-divider" />

        {/* User Profile Capsule */}
        <div
          className="header-profile-capsule"
          onClick={onOpenProfileModal || onOpenVtopModal}
          title="Student Profile & Settings"
          role="button"
          tabIndex={0}
        >
          <div className="header-profile-avatar">
            {avatarInitials}
          </div>
          <div className="header-profile-info">
            <span className="header-profile-name">{studentDisplayName}</span>
            <span className="header-profile-reg">{studentRegNo}</span>
          </div>
        </div>
      </div>
    </header>
  );
};
