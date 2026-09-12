import React, { useState } from 'react';
import {
  RefreshCw,
  Smartphone,
  CheckCircle2,
  Menu,
  X,
  LogOut,
} from 'lucide-react';
import { StudentProfile } from '../types';
import { ThemeSwitcher, THEMES, ThemeType, ThemeOption } from './ThemeSwitcher';

export { THEMES, ThemeSwitcher };
export type { ThemeType, ThemeOption };

interface HeaderProps {
  student: StudentProfile;
  activeView: string;
  currentTheme?: ThemeType;
  onSelectTheme?: (t: ThemeType) => void;
  onRefresh?: () => void;
  onSync?: () => void;
  onOpenVtopModal: () => void;
  syncing: boolean;
  onToggleMobileMenu?: () => void;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  student,
  activeView,
  currentTheme = 'cyber-dark',
  onSelectTheme,
  onSync,
  onOpenVtopModal,
  syncing,
  onToggleMobileMenu,
  onLogout,
}) => {
  const [showAppModal, setShowAppModal] = useState<boolean>(false);

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
  const rawStudentName = (student?.name && student.name !== 'Student' && student.name !== 'Not connected')
    ? student.name
    : (student?.regNo && student.regNo !== 'Not available'
        ? student.regNo
        : (savedUser || 'Student'));

  const studentDisplayName = formatTitleCase(rawStudentName) || 'Student';
  const studentRegNo = student?.regNo || (savedUser && /\d/.test(savedUser) ? savedUser.toUpperCase() : 'Sync Required');
  const studentProgram = student?.program || 'VIT Chennai';
  const studentSemester = student?.semester ? `Semester ${student.semester}` : 'Fall Semester 2026-27';

  const avatarInitials = student?.name
    ? student.name
        .split(' ')
        .filter(Boolean)
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'OS';

  const formatViewTitle = (view: string) => {
    switch (view) {
      case 'dashboard':
        return 'Dashboard';
      case 'academics':
        return 'Academics';
      case 'assignments':
        return 'Assignments';
      case 'fees':
        return 'Fees & Ledger';
      case 'placements':
        return 'Placements & DSA';
      case 'ai-planner':
        return 'AI Study Planner';
      default:
        return view.replace('-', ' ');
    }
  };

  return (
    <>
      <header className="app-header">
        <div className="header-left-block">
          {onToggleMobileMenu && (
            <button
              onClick={onToggleMobileMenu}
              className="mobile-hamburger-btn btn btn-ghost btn-sm"
              aria-label="Open Actions Drawer"
            >
              <Menu size={20} />
            </button>
          )}
          <div className="header-title-group">
            <h1 className="header-page-title">{formatViewTitle(activeView)}</h1>
            <div className="header-context-meta">
              <span className="header-context-program">{studentProgram}</span>
              <span className="header-context-separator">•</span>
              <span className="header-context-sem">{studentSemester}</span>
            </div>
          </div>
        </div>

        <div className="header-right-actions">
          {/* Direct Live Sync Button */}
          <button
            className="btn btn-primary header-sync-btn"
            onClick={onSync || onOpenVtopModal}
            disabled={syncing}
            title={syncing ? "Synchronizing academic data..." : "Sync latest grades, attendance, timetable & assignments directly"}
          >
            <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
            <span className="sync-btn-label">{syncing ? 'Syncing...' : 'Sync'}</span>
          </button>

          {/* Theme Switcher Button & Dropdown */}
          {onSelectTheme && (
            <ThemeSwitcher
              currentTheme={currentTheme}
              onSelectTheme={onSelectTheme}
            />
          )}

          <div className="header-divider desktop-only-inline" />

          {/* User Profile Capsule */}
          <div
            className="user-profile-capsule"
            onClick={onOpenVtopModal}
            title="Manage VTOP Portal Session & Credentials"
          >
            <div className="user-avatar-circle">{avatarInitials}</div>
            <div className="user-profile-text-block">
              <span className="user-profile-name">
                {studentDisplayName}
              </span>
              <span className="user-profile-reg">
                {studentRegNo}
              </span>
            </div>
          </div>

          {/* Sign Out Button (Desktop Only) */}
          {onLogout && (
            <button
              className="header-logout-btn desktop-only-inline"
              onClick={onLogout}
              title="Sign out of current session"
              aria-label="Sign out"
            >
              <LogOut size={14} />
            </button>
          )}
        </div>
      </header>

      {/* App Coming Soon Modal */}
      {showAppModal && (
        <div className="modal-backdrop" onClick={() => setShowAppModal(false)}>
          <div className="modal-content-glass" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div className="modal-header-row">
              <div className="brand-icon-box" style={{ width: '38px', height: '38px' }}>
                <Smartphone size={18} />
              </div>
              <button
                onClick={() => setShowAppModal(false)}
                className="btn btn-ghost btn-sm"
                style={{ padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            <div>
              <span className="status-badge info" style={{ marginBottom: '8px' }}>
                Development Preview
              </span>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                CampusOS Mobile App
              </h2>
              <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Native mobile builds for iOS and Android featuring offline timetable widgets, real-time attendance safety alerts, and automated LMS assignment sync.
              </p>
            </div>

            <div style={{ background: 'var(--surface-input)', border: '1px solid var(--border-secondary)', borderRadius: 'var(--radius-md)', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.86rem', fontWeight: 700, color: 'var(--accent-cyan)' }}>
                <CheckCircle2 size={16} />
                <span>Beta Testing in Progress</span>
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Register for early TestFlight and APK access via student portal notification.
              </p>
            </div>

            <button
              onClick={() => setShowAppModal(false)}
              className="btn btn-primary"
              style={{ width: '100%' }}
            >
              <span>Got it</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
};
